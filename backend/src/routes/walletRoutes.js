const express = require("express");
const { faucet, getBalance } = require("../controllers/walletController");

const router = express.Router();
router.post("/faucet", faucet);
router.get("/balance/:address", getBalance);

module.exports = router;
