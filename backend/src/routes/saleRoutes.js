const express = require("express");
const {
  listSales,
  getSale,
  downloadSalePdf,
  getSaleByTxNode,
  getSaleByBook,
  cancelSale,
  backfill,
} = require("../controllers/saleController");
const {
  authRequired,
  requireScope,
  authOptional,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authRequired, requireScope("sales"), listSales);
router.post("/backfill", authRequired, requireScope("sales"), backfill);
router.get("/by-node/:index", authOptional, getSaleByTxNode);
router.get("/by-book/:bookId", authOptional, getSaleByBook);
router.get("/:id/pdf", authRequired, requireScope("sales"), downloadSalePdf);
router.get("/:id", authRequired, requireScope("sales"), getSale);
router.post("/:id/cancel", authRequired, requireScope("sales"), cancelSale);

module.exports = router;
