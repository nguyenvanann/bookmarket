import { Moon, PanelLeftClose, PanelLeftOpen, RefreshCw, Sun } from "lucide-react";
import { useAdmin } from "../AdminContext";
import { TABS } from "../constants";
import { hasScope } from "../roles";

export default function AdminHeader() {
  const {
    tab,
    busy,
    sideCollapsed,
    toggleSide,
    darkMode,
    toggleDark,
    onRefreshBooks,
    onResync,
    user,
  } = useAdmin();
  const canSystem = hasScope(user?.role, "system");

  return (
    <header className="admin-head">
      <div>
        <h1>{TABS.find((t) => t.id === tab)?.label || "Admin"}</h1>
        <p className="muted">Quản lý NFT sách, chuỗi TxNode và đồng bộ Geth ↔ Mongo</p>
      </div>
      <div className="admin-head-actions">
        <button
          className="btn btn-ghost side-toggle-mobile"
          type="button"
          onClick={toggleSide}
          title={sideCollapsed ? "Mở sidebar" : "Thu gọn sidebar"}
        >
          {sideCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <button
          className={`btn btn-ghost theme-toggle${darkMode ? " active" : ""}`}
          type="button"
          onClick={toggleDark}
          title={darkMode ? "Chuyển sáng" : "Chuyển tối"}
          aria-pressed={darkMode}
          aria-label={darkMode ? "Bật giao diện sáng" : "Bật giao diện tối"}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span className="theme-toggle-label">{darkMode ? "Sáng" : "Tối"}</span>
        </button>
        {canSystem && (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={onRefreshBooks}>
              <RefreshCw size={16} /> Refresh sách
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={onResync}>
              <RefreshCw size={16} /> Resync chain
            </button>
          </>
        )}
      </div>
    </header>
  );
}
