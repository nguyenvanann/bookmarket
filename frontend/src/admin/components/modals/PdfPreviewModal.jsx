import { ExternalLink, FileDown, X } from "lucide-react";
import { useAdmin } from "../../AdminContext";

export default function PdfPreviewModal() {
  const {
    busy,
    pdfPreview,
    closePdfPreview,
    downloadPdfPreview,
  } = useAdmin();

  const eyebrow =
    pdfPreview?.kind === "stock" ? "Xem phiếu kho PDF" : "Xem hóa đơn PDF";
  const hint =
    pdfPreview?.kind === "stock"
      ? "Mẫu 01-VT / 02-VT · Thông tư 99/2025/TT-BTC"
      : "Xem trước trên trình duyệt · có thể tải về";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePdfPreview();
      }}
    >
      <div
        className="modal-sheet mint-modal pdf-preview-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">{eyebrow}</p>
            <h2 id="pdf-preview-title">{pdfPreview.title}</h2>
            <p className="muted">{hint}</p>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={closePdfPreview}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>
        <div className="pdf-preview-frame-wrap">
          <iframe
            className="pdf-preview-frame"
            title={`PDF ${pdfPreview.title}`}
            src={`${pdfPreview.url}#view=FitH`}
          />
        </div>
        <footer className="modal-foot" style={{ padding: "0.85rem 1.35rem 1.15rem" }}>
          <button className="btn btn-ghost" type="button" onClick={closePdfPreview}>
            Đóng
          </button>
          <a
            className="btn btn-ghost"
            href={pdfPreview.url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} /> Tab mới
          </a>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => downloadPdfPreview()}
          >
            <FileDown size={16} /> Tải PDF
          </button>
        </footer>
      </div>
    </div>
  );
}
