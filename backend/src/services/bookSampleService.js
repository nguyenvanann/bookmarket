const { PDFDocument, rgb, degrees, StandardFonts } = require("pdf-lib");

/** Cứng: đọc thử chỉ tối đa 10 trang đầu — không cho vượt. */
const SAMPLE_PAGES = 10;

function isPdfBuffer(buf) {
  if (!buf?.length || buf.length < 5) return false;
  return buf.slice(0, 5).toString("utf8") === "%PDF-";
}

function isPdfBook(book) {
  const mime = String(book?.mimeType || "").toLowerCase();
  const name = String(book?.fileName || "").toLowerCase();
  return (
    mime.includes("pdf") ||
    name.endsWith(".pdf") ||
    isPdfBuffer(book?.fileData)
  );
}

/**
 * Tạo PDF mẫu chỉ gồm tối đa 10 trang đầu của file gốc.
 * File trả về không chứa các trang sau trang 10.
 */
async function buildSamplePdfBuffer(fileBuffer) {
  if (!isPdfBuffer(fileBuffer)) {
    const err = new Error("Chỉ hỗ trợ đọc thử với file PDF");
    err.status = 400;
    throw err;
  }

  let src;
  try {
    src = await PDFDocument.load(fileBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch (e) {
    const err = new Error("Không đọc được file PDF để tạo bản mẫu");
    err.status = 422;
    throw err;
  }

  const total = src.getPageCount();
  if (total <= 0) {
    const err = new Error("File PDF không có trang");
    err.status = 422;
    throw err;
  }

  // Chỉ lấy trang 0..9 (tối đa 10 trang)
  const take = Math.min(SAMPLE_PAGES, total);
  const out = await PDFDocument.create();
  const indices = Array.from({ length: take }, (_, i) => i);
  const copied = await out.copyPages(src, indices);
  const font = await out.embedFont(StandardFonts.Helvetica);

  copied.forEach((page, idx) => {
    out.addPage(page);
    const { width, height } = page.getSize();
    // Watermark góc — đánh dấu bản đọc thử, không phải full
    page.drawText(`MAU ${idx + 1}/${take} · DOC THU 10 TRANG DAU`, {
      x: 18,
      y: Math.max(14, height - 22),
      size: 8,
      font,
      color: rgb(0.55, 0.25, 0.1),
      opacity: 0.85,
    });
    page.drawText("BOOKMARKET SAMPLE — MUA DE DOC FULL", {
      x: width / 2 - 90,
      y: height / 2,
      size: 14,
      font,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.22,
      rotate: degrees(-28),
    });
  });

  // Đảm bảo document mới không còn tham chiếu trang thừa
  if (out.getPageCount() > SAMPLE_PAGES) {
    const err = new Error("Loi cat mau PDF");
    err.status = 500;
    throw err;
  }

  out.setTitle("Doc thu 10 trang dau - BookMarket");
  out.setSubject(`Chi ${take} trang dau / tong ${total} trang`);
  out.setKeywords(["sample", "doc-thu", "10-trang"]);
  out.setProducer("BookMarket Sample Cutter");
  out.setCreator("BookMarket");

  const bytes = await out.save({ useObjectStreams: false });
  const buffer = Buffer.from(bytes);

  // Kiểm tra lại bằng cách load buffer kết quả
  const verify = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const verifiedPages = verify.getPageCount();
  if (verifiedPages > SAMPLE_PAGES) {
    const err = new Error("Ban mau vuot qua 10 trang — da chan");
    err.status = 500;
    throw err;
  }

  return {
    buffer,
    pageCount: verifiedPages,
    totalPages: total,
    isFullCopy: take >= total,
    maxSamplePages: SAMPLE_PAGES,
  };
}

module.exports = {
  SAMPLE_PAGES,
  isPdfBook,
  isPdfBuffer,
  buildSamplePdfBuffer,
};
