const StockMovement = require("../models/StockMovement");
const { ethToWords, vndToWords } = require("../utils/vnMoneyWords");

function fxRateVnd() {
  const n = Number(process.env.ETH_VND_RATE || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function orgParty() {
  return {
    name: process.env.SELLER_LEGAL_NAME || "Công ty TNHH BookMarket Việt Nam",
    taxCode: process.env.SELLER_TAX_CODE || "0312345678",
    address:
      process.env.SELLER_ADDRESS ||
      "Tầng 1, Tòa nhà BookMarket, Quận 1, TP. Hồ Chí Minh, Việt Nam",
    phone: process.env.SELLER_PHONE || "02812345678",
    email: process.env.SELLER_EMAIL || "ke-toan@bookmarket.local",
  };
}

function warehouseInfo() {
  return {
    name: process.env.WAREHOUSE_NAME || "Kho sách NFT BookMarket",
    location:
      process.env.WAREHOUSE_ADDRESS ||
      process.env.SELLER_ADDRESS ||
      "Tầng 1, Tòa nhà BookMarket, Quận 1, TP. Hồ Chí Minh",
    department: process.env.WAREHOUSE_DEPARTMENT || "Bộ phận Kho vận",
  };
}

function round6(n) {
  return Math.round((Number(n) || 0) * 1e6) / 1e6;
}

/**
 * Prefix số phiếu theo loại nghiệp vụ.
 * - in  → PNK (Phiếu nhập kho · Mẫu 01-VT)
 * - out → PXK (Phiếu xuất kho · Mẫu 02-VT)
 * - adjust tăng → PNK; giảm → PXK (kiểm kê thừa/thiếu)
 */
function voucherPrefixFor(type, delta = 0) {
  if (type === "out") return "PXK";
  if (type === "in") return "PNK";
  if (type === "adjust") return Number(delta) < 0 ? "PXK" : "PNK";
  return "PNK";
}

function voucherFormFor(prefix) {
  return prefix === "PXK" ? "02-VT" : "01-VT";
}

async function nextVoucherNumber(prefix) {
  const year = new Date().getFullYear();
  const head = `${prefix}${year}`;
  const last = await StockMovement.findOne({
    voucherNumber: new RegExp(`^${head}`),
  })
    .sort({ voucherNumber: -1 })
    .select("voucherNumber")
    .lean();
  let seq = 1;
  if (last?.voucherNumber) {
    const tail = last.voucherNumber.slice(head.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${head}${String(seq).padStart(7, "0")}`;
}

/**
 * Dựng metadata chứng từ VT gắn vào StockMovement khi tạo phiếu.
 */
async function buildVoucherFields({
  type,
  delta,
  quantity,
  unitPrice,
  book,
  supplierName = "",
  sale = null,
  note = "",
  userName = "",
  isReturn = false,
} = {}) {
  const prefix = voucherPrefixFor(type, delta);
  const form = voucherFormFor(prefix);
  const voucherNumber = await nextVoucherNumber(prefix);
  const org = orgParty();
  const wh = warehouseInfo();
  const qty = Math.abs(Number(quantity) || 0);
  const price = Number(unitPrice) || 0;
  const amount = round6(qty * price);
  const rate = fxRateVnd();
  const amountVnd = rate > 0 ? Math.round(amount * rate) : 0;

  const isOut = prefix === "PXK";
  let reason = "";
  let attachedDoc = "";
  let delivererName = "";
  let receiverName = "";

  if (type === "in" && isReturn) {
    reason = `Nhập hoàn tồn do hủy hóa đơn ${sale?.invoiceNumber || ""}`.trim();
    attachedDoc = sale?.invoiceNumber || "";
    delivererName = "Bộ phận Kinh doanh";
    receiverName = wh.department;
  } else if (type === "in") {
    reason = note || "Nhập kho hàng hóa mua ngoài";
    attachedDoc = note?.match(/HĐ|hóa đơn|PO|lệnh/i)
      ? String(note).slice(0, 80)
      : supplierName
        ? `NCC: ${supplierName}`
        : "";
    delivererName = supplierName || "Người giao hàng";
    receiverName = wh.department;
  } else if (type === "out") {
    reason =
      note ||
      `Xuất bán theo hóa đơn ${sale?.invoiceNumber || ""}`.trim() ||
      "Xuất kho bán hàng";
    attachedDoc = sale?.invoiceNumber || "";
    delivererName = wh.department;
    receiverName =
      sale?.buyer?.name ||
      sale?.buyer?.email ||
      (sale?.buyer?.walletAddress
        ? `Ví ${String(sale.buyer.walletAddress).slice(0, 10)}…`
        : "Khách hàng");
  } else if (type === "adjust") {
    reason =
      note ||
      (Number(delta) >= 0
        ? "Điều chỉnh tồn — kiểm kê thừa / bổ sung"
        : "Điều chỉnh tồn — kiểm kê thiếu / giảm");
    attachedDoc = "Phiếu điều chỉnh tồn kho";
    delivererName = Number(delta) >= 0 ? userName || "Thủ kho" : wh.department;
    receiverName = Number(delta) >= 0 ? wh.department : userName || "Thủ kho";
  }

  return {
    voucherNumber,
    voucherForm: form,
    voucherPrefix: prefix,
    issueDate: new Date(),
    organization: org,
    warehouseName: wh.name,
    warehouseLocation: wh.location,
    department: wh.department,
    delivererName,
    receiverName,
    reason,
    attachedDoc,
    bookIsbn: book?.isbn || "",
    bookUnit: "Cuốn",
    amount,
    amountInWords: ethToWords(amount),
    amountVnd,
    amountInWordsVnd: amountVnd > 0 ? vndToWords(amountVnd) : "",
    fxRateVnd: rate,
    createdByName: userName || "",
    copiesNote: isOut
      ? "Lập thành 3 liên: 1 lưu nơi lập, 1 thủ kho, 1 người nhận / kế toán"
      : "Lập thành 2 liên (mua ngoài): 1 lưu nơi lập, 1 thủ kho / kế toán",
  };
}

/**
 * Gắn số phiếu cho movement cũ (lazy) nếu thiếu — dùng khi xem PDF.
 */
async function ensureVoucherOnMovement(movement) {
  if (!movement) return null;
  if (movement.voucherNumber) return movement;

  const fields = await buildVoucherFields({
    type: movement.type,
    delta: movement.delta,
    quantity: movement.quantity,
    unitPrice: movement.unitPrice,
    book: {
      isbn: movement.bookIsbn || "",
      name: movement.bookName,
    },
    supplierName: movement.supplierName || "",
    sale: movement.saleInvoiceNumber
      ? {
          invoiceNumber: movement.saleInvoiceNumber,
          buyer: { name: movement.receiverName || "" },
        }
      : null,
    note: movement.note || "",
    userName: movement.createdByName || "",
    isReturn: /hoàn tồn|hủy HĐ/i.test(movement.note || ""),
  });

  Object.assign(movement, fields);
  await movement.save();
  return movement;
}

module.exports = {
  orgParty,
  warehouseInfo,
  buildVoucherFields,
  nextVoucherNumber,
  voucherPrefixFor,
  voucherFormFor,
  ensureVoucherOnMovement,
  fxRateVnd,
};
