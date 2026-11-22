const mongoose = require("mongoose");

const stallSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    stallNo: { type: String, required: true, trim: true },
    numberOfKeys: { type: Number, min: 0, max: 50 },
    image: { type: String },
    status: {
      type: String,
      enum: ["VACANT", "OCCUPIED"],
      default: "VACANT",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// একই property-তে একই stall নম্বর একবারই (A-z case ধরবে না)
stallSchema.index(
  { propertyId: 1, stallNo: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

module.exports = mongoose.model("Stall", stallSchema);