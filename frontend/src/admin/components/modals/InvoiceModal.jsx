import { useAdmin } from "../../AdminContext";
import {
  Eye,
  FileDown,
  X,
} from "lucide-react";
import { NFT } from "../../../services/contract";

export default function InvoiceModal() {
  const {
    busy,
    modal,
    viewSale,
    setViewSale,
    downloadSalePdf,
    viewSalePdf,
    cancelSaleInvoice,
  } = useAdmin();

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) setViewSale(null);
      }}
    >
      <div
        className="modal-sheet mint-modal invoice-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">Hóa đơn GTGT điện tử</p>
            <h2 id="invoice-title">{viewSale.invoiceNumber}</h2>
            <p className="muted">
              Ký hiệu {viewSale.invoiceSymbol} · Mẫu {viewSale.templateCode} ·{" "}
              {viewSale.invoiceForm}
            </p>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={() => setViewSale(null)}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body invoice-body">
          <div className="invoice-parties">
            <div>
              <h3>Người bán</h3>
              <p>
                <strong>{viewSale.seller?.name}</strong>
              </p>
              <p className="muted">MST: {viewSale.seller?.taxCode || "—"}</p>
              <p className="muted">{viewSale.seller?.address}</p>
              <p className="muted">
                {viewSale.seller?.phone} · {viewSale.seller?.email}
              </p>
            </div>
            <div>
              <h3>Người mua</h3>
              <p>
                <strong>{viewSale.buyer?.name}</strong>
              </p>
              <p className="muted">MST: {viewSale.buyer?.taxCode || "— (cá nhân)"}</p>
              <p className="muted">{viewSale.buyer?.address}</p>
              <p className="mono muted">{viewSale.buyer?.walletAddress}</p>
            </div>
          </div>

          <table className="admin-table invoice-items">
            <thead>
              <tr>
                <th>#</th>
                <th>Tên hàng hóa / dịch vụ</th>
                <th>ĐVT</th>
                <th>SL</th>
                <th>Đơn giá</th>
                <th>Chưa thuế</th>
                <th>Thuế</th>
                <th>Cộng</th>
              </tr>
            </thead>
            <tbody>
              {(viewSale.items || []).map((it) => (
                <tr key={it.lineNo}>
                  <td>{it.lineNo}</td>
                  <td>
                    {it.name}
                    <div className="muted">
                      NFT #{it.bookId}
                      {it.isbn ? ` · ISBN ${it.isbn}` : ""}
                    </div>
                  </td>
                  <td>{it.unit}</td>
                  <td>{it.quantity}</td>
                  <td className="mono">{it.unitPriceEth} ETH</td>
                  <td className="mono">{it.amountExVat}</td>
                  <td className="mono">
                    {it.vatRate}% / {it.vatAmount}
                  </td>
                  <td className="mono">{it.amountInclVat}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="kv invoice-totals">
            <dt>Cộng tiền hàng (chưa VAT)</dt>
            <dd className="mono">{viewSale.subtotalExVat} ETH</dd>
            <dt>Thuế GTGT ({viewSale.vatRate}%)</dt>
            <dd className="mono">{viewSale.vatAmount} ETH</dd>
            <dt>Tổng thanh toán</dt>
            <dd className="mono">
              <strong>{viewSale.totalInclVat} ETH</strong>
            </dd>
            <dt>Bằng chữ</dt>
            <dd>{viewSale.totalInWords}</dd>
            {viewSale.totalInclVatVnd > 0 && (
              <>
                <dt>Quy đổi VND</dt>
                <dd>
                  {viewSale.totalInclVatVnd.toLocaleString("vi-VN")} đ ·{" "}
                  {viewSale.totalInWordsVnd}
                </dd>
              </>
            )}
            <dt>Thanh toán</dt>
            <dd>
              {viewSale.paymentMethod} ·{" "}
              {viewSale.paidAt
                ? new Date(viewSale.paidAt).toLocaleString("vi-VN")
                : "—"}
            </dd>
            <dt>Blockchain</dt>
            <dd className="mono">
              TxNode #{viewSale.blockchain?.txNodeIndex} ·{" "}
              {viewSale.blockchain?.saleChannel}
              <br />
              hash: {viewSale.blockchain?.nodeHash}
              <br />
              tx: {viewSale.blockchain?.txHash || "—"}
            </dd>
          </dl>
          {viewSale.notes && <p className="l2-hint">{viewSale.notes}</p>}
          <footer className="modal-foot">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setViewSale(null)}
            >
              Đóng
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => viewSalePdf(viewSale)}
            >
              <Eye size={16} /> Xem PDF
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => downloadSalePdf(viewSale)}
            >
              <FileDown size={16} /> Tải PDF
            </button>
            {viewSale.status === "issued" && (
              <button
                className="btn btn-danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  cancelSaleInvoice(viewSale._id, viewSale.invoiceNumber)
                }
              >
                Hủy hóa đơn
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
