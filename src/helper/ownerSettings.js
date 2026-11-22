const OwnerSettingsModel = require("../model/ownerSettings.model.js");

const normalizeTerm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

// প্রথমবার খুললে default মান দিয়ে নিজে তৈরি হয়
const getOrCreateSettings = (ownerId) =>
  OwnerSettingsModel.findOneAndUpdate(
    { ownerId },
    { $setOnInsert: { ownerId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

const toSavedTerms = (terms) =>
  (terms || []).map((t) => ({ id: t._id, text: t.text }));

const toSettingsDto = (s) => ({
  officeName: s.officeName || "",
  officeAddress: s.officeAddress || "",
  lateFineAmountPerDay: s.lateFineAmountPerDay,
  lateFineAfterDay: s.lateFineAfterDay,
  rentIncreaseEveryYears: s.rentIncreaseEveryYears,
  rentIncreasePercent: s.rentIncreasePercent,
  validityYears: s.validityYears,
  stallCannotCloseForDays: s.stallCannotCloseForDays,
  noticePeriodMonths: s.noticePeriodMonths,
  savedTerms: toSavedTerms(s.savedTerms),
});

module.exports = {
  normalizeTerm,
  getOrCreateSettings,
  toSettingsDto,
  toSavedTerms,
};