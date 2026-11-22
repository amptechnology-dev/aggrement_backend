const router = require("express").Router();
const {
  getProfile,
  getMyAgreements,
  getMyHandovers,
} = require("../controller/tenantPortal.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

// shob route shudhu TENANT-er jonno
router.use(verifyJwt, authorize("TENANT"));

router.get("/profile", getProfile);
router.get("/agreements", getMyAgreements);
router.get("/handovers", getMyHandovers);

module.exports = router;