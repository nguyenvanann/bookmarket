const mongoose = require("mongoose");

/**
 * Phiếu xuất / nhập kho (chứng từ VT — Thông tư 99/2025/TT-BTC).
 * - in:  phiếu nhập kho (Mẫu 01-VT · số PNK…)
 * - out: phiếu xuất kho (Mẫu 02-VT · số PXK…) — gắn saleId khi bán
 * - adjust: điều chỉnh tồn → PNK (tăng) hoặc PXK (giảm)
 */
const stockMovementSchema = new mongoose.Schema(
  {
    bookId: { type: Number, required: true, index: true },
    bookName: { type: String, default: "" },
    bookIsbn: { type: String, default: "" },
    bookUnit: { type: String, default: "Cuốn" },
    type: {
      type: String,
      enum: ["in", "out", "adjust"],
      required: true,
      index: true,
    },
    /** Số lượng tuyệt đối (> 0). Chiều tăng/giảm theo type / delta. */
    quantity: { type: Number, required: true, min: 0 },
    /** Điều chỉnh: dương = tăng tồn, âm = giảm tồn */
    delta: { type: Number, required: true },
    /** Giá vốn (nhập) hoặc giá bán tại thời điểm xuất (ETH) */
    unitPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "ETH" },
    amount: { type: Number, default: 0 },
    amountInWords: { type: String, default: "" },
    amountVnd: { type: Number, default: 0 },
    amountInWordsVnd: { type: String, default: "" },
    fxRateVnd: { type: Number, default: 0 },
    balanceBefore: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },

    /** Số phiếu: PNK2026xxxxxxx / PXK2026xxxxxxx — unique partial index bên dưới */
    voucherNumber: { type: String, default: "" },
    /** Mẫu số chứng từ: 01-VT | 02-VT */
    voucherForm: { type: String, default: "" },
    voucherPrefix: { type: String, default: "" },
    issueDate: { type: Date, default: null },

    organization: {
      name: { type: String, default: "" },
      taxCode: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    warehouseName: { type: String, default: "" },
    warehouseLocation: { type: String, default: "" },
    department: { type: String, default: "" },
    delivererName: { type: String, default: "" },
    receiverName: { type: String, default: "" },
    reason: { type: String, default: "" },
    attachedDoc: { type: String, default: "" },
    copiesNote: { type: String, default: "" },
    createdByName: { type: String, default: "" },

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
      index: true,
    },
    saleInvoiceNumber: { type: String, default: "", index: true },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplierName: { type: String, default: "" },
    note: { type: String, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

/** Một hóa đơn bán chỉ xuất kho 1 lần / dòng sách */
stockMovementSchema.index(
  { saleId: 1, bookId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "out", saleId: { $type: "objectId" } },
  }
);

stockMovementSchema.index(
  { voucherNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { voucherNumber: { $type: "string", $gt: "" } },
  }
);

stockMovementSchema.set("toJSON", {
  transform(_doc, ret) {
    ret._id = String(ret._id);
    if (ret.saleId) ret.saleId = String(ret.saleId);
    if (ret.supplierId) ret.supplierId = String(ret.supplierId);
    if (ret.createdBy) ret.createdBy = String(ret.createdBy);
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("StockMovement", stockMovementSchema);
