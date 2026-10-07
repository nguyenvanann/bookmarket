import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatEth } from "../../services/contract";
import { useLedgerLive } from "../../hooks/useLedgerLive";

export default function Ledger() {
  const [tip, setTip] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [status, setStatus] = useState(null);
  const [live, setLive] = useState(false);
  const [flashIdx, setFlashIdx] = useState(null);

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([api.get("/ledger?limit=100"), api.get("/ledger/status")]);
    setTip(l.data.tip);
    setNodes(l.data.nodes || []);
    setStatus(s.data.status);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useLedgerLive({
    enabled: true,
    onHello: () => setLive(true),
    onTx: ({ node, tip: t }) => {
      setLive(true);
      if (t) setTip(t);
      setNodes((prev) => {
        const i = prev.findIndex((n) => n.index === node.index);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], ...node };
          return next;
        }
        return [...prev, node].sort((a, b) => a.index - b.index);
      });
      setFlashIdx(node.index);
      window.setTimeout(() => setFlashIdx((x) => (x === node.index ? null : x)), 4000);
    },
    onTip: (t) => {
      if (t) setTip(t);
    },
  });

  return (
    <div className="container">
      <h2>Chuỗi giao dịch toàn sàn</h2>
      <p className="muted">
        Mọi mint / bán / cấp ETH tạo TxNode: <code>nodeHash = keccak256(..., prevNodeHash)</code>
        {live ? (
          <>
            {" "}
            · <span className="badge mint">LIVE</span>
          </>
        ) : null}
      </p>

      <div className="panel" style={{ margin: "1rem 0", display: "grid", gap: "0.35rem" }}>
        <div>
          Tip index: <strong>{tip?.latestNodeIndex ?? "—"}</strong>{" "}
          {tip?.verified ? (
            <span className="badge mint">verifyChain OK</span>
          ) : (
            <span className="badge">chưa xác thực</span>
          )}
        </div>
        <div className="hash-line">latest: {tip?.latestNodeHash}</div>
        {status && (
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            Node1 block {status.blockNumber}
            {status.blockNumberNode2 != null && ` · Node2 block ${status.blockNumberNode2}`}
            {status.nodesInSync != null &&
              ` · sync: ${status.nodesInSync ? "OK" : " lệch"}`}
          </div>
        )}
      </div>

      <div className="chain-list">
        {[...nodes].reverse().map((n) => (
          <div
            className="chain-node"
            key={n.index}
            style={
              flashIdx === n.index
                ? { boxShadow: "0 0 0 2px rgba(13,115,119,0.5)", background: "rgba(13,115,119,0.08)" }
                : undefined
            }
          >
            <div className="chain-index">{n.index}</div>
            <div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <span
                  className={`badge ${
                    n.action === "Mint" ? "mint" : n.action === "Faucet" ? "faucet" : "sale"
                  }`}
                >
                  {n.action}
                </span>
                {n.bookId > 0 ? (
                  <Link className="badge" to={`/books/${n.bookId}`}>
                    Book #{n.bookId}
                  </Link>
                ) : (
                  <span className="badge faucet">Faucet ETH</span>
                )}
                <span className="badge sale">{formatEth(n.priceWei)}</span>
                {flashIdx === n.index && <span className="badge mint">mới</span>}
              </div>
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                {(n.from || "0x0").slice(0, 12)} → {(n.to || "").slice(0, 12)}
              </div>
              <div className="hash-line">prev: {n.prevNodeHash}</div>
              <div className="hash-line">hash: {n.nodeHash}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
