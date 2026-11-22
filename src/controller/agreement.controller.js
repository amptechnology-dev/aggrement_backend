const mongoose = require("mongoose");
const AgreementModel = require("../model/agreement.model.js");
const TenantModel = require("../model/tenant.model.js");
const StallModel = require("../model/stall.model.js");
const OwnerModel = require("../model/owner.model.js");
const OwnerSettingsModel = require("../model/ownerSettings.model.js");
const CounterModel = require("../model/counter.model.js");
const { createAgreementSchema } = require("../schema/agreement.schema.js");
const { normalizeTerm, getOrCreateSettings } = require("../helper/ownerSettings.js");
const {
  buildSchedule,
  getEndDate,
  todayUtc,
  toIso,
} = require("../helper/rentSchedule.js");
const sendError = require("../helper/sendError.js");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const RULE_KEYS = [
  "lateFineAmountPerDay",
  "lateFineAfterDay",
  "validityYears",
  "rentIncreaseEveryYears",
  "rentIncreasePercent",
  "stallCannotCloseForDays",
  "noticePeriodMonths",
];

const toDto = (a, withSchedule = false) => {
  const schedule = buildSchedule({
    monthlyRent: a.monthlyRent,
    effectiveFrom: a.effectiveFrom,
    endDate: a.endDate,
    everyYears: a.rentIncreaseEveryYears,
    percent: a.rentIncreasePercent,
  });

  // ISO string (YYYY-MM-DD) তুলনা করলে তারিখের ক্রমই পাওয়া যায়
  const today = toIso(todayUtc());
  const current =
    schedule.find((p) => p.from <= today && today <= p.to) ||
    (today < schedule[0].from ? schedule[0] : schedule[schedule.length - 1]);

  return {
    id: a._id,
    agreementNo: a.agreementNo,
    status: a.status,
    isExpired: a.status === "ACTIVE" && toIso(a.endDate) < today,
    agreementDate: toIso(a.agreementDate),
    effectiveFrom: toIso(a.effectiveFrom),
    endDate: toIso(a.endDate),
    office: a.office,
    tenant: { id: a.tenantId, ...a.tenant },
    stall: { id: a.stallId, propertyId: a.propertyId, ...a.stall },
    monthlyRent: a.monthlyRent,
    currentRent: current.monthlyRent,
    depositAmount: a.depositAmount,
    lateFineAmountPerDay: a.lateFineAmountPerDay,
    lateFineAfterDay: a.lateFineAfterDay,
    validityYears: a.validityYears,
    rentIncreaseEveryYears: a.rentIncreaseEveryYears,
    rentIncreasePercent: a.rentIncreasePercent,
    stallCannotCloseForDays: a.stallCannotCloseForDays,
    noticePeriodMonths: a.noticePeriodMonths,
    terms: a.terms,
    schedule: withSchedule ? schedule : undefined,
    terminatedAt: a.terminatedAt ?? null,
    terminationReason: a.terminationReason ?? null,
    owner:
      a.ownerId && a.ownerId._id
        ? { id: a.ownerId._id, name: a.ownerId.name, phone: a.ownerId.phone }
        : null,
    createdAt: a.createdAt,
  };
};

const scopeFilter = (req) =>
  req.user.role === "OWNER" ? { ownerId: req.user._id } : {};

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid agreement id" });

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Agreement not found" });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const nextAgreementNo = async (ownerId, year) => {
  const counter = await CounterModel.findOneAndUpdate(
    { key: `agreement:${ownerId}:${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `AGR-${year}-${String(counter.seq).padStart(4, "0")}`;
};

// মেয়াদ পেরোনো ACTIVE agreement থাকলে সেটাকে EXPIRED করে stall খালি করে
const releaseIfExpired = async (stallId) => {
  const expired = await AgreementModel.findOneAndUpdate(
    { stallId, status: "ACTIVE", endDate: { $lt: todayUtc() } },
    { $set: { status: "EXPIRED" } },
  );
  if (expired) {
    await StallModel.updateOne({ _id: stallId }, { $set: { status: "VACANT" } });
  }
};

// নতুন term গুলো library-তে জমা করে, কতগুলো নতুন সেভ হলো সেটা ফেরত দেয়
const saveNewTerms = async (ownerId, savedTerms, terms) => {
  const known = new Set(savedTerms.map((t) => normalizeTerm(t.text)));
  const fresh = [];
  terms.forEach((text) => {
    const key = normalizeTerm(text);
    if (!known.has(key)) {
      known.add(key);
      fresh.push({ text });
    }
  });
  if (fresh.length) {
    await OwnerSettingsModel.updateOne(
      { ownerId },
      { $push: { savedTerms: { $each: fresh } } },
    );
  }
  return fresh.length;
};

/**
 * Owner -> Agreement create
 */
const createAgreement = async (req, res) => {
  let claimedStallId = null;
  let created = null;

  try {
    const data = createAgreementSchema.parse(req.body);
    const ownerId = req.user._id;

    const [tenant, stall, settings, ownerProfile] = await Promise.all([
      TenantModel.findOne({ _id: data.tenantId, ownerId }).lean(),
      StallModel.findOne({ _id: data.stallId, ownerId })
        .populate({
          path: "propertyId",
          select: "name address city state pin isActive",
        })
        .lean(),
      getOrCreateSettings(ownerId),
      OwnerModel.findOne({ userId: ownerId }).select("address").lean(),
    ]);

    if (!tenant) return fail(res, 404, "Tenant not found");
    if (!tenant.isActive) return fail(res, 400, "This tenant is inactive");
    if (!stall || !stall.propertyId) return fail(res, 404, "Stall not found");
    if (!stall.isActive) return fail(res, 400, "This stall is inactive");

    const property = stall.propertyId;
    if (!property.isActive) return fail(res, 400, "This property is inactive");

    if (stall.status === "OCCUPIED") await releaseIfExpired(stall._id);

    // stall-কে atomically দখল করি, দুজন একসাথে করলেও একজনই পাবে
    const claim = await StallModel.findOneAndUpdate(
      { _id: stall._id, ownerId, status: "VACANT", isActive: true },
      { $set: { status: "OCCUPIED" } },
    );
    if (!claim) {
      return fail(res, 409, "This stall already has an active agreement");
    }
    claimedStallId = stall._id;

    // body-তে না থাকলে settings-এর মান
    const rules = {};
    RULE_KEYS.forEach((key) => {
      rules[key] = data[key] !== undefined ? data[key] : settings[key];
    });

    const endDate = getEndDate(data.effectiveFrom, rules.validityYears);
    const year = data.agreementDate.getUTCFullYear();
    const agreementNo = await nextAgreementNo(ownerId, year);

    created = await AgreementModel.create({
      ownerId,
      agreementNo,
      tenantId: tenant._id,
      tenantUserId: tenant.userId,
      stallId: stall._id,
      propertyId: property._id,
      agreementDate: data.agreementDate,
      effectiveFrom: data.effectiveFrom,
      endDate,
      office: {
        name: data.officeName || settings.officeName || req.user.name,
        address: data.officeAddress || settings.officeAddress || ownerProfile?.address || "-",
      },
      tenant: {
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        guardianName: tenant.guardianName,
        guardianRelation: data.guardianRelation,
        voterCardNo: data.voterCardNo,
        address: tenant.address,
      },
      stall: {
        stallNo: stall.stallNo,
        propertyName: property.name,
        propertyAddress: `${property.address}, ${property.city}, ${property.state} - ${property.pin}`,
      },
      monthlyRent: data.monthlyRent,
      depositAmount: data.depositAmount,
      ...rules,
      terms: data.terms,
    });

    // tenant-এ ভোটার/সম্পর্ক না থাকলে এখান থেকে ভরে দাও
    const backfill = {};
    if (!tenant.voterCardNo) backfill.voterCardNo = data.voterCardNo;
    if (!tenant.guardianRelation) backfill.guardianRelation = data.guardianRelation;
    if (Object.keys(backfill).length) {
      await TenantModel.updateOne({ _id: tenant._id }, { $set: backfill }).catch(
        (e) => console.error("Tenant backfill error:", e),
      );
    }

    let newTermsSaved = 0;
    try {
      newTermsSaved = await saveNewTerms(ownerId, settings.savedTerms, data.terms);
    } catch (e) {
      console.error("Save terms error:", e);
    }

    return res.status(201).json({
      success: true,
      message: "Agreement created successfully",
      newTermsSaved,
      agreement: toDto(created.toObject(), true),
    });
  } catch (error) {
    // agreement না হলে stall আবার খালি করে দাও
    if (claimedStallId && !created) {
      await StallModel.updateOne(
        { _id: claimedStallId },
        { $set: { status: "VACANT" } },
      ).catch(() => {});
    }
    if (error.code === 11000) {
      return fail(res, 409, "This stall already has an active agreement");
    }
    return sendError(res, error, "createAgreement error");
  }
};

/**
 * Agreement list
 * ?search= &status= &propertyId= &tenantId= &stallId= &ownerId= (ownerId শুধু SUPER_ADMIN)
 */
const getAgreements = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = String(req.query.search || "").trim();
    const { status, propertyId, tenantId, stallId, ownerId } = req.query;

    const filter = scopeFilter(req);

    if (req.user.role === "SUPER_ADMIN" && mongoose.isValidObjectId(ownerId)) {
      filter.ownerId = ownerId;
    }
    if (["ACTIVE", "TERMINATED", "EXPIRED"].includes(status)) filter.status = status;
    if (mongoose.isValidObjectId(propertyId)) filter.propertyId = propertyId;
    if (mongoose.isValidObjectId(tenantId)) filter.tenantId = tenantId;
    if (mongoose.isValidObjectId(stallId)) filter.stallId = stallId;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { agreementNo: rx },
        { "tenant.name": rx },
        { "tenant.phone": rx },
        { "stall.stallNo": rx },
        { "stall.propertyName": rx },
      ];
    }

    const [agreements, total] = await Promise.all([
      AgreementModel.find(filter)
        .populate({ path: "ownerId", select: "name phone" })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AgreementModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      agreements: agreements.map((a) => toDto(a)),
    });
  } catch (error) {
    return sendError(res, error, "getAgreements error");
  }
};

/**
 * Single agreement (rent schedule সহ)
 */
const getAgreementById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const agreement = await AgreementModel.findOne({ _id: id, ...scopeFilter(req) })
      .populate({ path: "ownerId", select: "name phone" })
      .lean();

    if (!agreement) return notFound(res);

    return res.status(200).json({ success: true, agreement: toDto(agreement, true) });
  } catch (error) {
    return sendError(res, error, "getAgreementById error");
  }
};

/**
 * Agreement terminate -> stall VACANT
 */
const terminateAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";

    const agreement = await AgreementModel.findOneAndUpdate(
      { _id: id, ownerId: req.user._id, status: "ACTIVE" },
      {
        $set: {
          status: "TERMINATED",
          terminatedAt: new Date(),
          terminationReason: reason,
          terminatedBy: req.user._id,
        },
      },
      { new: true },
    ).lean();

    if (!agreement) {
      const exists = await AgreementModel.exists({ _id: id, ownerId: req.user._id });
      return exists ? fail(res, 400, "This agreement is not active") : notFound(res);
    }

    await StallModel.updateOne(
      { _id: agreement.stallId },
      { $set: { status: "VACANT" } },
    );

    return res.status(200).json({
      success: true,
      message: "Agreement terminated. The stall is vacant again.",
    });
  } catch (error) {
    return sendError(res, error, "terminateAgreement error");
  }
};

module.exports = {
  createAgreement,
  getAgreements,
  getAgreementById,
  terminateAgreement,
  toDto,
};