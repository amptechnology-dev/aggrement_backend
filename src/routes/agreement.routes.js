const router = require("express").Router();
const {
  createAgreement,
  getAgreements,
  getAgreementById,
  terminateAgreement,
} = require("../controller/agreement.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.use(verifyJwt);

router.get("/", authorize("OWNER", "SUPER_ADMIN"), getAgreements);
router.get("/:id", authorize("OWNER", "SUPER_ADMIN"), getAgreementById);

router.post("/", authorize("OWNER"), createAgreement);
router.patch("/:id/terminate", authorize("OWNER"), terminateAgreement);

module.exports = router;