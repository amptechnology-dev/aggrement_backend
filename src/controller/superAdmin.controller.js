const UserModel = require("../model/user.model.js");
const OwnerModel = require("../model/owner.model.js");
const {
  createSuperAdminSchema,
  createOwnerSchema,
} = require("../schema/auth.schema.js");
const { sendWelcomeEmail } = require("../helper/sendOtpEmail.js");
const sendError = require("../helper/sendError.js");
const mongoose = require("mongoose");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const registerSuperAdmin = async (req, res) => {
  try {
    const key = req.headers["x-setup-key"];
    if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const data = createSuperAdminSchema.parse(req.body);

    const exists = await UserModel.exists({
      role: "SUPER_ADMIN",
      $or: [{ email: data.email }, { phone: data.phone }],
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Super Admin already exists with this email or phone",
      });
    }

    const user = await UserModel.create({
      ...data,
      role: "SUPER_ADMIN",
      isVerified: false,
    });

    return res.status(201).json({
      success: true,
      message: "Super Admin created. Login with email OTP.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return sendError(res, error, "registerSuperAdmin error");
  }
};

/**
 * Super Admin -> Owner create
 */
const createOwner = async (req, res) => {
  let user;
  try {
    const data = createOwnerSchema.parse(req.body);

    const exists = await UserModel.exists({
      role: "OWNER",
      $or: [{ email: data.email }, { phone: data.phone }],
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "An Owner already exists with this email or phone",
      });
    }

    user = await UserModel.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: "OWNER",
      createdBy: req.user._id,
    });

    const owner = await OwnerModel.create({
      userId: user._id,
      address: data.address,
      createdBy: req.user._id,
    });

    sendWelcomeEmail(user, "Owner").catch((e) =>
      console.error("Owner welcome email error:", e),
    );

    return res.status(201).json({
      success: true,
      message: "Owner created successfully",
      owner: {
        id: owner._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: owner.address,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    // Owner profile fail করলে orphan user মুছে দাও
    if (user?._id) {
      const profile = await OwnerModel.exists({ userId: user._id });
      if (!profile) await UserModel.findByIdAndDelete(user._id).catch(() => {});
    }
    return sendError(res, error, "createOwner error");
  }
};

/**
 * Owner list (pagination + search)
 */
const getOwners = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = String(req.query.search || "").trim();

    const filter = { role: "OWNER" };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const profiles = await OwnerModel.find({
      userId: { $in: users.map((u) => u._id) },
    }).lean();
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    const owners = users.map((u) => {
      const p = profileMap.get(String(u._id));
      return {
        id: p?._id,
        userId: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: p?.address,
        isActive: u.isActive,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      owners,
    });
  } catch (error) {
    return sendError(res, error, "getOwners error");
  }
};

/**
 * Owner active / inactive
 */
const updateOwnerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be true or false" });
    }

    const owner = await OwnerModel.findById(req.params.ownerId);
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    await UserModel.findByIdAndUpdate(owner.userId, { isActive });

    return res.status(200).json({
      success: true,
      message: `Owner ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    return sendError(res, error, "updateOwnerStatus error");
  }
};

const getOwnerById = async (req, res) => {
  try {
    const { ownerId } = req.params;

    if (!mongoose.isValidObjectId(ownerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid owner id" });
    }

    const owner = await OwnerModel.findById(ownerId)
      .populate({
        path: "userId",
        select: "name email phone isActive isVerified lastLoginAt createdAt",
      })
      .populate({ path: "createdBy", select: "name email" })
      .lean();

    if (!owner || !owner.userId) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    const { userId: user } = owner;

    return res.status(200).json({
      success: true,
      owner: {
        id: owner._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: owner.address,
        isActive: user.isActive,
        isVerified: user.isVerified,
        lastLoginAt: user.lastLoginAt,
        createdBy: owner.createdBy
          ? { id: owner.createdBy._id, name: owner.createdBy.name }
          : null,
        createdAt: owner.createdAt,
      },
    });
  } catch (error) {
    return sendError(res, error, "getOwnerById error");
  }
};

module.exports = {
  registerSuperAdmin,
  createOwner,
  getOwners,
  getOwnerById,
  updateOwnerStatus,
};
