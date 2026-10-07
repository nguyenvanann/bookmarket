const multer = require("multer");
const path = require("path");

const BOOK_MIME = new Set([
  "application/pdf",
  "application/epub+zip",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

const BOOK_EXT = /\.(pdf|epub|txt|doc|docx|mobi)$/i;

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

const storage = multer.memoryStorage();

function bookFileFilter(_req, file, cb) {
  const okMime = BOOK_MIME.has(file.mimetype);
  const okExt = BOOK_EXT.test(file.originalname || "");
  if (okMime || okExt) return cb(null, true);
  cb(new Error("Chỉ chấp nhận PDF, EPUB, TXT, DOC, DOCX, MOBI (≤ 25MB)"));
}

function imageFileFilter(_req, file, cb) {
  const okMime = IMAGE_MIME.has(file.mimetype);
  const okExt = IMAGE_EXT.test(file.originalname || "");
  if (okMime || okExt) return cb(null, true);
  cb(new Error("Ảnh bìa chỉ chấp nhận JPG, PNG, WEBP, GIF (≤ 5MB)"));
}

/** Mint: chỉ file sách */
const uploadBookFile = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: bookFileFilter,
}).single("bookFile");

/**
 * Sửa sách: bookFile (nội dung) + coverImage (ảnh bìa)
 * Dùng fields với filter theo fieldname.
 */
const uploadBookAssets = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.fieldname === "bookFile") return bookFileFilter(req, file, cb);
    if (file.fieldname === "coverImage") {
      // Giới hạn ảnh chặt hơn — kiểm tra size trong controller nếu cần
      if (file.size && file.size > 5 * 1024 * 1024) {
        return cb(new Error("Ảnh bìa tối đa 5MB"));
      }
      return imageFileFilter(req, file, cb);
    }
    cb(new Error(`Field upload không hợp lệ: ${file.fieldname}`));
  },
}).fields([
  { name: "bookFile", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

function pickUploaded(req, field) {
  const list = req.files?.[field];
  return Array.isArray(list) && list[0] ? list[0] : null;
}

function coverToDataUrl(file) {
  if (!file?.buffer?.length) return "";
  const mime = file.mimetype || "image/jpeg";
  if (!IMAGE_MIME.has(mime) && !IMAGE_EXT.test(file.originalname || "")) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const map = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const guessed = map[ext] || "image/jpeg";
    return `data:${guessed};base64,${file.buffer.toString("base64")}`;
  }
  return `data:${mime};base64,${file.buffer.toString("base64")}`;
}

module.exports = {
  uploadBookFile,
  uploadBookAssets,
  pickUploaded,
  coverToDataUrl,
};
