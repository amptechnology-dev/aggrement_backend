const router = require("express").Router();
// const rateLimit = require("express-rate-limit");
const {
  sendOtp,
  verifyOtp,
  logout,
  me,
} = require("../controller/auth.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");

// const otpLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { success: false, message: "Too many requests. Try again later." },
// });

router.post("/send-otp",  sendOtp);
router.post("/verify-otp",  verifyOtp);
router.post("/logout", verifyJwt, logout);
router.get("/me", verifyJwt, me);

module.exports = router;