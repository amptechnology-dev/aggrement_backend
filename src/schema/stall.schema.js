const { z } = require("zod");

const stallNo = z
  .string()
  .trim()
  .min(1, "Stall number is required")
  .max(20, "Stall number is too long");

const numberOfKeys = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .pipe(
    z
      .number()
      .int("Number of keys must be a whole number")
      .min(0, "Number of keys cannot be negative")
      .max(50, "Number of keys is too high")
      .optional(),
  );

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid property");

const createStallSchema = z.object({
  propertyId: objectId,
  stallNo,
  numberOfKeys,
});

// propertyId বদলানো যাবে না
const updateStallSchema = z.object({
  stallNo: stallNo.optional(),
  numberOfKeys,
});

module.exports = { createStallSchema, updateStallSchema };