const { formatEther } = require("ethers");
const Sale = require("../models/Sale");
const Book = require("../models/Book");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { ethToWords, vndToWords } = require("../utils/vnMoneyWords");
const { stockOutFromSale } = require("./stockService");

function vatRatePercent() {
  const n = Number(process.env.VAT_RATE_PERCENT ?? 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

function fxRateVnd() {
  const n = Number(process.env.ETH_VND_RATE || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sellerParty() {
  return {
    name: process.env.SELLER_LEGAL_NAME || "Công ty TNHH BookMarket Việt Nam",
    taxCode: process.env.SELLER_TAX_CODE || "0312345678",
    address:
      process.env.SELLER_ADDRESS ||
      "Tầng 1, Tòa nhà BookMarket, Quận 1, TP. Hồ Chí Minh, Việt Nam",
    phone: process.env.SELLER_PHONE || "02812345678",
    email: process.env.SELLER_EMAIL || "ke-toan@bookmarket.local",
    bankAccount: process.env.SELLER_BANK_ACCOUNT || "",
    bankName: process.env.SELLER_BANK_NAME || "",
    walletAddress: (process.env.DEPLOYER_ADDRESS || "").toLowerCase(),
  };
}

/** Giá on-chain coi là đã gồm VAT (giá thanh toán = tổng TT) */
function splitVatInclusive(totalIncl, vatPercent) {
  const rate = vatPercent / 100;
  const total = Number(totalIncl) || 0;
  if (rate <= 0) {
    return { amountExVat: total, vatAmount: 0, amountInclVat: total };
  }
  const amountExVat = total / (1 + rate);
  const vatAmount = total - amountExVat;
  return {
    amountExVat: round6(amountExVat),
    vatAmount: round6(vatAmount),
    amountInclVat: round6(total),
  };
}

function round6(n) {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `BM${year}`;
  const last = await Sale.findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber")
    .lean();
  let seq = 1;
  if (last?.invoiceNumber) {
    const m = String(last.invoiceNumber).match(/(\d+)$/);
    if (m) seq = Number(m[1]) + 1;
  }
  return `${prefix}${String(seq).padStart(7, "0")}`;
}

/**
 * Xuất hóa đơn GTGT đầy đủ khi TxNode Sale đã ghi nhận thành công trên chain.
 * Idempotent theo txNodeIndex / nodeHash.
 */
async function issueSaleInvoiceFromTxNode(txNode) {
  if (!txNode || txNode.action !== "Sale" || !txNode.bookId) {
    return null;
  }

  const existing = await Sale.findOne({
    $or: [
      { "blockchain.txNodeIndex": txNode.index },
      { "blockchain.nodeHash": txNode.nodeHash },
    ],
  });
  if (existing) return existing;

  const book = await Book.findOne({ bookId: txNode.bookId });
  const buyerUser = await User.findOne({
    walletAddress: String(txNode.to || "").toLowerCase(),
  }).select("name email walletAddress");

  const priceWei = txNode.priceWei || "0";
  let priceEth = 0;
  try {
    priceEth = Number(formatEther(priceWei));
  } catch {
    priceEth = 0;
  }

  const vatPercent = vatRatePercent();
  const split = splitVatInclusive(priceEth, vatPercent);
  const fx = fxRateVnd();
  const totalVnd = fx ? Math.round(split.amountInclVat * fx) : 0;

  const itemName = book?.name || book?.title || `Sách NFT #${txNode.bookId}`;
  const items = [
    {
      lineNo: 1,
      bookId: txNode.bookId,
      name: itemName,
      isbn: book?.isbn || "",
      unit: "NFT",
      quantity: 1,
      unitPriceWei: priceWei,
      unitPriceEth: round6(priceEth),
      amountExVat: split.amountExVat,
      vatRate: vatPercent,
      vatAmount: split.vatAmount,
      amountInclVat: split.amountInclVat,
    },
  ];

  // Kênh bán: nếu from là marketplace address → marketplace
  const marketAddr = (process.env.BOOK_MARKETPLACE_ADDRESS || "").toLowerCase();
  const from = String(txNode.from || "").toLowerCase();
  const saleChannel =
    marketAddr && from === marketAddr
      ? "marketplace"
      : from
        ? "primary"
        : "unknown";

  const invoiceNumber = await nextInvoiceNumber();
  const issueDate = txNode.timestamp
    ? new Date(Number(txNode.timestamp) * 1000)
    : new Date();

  const sale = await Sale.create({
    templateCode: process.env.INVOICE_TEMPLATE_CODE || "1",
    invoiceSymbol: process.env.INVOICE_SYMBOL || "C26TAA",
    invoiceNumber,
    invoiceForm: process.env.INVOICE_FORM || "01GTKT0/001",
    invoiceType: "GTGT",
    issueDate,
    status: "issued",
    seller: sellerParty(),
    buyer: {
      name: buyerUser?.name || `Ví ${String(txNode.to || "").slice(0, 10)}…`,
      taxCode: "",
      address: "Khách hàng cá nhân (mua bằng ví MetaMask)",
      phone: "",
      email: buyerUser?.email || "",
      walletAddress: String(txNode.to || "").toLowerCase(),
      userId: buyerUser?._id || null,
    },
    items,
    currency: "ETH",
    fxRateVnd: fx,
    subtotalExVat: split.amountExVat,
    vatRate: vatPercent,
    vatAmount: split.vatAmount,
    totalInclVat: split.amountInclVat,
    totalInclVatVnd: totalVnd,
    totalInWords: ethToWords(split.amountInclVat),
    totalInWordsVnd: totalVnd ? vndToWords(totalVnd) : "",
    paymentMethod: "CRYPTO_ETH",
    paidAt: issueDate,
    blockchain: {
      txHash: txNode.txHash || "",
      blockNumber: txNode.blockNumber || 0,
      txNodeIndex: txNode.index,
      nodeHash: txNode.nodeHash,
      prevNodeHash: txNode.prevNodeHash || "",
      saleChannel,
      sellerWallet: from,
      buyerWallet: String(txNode.to || "").toLowerCase(),
      priceWei,
      action: "Sale",
    },
    notes:
      "Hóa đơn điện tử GTGT xuất sau khi giao dịch mua sách NFT xác nhận thành công trên blockchain (TxNode). " +
      "Giá thanh toán on-chain được coi là đã bao gồm thuế GTGT theo Nghị định/Thông tư hiện hành.",
  });

  // Xuất kho: mỗi lần khách mua (HĐ phát hành) = 1 phiếu xuất
  if (book) {
    const lineQty = Number(items?.[0]?.quantity) || 1;
    // Trừ tồn trên ấn bản gốc (tên/ISBN) nếu bản vừa bán là copy qty=0
    let stockBook = book;
    if (Number(book.quantity) <= 0) {
      try {
        const { findEditionRoot } = require("./inventoryService");
        const root = await findEditionRoot(book);
        if (root && Number(root.quantity) > 0) stockBook = root;
      } catch {
        if (book.isbn) {
          const root = await Book.findOne({ isbn: book.isbn }).sort({
            quantity: -1,
          });
          if (root && Number(root.quantity) > 0) stockBook = root;
        }
      }
    }
    await stockOutFromSale({
      sale,
      book: stockBook,
      quantity: lineQty,
      unitPrice: priceEth,
      note: `Xuất kho theo mua hàng · TxNode #${txNode.index}`,
    });
  }

  // Còn tồn → mint thêm 1 NFT forSale để người khác / mua lại cùng tựa
  try {
    const { restockAfterSale } = require("./inventoryService");
    await restockAfterSale(txNode.bookId);
  } catch (e) {
    console.warn("[sale] restockAfterSale:", e.message || e);
  }

  return sale;
}

/** Quét các TxNode Sale chưa có hóa đơn → xuất bổ sung */
async function backfillSaleInvoices({ limit = 100 } = {}) {
  const sales = await Transaction.find({ action: "Sale", bookId: { $gt: 0 } })
    .sort({ index: 1 })
    .limit(limit);
  const results = [];
  for (const node of sales) {
    try {
      const inv = await issueSaleInvoiceFromTxNode(node);
      results.push({
        index: node.index,
        invoiceNumber: inv?.invoiceNumber,
        ok: true,
      });
    } catch (e) {
      results.push({ index: node.index, ok: false, message: e.message });
    }
  }
  return results;
}

module.exports = {
  issueSaleInvoiceFromTxNode,
  backfillSaleInvoices,
  sellerParty,
  vatRatePercent,
};
