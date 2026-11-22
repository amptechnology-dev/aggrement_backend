const router = require("express").Router();
const {
  createStall,
  getStalls,
  getStallById,
  updateStall,
  updateStallStatus,
} = require("../controller/stall.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");
const uploadImage = require("../middleware/uploadImage.js");

router.use(verifyJwt);

router.get("/", authorize("OWNER", "SUPER_ADMIN"), getStalls);
router.get("/:id", authorize("OWNER", "SUPER_ADMIN"), getStallById);

router.post("/", authorize("OWNER"), uploadImage, createStall);
router.put("/:id", authorize("OWNER"), uploadImage, updateStall);
router.patch("/:id/status", authorize("OWNER"), updateStallStatus);

module.exports = router;