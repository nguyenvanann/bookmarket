const express = require("express");
const {
  listBooks,
  getBook,
  adminMint,
  downloadBookFile,
  downloadBookSample,
  updateBookMeta,
  refreshBook,
  deleteBook,
  restoreBook,
  prepareCheckoutUnits,
  listEditionAvailability,
} = require("../controllers/bookController");
const { authRequired, requireScope } = require("../middlewares/authMiddleware");
const { uploadBookAssets } = require("../middlewares/uploadMiddleware");

const router = express.Router();

function handleAssetsUpload(req, res, next) {
  uploadBookAssets(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload thất bại" });
    }
    next();
  });
}

router.get("/", listBooks);
router.post(
  "/admin/mint",
  authRequired,
  requireScope("mint"),
  handleAssetsUpload,
  adminMint
);
/** Đọc thử 10 trang đầu — công khai */
router.get("/:bookId/sample", downloadBookSample);
/** Đọc / tải toàn bộ — chủ sở hữu NFT hoặc admin (?view=1 xem inline) */
router.get("/:bookId/file", authRequired, downloadBookFile);
/** Ấn bản còn bao nhiêu bản có thể mua (NFT forSale + tồn kho) */
router.get("/:bookId/availability", listEditionAvailability);
/** Mint thêm bản forSale nếu thiếu — trước khi mua nhiều cuốn / qty > 1 */
router.post("/:bookId/prepare-checkout", prepareCheckoutUnits);
router.get("/:bookId", getBook);
router.post("/:bookId/refresh", refreshBook);
router.patch(
  "/:bookId/meta",
  authRequired,
  requireScope("books"),
  handleAssetsUpload,
  updateBookMeta
);
router.delete(
  "/:bookId",
  authRequired,
  requireScope("books"),
  deleteBook
);
router.post(
  "/:bookId/restore",
  authRequired,
  requireScope("books"),
  restoreBook
);

module.exports = router;
