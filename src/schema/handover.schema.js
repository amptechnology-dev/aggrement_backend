const { z } = require("zod");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use date format YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Invalid date")
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

const numberOfKeys = z.coerce
  .number()
  .int("Number of keys must be a whole number")
  .min(1, "At least 1 key is required")
  .max(100, "Number of keys is too high");

const remarks = z.string().trim().max(500, "Remarks can be at most 500 characters");

const createHandoverSchema = z.object({
  agreementId: objectId,
  numberOfKeys,
  handoverDate: isoDate,
  remarks: remarks.optional(),
});

const updateHandoverSchema = z.object({
  numberOfKeys: numberOfKeys.optional(),
  handoverDate: isoDate.optional(),
  remarks: remarks.optional(),
});

module.exports = { createHandoverSchema, updateHandoverSchema };