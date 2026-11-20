const sendError = (res, error, label) => {
  if (error.name === "ZodError") {
    const errors = error.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: errors[0]?.message || "Validation failed",
      errors,
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {}).find(
      (k) => k !== "role",
    );
    return res.status(409).json({
      success: false,
      message: `This ${field || "value"} is already registered for this role`,
    });
  }

  console.error(`${label}:`, error);
  return res
    .status(500)
    .json({ success: false, message: "Internal server error" });
};

module.exports = sendError;