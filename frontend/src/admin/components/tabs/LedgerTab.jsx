import { Link } from "react-router-dom";
import { useAdmin } from "../../AdminContext";
import {
  RefreshCw,
} from "lucide-react";
import { shortAddr, actionBadgeClass, actionLabel } from "../../utils";
import { formatEth } from "../../../services/contract";

export default function LedgerTab() {
  const {
    books,
    ledgerNodes,
    ledgerTip,
    busy,
    liveOn,
    txAction,
    setTxAction,
    txBookQ,
    setTxBookQ,
    highlightIdx,
    viewMode,
    setViewMode,
    flash,
    filteredTx,
  } = useAdmin();

  return (
    <section>
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-title">
          <div>
            <h2>Quản lý giao dịch · Chuỗi TxNode</h2>
            <p className="muted">
              Tip #{ledgerTip?.latestNodeIndex ?? "—"} ·{" "}
              {ledgerTip?.verified ? "verifyChain OK" : "chưa verify"} ·{" "}
              {liveOn ? (
                <span className="live-dot">LIVE SSE</span>
              ) : (
                <span className="muted">đang kết nối live…</span>
              )}
            </p>
          </div>
          <div className="row-actions">
            <button
              className={`btn ${viewMode === "chain" ? "btn-primary" : "btn-ghost"}`}
              type="button"
              onClick={() => setViewMode("chain")}
            >
              Chuỗi
            </button>
            <button
              className={`btn ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
              type="button"
              onClick={() => setViewMode("table")}
            >
              Bảng
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={() => loadAll().then(() => flash("Đã tải lại giao dịch"))}
            >
              <RefreshCw size={16} /> Tải lại
            </button>
          </div>
        </div>
        <div className="hash-line" style={{ marginBottom: "0.75rem" }}>
          tip hash: {ledgerTip?.latestNodeHash || "—"}
        </div>
        <div className="toolbar">
          <select value={txAction} onChange={(e) => setTxAction(e.target.value)}>
            <option value="all">Mọi loại</option>
            <option value="Mint">Mint</option>
            <option value="Sale">Sale</option>
            <option value="Transfer">Transfer</option>
            <option value="Faucet">Faucet</option>
          </select>
          <input
            placeholder="Lọc bookId…"
            value={txBookQ}
            onChange={(e) => setTxBookQ(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <span className="muted">
            {filteredTx.length}/{ledgerNodes.length} giao dịch
          </span>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="table-wrap panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Loại</th>
                <th>Sách</th>
                <th>Giá</th>
                <th>From → To</th>
                <th>prev → hash</th>
                <th>Block / Tx</th>
              </tr>
            </thead>
            <tbody>
              {[...filteredTx].reverse().map((n) => (
                <tr
                  key={n.index}
                  className={highlightIdx === n.index ? "row-flash" : ""}
                >
                  <td>
                    <strong>{n.index}</strong>
                  </td>
                  <td>
                    <span className={`badge ${actionBadgeClass(n.action)}`}>
                      {n.action}
                    </span>
                  </td>
                  <td>
                    {n.bookId > 0 ? (
                      <Link to={`/books/${n.bookId}`}>#{n.bookId}</Link>
                    ) : (
                      <span className="muted">ETH</span>
                    )}
                  </td>
                  <td>{formatEth(n.priceWei)}</td>
                  <td className="mono">
                    {shortAddr(n.from)} → {shortAddr(n.to)}
                  </td>
                  <td>
                    <div className="hash-line">p: {n.prevNodeHash}</div>
                    <div className="hash-line">h: {n.nodeHash}</div>
                  </td>
                  <td className="mono">
                    {n.blockNumber || "—"}
                    <div>{n.txHash ? shortAddr(n.txHash) : ""}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTx.length === 0 && <div className="empty">Chưa có giao dịch</div>}
        </div>
      ) : (
        <div className="panel">
          <div className="chain-list">
            {[...filteredTx].reverse().map((n) => (
              <div
                className={`chain-node ${highlightIdx === n.index ? "node-flash" : ""}`}
                key={n.index}
              >
                <div className="chain-index">{n.index}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <span className={`badge ${actionBadgeClass(n.action)}`}>
                      {n.action}
                    </span>
                    {n.bookId > 0 ? (
                      <Link className="badge" to={`/books/${n.bookId}`}>
                        Book #{n.bookId}
                      </Link>
                    ) : (
                      <span className="badge faucet">{actionLabel(n)}</span>
                    )}
                    <span className="badge sale">{formatEth(n.priceWei)}</span>
                    {highlightIdx === n.index && (
                      <span className="badge mint">mới</span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: "0.85rem", marginTop: 6 }}>
                    {n.from || "0x0"} → {n.to}
                  </div>
                  <div className="hash-line">prev: {n.prevNodeHash}</div>
                  <div className="hash-line">hash: {n.nodeHash}</div>
                </div>
              </div>
            ))}
            {filteredTx.length === 0 && <div className="empty">Chưa có node</div>}
          </div>
        </div>
      )}
    </section>
  );
}
