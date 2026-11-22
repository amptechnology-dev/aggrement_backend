const router = require("express").Router();
const {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  updateTenantStatus,
} = require("../controller/tenant.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.use(verifyJwt);

router.get("/", authorize("OWNER", "SUPER_ADMIN"), getTenants);
router.get("/:id", authorize("OWNER", "SUPER_ADMIN"), getTenantById);

router.post("/", authorize("OWNER"), createTenant);
router.put("/:id", authorize("OWNER"), updateTenant);
router.patch("/:id/status", authorize("OWNER"), updateTenantStatus);

module.exports = router;