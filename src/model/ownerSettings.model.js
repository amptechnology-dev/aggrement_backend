const mongoose = require("mongoose");

const termSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
});

const ownerSettingsSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    officeName: { type: String, trim: true, default: "" },
    officeAddress: { type: String, trim: true, default: "" },

    lateFineAmountPerDay: { type: Number, default: 20, min: 0 },
    lateFineAfterDay: { type: Number, default: 7, min: 1, max: 28 },
    rentIncreaseEveryYears: { type: Number, default: 3, min: 0 },
    rentIncreasePercent: { type: Number, default: 10, min: 0 },
    validityYears: { type: Number, default: 15, min: 1 },
    stallCannotCloseForDays: { type: Number, default: 7, min: 0 },
    noticePeriodMonths: { type: Number, default: 1, min: 0 },

    savedTerms: { type: [termSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OwnerSettings", ownerSettingsSchema);