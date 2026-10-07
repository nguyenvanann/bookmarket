const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const FONTS_DIR = path.join(__dirname, "../../assets/fonts");
const FONT_REG = path.join(FONTS_DIR, "NotoSans-Regular.ttf");
const FONT_BOLD = path.join(FONTS_DIR, "NotoSans-Bold.ttf");

function hasFonts() {
  return fs.existsSync(FONT_REG) && fs.existsSync(FONT_BOLD);
}

function fmtDateParts(d) {
  const dt = d ? new Date(d) : new Date();
  if (Number.isNaN(dt.getTime())) {
    return { day: "…", month: "…", year: "…", full: "—" };
  }
  return {
    day: String(dt.getDate()).padStart(2, "0"),
    month: String(dt.getMonth() + 1).padStart(2, "0"),
    year: String(dt.getFullYear()),
    full: dt.toLocaleString("vi-VN"),
  };
}

function moneyEth(n) {
  const v = Number(n) || 0;
  if (v === 0) return "0";
  if (v >= 1) return v.toFixed(4).replace(/\.?0+$/, "");
  return v.toFixed(6).replace(/\.?0+$/, "");
}

function moneyVnd(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("vi-VN")} đ`;
}

/**
 * PDF Phiếu nhập kho (01-VT) / Phiếu xuất kho (02-VT)
 * theo mẫu chứng từ hàng tồn kho — Thông tư 99/2025/TT-BTC.
 */
function buildStockVoucherPdfBuffer(movement) {
  return new Promise((resolve, reject) => {
    const isOut = movement.voucherPrefix === "PXK" || movement.voucherForm === "02-VT";
    const title = isOut ? "PHIẾU XUẤT KHO" : "PHIẾU NHẬP KHO";
    const form = movement.voucherForm || (isOut ? "02-VT" : "01-VT");
    const voucherNo = movement.voucherNumber || "—";

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 40, right: 40 },
      info: {
        Title: `${title} ${voucherNo}`,
        Author: movement.organization?.name || "BookMarket",
        Subject: `Mau so ${form} - Thong tu 99/2025/TT-BTC`,
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

    const left = doc.page.margins.left;
    const pageW = doc.page.width - left - doc.page.margins.right;
    const org = movement.organization || {};
    const date = fmtDateParts(movement.issueDate || movement.createdAt);
    const qty = Math.abs(Number(movement.quantity) || 0);
    const price = Number(movement.unitPrice) || 0;
    const amount = Number(movement.amount) || qty * price;

    // —— Header: đơn vị (trái) + mẫu số (phải)
    const headerTop = doc.y;
    doc.font(FB).fontSize(10).fillColor("#000").text(org.name || "Đơn vị", left, headerTop, {
      width: pageW * 0.55,
    });
    doc.font(F).fontSize(8).fillColor("#333");
    doc.text(`MST: ${org.taxCode || "—"}`, left, doc.y, { width: pageW * 0.55 });
    doc.text(org.address || "", left, doc.y, { width: pageW * 0.55 });
    doc.text(`Bộ phận: ${movement.department || "Kho"}`, left, doc.y, {
      width: pageW * 0.55,
    });
    const leftBottom = doc.y;

    const rightX = left + pageW * 0.58;
    doc.font(FB).fontSize(9).fillColor("#000").text(`Mẫu số: ${form}`, rightX, headerTop, {
      width: pageW * 0.42,
      align: "center",
    });
    doc.font(F).fontSize(7).fillColor("#444");
    doc.text("(Ban hành theo Thông tư số 99/2025/TT-BTC", rightX, doc.y, {
      width: pageW * 0.42,
      align: "center",
    });
    doc.text("ngày 27/10/2025 của Bộ Tài chính)", rightX, doc.y, {
      width: pageW * 0.42,
      align: "center",
    });

    doc.y = Math.max(leftBottom, doc.y) + 12;

    // —— Title
    doc.font(FB).fontSize(16).fillColor("#000").text(title, left, doc.y, {
      width: pageW,
      align: "center",
    });
    doc.moveDown(0.25);
    doc.font(FB).fontSize(11).text(`Số: ${voucherNo}`, { align: "center" });
    doc.font(F).fontSize(9).fillColor("#222");
    doc.text(`Ngày ${date.day} tháng ${date.month} năm ${date.year}`, {
      align: "center",
    });
    doc.moveDown(0.55);

    // —— Meta block
    const metaLines = isOut
      ? [
          `Họ và tên người nhận hàng: ${movement.receiverName || "—"}`,
          `Đơn vị (bộ phận): ${movement.department || "—"}`,
          `Lý do xuất kho: ${movement.reason || "—"}`,
          `Xuất tại kho: ${movement.warehouseName || "—"}    Địa điểm: ${movement.warehouseLocation || "—"}`,
          movement.attachedDoc
            ? `Chứng từ kèm theo: ${movement.attachedDoc}`
            : null,
        ]
      : [
          `Họ và tên người giao hàng: ${movement.delivererName || "—"}`,
          `Theo chứng từ (HĐ / lệnh nhập): ${movement.attachedDoc || "—"}`,
          `Lý do nhập kho: ${movement.reason || "—"}`,
          `Nhập tại kho: ${movement.warehouseName || "—"}    Địa điểm: ${movement.warehouseLocation || "—"}`,
        ];

    doc.font(F).fontSize(9).fillColor("#000");
    for (const line of metaLines.filter(Boolean)) {
      doc.text(line, left, doc.y, { width: pageW });
      doc.moveDown(0.2);
    }
    doc.moveDown(0.35);

    // —— Table (01-VT / 02-VT columns)
    const cols = isOut
      ? [
          { key: "stt", label: "STT", w: 28, sub: "A" },
          { key: "name", label: "Tên, nhãn hiệu, quy cách", w: 150, sub: "B" },
          { key: "code", label: "Mã số", w: 48, sub: "C" },
          { key: "unit", label: "ĐVT", w: 36, sub: "D" },
          { key: "req", label: "SL yêu cầu", w: 52, sub: "1" },
          { key: "real", label: "SL thực xuất", w: 58, sub: "2" },
          { key: "price", label: "Đơn giá", w: 62, sub: "3" },
          { key: "amt", label: "Thành tiền", w: 66, sub: "4" },
        ]
      : [
          { key: "stt", label: "STT", w: 28, sub: "A" },
          { key: "name", label: "Tên, nhãn hiệu, quy cách", w: 150, sub: "B" },
          { key: "code", label: "Mã số", w: 48, sub: "C" },
          { key: "unit", label: "ĐVT", w: 36, sub: "D" },
          { key: "doc", label: "SL theo CT", w: 52, sub: "1" },
          { key: "real", label: "SL thực nhập", w: 58, sub: "2" },
          { key: "price", label: "Đơn giá", w: 62, sub: "3" },
          { key: "amt", label: "Thành tiền", w: 66, sub: "4" },
        ];

    const tableW = cols.reduce((s, c) => s + c.w, 0);
    const scale = pageW / tableW;
    cols.forEach((c) => {
      c.w = Math.floor(c.w * scale);
    });
    // fix rounding
    const used = cols.reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w += Math.floor(pageW - used);

    const headH = 32;
    let y = doc.y;
    doc.rect(left, y, pageW, headH).fillAndStroke("#eef3f6", "#9aa8b2");
    doc.fillColor("#000").font(FB).fontSize(7);
    let x = left;
    for (const c of cols) {
      doc.text(c.label, x + 2, y + 5, {
        width: c.w - 4,
        align: "center",
      });
      doc.font(F).fontSize(6).fillColor("#555").text(c.sub, x + 2, y + 18, {
        width: c.w - 4,
        align: "center",
      });
      doc.font(FB).fontSize(7).fillColor("#000");
      x += c.w;
    }

    // vertical lines in header
    x = left;
    for (let i = 0; i < cols.length - 1; i += 1) {
      x += cols[i].w;
      doc
        .moveTo(x, y)
        .lineTo(x, y + headH)
        .stroke("#9aa8b2");
    }

    y += headH;
    const rowH = 40;
    const isbn = movement.bookIsbn ? `ISBN: ${movement.bookIsbn}` : "";
    const nameCell = [
      movement.bookName || "Hàng hóa",
      `NFT sách #${movement.bookId}`,
      isbn,
    ]
      .filter(Boolean)
      .join("\n");

    const cells = [
      "1",
      nameCell,
      String(movement.bookId),
      movement.bookUnit || "Cuốn",
      String(qty),
      String(qty),
      `${moneyEth(price)} ETH`,
      `${moneyEth(amount)} ETH`,
    ];

    doc.rect(left, y, pageW, rowH).stroke("#9aa8b2");
    x = left;
    doc.font(F).fontSize(8).fillColor("#000");
    cols.forEach((c, i) => {
      const align = i <= 1 ? "left" : "center";
      doc.text(cells[i], x + 3, y + 6, {
        width: c.w - 6,
        align,
      });
      x += c.w;
    });
    x = left;
    for (let i = 0; i < cols.length - 1; i += 1) {
      x += cols[i].w;
      doc
        .moveTo(x, y)
        .lineTo(x, y + rowH)
        .stroke("#9aa8b2");
    }

    y += rowH;

    // Total row
    const totalH = 22;
    doc.rect(left, y, pageW, totalH).fillAndStroke("#f7fafb", "#9aa8b2");
    doc.font(FB).fontSize(8).fillColor("#000");
    const labelW = cols.slice(0, 6).reduce((s, c) => s + c.w, 0);
    doc.text("Cộng", left + 4, y + 6, { width: labelW - 8, align: "right" });
    doc.text(`${moneyEth(amount)} ETH`, left + labelW + 3, y + 6, {
      width: pageW - labelW - 6,
      align: "center",
    });
    x = left;
    for (let i = 0; i < cols.length - 1; i += 1) {
      x += cols[i].w;
      doc
        .moveTo(x, y)
        .lineTo(x, y + totalH)
        .stroke("#9aa8b2");
    }

    doc.y = y + totalH + 10;

    // Totals in words
    doc.font(F).fontSize(9).fillColor("#000");
    doc.text(
      `- Tổng số tiền (viết bằng chữ): ${movement.amountInWords || "—"}`,
      left,
      doc.y,
      { width: pageW }
    );
    if (movement.amountVnd > 0) {
      doc.moveDown(0.2);
      doc.text(
        `- Quy đổi VND (tỷ giá ${Number(movement.fxRateVnd).toLocaleString("vi-VN")}): ${moneyVnd(movement.amountVnd)}`,
        left,
        doc.y,
        { width: pageW }
      );
      if (movement.amountInWordsVnd) {
        doc.moveDown(0.15);
        doc.text(`- Bằng chữ (VND): ${movement.amountInWordsVnd}`, left, doc.y, {
          width: pageW,
        });
      }
    }
    doc.moveDown(0.25);
    doc.font(F).fontSize(8).fillColor("#444");
    doc.text(
      `- Tồn trước / sau: ${movement.balanceBefore ?? "—"} → ${movement.balanceAfter ?? "—"}` +
        (movement.note ? `   · Ghi chú: ${movement.note}` : ""),
      left,
      doc.y,
      { width: pageW }
    );
    if (movement.copiesNote) {
      doc.moveDown(0.2);
      doc.text(`- ${movement.copiesNote}`, left, doc.y, { width: pageW });
    }

    doc.moveDown(0.9);
    doc.font(F).fontSize(7).fillColor("#666");
    doc.text(
      "Số chứng từ gốc kèm theo phiếu này: …………………… chứng từ.",
      left,
      doc.y,
      { width: pageW }
    );

    // —— Signatures
    doc.moveDown(1.1);
    const sigY = doc.y;
    const sigCols = isOut
      ? [
          "Người lập phiếu",
          "Người nhận hàng",
          "Thủ kho",
          "Kế toán trưởng",
          "Thủ trưởng đơn vị",
        ]
      : [
          "Người lập phiếu",
          "Người giao hàng",
          "Thủ kho",
          "Kế toán trưởng",
          "Thủ trưởng đơn vị",
        ];
    const sigW = pageW / sigCols.length;
    doc.font(FB).fontSize(7).fillColor("#000");
    sigCols.forEach((label, i) => {
      const sx = left + i * sigW;
      doc.text(label, sx, sigY, { width: sigW - 4, align: "center" });
      doc.font(F).fontSize(6).fillColor("#666");
      doc.text("(Ký, họ tên)", sx, sigY + 11, { width: sigW - 4, align: "center" });
      doc.font(FB).fontSize(7).fillColor("#000");
    });

    // Pre-fill người lập if known
    if (movement.createdByName) {
      doc.font(F).fontSize(8).fillColor("#222");
      doc.text(movement.createdByName, left, sigY + 48, {
        width: sigW - 4,
        align: "center",
      });
    }

    doc.moveDown(4);
    doc.font(F).fontSize(7).fillColor("#888");
    doc.text(
      "Chứng từ điện tử BookMarket — bản thể hiện PDF của phiếu xuất/nhập kho. " +
        `Lập lúc ${date.full}.`,
      left,
      doc.page.height - 48,
      { width: pageW, align: "center" }
    );

    doc.end();
  });
}

module.exports = { buildStockVoucherPdfBuffer };
