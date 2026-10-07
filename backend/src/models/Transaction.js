const mongoose = require("mongoose");

/**
 * Bản ghi đồng bộ từ TxNode on-chain.
 * Mỗi giao dịch nối prevNodeHash → nodeHash (chuỗi liên kết).
 */
const transactionSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true, unique: true, index: true },
    bookId: { type: Number, required: true, index: true },
    from: { type: String, default: "", lowercase: true },
    to: { type: String, default: "", lowercase: true },
    priceWei: { type: String, default: "0" },
    action: {
      type: String,
      enum: ["Mint", "Transfer", "Sale", "Faucet"],
      required: true,
    },
    timestamp: { type: Number, default: 0 },
    prevNodeHash: { type: String, required: true },
    nodeHash: { type: String, required: true, unique: true },
    txHash: { type: String, default: "", index: true },
    blockNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
