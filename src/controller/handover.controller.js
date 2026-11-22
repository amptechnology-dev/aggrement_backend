const mongoose = require("mongoose");
const HandoverModel = require("../model/handover.model.js");
const AgreementModel = require("../model/agreement.model.js");
const StallModel = require("../model/stall.model.js");
const {
  createHandoverSchema,
  updateHandoverSchema,
} = require("../schema/handover.schema.js");
const { toIso } = require("../helper/rentSchedule.js");
const sendError = require("../helper/sendError.js");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toDto = (h) => ({
  id: h._id,
  agreementId: h.agreementId,
  agreementNo: h.agreementNo,
  tenant: { id: h.tenantId, name: h.tenantName },
  stall: {
    id: h.stallId,
    propertyId: h.propertyId,
    stallNo: h.stallNo,
    propertyName: h.propertyName,
  },
  numberOfKeys: h.numberOfKeys,
  handoverDate: toIso(h.handoverDate),
  remarks: h.remarks || "",
  owner:
    h.ownerId && h.ownerId.name
      ? { id: h.ownerId._id, name: h.ownerId.name, phone: h.ownerId.phone }
      : null,
  createdAt: h.createdAt,
  updatedAt: h.updatedAt,
});

const scopeFilter = (req) =>
  req.user.role === "OWNER" ? { ownerId: req.user._id } : {};

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const invalidId = (res) => fail(res, 400, "Invalid handover id");
const notFound = (res) => fail(res, 404, "Handover not found");

const DUPLICATE_MESSAGE = "Handover is already recorded for this agreement";
const DATE_MESSAGE = "Handover date cannot be before the agreement date";

/**
 * Owner -> Handover create
 */
const createHandover = async (req, res) => {
  try {
    const data = createHandoverSchema.parse(req.body);
    const ownerId = req.user._id;

    const agreement = await AgreementModel.findOne({
      _id: data.agreementId,
      ownerId,
    }).lean();

    if (!agreement) return fail(res, 404, "Agreement not found");
    if (agreement.status !== "ACTIVE") {
      return fail(res, 400, "Handover can be recorded only for an active agreement");
    }
    if (data.handoverDate < agreement.agreementDate) {
      return fail(res, 400, DATE_MESSAGE);
    }

    const already = await HandoverModel.exists({ agreementId: agreement._id });
    if (already) return fail(res, 409, DUPLICATE_MESSAGE);

    const created = await HandoverModel.create({
      ownerId,
      agreementId: agreement._id,
      tenantId: agreement.tenantId,
      tenantUserId: agreement.tenantUserId,
      stallId: agreement.stallId,
      propertyId: agreement.propertyId,
      agreementNo: agreement.agreementNo,
      tenantName: agreement.tenant.name,
      stallNo: agreement.stall.stallNo,
      propertyName: agreement.stall.propertyName,
      numberOfKeys: data.numberOfKeys,
      handoverDate: data.handoverDate,
      remarks: data.remarks || "",
      handedOverBy: ownerId,
    });

    return res.status(201).json({
      success: true,
      message: "Handover recorded successfully",
      handover: toDto({
        ...created.toObject(),
        ownerId: { _id: req.user._id, name: req.user.name, phone: req.user.phone },
      }),
    });
  } catch (error) {
    // dujon ekshonge submit korle unique index dhore felbe
    if (error.code === 11000) return fail(res, 409, DUPLICATE_MESSAGE);
    return sendError(res, error, "createHandover error");
  }
};

/**
 * Handover list
 * ?search= &propertyId= &tenantId=
 */
const getHandovers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = String(req.query.search || "").trim();
    const { propertyId, tenantId } = req.query;

    const filter = scopeFilter(req);

    if (mongoose.isValidObjectId(propertyId)) filter.propertyId = propertyId;
    if (mongoose.isValidObjectId(tenantId)) filter.tenantId = tenantId;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { agreementNo: rx },
        { tenantName: rx },
        { stallNo: rx },
        { propertyName: rx },
      ];
    }

    const [handovers, total] = await Promise.all([
      HandoverModel.find(filter)
        .populate({ path: "ownerId", select: "name phone" })
        .sort({ handoverDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HandoverModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      handovers: handovers.map(toDto),
    });
  } catch (error) {
    return sendError(res, error, "getHandovers error");
  }
};

/**
 * Jei ACTIVE agreement-er handover ekhono hoy ni (form-er dropdown-er jonno)
 */
const getEligibleAgreements = async (req, res) => {
  try {
    const ownerId = req.user._id;

    const handedIds = await HandoverModel.distinct("agreementId", { ownerId });

    const agreements = await AgreementModel.find({
      ownerId,
      status: "ACTIVE",
      _id: { $nin: handedIds },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select(
        "agreementNo agreementDate effectiveFrom stallId tenant.name tenant.phone stall.stallNo stall.propertyName",
      )
      .lean();

    const stalls = await StallModel.find({
      _id: { $in: agreements.map((a) => a.stallId) },
    })
      .select("numberOfKeys")
      .lean();
    const keysMap = new Map(stalls.map((s) => [String(s._id), s.numberOfKeys]));

    return res.status(200).json({
      success: true,
      agreements: agreements.map((a) => {
        const keys = keysMap.get(String(a.stallId));
        return {
          id: a._id,
          agreementNo: a.agreementNo,
          agreementDate: toIso(a.agreementDate),
          effectiveFrom: toIso(a.effectiveFrom),
          tenantName: a.tenant.name,
          tenantPhone: a.tenant.phone,
          stallNo: a.stall.stallNo,
          propertyName: a.stall.propertyName,
          defaultKeys: Number.isInteger(keys) && keys >= 1 ? keys : 1,
        };
      }),
    });
  } catch (error) {
    return sendError(res, error, "getEligibleAgreements error");
  }
};

/**
 * Single handover
 */
const getHandoverById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const handover = await HandoverModel.findOne({ _id: id, ...scopeFilter(req) })
      .populate({ path: "ownerId", select: "name phone" })
      .lean();

    if (!handover) return notFound(res);

    return res.status(200).json({ success: true, handover: toDto(handover) });
  } catch (error) {
    return sendError(res, error, "getHandoverById error");
  }
};

/**
 * Owner -> keys / date / remarks edit
 */
const updateHandover = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const parsed = updateHandoverSchema.parse(req.body);
    const changes = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      return fail(res, 400, "No valid fields provided to update");
    }

    const handover = await HandoverModel.findOne({ _id: id, ownerId: req.user._id });
    if (!handover) return notFound(res);

    const agreement = await AgreementModel.findById(handover.agreementId)
      .select("status agreementDate")
      .lean();
    if (!agreement || agreement.status !== "ACTIVE") {
      return fail(res, 400, "Handover of an inactive agreement cannot be edited");
    }

    const nextDate = changes.handoverDate || handover.handoverDate;
    if (nextDate < agreement.agreementDate) return fail(res, 400, DATE_MESSAGE);

    Object.assign(handover, changes);
    await handover.save();

    return res.status(200).json({
      success: true,
      message: "Handover updated successfully",
      handover: toDto({
        ...handover.toObject(),
        ownerId: { _id: req.user._id, name: req.user.name, phone: req.user.phone },
      }),
    });
  } catch (error) {
    return sendError(res, error, "updateHandover error");
  }
};

module.exports = {
  createHandover,
  getHandovers,
  getEligibleAgreements,
  getHandoverById,
  updateHandover,
  toDto,
};