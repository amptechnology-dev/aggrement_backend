const router = require("express").Router();
const {
  getSettings,
  updateSettings,
  addTerm,
  updateTerm,
  deleteTerm,
} = require("../controller/settings.controller.js");
const verifyJwt = require("../middleware/verifiyUser.js");
const authorize = require("../middleware/authorize.js");

router.use(verifyJwt, authorize("OWNER"));

router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/terms", addTerm);
router.put("/terms/:termId", updateTerm);
router.delete("/terms/:termId", deleteTerm);

module.exports = router;