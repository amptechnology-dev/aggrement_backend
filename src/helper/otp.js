const crypto = require("crypto");

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const hashOtp = (otp) =>
  crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(String(otp))
    .digest("hex");

const isOtpValid = (otp, storedHash) => {
  const a = Buffer.from(hashOtp(otp));
  const b = Buffer.from(storedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { generateOtp, hashOtp, isOtpValid };