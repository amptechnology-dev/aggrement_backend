const UserModel = require("../model/user.model.js");
const OtpModel = require("../model/otp.model.js");
const { generateOtp, hashOtp, isOtpValid } = require("../helper/otp.js");
const { sendOtpEmail } = require("../helper/sendOtpEmail.js");
const {
  generateAuthToken,
  setAuthCookie,
  clearAuthCookie,
  buildResponseUser,
} = require("../helper/authToken.js");
const { sendOtpSchema, verifyOtpSchema } = require("../schema/auth.schema.js");
const sendError = require("../helper/sendError.js");

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

// email (+ optional role) দিয়ে account খোঁজে
const findAccounts = (email, role) =>
  UserModel.find(role ? { email, role } : { email });

/**
 * Step 1: email দিলে user আছে কিনা check, থাকলে OTP পাঠায়
 */
const sendOtp = async (req, res) => {
  try {
    const { email, role } = sendOtpSchema.parse(req.body);

    const accounts = await findAccounts(email, role);
    if (!accounts.length) {
      return res
        .status(404)
        .json({ success: false, message: "User not present in this email" });
    }

    // একই email-এ একাধিক role থাকলে user-কে role বাছতে বলো
    if (accounts.length > 1) {
      return res.status(200).json({
        success: true,
        requireRole: true,
        message: "Multiple accounts found. Please select a role.",
        roles: accounts.map((a) => a.role),
      });
    }

    const user = accounts[0];
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact support.",
      });
    }

    // resend cooldown
    const lastOtp = await OtpModel.findOne({
      userId: user._id,
      purpose: "LOGIN",
    }).sort({ createdAt: -1 });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - lastOtp.createdAt.getTime())) / 1000,
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${wait} seconds before requesting a new OTP`,
        retryAfter: wait,
      });
    }

    const otp = generateOtp();
    await OtpModel.deleteMany({ userId: user._id, purpose: "LOGIN" });
    const otpDoc = await OtpModel.create({
      userId: user._id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    });

    try {
      await sendOtpEmail(user, otp);
    } catch (mailError) {
      await OtpModel.findByIdAndDelete(otpDoc._id);
      console.error("OTP email error:", mailError);
      return res.status(500).json({
        success: false,
        message: "Could not send OTP email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      role: user.role,
      expiresInSeconds: OTP_EXPIRY_MS / 1000,
    });
  } catch (error) {
    return sendError(res, error, "sendOtp error");
  }
};

/**
 * Step 2: OTP verify করে login (token + cookie)
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, role, otp } = verifyOtpSchema.parse(req.body);

    const accounts = await findAccounts(email, role);
    if (!accounts.length) {
      return res
        .status(404)
        .json({ success: false, message: "User not present in this email" });
    }
    if (accounts.length > 1) {
      return res.status(400).json({
        success: false,
        requireRole: true,
        message: "Multiple accounts found. Please select a role.",
        roles: accounts.map((a) => a.role),
      });
    }

    const user = accounts[0];
    if (!user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "Your account is inactive" });
    }

    const otpDoc = await OtpModel.findOne({
      userId: user._id,
      purpose: "LOGIN",
    }).sort({ createdAt: -1 });

    if (!otpDoc || otpDoc.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not requested. Please request a new OTP.",
      });
    }

    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      await OtpModel.findByIdAndDelete(otpDoc._id);
      return res.status(429).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    if (!isOtpValid(otp, otpDoc.otpHash)) {
      await OtpModel.updateOne({ _id: otpDoc._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsLeft: MAX_ATTEMPTS - otpDoc.attempts - 1,
      });
    }

    // সফল
    await OtpModel.deleteMany({ userId: user._id, purpose: "LOGIN" });
    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateAuthToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: buildResponseUser(user),
    });
  } catch (error) {
    return sendError(res, error, "verifyOtp error");
  }
};

const logout = async (req, res) => {
  clearAuthCookie(res);
  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
};

const me = async (req, res) => {
  return res.status(200).json({ success: true, user: buildResponseUser(req.user) });
};

module.exports = { sendOtp, verifyOtp, logout, me };