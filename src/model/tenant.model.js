const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    guardianName: { type: String, required: true, trim: true },
    guardianRelation: { type: String, enum: ["FATHER", "HUSBAND"] },
    address: { type: String, required: true, trim: true },
    voterCardNo: { type: String, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// একই owner-এর list-এ একই tenant দুবার আসবে না
tenantSchema.index({ ownerId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Tenant", tenantSchema);