import { useAdmin } from "../../AdminContext";
import {
  Droplets,
  RefreshCw,
} from "lucide-react";
import { shortAddr } from "../../utils";

export default function FaucetTab() {
  const {
    users,
    busy,
    form,
    faucetAddr,
    setFaucetAddr,
    faucetAmount,
    setFaucetAmount,
    faucetBatch,
    setFaucetBatch,
    faucetForce,
    setFaucetForce,
    faucetResults,
    deployerInfo,
    user,
    fundUserWallet,
    sendFaucetSingle,
    sendFaucetBatch,
    loadDeployerBalance,
  } = useAdmin();

  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Cấp ETH cho mọi ví</h2>
            <p className="muted">
              Gửi từ deployer · số dư kho:{" "}
              <strong>{deployerInfo?.balanceEth ?? "…"} ETH</strong>
            </p>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadDeployerBalance}
            disabled={busy}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        <div className="field">
          <label>Số ETH mỗi ví</label>
          <input
            value={faucetAmount}
            onChange={(e) => setFaucetAmount(e.target.value)}
            placeholder="1"
          />
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={faucetForce}
            onChange={(e) => setFaucetForce(e.target.checked)}
          />
          Force gửi kể cả ví đã có ≥ 2 ETH
        </label>

        <form onSubmit={sendFaucetSingle} style={{ marginTop: "1rem" }}>
          <div className="field">
            <label>Một địa chỉ ví</label>
            <input
              required
              value={faucetAddr}
              onChange={(e) => setFaucetAddr(e.target.value)}
              placeholder="0x…"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Droplets size={16} /> Gửi ETH
          </button>
        </form>

        <form onSubmit={sendFaucetBatch} style={{ marginTop: "1.25rem" }}>
          <div className="field">
            <label>Hàng loạt (mỗi dòng / cách nhau bởi dấu phẩy)</label>
            <textarea
              rows={5}
              value={faucetBatch}
              onChange={(e) => setFaucetBatch(e.target.value)}
              placeholder={"0xabc…\n0xdef…\n0x123…"}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Gửi hàng loạt (tối đa 50 ví)
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Kết quả gần nhất</h2>
        </div>
        {faucetResults.length === 0 ? (
          <div className="empty">Chưa gửi lần nào trong phiên này</div>
        ) : (
          <div className="table-wrap" style={{ border: "none", boxShadow: "none" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ví</th>
                  <th>Trạng thái</th>
                  <th>Số dư</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {faucetResults.map((r, i) => (
                  <tr key={`${r.to}-${i}`}>
                    <td className="mono" title={r.to}>
                      {shortAddr(r.to)}
                    </td>
                    <td>
                      {!r.ok ? (
                        <span className="badge" style={{ color: "var(--danger)" }}>
                          lỗi
                        </span>
                      ) : r.skipped ? (
                        <span className="badge">bỏ qua</span>
                      ) : (
                        <span className="badge mint">đã gửi</span>
                      )}
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        {r.message || (r.amountEth ? `${r.amountEth} ETH` : "")}
                      </div>
                    </td>
                    <td>{r.balanceEth ?? "—"}</td>
                    <td className="mono">{r.txHash ? shortAddr(r.txHash) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel-title" style={{ marginTop: "1.25rem" }}>
          <h2>User đã gắn ví</h2>
        </div>
        <div className="chain-list">
          {users
            .filter((u) => u.walletAddress)
            .map((u) => (
              <div className="chain-node" key={u._id}>
                <div className="chain-index" style={{ fontSize: 11 }}>
                  ETH
                </div>
                <div style={{ minWidth: 0, width: "100%" }}>
                  <strong>{u.name}</strong>
                  <div className="mono muted">{u.walletAddress}</div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    style={{ marginTop: 6 }}
                    disabled={busy}
                    onClick={() => fundUserWallet(u.walletAddress)}
                  >
                    Cấp {faucetAmount || "1"} ETH
                  </button>
                </div>
              </div>
            ))}
          {users.filter((u) => u.walletAddress).length === 0 && (
            <div className="empty">Chưa có user nào link MetaMask</div>
          )}
        </div>
      </section>
    </div>
  );
}
