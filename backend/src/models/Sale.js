const mongoose = require("mongoose");

/**
 * sales – Hóa đơn bán sách (nhúng chi tiết dòng hàng).
 * Chỉ phát hành (status=issued) khi giao dịch on-chain Sale thành công (TxNode).
 * Tuân thủ cấu trúc HĐ GTGT Việt Nam (người bán/mua, thuế, dòng hàng, thanh toán).
 */
const saleItemSchema = new mongoose.Schema(
  {
    lineNo: { type: Number, required: true },
    bookId: { type: Number, required: true },
    name: { type: String, required: true },
    isbn: { type: String, default: "" },
    unit: { type: String, default: "NFT" },
    quantity: { type: Number, default: 1, min: 1 },
    unitPriceWei: { type: String, default: "0" },
    unitPriceEth: { type: Number, default: 0 },
    /** Thành tiền chưa VAT */
    amountExVat: { type: Number, default: 0 },
    vatRate: { type: Number, default: 10 },
    vatAmount: { type: Number, default: 0 },
    /** Thành tiền gồm VAT */
    amountInclVat: { type: Number, default: 0 },
  },
  { _id: false }
);

const partySchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    taxCode: { type: String, default: "" }, // MST
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    bankAccount: { type: String, default: "" },
    bankName: { type: String, default: "" },
    walletAddress: { type: String, default: "", lowercase: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    // —— Định danh HĐ GTGT VN ——
    templateCode: { type: String, default: "1" }, // Mẫu số
    invoiceSymbol: { type: String, default: "C26TAA" }, // Ký hiệu
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    invoiceForm: { type: String, default: "01GTKT0/001" },
    invoiceType: { type: String, default: "GTGT" },
    issueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["issued", "cancelled"],
      default: "issued",
      index: true,
    },

    seller: { type: partySchema, required: true },
    buyer: { type: partySchema, required: true },

    /** Chi tiết hàng hóa/dịch vụ — nhúng trong hóa đơn */
    items: {
      type: [saleItemSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Hóa đơn cần ít nhất 1 dòng hàng",
      },
    },

    currency: { type: String, default: "ETH" },
    fxRateVnd: { type: Number, default: 0 },
    subtotalExVat: { type: Number, default: 0 },
    vatRate: { type: Number, default: 10 },
    vatAmount: { type: Number, default: 0 },
    totalInclVat: { type: Number, default: 0 },
    totalInclVatVnd: { type: Number, default: 0 },
    totalInWords: { type: String, default: "" },
    totalInWordsVnd: { type: String, default: "" },

    paymentMethod: { type: String, default: "CRYPTO_ETH" },
    paidAt: { type: Date, default: Date.now },

    // —— Neo blockchain (điều kiện xuất HĐ) ——
    blockchain: {
      txHash: { type: String, default: "", index: true },
      blockNumber: { type: Number, default: 0 },
      txNodeIndex: { type: Number, required: true, unique: true, index: true },
      nodeHash: { type: String, required: true, unique: true },
      prevNodeHash: { type: String, default: "" },
      saleChannel: {
        type: String,
        enum: ["primary", "marketplace", "unknown"],
        default: "unknown",
      },
      sellerWallet: { type: String, default: "", lowercase: true },
      buyerWallet: { type: String, default: "", lowercase: true },
      priceWei: { type: String, default: "0" },
      action: { type: String, default: "Sale" },
    },

    notes: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true }
);

saleSchema.set("toJSON", {
  transform(_doc, ret) {
    ret._id = String(ret._id);
    if (ret.buyer?.userId) ret.buyer.userId = String(ret.buyer.userId);
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Sale", saleSchema);
