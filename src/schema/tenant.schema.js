const { z } = require("zod");

const emptyToUndefined = (v) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyToNull = (v) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const name = z.string().trim().min(2, "Name must be at least 2 characters");
const email = z.string().trim().toLowerCase().email("Valid email is required");
const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10 digit mobile number");
const guardianName = z
  .string()
  .trim()
  .min(2, "Guardian's name must be at least 2 characters");
const address = z.string().trim().min(5, "Address must be at least 5 characters");
const relation = z.enum(["FATHER", "HUSBAND"]);
const voterCardNo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{3}\d{7}$/,
    "Voter ID must be 3 letters followed by 7 digits (e.g. ABC1234567)",
  );

const createTenantSchema = z.object({
  name,
  email,
  phone,
  guardianName,
  address,
  guardianRelation: z.preprocess(emptyToUndefined, relation.optional()),
  voterCardNo: z.preprocess(emptyToUndefined, voterCardNo.optional()),
});

// email ও phone বদলানো যাবে না
const updateTenantSchema = z.object({
  name: name.optional(),
  guardianName: guardianName.optional(),
  address: address.optional(),
  guardianRelation: z.preprocess(emptyToNull, relation.nullable().optional()),
  voterCardNo: z.preprocess(emptyToNull, voterCardNo.nullable().optional()),
});

module.exports = { createTenantSchema, updateTenantSchema };