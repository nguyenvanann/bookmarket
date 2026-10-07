import { useAdmin } from "../../AdminContext";
import {
  Droplets,
} from "lucide-react";
import { NFT, MARKET, CHAIN_ID, RPC_URL } from "../../../services/contract";

export default function SystemTab() {
  const {
    setTab,
    busy,
    onRefreshBooks,
    onResync,
    ledger,
  } = useAdmin();

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Cấu hình mạng</h2>
      </div>
      <dl className="kv">
        <dt>RPC</dt>
        <dd className="mono">{RPC_URL}</dd>
        <dt>Chain ID</dt>
        <dd>{CHAIN_ID}</dd>
        <dt>BookNFT</dt>
        <dd className="mono">{NFT || ledger?.bookNft || "—"}</dd>
        <dt>Marketplace</dt>
        <dd className="mono">{MARKET || ledger?.marketplace || "—"}</dd>
        <dt>RPC node2</dt>
        <dd className="mono">{ledger?.rpc2 || "—"}</dd>
      </dl>
      <div className="row-actions" style={{ marginTop: "1rem" }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={onResync}>
          Resync chain → Mongo
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={busy}
          onClick={onRefreshBooks}
        >
          Refresh toàn bộ sách
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => setTab("faucet")}>
          <Droplets size={16} /> Mở Cấp ETH
        </button>
      </div>
    </section>
  );
}
