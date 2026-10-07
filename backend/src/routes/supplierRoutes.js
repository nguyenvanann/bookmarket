const express = require("express");
const {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplierController");
const { authRequired, requireScope } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authRequired, requireScope("catalog"));
router.get("/", listSuppliers);
router.post("/", createSupplier);
router.get("/:id", getSupplier);
router.patch("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

module.exports = router;
