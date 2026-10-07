const express = require("express");
const {
  listPublishers,
  getPublisher,
  createPublisher,
  updatePublisher,
  deletePublisher,
} = require("../controllers/publisherController");
const {
  authRequired,
  requireScope,
  authOptional,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authOptional, listPublishers);

router.post("/", authRequired, requireScope("catalog"), createPublisher);
router.get("/:id", authRequired, requireScope("catalog"), getPublisher);
router.patch("/:id", authRequired, requireScope("catalog"), updatePublisher);
router.delete("/:id", authRequired, requireScope("catalog"), deletePublisher);

module.exports = router;
