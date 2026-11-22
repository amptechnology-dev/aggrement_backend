const mongoose = require("mongoose");
const OwnerSettingsModel = require("../model/ownerSettings.model.js");
const {
  updateSettingsSchema,
  termSchema,
} = require("../schema/settings.schema.js");
const {
  normalizeTerm,
  getOrCreateSettings,
  toSettingsDto,
  toSavedTerms,
} = require("../helper/ownerSettings.js");
const sendError = require("../helper/sendError.js");

const DUPLICATE_TERM = "This term is already in your saved terms";

const getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    return res.status(200).json({ success: true, settings: toSettingsDto(settings) });
  } catch (error) {
    return sendError(res, error, "getSettings error");
  }
};

const updateSettings = async (req, res) => {
  try {
    const parsed = updateSettingsSchema.parse(req.body);
    const data = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid fields provided to update" });
    }

    const settings = await OwnerSettingsModel.findOneAndUpdate(
      { ownerId: req.user._id },
      { $set: data, $setOnInsert: { ownerId: req.user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Settings saved successfully",
      settings: toSettingsDto(settings),
    });
  } catch (error) {
    return sendError(res, error, "updateSettings error");
  }
};

const addTerm = async (req, res) => {
  try {
    const { text } = termSchema.parse(req.body);
    const settings = await getOrCreateSettings(req.user._id);

    const key = normalizeTerm(text);
    if (settings.savedTerms.some((t) => normalizeTerm(t.text) === key)) {
      return res.status(409).json({ success: false, message: DUPLICATE_TERM });
    }

    const updated = await OwnerSettingsModel.findOneAndUpdate(
      { ownerId: req.user._id },
      { $push: { savedTerms: { text } } },
      { new: true },
    ).lean();

    return res.status(201).json({
      success: true,
      message: "Term saved",
      savedTerms: toSavedTerms(updated.savedTerms),
    });
  } catch (error) {
    return sendError(res, error, "addTerm error");
  }
};

const updateTerm = async (req, res) => {
  try {
    const { termId } = req.params;
    if (!mongoose.isValidObjectId(termId)) {
      return res.status(400).json({ success: false, message: "Invalid term id" });
    }

    const { text } = termSchema.parse(req.body);
    const settings = await getOrCreateSettings(req.user._id);

    const key = normalizeTerm(text);
    const clash = settings.savedTerms.some(
      (t) => String(t._id) !== termId && normalizeTerm(t.text) === key,
    );
    if (clash) {
      return res.status(409).json({ success: false, message: DUPLICATE_TERM });
    }

    const updated = await OwnerSettingsModel.findOneAndUpdate(
      { ownerId: req.user._id, "savedTerms._id": termId },
      { $set: { "savedTerms.$.text": text } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Term not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Term updated. Existing agreements are not changed.",
      savedTerms: toSavedTerms(updated.savedTerms),
    });
  } catch (error) {
    return sendError(res, error, "updateTerm error");
  }
};

const deleteTerm = async (req, res) => {
  try {
    const { termId } = req.params;
    if (!mongoose.isValidObjectId(termId)) {
      return res.status(400).json({ success: false, message: "Invalid term id" });
    }

    const updated = await OwnerSettingsModel.findOneAndUpdate(
      { ownerId: req.user._id, "savedTerms._id": termId },
      { $pull: { savedTerms: { _id: termId } } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Term not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Term removed. Existing agreements are not changed.",
      savedTerms: toSavedTerms(updated.savedTerms),
    });
  } catch (error) {
    return sendError(res, error, "deleteTerm error");
  }
};

module.exports = { getSettings, updateSettings, addTerm, updateTerm, deleteTerm };