const { z } = require("zod");
const { ruleFields, termText } = require("./settings.schema.js");

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

const createAgreementSchema = z.object({
  tenantId: objectId,
  stallId: objectId,
  agreementDate: isoDate,
  effectiveFrom: isoDate,
  monthlyRent: z.coerce
    .number()
    .positive("Monthly rent must be greater than 0")
    .max(10000000, "Monthly rent is too high"),
  depositAmount: z.coerce
    .number()
    .min(0, "Deposit cannot be negative")
    .max(100000000, "Deposit is too high"),
  guardianRelation: z.enum(["FATHER", "HUSBAND"]),
  voterCardNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}\d{7}$/,
      "Voter ID must be 3 letters followed by 7 digits (e.g. ABC1234567)",
    ),
  officeName: z.string().trim().max(150).optional(),
  officeAddress: z.string().trim().max(300).optional(),
  ...ruleFields,
  terms: z.array(termText).max(50, "At most 50 terms are allowed").default([]),
});

module.exports = { createAgreementSchema };