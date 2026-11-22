const mongoose = require("mongoose");
const PropertyModel = require("../model/property.model.js");
const {
  createPropertySchema,
  updatePropertySchema,
} = require("../schema/property.schema.js");
const { uploadToR2 } = require("../helper/upload.js");
const sendError = require("../helper/sendError.js");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const OWNER_SELECT = "name email phone";

const DUPLICATE_MESSAGE = "You already have a property with this name";

const toDto = (p) => ({
  id: p._id,
  name: p.name,
  address: p.address,
  pin: p.pin,
  city: p.city,
  state: p.state,
  location: p.location,
  lat: p.lat,
  long: p.long,
  image: p.image,
  isActive: p.isActive,
  owner: p.ownerId
    ? {
        id: p.ownerId._id,
        name: p.ownerId.name,
        email: p.ownerId.email,
        phone: p.ownerId.phone,
      }
    : null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// OWNER শুধু নিজের, SUPER_ADMIN সবার (read only route-এ)
const scopeFilter = (req) =>
  req.user.role === "OWNER" ? { ownerId: req.user._id } : {};

const uploadImage = (file) => {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
  return uploadToR2(
    file.buffer,
    `agreement-system/properties/${Date.now()}-${safeName}`,
    file.mimetype,
  );
};

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid property id" });

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Property not found" });

/**
 * Owner -> Property create
 */
const createProperty = async (req, res) => {
  try {
    const data = createPropertySchema.parse(req.body);

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Property image is required" });
    }

    const image = await uploadImage(req.file);

    const created = await PropertyModel.create({
      ...data,
      image,
      ownerId: req.user._id,
    });

    const property = await PropertyModel.findById(created._id)
      .populate({ path: "ownerId", select: OWNER_SELECT })
      .lean();

    return res.status(201).json({
      success: true,
      message: "Property created successfully",
      property: toDto(property),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: DUPLICATE_MESSAGE });
    }
    return sendError(res, error, "createProperty error");
  }
};

/**
 * Property list (pagination + search)
 * OWNER: নিজের | SUPER_ADMIN: সব (?ownerId= দিয়ে filter করা যাবে)
 */
const getProperties = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 6, 100);
    const search = String(req.query.search || "").trim();

    const filter = scopeFilter(req);

    if (
      req.user.role === "SUPER_ADMIN" &&
      mongoose.isValidObjectId(req.query.ownerId)
    ) {
      filter.ownerId = req.query.ownerId;
    }

    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: rx }, { city: rx }, { state: rx }, { pin: rx }];
    }

    const [properties, total] = await Promise.all([
      PropertyModel.find(filter)
        .populate({ path: "ownerId", select: OWNER_SELECT })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PropertyModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      properties: properties.map(toDto),
    });
  } catch (error) {
    return sendError(res, error, "getProperties error");
  }
};

/**
 * Single property
 */
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const property = await PropertyModel.findOne({ _id: id, ...scopeFilter(req) })
      .populate({ path: "ownerId", select: OWNER_SELECT })
      .lean();

    if (!property) return notFound(res);

    return res.status(200).json({ success: true, property: toDto(property) });
  } catch (error) {
    return sendError(res, error, "getPropertyById error");
  }
};

/**
 * Property update (image পাঠালে বদলাবে, না পাঠালে পুরনোটাই থাকবে)
 */
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const data = updatePropertySchema.parse(req.body);

    if (Object.keys(data).length === 0 && !req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided to update" });
    }

    // image upload করার আগেই ownership check, যাতে অন্যের জন্য upload না হয়
    const owned = await PropertyModel.exists({ _id: id, ownerId: req.user._id });
    if (!owned) return notFound(res);

    const update = { ...data };
    if (req.file) update.image = await uploadImage(req.file);

    const property = await PropertyModel.findOneAndUpdate(
      { _id: id, ownerId: req.user._id },
      { $set: update },
      { new: true, runValidators: true },
    )
      .populate({ path: "ownerId", select: OWNER_SELECT })
      .lean();

    if (!property) return notFound(res);

    return res.status(200).json({
      success: true,
      message: "Property updated successfully",
      property: toDto(property),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: DUPLICATE_MESSAGE });
    }
    return sendError(res, error, "updateProperty error");
  }
};

/**
 * Property active / inactive
 */
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be true or false" });
    }

    const property = await PropertyModel.findOneAndUpdate(
      { _id: id, ownerId: req.user._id },
      { $set: { isActive } },
      { new: true },
    ).lean();

    if (!property) return notFound(res);

    return res.status(200).json({
      success: true,
      message: `Property ${isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    return sendError(res, error, "updatePropertyStatus error");
  }
};

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  updatePropertyStatus,
};