const express = require("express");
const {
  dashboard,
  listUsers,
  setUserRole,
  createUser,
  updateUser,
  deleteUser,
  setUserPassword,
  resync,
  refreshAllBooks,
} = require("../controllers/adminController");
const { adminFaucet } = require("../controllers/walletController");
const {
  authRequired,
  requireStaffAccess,
  requireScope,
} = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(authRequired, requireStaffAccess());

router.get("/dashboard", requireScope("dashboard"), dashboard);
router.get("/users", requireScope("users"), listUsers);
router.post("/users", requireScope("users"), createUser);
router.patch("/users/:id", requireScope("users"), updateUser);
router.patch("/users/:id/role", requireScope("users"), setUserRole);
router.patch("/users/:id/password", requireScope("users"), setUserPassword);
router.delete("/users/:id", requireScope("users"), deleteUser);
router.post("/resync", requireScope("system"), resync);
router.post("/refresh-books", requireScope("system"), refreshAllBooks);
router.post("/faucet", requireScope("faucet"), adminFaucet);

module.exports = router;
