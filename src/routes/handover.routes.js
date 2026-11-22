const router = require("express").Router();
const {
  createHandover,
  getHandovers,
  getEligibleAgreements,
  getHandoverById,
  updateHandover,
} = require("../controller/handover.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.use(verifyJwt);

router.get("/eligible", authorize("OWNER"), getEligibleAgreements);
router.get("/", authorize("OWNER", "SUPER_ADMIN"), getHandovers);
router.get("/:id", authorize("OWNER", "SUPER_ADMIN"), getHandoverById);

router.post("/", authorize("OWNER"), createHandover);
router.put("/:id", authorize("OWNER"), updateHandover);

module.exports = router;