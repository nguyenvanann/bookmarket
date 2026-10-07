const express = require("express");
const {
  createStockIn,
  createStockAdjust,
  getMovements,
  getMovement,
  downloadMovementPdf,
} = require("../controllers/stockController");
const { authRequired, requireScope } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authRequired, requireScope("stock"));

router.get("/movements", getMovements);
router.get("/movements/:id", getMovement);
router.get("/movements/:id/pdf", downloadMovementPdf);
router.post("/in", createStockIn);
router.post("/adjust", createStockAdjust);

module.exports = router;
