const { z } = require("zod");
const { ROLES } = require("../helper/constants");

const email = z.string().trim().toLowerCase().email("Valid email is required");
const role = z.enum(ROLES);
const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10 digit mobile number");
const name = z.string().trim().min(2, "Name must be at least 2 characters");

const sendOtpSchema = z.object({ email, role: role.optional() });

const verifyOtpSchema = z.object({
  email,
  role: role.optional(),
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

const createSuperAdminSchema = z.object({ name, email, phone });

const createOwnerSchema = z.object({
  name,
  email,
  phone,
  address: z.string().trim().min(5, "Address is required"),
});

module.exports = {
  sendOtpSchema,
  verifyOtpSchema,
  createSuperAdminSchema,
  createOwnerSchema,
};