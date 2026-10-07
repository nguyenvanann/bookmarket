const Book = require("../models/Book");
const StockMovement = require("../models/StockMovement");
const Supplier = require("../models/Supplier");
const User = require("../models/User");
const { buildVoucherFields } = require("./stockVoucherService");

function applyStockStatus(book) {
  const qty = Number(book.quantity) || 0;
  if (qty <= 0) {
    if (["available", "listed"].includes(book.status)) {
      book.status = "out_of_stock";
    }
  } else if (book.status === "out_of_stock") {
    book.status = book.forSale ? "listed" : "available";
  }
}

async function resolveUserName(userId) {
  if (!userId) return "";
  try {
    const u = await User.findById(userId).select("name email");
    return u?.name || u?.email || "";
  } catch {
    return "";
  }
}

/**
 * Nhập kho: tăng tồn + ghi giá vốn (unitPrice) + phiếu 01-VT.
 */
async function stockIn({
  bookId,
  quantity,
  unitPrice,
  supplierId,
  note,
  userId,
} = {}) {
  const id = Number(bookId);
  const qty = Math.floor(Number(quantity));
  const price = Number(unitPrice);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("bookId không hợp lệ");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    const err = new Error("Số lượng nhập phải > 0");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(price) || price < 0) {
    const err = new Error("Giá nhập (ETH) không hợp lệ");
    err.status = 400;
    throw err;
  }

  const book = await Book.findOne({ bookId: id });
  if (!book) {
    const err = new Error("Không tìm thấy sách trong kho");
    err.status = 404;
    throw err;
  }

  let supplierName = "";
  let resolvedSupplierId = null;
  if (supplierId) {
    const supplier = await Supplier.findById(supplierId).select("name");
    if (supplier) {
      supplierName = supplier.name;
      resolvedSupplierId = supplier._id;
    }
  }

  const before = Number(book.quantity) || 0;
  const after = before + qty;
  book.quantity = after;
  book.costPrice = price;
  if (price > 0 && (!book.price || book.price <= 0)) {
    book.price = price;
  }
  applyStockStatus(book);
  await book.save();

  const userName = await resolveUserName(userId);
  const voucher = await buildVoucherFields({
    type: "in",
    delta: qty,
    quantity: qty,
    unitPrice: price,
    book,
    supplierName,
    note: String(note || "").trim(),
    userName,
  });

  const movement = await StockMovement.create({
    bookId: id,
    bookName: book.name || "",
    type: "in",
    quantity: qty,
    delta: qty,
    unitPrice: price,
    currency: "ETH",
    balanceBefore: before,
    balanceAfter: after,
    supplierId: resolvedSupplierId,
    supplierName,
    note: String(note || "").trim(),
    createdBy: userId || null,
    ...voucher,
  });

  return { movement, book };
}

/**
 * Xuất kho gắn hóa đơn bán (mỗi lần khách mua = 1 phiếu xuất 02-VT).
 * Idempotent theo (saleId, bookId, type=out).
 */
async function stockOutFromSale({
  sale,
  book,
  quantity = 1,
  unitPrice = 0,
  note = "",
} = {}) {
  if (!sale?._id || !book) return null;

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const bookId = Number(book.bookId);
  const existing = await StockMovement.findOne({
    saleId: sale._id,
    bookId,
    type: "out",
  });
  if (existing) return { movement: existing, book, skipped: true };

  const before = Number(book.quantity) || 0;
  const after = Math.max(0, before - qty);
  book.quantity = after;
  applyStockStatus(book);
  await book.save();

  const price =
    Number(unitPrice) ||
    Number(sale.items?.[0]?.unitPriceEth) ||
    Number(book.price) ||
    0;

  const voucher = await buildVoucherFields({
    type: "out",
    delta: -qty,
    quantity: qty,
    unitPrice: price,
    book,
    sale,
    note:
      note ||
      `Xuất kho theo HĐ ${sale.invoiceNumber || ""} · mua NFT #${bookId}`,
  });

  let movement;
  try {
    movement = await StockMovement.create({
      bookId,
      bookName: book.name || sale.items?.[0]?.name || "",
      type: "out",
      quantity: qty,
      delta: -qty,
      unitPrice: price,
      currency: "ETH",
      balanceBefore: before,
      balanceAfter: after,
      saleId: sale._id,
      saleInvoiceNumber: sale.invoiceNumber || "",
      note:
        note ||
        `Xuất kho theo HĐ ${sale.invoiceNumber || ""} · mua NFT #${bookId}`,
      ...voucher,
    });
  } catch (e) {
    if (e?.code === 11000) {
      const dup = await StockMovement.findOne({
        saleId: sale._id,
        bookId,
        type: "out",
      });
      return { movement: dup, book, skipped: true };
    }
    throw e;
  }

  return { movement, book, skipped: false };
}

/**
 * Hủy hóa đơn → nhập bù (hoàn tồn) + phiếu nhập 01-VT nếu đã xuất kho.
 */
async function reverseStockOutOnCancel(sale, { reason = "", userId } = {}) {
  if (!sale?._id) return [];
  const outs = await StockMovement.find({ saleId: sale._id, type: "out" });
  const results = [];
  const userName = await resolveUserName(userId);

  for (const out of outs) {
    const already = await StockMovement.findOne({
      saleId: sale._id,
      bookId: out.bookId,
      type: "in",
      note: /hoàn tồn|hủy HĐ/i,
    });
    if (already) {
      results.push({ movement: already, skipped: true });
      continue;
    }

    const book = await Book.findOne({ bookId: out.bookId });
    if (!book) continue;

    const qty = Number(out.quantity) || 1;
    const before = Number(book.quantity) || 0;
    const after = before + qty;
    book.quantity = after;
    applyStockStatus(book);
    await book.save();

    const noteText = `Hoàn tồn do hủy HĐ ${sale.invoiceNumber || ""}${
      reason ? ` · ${reason}` : ""
    }`;
    const voucher = await buildVoucherFields({
      type: "in",
      delta: qty,
      quantity: qty,
      unitPrice: out.unitPrice || 0,
      book,
      sale,
      note: noteText,
      userName,
      isReturn: true,
    });

    const movement = await StockMovement.create({
      bookId: out.bookId,
      bookName: book.name || out.bookName || "",
      type: "in",
      quantity: qty,
      delta: qty,
      unitPrice: out.unitPrice || 0,
      currency: "ETH",
      balanceBefore: before,
      balanceAfter: after,
      saleId: sale._id,
      saleInvoiceNumber: sale.invoiceNumber || "",
      note: noteText,
      createdBy: userId || null,
      ...voucher,
    });
    results.push({ movement, book, skipped: false });
  }

  return results;
}

/**
 * Điều chỉnh tồn thủ công (stepper) — phiếu PNK/PXK theo chiều tăng/giảm.
 */
async function stockAdjust({ bookId, quantity, note, userId } = {}) {
  const id = Number(bookId);
  const next = Math.max(0, Math.floor(Number(quantity)));
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("bookId không hợp lệ");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(next)) {
    const err = new Error("Số lượng tồn không hợp lệ");
    err.status = 400;
    throw err;
  }

  const book = await Book.findOne({ bookId: id });
  if (!book) {
    const err = new Error("Không tìm thấy sách");
    err.status = 404;
    throw err;
  }

  const before = Number(book.quantity) || 0;
  const delta = next - before;
  if (delta === 0) {
    return { movement: null, book, skipped: true };
  }

  book.quantity = next;
  applyStockStatus(book);
  await book.save();

  const userName = await resolveUserName(userId);
  const price = Number(book.costPrice) || Number(book.price) || 0;
  const voucher = await buildVoucherFields({
    type: "adjust",
    delta,
    quantity: Math.abs(delta),
    unitPrice: price,
    book,
    note: String(note || "Điều chỉnh tồn thủ công").trim(),
    userName,
  });

  const movement = await StockMovement.create({
    bookId: id,
    bookName: book.name || "",
    type: "adjust",
    quantity: Math.abs(delta),
    delta,
    unitPrice: price,
    currency: "ETH",
    balanceBefore: before,
    balanceAfter: next,
    note: String(note || "Điều chỉnh tồn thủ công").trim(),
    createdBy: userId || null,
    ...voucher,
  });

  return { movement, book, skipped: false };
}

async function listMovements({ bookId, type, limit = 100 } = {}) {
  const q = {};
  if (bookId != null && bookId !== "") q.bookId = Number(bookId);
  if (type && ["in", "out", "adjust"].includes(type)) q.type = type;
  return StockMovement.find(q)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 300));
}

async function getMovementById(id) {
  if (!id) return null;
  if (/^[a-f\d]{24}$/i.test(String(id))) {
    const byId = await StockMovement.findById(id);
    if (byId) return byId;
  }
  return StockMovement.findOne({ voucherNumber: String(id) });
}

module.exports = {
  stockIn,
  stockOutFromSale,
  reverseStockOutOnCancel,
  stockAdjust,
  listMovements,
  getMovementById,
  applyStockStatus,
};
