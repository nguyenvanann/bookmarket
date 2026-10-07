const {
  stockIn,
  stockAdjust,
  listMovements,
  getMovementById,
} = require("../services/stockService");
const { buildStockVoucherPdfBuffer } = require("../services/stockPdfService");
const { ensureVoucherOnMovement } = require("../services/stockVoucherService");

async function createStockIn(req, res, next) {
  try {
    const { bookId, quantity, unitPrice, supplierId, note } = req.body || {};
    const { movement, book } = await stockIn({
      bookId,
      quantity,
      unitPrice,
      supplierId,
      note,
      userId: req.user?.id,
    });
    res.status(201).json({
      movement,
      book,
      message: `Đã nhập kho +${movement.quantity} · phiếu ${movement.voucherNumber} · SKU #${book.bookId}`,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function createStockAdjust(req, res, next) {
  try {
    const { bookId, quantity, note } = req.body || {};
    const result = await stockAdjust({
      bookId,
      quantity,
      note,
      userId: req.user?.id,
    });
    const vn = result.movement?.voucherNumber;
    res.json({
      ...result,
      message: result.skipped
        ? "Tồn không đổi"
        : `Đã điều chỉnh tồn #${bookId} → ${quantity}${vn ? ` · phiếu ${vn}` : ""}`,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function getMovements(req, res, next) {
  try {
    const movements = await listMovements({
      bookId: req.query.bookId,
      type: req.query.type,
      limit: req.query.limit,
    });
    res.json({ movements });
  } catch (e) {
    next(e);
  }
}

async function getMovement(req, res, next) {
  try {
    const movement = await getMovementById(req.params.id);
    if (!movement) {
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }
    res.json({ movement });
  } catch (e) {
    next(e);
  }
}

/**
 * PDF phiếu nhập (01-VT) / xuất (02-VT).
 * GET /stock/movements/:id/pdf?view=1
 */
async function downloadMovementPdf(req, res, next) {
  try {
    let movement = await getMovementById(req.params.id);
    if (!movement) {
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }
    movement = await ensureVoucherOnMovement(movement);
    const buf = await buildStockVoucherPdfBuffer(movement);
    const filename = `${movement.voucherNumber || "phieu-kho"}.pdf`;
    const inline = ["1", "true", "yes"].includes(
      String(req.query.view || "").toLowerCase()
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createStockIn,
  createStockAdjust,
  getMovements,
  getMovement,
  downloadMovementPdf,
};
