const express = require("express");
const {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const {
  authRequired,
  requireScope,
  authOptional,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authOptional, listCategories);

router.post("/", authRequired, requireScope("catalog"), createCategory);
router.get("/:id", authRequired, requireScope("catalog"), getCategory);
router.patch("/:id", authRequired, requireScope("catalog"), updateCategory);
router.delete("/:id", authRequired, requireScope("catalog"), deleteCategory);

module.exports = router;
