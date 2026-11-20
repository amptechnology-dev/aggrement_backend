const router = require("express").Router();
const {
  registerSuperAdmin,
  createOwner,
  getOwners,
  getOwnerById, 
  updateOwnerStatus,
} = require("../controller/superAdmin.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.post("/setup", registerSuperAdmin);

router.use(verifyJwt, authorize("SUPER_ADMIN"));
router.post("/owners", createOwner);
router.get("/owners", getOwners);
router.get("/owners/:ownerId", getOwnerById);
router.patch("/owners/:ownerId/status", updateOwnerStatus);

module.exports = router;