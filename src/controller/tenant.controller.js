const mongoose = require("mongoose");
const UserModel = require("../model/user.model.js");
const TenantModel = require("../model/tenant.model.js");
const {
  createTenantSchema,
  updateTenantSchema,
} = require("../schema/tenant.schema.js");
const { sendWelcomeEmail } = require("../helper/sendOtpEmail.js");
const sendError = require("../helper/sendError.js");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OWNER_SELECT = "name phone";

const toDto = (t) => ({
  id: t._id,
  userId: t.userId,
  name: t.name,
  email: t.email,
  phone: t.phone,
  guardianName: t.guardianName,
  guardianRelation: t.guardianRelation ?? null,
  address: t.address,
  voterCardNo: t.voterCardNo ?? null,
  isActive: t.isActive,
  owner:
    t.ownerId && t.ownerId._id
      ? { id: t.ownerId._id, name: t.ownerId.name, phone: t.ownerId.phone }
      : null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const populateTenant = (query) =>
  query.populate({ path: "ownerId", select: OWNER_SELECT });

// OWNER শুধু নিজের tenant, SUPER_ADMIN সবার (read only)
const scopeFilter = (req) =>
  req.user.role === "OWNER" ? { ownerId: req.user._id } : {};

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid tenant id" });

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Tenant not found" });

/**
 * Owner -> Tenant create
 * আগে থেকে TENANT account থাকলে (অন্য owner-এর কাছে) সেটাই জুড়ে নেয়
 */
const createTenant = async (req, res) => {
  let user = null;
  let createdUser = false;

  try {
    const data = createTenantSchema.parse(req.body);

    const matches = await UserModel.find({
      role: "TENANT",
      $or: [{ email: data.email }, { phone: data.phone }],
    });

    if (matches.length > 1) {
      return res.status(409).json({
        success: false,
        message:
          "This email or phone number is already linked to another tenant account. Please check the details.",
      });
    }

    if (matches.length === 1) {
      const existing = matches[0];

      if (existing.email !== data.email || existing.phone !== data.phone) {
        return res.status(409).json({
          success: false,
          message:
            "This email or phone number is already linked to another tenant account. Please check the details.",
        });
      }
      if (!existing.isActive) {
        return res.status(400).json({
          success: false,
          message: "This tenant account has been deactivated by the administrator",
        });
      }

      const alreadyMine = await TenantModel.exists({
        ownerId: req.user._id,
        userId: existing._id,
      });
      if (alreadyMine) {
        return res.status(409).json({
          success: false,
          message: "This tenant is already in your list",
        });
      }

      user = existing;
    } else {
      user = await UserModel.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: "TENANT",
        createdBy: req.user._id,
      });
      createdUser = true;
    }

    const created = await TenantModel.create({
      ownerId: req.user._id,
      userId: user._id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      guardianName: data.guardianName,
      guardianRelation: data.guardianRelation,
      address: data.address,
      voterCardNo: data.voterCardNo,
    });

    if (createdUser) {
      sendWelcomeEmail(user, "Tenant").catch((e) =>
        console.error("Tenant welcome email error:", e),
      );
    }

    const tenant = await populateTenant(TenantModel.findById(created._id)).lean();

    return res.status(201).json({
      success: true,
      message: createdUser
        ? "Tenant created successfully"
        : "Tenant added successfully (existing account linked)",
      tenant: toDto(tenant),
    });
  } catch (error) {
    // নতুন user বানানোর পর tenant record fail করলে orphan user মুছে দাও
    if (createdUser && user?._id) {
      const hasRecord = await TenantModel.exists({ userId: user._id });
      if (!hasRecord) await UserModel.findByIdAndDelete(user._id).catch(() => {});
    }
    return sendError(res, error, "createTenant error");
  }
};

/**
 * Tenant list (pagination + search + filter)
 * ?search= &isActive= &ownerId= (ownerId শুধু SUPER_ADMIN)
 */
const getTenants = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = String(req.query.search || "").trim();
    const { isActive, ownerId } = req.query;

    const filter = scopeFilter(req);

    if (req.user.role === "SUPER_ADMIN" && mongoose.isValidObjectId(ownerId)) {
      filter.ownerId = ownerId;
    }
    if (isActive === "true" || isActive === "false") {
      filter.isActive = isActive === "true";
    }
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [tenants, total] = await Promise.all([
      populateTenant(TenantModel.find(filter))
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TenantModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      tenants: tenants.map(toDto),
    });
  } catch (error) {
    return sendError(res, error, "getTenants error");
  }
};

/**
 * Single tenant
 */
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const tenant = await populateTenant(
      TenantModel.findOne({ _id: id, ...scopeFilter(req) }),
    ).lean();

    if (!tenant) return notFound(res);

    return res.status(200).json({ success: true, tenant: toDto(tenant) });
  } catch (error) {
    return sendError(res, error, "getTenantById error");
  }
};

/**
 * Tenant update (name, guardian, relation, address, voter card)
 */
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const data = updateTenantSchema.parse(req.body);

    if (Object.values(data).every((v) => v === undefined)) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided to update" });
    }

    const $set = {};
    const $unset = {};

    ["name", "guardianName", "address"].forEach((key) => {
      if (data[key] !== undefined) $set[key] = data[key];
    });

    // null মানে "মুছে ফেলো"
    ["guardianRelation", "voterCardNo"].forEach((key) => {
      if (data[key] === null) $unset[key] = "";
      else if (data[key] !== undefined) $set[key] = data[key];
    });

    const operation = {};
    if (Object.keys($set).length) operation.$set = $set;
    if (Object.keys($unset).length) operation.$unset = $unset;

    const tenant = await populateTenant(
      TenantModel.findOneAndUpdate(
        { _id: id, ownerId: req.user._id },
        operation,
        { new: true, runValidators: true },
      ),
    ).lean();

    if (!tenant) return notFound(res);

    return res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
      tenant: toDto(tenant),
    });
  } catch (error) {
    return sendError(res, error, "updateTenant error");
  }
};

/**
 * Tenant active / inactive (শুধু এই owner-এর record, account না)
 */
const updateTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be true or false" });
    }

    const tenant = await TenantModel.findOneAndUpdate(
      { _id: id, ownerId: req.user._id },
      { $set: { isActive } },
      { new: true },
    ).lean();

    if (!tenant) return notFound(res);

    return res.status(200).json({
      success: true,
      message: `Tenant ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    return sendError(res, error, "updateTenantStatus error");
  }
};

module.exports = {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  updateTenantStatus,
};