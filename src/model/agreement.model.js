const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

const agreementSchema = new mongoose.Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    agreementNo: { type: String, required: true },

    tenantId: { type: ObjectId, ref: "Tenant", required: true, index: true },
    tenantUserId: { type: ObjectId, ref: "User", required: true, index: true },
    stallId: { type: ObjectId, ref: "Stall", required: true },
    propertyId: { type: ObjectId, ref: "Property", required: true, index: true },

    agreementDate: { type: Date, required: true },
    effectiveFrom: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // ---- snapshots: পরে মূল data বদলালেও এগুলো বদলায় না ----
    office: {
      name: { type: String, required: true },
      address: { type: String, required: true },
    },
    tenant: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      guardianName: { type: String, required: true },
      guardianRelation: { type: String, enum: ["FATHER", "HUSBAND"], required: true },
      voterCardNo: { type: String, required: true },
      address: { type: String, required: true },
    },
    stall: {
      stallNo: { type: String, required: true },
      propertyName: { type: String, required: true },
      propertyAddress: { type: String, required: true },
    },

    // ---- rent ও শর্ত ----
    monthlyRent: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },
    lateFineAmountPerDay: { type: Number, required: true, min: 0 },
    lateFineAfterDay: { type: Number, required: true, min: 1, max: 28 },
    validityYears: { type: Number, required: true, min: 1 },
    rentIncreaseEveryYears: { type: Number, required: true, min: 0 },
    rentIncreasePercent: { type: Number, required: true, min: 0 },
    stallCannotCloseForDays: { type: Number, required: true, min: 0 },
    noticePeriodMonths: { type: Number, required: true, min: 0 },
    terms: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["ACTIVE", "TERMINATED", "EXPIRED"],
      default: "ACTIVE",
      index: true,
    },
    terminatedAt: { type: Date },
    terminationReason: { type: String, trim: true },
    terminatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);

agreementSchema.index({ ownerId: 1, agreementNo: 1 }, { unique: true });

// একটা stall-এ একসাথে একটাই ACTIVE agreement
agreementSchema.index(
  { stallId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);

module.exports = mongoose.model("Agreement", agreementSchema);