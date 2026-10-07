const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const FONTS_DIR = path.join(__dirname, "../../assets/fonts");
const FONT_REG = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_BOLD = path.join(FONTS_DIR, "NotoSans-Bold.ttf");

function hasFonts() {
  return fs.existsSync(FONT_REG) && fs.existsSync(FONT_BOLD);
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return String(d);
  }
}

function short(s, n = 42) {
  const t = String(s || "");
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/**
 * Tạo buffer PDF hóa đơn GTGT từ document Sale.
 */
function buildSalePdfBuffer(sale) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 42, right: 42 },
      info: {
        Title: `Hoa don ${sale.invoiceNumber}`,
        Author: sale.seller?.name || "BookMarket",
        Subject: "Hoa don GTGT dien tu",
      },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const useVn = hasFonts();
    if (useVn) {
      doc.registerFont("VN", FONT_REG);
      doc.registerFont("VN-Bold", FONT_BOLD);
    }
    const F = useVn ? "VN" : "Helvetica";
    const FB = useVn ? "VN-Bold" : "Helvetica-Bold";

    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    let y = doc.page.margins.top;

    // Header
    doc.font(FB).fontSize(14).text("HÓA ĐƠN GIÁ TRỊ GIA TĂNG", { align: "center" });
    y = doc.y + 4;
    doc.font(F).fontSize(9).fillColor("#333");
    doc.text("(Bản thể hiện của hóa đơn điện tử)", { align: "center" });
    doc.text(
      `Mẫu số: ${sale.templateCode || "1"}   Ký hiệu: ${sale.invoiceSymbol || "—"}   Số: ${sale.invoiceNumber}`,
      { align: "center" }
    );
    doc.text(`Ngày lập: ${fmtDate(sale.issueDate)}   Trạng thái: ${sale.status}`, {
      align: "center",
    });
    y = doc.y + 12;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageW, y).stroke("#999");
    y += 14;
    doc.y = y;

    // Parties
    const colW = pageW / 2 - 8;
    const leftX = doc.page.margins.left;
    const rightX = leftX + colW + 16;
    const partyTop = doc.y;

    doc.font(FB).fontSize(10).fillColor("#000").text("NGƯỜI BÁN", leftX, partyTop, { width: colW });
    doc.font(F).fontSize(9);
    doc.text(sale.seller?.name || "—", leftX, doc.y, { width: colW });
    doc.text(`MST: ${sale.seller?.taxCode || "—"}`, leftX, doc.y, { width: colW });
    doc.text(sale.seller?.address || "—", leftX, doc.y, { width: colW });
    doc.text(`ĐT: ${sale.seller?.phone || "—"}`, leftX, doc.y, { width: colW });
    doc.text(`Email: ${sale.seller?.email || "—"}`, leftX, doc.y, { width: colW });
    if (sale.seller?.walletAddress) {
      doc.text(`Ví: ${short(sale.seller.walletAddress, 36)}`, leftX, doc.y, { width: colW });
    }
    const leftBottom = doc.y;

    doc.font(FB).fontSize(10).text("NGƯỜI MUA", rightX, partyTop, { width: colW });
    doc.font(F).fontSize(9);
    doc.text(sale.buyer?.name || "—", rightX, doc.y, { width: colW });
    doc.text(`MST: ${sale.buyer?.taxCode || "— (cá nhân)"}`, rightX, doc.y, { width: colW });
    doc.text(sale.buyer?.address || "—", rightX, doc.y, { width: colW });
    doc.text(`Email: ${sale.buyer?.email || "—"}`, rightX, doc.y, { width: colW });
    if (sale.buyer?.walletAddress) {
      doc.text(`Ví: ${short(sale.buyer.walletAddress, 36)}`, rightX, doc.y, { width: colW });
    }
    const rightBottom = doc.y;

    doc.y = Math.max(leftBottom, rightBottom) + 14;

    // Items table
    doc.font(FB).fontSize(10).text("CHI TIẾT HÀNG HÓA / DỊCH VỤ");
    doc.moveDown(0.4);

    const cols = [
      { key: "stt", label: "STT", w: 28 },
      { key: "name", label: "Tên hàng hóa", w: 170 },
      { key: "unit", label: "ĐVT", w: 36 },
      { key: "qty", label: "SL", w: 28 },
      { key: "price", label: "Đơn giá", w: 70 },
      { key: "ex", label: "Chưa thuế", w: 70 },
      { key: "vat", label: "VAT", w: 50 },
      { key: "inc", label: "Cộng", w: 58 },
    ];

    const tableX = leftX;
    let tx = tableX;
    const rowH = 22;
    const headerY = doc.y;

    doc.rect(tableX, headerY, pageW, rowH).fillAndStroke("#eef3f6", "#ccd5db");
    doc.fillColor("#000").font(FB).fontSize(8);
    tx = tableX;
    for (const c of cols) {
      doc.text(c.label, tx + 3, headerY + 6, { width: c.w - 6, align: c.key === "name" ? "left" : "center" });
      tx += c.w;
    }

    let rowY = headerY + rowH;
    doc.font(F).fontSize(8);
    const items = sale.items || [];
    for (const it of items) {
      if (rowY > doc.page.height - 160) {
        doc.addPage();
        rowY = doc.page.margins.top;
      }
      doc.rect(tableX, rowY, pageW, rowH + 8).stroke("#dde3e8");
      const cells = [
        String(it.lineNo),
        `${it.name}\nNFT #${it.bookId}${it.isbn ? ` · ${it.isbn}` : ""}`,
        it.unit || "NFT",
        String(it.quantity ?? 1),
        `${it.unitPriceEth} ETH`,
        String(it.amountExVat),
        `${it.vatRate}%`,
        String(it.amountInclVat),
      ];
      tx = tableX;
      cols.forEach((c, i) => {
        doc.text(cells[i], tx + 3, rowY + 4, {
          width: c.w - 6,
          align: i <= 1 ? "left" : "right",
        });
        tx += c.w;
      });
      rowY += rowH + 8;
    }

    doc.y = rowY + 10;

    // Totals
    doc.font(FB).fontSize(10).text("TỔNG CỘNG");
    doc.font(F).fontSize(9);
    const totals = [
      ["Cộng tiền hàng (chưa VAT)", `${sale.subtotalExVat} ETH`],
      [`Thuế GTGT (${sale.vatRate}%)`, `${sale.vatAmount} ETH`],
      ["Tổng thanh toán", `${sale.totalInclVat} ETH`],
      ["Bằng chữ", sale.totalInWords || "—"],
    ];
    if (sale.totalInclVatVnd > 0) {
      totals.push([
        "Quy đổi VND",
        `${Number(sale.totalInclVatVnd).toLocaleString("vi-VN")} đ`,
      ]);
      if (sale.totalInWordsVnd) totals.push(["Bằng chữ (VND)", sale.totalInWordsVnd]);
    }
    totals.push(["Hình thức TT", sale.paymentMethod || "CRYPTO_ETH"]);
    totals.push(["Thời điểm TT", fmtDate(sale.paidAt)]);

    for (const [k, v] of totals) {
      const ty = doc.y;
      doc.font(F).text(k, leftX, ty, { width: 200 });
      doc.font(k.startsWith("Tổng") ? FB : F).text(v, leftX + 200, ty, { width: pageW - 200 });
      doc.y = ty + 14;
    }

    doc.moveDown(0.6);
    doc.font(FB).fontSize(10).text("THÔNG TIN BLOCKCHAIN");
    doc.font(F).fontSize(8);
    const bc = sale.blockchain || {};
    doc.text(`TxNode #${bc.txNodeIndex ?? "—"} · Kênh: ${bc.saleChannel || "—"}`);
    doc.text(`nodeHash: ${bc.nodeHash || "—"}`);
    doc.text(`prevNodeHash: ${bc.prevNodeHash || "—"}`);
    doc.text(`txHash: ${bc.txHash || "—"}`);
    doc.text(`block: ${bc.blockNumber || "—"} · seller: ${bc.sellerWallet || "—"}`);

    if (sale.notes) {
      doc.moveDown(0.5);
      doc.font(F).fontSize(8).fillColor("#444").text(sale.notes, { width: pageW });
    }

    doc.moveDown(1);
    doc.fillColor("#000").font(F).fontSize(8);
    doc.text("Người mua", leftX, doc.y, { width: colW, align: "center" });
    doc.text("Người bán", rightX, doc.y - 10, { width: colW, align: "center" });
    doc.moveDown(2);
    doc.font(F).fontSize(7).fillColor("#666");
    doc.text(
      "Hóa đơn xuất sau khi giao dịch mua sách NFT xác nhận thành công trên blockchain (BookMarket).",
      { align: "center" }
    );

    doc.end();
  });
}

module.exports = { buildSalePdfBuffer };
