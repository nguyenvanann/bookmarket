const Sale = require("../models/Sale");
const {
  backfillSaleInvoices,
  sellerParty,
  vatRatePercent,
} = require("../services/saleInvoiceService");
const { buildSalePdfBuffer } = require("../services/salePdfService");
const { reverseStockOutOnCancel } = require("../services/stockService");

async function findSaleByParam(id) {
  if (!id) return null;
  if (/^[a-f\d]{24}$/i.test(id)) {
    const byId = await Sale.findById(id);
    if (byId) return byId;
  }
  return (
    (await Sale.findOne({ invoiceNumber: id })) ||
    (await Sale.findOne({ "blockchain.txNodeIndex": Number(id) }))
  );
}

async function listSales(req, res, next) {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.q) {
      const s = String(req.query.q).trim();
      q.$or = [
        { invoiceNumber: new RegExp(s, "i") },
        { "buyer.name": new RegExp(s, "i") },
        { "buyer.walletAddress": new RegExp(s, "i") },
        { "blockchain.txHash": new RegExp(s, "i") },
        { "items.name": new RegExp(s, "i") },
      ];
    }
    if (req.query.bookId) q["items.bookId"] = Number(req.query.bookId);
    if (req.query.wallet) {
      q["buyer.walletAddress"] = String(req.query.wallet).toLowerCase();
    }

    const sales = await Sale.find(q).sort({ issueDate: -1 }).limit(200);
    res.json({
      sales,
      meta: {
        seller: sellerParty(),
        vatRatePercent: vatRatePercent(),
      },
    });
  } catch (e) {
    next(e);
  }
}

async function getSale(req, res, next) {
  try {
    const sale = await findSaleByParam(req.params.id);
    if (!sale) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    res.json({ sale });
  } catch (e) {
    next(e);
  }
}

async function downloadSalePdf(req, res, next) {
  try {
    const sale = await findSaleByParam(req.params.id);
    if (!sale) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    const buf = await buildSalePdfBuffer(sale);
    const filename = `${sale.invoiceNumber || "hoadon"}.pdf`;
    // ?view=1 → xem inline trên trình duyệt; mặc định tải về
    const inline = ["1", "true", "yes"].includes(String(req.query.view || "").toLowerCase());
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

async function getSaleByTxNode(req, res, next) {
  try {
    const index = Number(req.params.index);
    const sale = await Sale.findOne({ "blockchain.txNodeIndex": index });
    if (!sale) return res.status(404).json({ message: "Chưa có hóa đơn cho TxNode này" });
    res.json({ sale });
  } catch (e) {
    next(e);
  }
}

/** Hóa đơn mới nhất của một sách (theo ví người mua) — dùng sau khi mua thành công */
async function getSaleByBook(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const wallet = String(req.query.wallet || "").toLowerCase();
    const q = { "items.bookId": bookId, status: "issued" };
    if (wallet) q["buyer.walletAddress"] = wallet;
    const sale = await Sale.findOne(q).sort({ issueDate: -1 });
    if (!sale) return res.status(404).json({ message: "Chưa có hóa đơn cho sách này" });
    res.json({ sale });
  } catch (e) {
    next(e);
  }
}

async function cancelSale(req, res, next) {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Không tìm thấy hóa đơn" });
    if (sale.status === "cancelled") {
      return res.status(400).json({ message: "Hóa đơn đã hủy" });
    }
    sale.status = "cancelled";
    sale.cancelReason = String(req.body.reason || "Hủy bởi admin").trim();
    await sale.save();
    const stockRestores = await reverseStockOutOnCancel(sale, {
      reason: sale.cancelReason,
      userId: req.user?.id,
    });
    res.json({ sale, stockRestores });
  } catch (e) {
    next(e);
  }
}

async function backfill(req, res, next) {
  try {
    const limit = Math.min(Number(req.body.limit) || 100, 500);
    const results = await backfillSaleInvoices({ limit });
    const issued = results.filter((r) => r.ok).length;
    res.json({ ok: true, issued, total: results.length, results });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listSales,
  getSale,
  downloadSalePdf,
  getSaleByTxNode,
  getSaleByBook,
  cancelSale,
  backfill,
};
