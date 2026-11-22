const router = require("express").Router();
const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  updatePropertyStatus,
} = require("../controller/property.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");
const uploadImage = require("../middleware/uploadImage.js");

router.use(verifyJwt);

// দেখা: Owner (নিজের) + Super Admin (সব)
router.get("/", authorize("OWNER", "SUPER_ADMIN"), getProperties);
router.get("/:id", authorize("OWNER", "SUPER_ADMIN"), getPropertyById);

// বদলানো: শুধু Owner
router.post("/", authorize("OWNER"), uploadImage, createProperty);
router.put("/:id", authorize("OWNER"), uploadImage, updateProperty);
router.patch("/:id/status", authorize("OWNER"), updatePropertyStatus);

module.exports = router;