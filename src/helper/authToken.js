const jwt = require("jsonwebtoken");

const generateAuthToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role },
    process.env.TOKEN_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRATION },
  );

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: "strict",
};

const setAuthCookie = (res, token) =>
  res.cookie("login-token", token, cookieOptions);

const clearAuthCookie = (res) => res.clearCookie("login-token", cookieOptions);

const buildResponseUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
});

module.exports = {
  generateAuthToken,
  setAuthCookie,
  clearAuthCookie,
  buildResponseUser,
};