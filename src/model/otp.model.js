const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["LOGIN"], default: "LOGIN" },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto delete
otpSchema.index({ userId: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);