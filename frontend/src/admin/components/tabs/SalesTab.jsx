import { useAdmin } from "../../AdminContext";
import {
  Eye,
  FileDown,
  Receipt,
  RefreshCw,
  Search,
} from "lucide-react";
import { shortAddr } from "../../utils";

export default function SalesTab() {
  const {
    busy,
    sales,
    saleQ,
    setSaleQ,
    saleFilter,
    setSaleFilter,
    setViewSale,
    filteredSales,
    downloadSalePdf,
    viewSalePdf,
    backfillSales,
  } = useAdmin();

  return (
    <section className="catalog">
      <div className="catalog-hero">
        <div>
          <h2>Hóa đơn bán sách (GTGT)</h2>
          <p className="muted">
            Xuất khi TxNode Sale on-chain thành công · chi tiết hàng nhúng trong hóa đơn ·
            thuế &amp; quy định VN
          </p>
        </div>
        <div className="catalog-hero-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={backfillSales}
          >
            <RefreshCw size={16} /> Đồng bộ từ chain
          </button>
        </div>
      </div>

      <div className="catalog-stats">
        <div className="catalog-stat">
          <strong>{sales.length}</strong>
          <span>Tổng HĐ</span>
        </div>
        <div className="catalog-stat">
          <strong>{sales.filter((s) => s.status === "issued").length}</strong>
          <span>Đã phát hành</span>
        </div>
        <div className="catalog-stat">
          <strong>{sales.filter((s) => s.status === "cancelled").length}</strong>
          <span>Đã hủy</span>
        </div>
        <div className="catalog-stat">
          <strong>{filteredSales.length}</strong>
          <span>Đang hiện</span>
        </div>
      </div>

      <div className="toolbar catalog-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Số HĐ, người mua, txHash, sách…"
            value={saleQ}
            onChange={(e) => setSaleQ(e.target.value)}
          />
        </label>
        <select value={saleFilter} onChange={(e) => setSaleFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="issued">Đã phát hành</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      <div className="table-wrap panel catalog-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Số HĐ</th>
              <th>Ngày</th>
              <th>Người mua</th>
              <th>Hàng hóa</th>
              <th>GTGT</th>
              <th>Tổng TT</th>
              <th>TxNode</th>
              <th>status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((s) => (
              <tr key={s._id}>
                <td>
                  <strong className="mono">{s.invoiceNumber}</strong>
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    {s.invoiceSymbol} · mẫu {s.templateCode}
                  </div>
                </td>
                <td>
                  {s.issueDate
                    ? new Date(s.issueDate).toLocaleString("vi-VN")
                    : "—"}
                </td>
                <td>
                  <div>{s.buyer?.name || "—"}</div>
                  <div className="mono muted" title={s.buyer?.walletAddress}>
                    {shortAddr(s.buyer?.walletAddress)}
                  </div>
                </td>
                <td className="authors-cell">
                  {(s.items || []).map((it) => (
                    <div key={it.lineNo}>
                      #{it.bookId} {it.name}
                    </div>
                  ))}
                </td>
                <td className="mono">
                  {s.vatRate}% · {s.vatAmount} ETH
                </td>
                <td className="mono">
                  <strong>{s.totalInclVat} ETH</strong>
                </td>
                <td className="mono">
                  #{s.blockchain?.txNodeIndex}
                  <div className="muted" style={{ fontSize: "0.72rem" }}>
                    {s.blockchain?.saleChannel}
                  </div>
                </td>
                <td>
                  <span
                    className={`status-pill ${
                      s.status === "issued" ? "available" : "inactive"
                    }`}
                  >
                    {s.status === "issued" ? "Đã xuất" : "Đã hủy"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setViewSale(s)}
                    >
                      Chi tiết
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      title="Xem PDF"
                      onClick={() => viewSalePdf(s)}
                    >
                      <Eye size={14} /> Xem PDF
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={busy}
                      title="Tải PDF"
                      onClick={() => downloadSalePdf(s)}
                    >
                      <FileDown size={14} /> Tải
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSales.length === 0 && (
          <div className="empty catalog-empty">
            <Receipt size={28} />
            <p>Chưa có hóa đơn — mua sách on-chain hoặc bấm Đồng bộ từ chain</p>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={backfillSales}
            >
              <RefreshCw size={16} /> Đồng bộ Sale → HĐ
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
