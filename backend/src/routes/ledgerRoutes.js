const express = require("express");
const {
  getChain,
  getStatus,
  getBookChain,
  streamLedger,
} = require("../controllers/ledgerController");

const router = express.Router();
router.get("/stream", streamLedger);
router.get("/", getChain);
router.get("/status", getStatus);
router.get("/book/:bookId", getBookChain);

module.exports = router;
