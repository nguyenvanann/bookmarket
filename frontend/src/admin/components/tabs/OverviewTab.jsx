import { Link } from "react-router-dom";
import { useAdmin } from "../../AdminContext";
import { shortAddr, actionBadgeClass, actionLabel } from "../../utils";
import { formatEth, CHAIN_ID } from "../../../services/contract";

export default function OverviewTab() {
  const {
    setTab,
    dash,
    books,
    users,
    suppliers,
    ledgerTip,
    sales,
    ledger,
  } = useAdmin();

  return (
    <>
      <section className="stats">
        <div className="stat accent" style={{ animationDelay: "0s" }}>
          <strong>{dash?.stats?.books ?? "—"}</strong>
          <span>Sách NFT</span>
        </div>
        <div className="stat" style={{ animationDelay: "0.04s" }}>
          <strong>{dash?.stats?.listed ?? "—"}</strong>
          <span>Đang bán sơ cấp</span>
        </div>
        <div className="stat" style={{ animationDelay: "0.08s" }}>
          <strong>{dash?.stats?.escrow ?? "—"}</strong>
          <span>Marketplace escrow</span>
        </div>
        <div className="stat" style={{ animationDelay: "0.12s" }}>
          <strong>{dash?.stats?.transactions ?? "—"}</strong>
          <span>TxNode</span>
        </div>
        <div className="stat" style={{ animationDelay: "0.16s" }}>
          <strong>{dash?.stats?.sales ?? "—"}</strong>
          <span>Hóa đơn GTGT</span>
        </div>
        <div className="stat" style={{ animationDelay: "0.2s" }}>
          <strong>{dash?.stats?.suppliers ?? dash?.stats?.users ?? "—"}</strong>
          <span>{dash?.stats?.suppliers != null ? "NCC active" : "Users"}</span>
        </div>
      </section>

      <div className="grid-2">
        <div className="panel ledger-card">
          <div className="panel-title">
            <h2>Trạng thái sổ cái</h2>
            {ledger?.verified ? (
              <span className="badge mint">verifyChain OK</span>
            ) : (
              <span className="badge">chưa xác thực</span>
            )}
          </div>
          <dl className="kv">
            <dt>Chain ID</dt>
            <dd>{ledger?.chainId ?? CHAIN_ID}</dd>
            <dt>Block node1</dt>
            <dd>{ledger?.blockNumber ?? "—"}</dd>
            <dt>Block node2</dt>
            <dd>{ledger?.blockNumberNode2 ?? "—"}</dd>
            <dt>Nodes sync</dt>
            <dd>
              {ledger?.nodesInSync == null
                ? "—"
                : ledger.nodesInSync
                  ? "Đồng bộ"
                  : "Lệch"}
            </dd>
            <dt>Tip index</dt>
            <dd>#{ledger?.latestNodeIndex ?? ledgerTip?.latestNodeIndex ?? "—"}</dd>
            <dt>Tip hash</dt>
            <dd className="hash">{ledger?.latestNodeHash || ledgerTip?.latestNodeHash || "—"}</dd>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>TxNode mới nhất</h2>
            <button className="btn btn-ghost" type="button" onClick={() => setTab("ledger")}>
              Xem tất cả
            </button>
          </div>
          <div className="chain-list">
            {(dash?.recentTx || []).length === 0 && (
              <div className="empty">Chưa có giao dịch</div>
            )}
            {(dash?.recentTx || []).map((n) => (
              <div className="chain-node" key={n.index}>
                <div className="chain-index">{n.index}</div>
                <div>
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
                  </div>
                  <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                    {shortAddr(n.from)} → {shortAddr(n.to)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
