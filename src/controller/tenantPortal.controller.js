const TenantModel = require("../model/tenant.model.js");
const AgreementModel = require("../model/agreement.model.js");
const HandoverModel = require("../model/handover.model.js");
const { toDto: toAgreementDto } = require("./agreement.controller.js");
const { toDto: toHandoverDto } = require("./handover.controller.js");
const { buildResponseUser } = require("../helper/authToken.js");
const sendError = require("../helper/sendError.js");

const STATUSES = ["ACTIVE", "TERMINATED", "EXPIRED"];

const toProfile = (t) => ({
  id: t._id,
  name: t.name,
  email: t.email,
  phone: t.phone,
  guardianName: t.guardianName,
  guardianRelation: t.guardianRelation ?? null,
  address: t.address,
  voterCardNo: t.voterCardNo ?? null,
  isActive: t.isActive,
  owner:
    t.ownerId && t.ownerId.name
      ? { id: t.ownerId._id, name: t.ownerId.name, phone: t.ownerId.phone }
      : null,
});

/**
 * Tenant -> nijer profile
 * Ek-i user-er ekadhik Owner-er under-e tenant record thakte pare, tai array
 */
const getProfile = async (req, res) => {
  try {
    const tenants = await TenantModel.find({ userId: req.user._id })
      .populate({ path: "ownerId", select: "name phone" })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      user: buildResponseUser(req.user),
      profiles: tenants.map(toProfile),
    });
  } catch (error) {
    return sendError(res, error, "getTenantProfile error");
  }
};

/**
 * Tenant -> shudhu nijer agreement (rent schedule shoho)
 * ?status=ACTIVE
 */
const getMyAgreements = async (req, res) => {
  try {
    const filter = { tenantUserId: req.user._id };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const agreements = await AgreementModel.find(filter)
      .populate({ path: "ownerId", select: "name phone" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      total: agreements.length,
      agreements: agreements.map((a) => toAgreementDto(a, true)),
    });
  } catch (error) {
    return sendError(res, error, "getMyAgreements error");
  }
};

/**
 * Tenant -> shudhu nijer handover
 */
const getMyHandovers = async (req, res) => {
  try {
    const handovers = await HandoverModel.find({ tenantUserId: req.user._id })
      .populate({ path: "ownerId", select: "name phone" })
      .sort({ handoverDate: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      total: handovers.length,
      handovers: handovers.map(toHandoverDto),
    });
  } catch (error) {
    return sendError(res, error, "getMyHandovers error");
  }
};

module.exports = { getProfile, getMyAgreements, getMyHandovers };