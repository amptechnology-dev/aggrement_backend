const mongoose = require("mongoose");

const { ObjectId } = mongoose.Schema.Types;

const handoverSchema = new mongoose.Schema(
  {
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },

    // ekta agreement-e ekta-i handover
    agreementId: { type: ObjectId, ref: "Agreement", required: true, unique: true },
    tenantId: { type: ObjectId, ref: "Tenant", required: true, index: true },
    tenantUserId: { type: ObjectId, ref: "User", required: true, index: true },
    stallId: { type: ObjectId, ref: "Stall", required: true },
    propertyId: { type: ObjectId, ref: "Property", required: true, index: true },

    // ---- snapshots ----
    agreementNo: { type: String, required: true },
    tenantName: { type: String, required: true },
    stallNo: { type: String, required: true },
    propertyName: { type: String, required: true },

    numberOfKeys: { type: Number, required: true, min: 1, max: 100 },
    handoverDate: { type: Date, required: true },
    remarks: { type: String, trim: true, default: "" },

    handedOverBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Handover", handoverSchema);