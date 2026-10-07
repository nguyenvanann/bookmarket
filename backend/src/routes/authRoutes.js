const express = require("express");
const { register, login, me, linkWallet } = require("../controllers/authController");
const { authRequired } = require("../middlewares/authMiddleware");

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", authRequired, me);
router.post("/link-wallet", authRequired, linkWallet);

module.exports = router;
