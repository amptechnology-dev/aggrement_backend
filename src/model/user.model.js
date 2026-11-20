const mongoose = require("mongoose");
const { ROLES } = require("../helper/constants");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index({ phone: 1, role: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
