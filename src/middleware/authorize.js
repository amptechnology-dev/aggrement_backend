const UserModel = require("../model/user.model");

const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: Please login" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You are not eligible to access this resource",
      });
    }
    next();
  };

module.exports = authorize;