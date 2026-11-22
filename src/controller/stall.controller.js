const mongoose = require("mongoose");
const StallModel = require("../model/stall.model.js");
const PropertyModel = require("../model/property.model.js");
const {
  createStallSchema,
  updateStallSchema,
} = require("../schema/stall.schema.js");
const { uploadToR2 } = require("../helper/upload.js");
const sendError = require("../helper/sendError.js");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DUPLICATE_MESSAGE = "This stall number already exists in this property";

const PROPERTY_SELECT = "name city state isActive";
const OWNER_SELECT = "name email phone";

const toDto = (s) => ({
  id: s._id,
  stallNo: s.stallNo,
  numberOfKeys: s.numberOfKeys ?? null,
  image: s.image ?? null,
  status: s.status,
  isActive: s.isActive,
  property: s.propertyId
    ? {
        id: s.propertyId._id,
        name: s.propertyId.name,
        city: s.propertyId.city,
        state: s.propertyId.state,
      }
    : null,
  owner: s.ownerId
    ? { id: s.ownerId._id, name: s.ownerId.name, phone: s.ownerId.phone }
    : null,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

const populateStall = (query) =>
  query
    .populate({ path: "propertyId", select: PROPERTY_SELECT })
    .populate({ path: "ownerId", select: OWNER_SELECT });

// OWNER শুধু নিজের, SUPER_ADMIN সবার (read only)
const scopeFilter = (req) =>
  req.user.role === "OWNER" ? { ownerId: req.user._id } : {};

const uploadStallImage = (file) => {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
  return uploadToR2(
    file.buffer,
    `agreement-system/stalls/${Date.now()}-${safeName}`,
    file.mimetype,
  );
};

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid stall id" });

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Stall not found" });

/**
 * Owner -> Stall create
 */
const createStall = async (req, res) => {
  try {
    const data = createStallSchema.parse(req.body);

    // property ওই Owner-এর কিনা + active কিনা
    const property = await PropertyModel.findOne({
      _id: data.propertyId,
      ownerId: req.user._id,
    })
      .select("isActive")
      .lean();

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }
    if (!property.isActive) {
      return res.status(400).json({
        success: false,
        message: "This property is inactive. Activate it to add stalls.",
      });
    }

    const image = req.file ? await uploadStallImage(req.file) : undefined;

    const created = await StallModel.create({
      ownerId: req.user._id,
      propertyId: data.propertyId,
      stallNo: data.stallNo,
      numberOfKeys: data.numberOfKeys,
      image,
    });

    const stall = await populateStall(StallModel.findById(created._id)).lean();

    return res.status(201).json({
      success: true,
      message: "Stall created successfully",
      stall: toDto(stall),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: DUPLICATE_MESSAGE });
    }
    return sendError(res, error, "createStall error");
  }
};

/**
 * Stall list (pagination + search + filter)
 * ?propertyId= &status= &isActive= &search=
 */
const getStalls = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const search = String(req.query.search || "").trim();
    const { propertyId, status, isActive } = req.query;

    const filter = scopeFilter(req);

    if (mongoose.isValidObjectId(propertyId)) filter.propertyId = propertyId;
    if (status === "VACANT" || status === "OCCUPIED") filter.status = status;
    if (isActive === "true" || isActive === "false") {
      filter.isActive = isActive === "true";
    }
    if (search) {
      filter.stallNo = { $regex: escapeRegex(search), $options: "i" };
    }

    const [stalls, total] = await Promise.all([
      populateStall(StallModel.find(filter))
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StallModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      stalls: stalls.map(toDto),
    });
  } catch (error) {
    return sendError(res, error, "getStalls error");
  }
};

/**
 * Single stall
 */
const getStallById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const stall = await populateStall(
      StallModel.findOne({ _id: id, ...scopeFilter(req) }),
    ).lean();

    if (!stall) return notFound(res);

    return res.status(200).json({ success: true, stall: toDto(stall) });
  } catch (error) {
    return sendError(res, error, "getStallById error");
  }
};

/**
 * Stall update (stallNo, numberOfKeys, image)
 */
const updateStall = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const data = updateStallSchema.parse(req.body);

    // দুটো আলাদা field আসে: image মুছতে চাইলে removeImage=true
    const removeImage = req.body.removeImage === "true";

    const hasChange =
      data.stallNo !== undefined ||
      data.numberOfKeys !== undefined ||
      req.file ||
      removeImage;
    if (!hasChange) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided to update" });
    }

    const owned = await StallModel.exists({ _id: id, ownerId: req.user._id });
    if (!owned) return notFound(res);

    const $set = {};
    const $unset = {};

    if (data.stallNo !== undefined) $set.stallNo = data.stallNo;
    if (data.numberOfKeys !== undefined) $set.numberOfKeys = data.numberOfKeys;
    if (req.file) $set.image = await uploadStallImage(req.file);
    else if (removeImage) $unset.image = "";

    const operation = {};
    if (Object.keys($set).length) operation.$set = $set;
    if (Object.keys($unset).length) operation.$unset = $unset;

    const stall = await populateStall(
      StallModel.findOneAndUpdate(
        { _id: id, ownerId: req.user._id },
        operation,
        { new: true, runValidators: true },
      ),
    ).lean();

    if (!stall) return notFound(res);

    return res.status(200).json({
      success: true,
      message: "Stall updated successfully",
      stall: toDto(stall),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: DUPLICATE_MESSAGE });
    }
    return sendError(res, error, "updateStall error");
  }
};

/**
 * Stall active / inactive
 */
const updateStallStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be true or false" });
    }

    const stall = await StallModel.findOne({
      _id: id,
      ownerId: req.user._id,
    });
    if (!stall) return notFound(res);

    if (!isActive && stall.status === "OCCUPIED") {
      return res.status(400).json({
        success: false,
        message: "An occupied stall cannot be deactivated",
      });
    }

    stall.isActive = isActive;
    await stall.save();

    return res.status(200).json({
      success: true,
      message: `Stall ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    return sendError(res, error, "updateStallStatus error");
  }
};

module.exports = {
  createStall,
  getStalls,
  getStallById,
  updateStall,
  updateStallStatus,
};