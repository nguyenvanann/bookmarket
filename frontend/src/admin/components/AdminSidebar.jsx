import { Link } from "react-router-dom";
import {
  BookOpen,
  ExternalLink,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
} from "lucide-react";
import { useMemo } from "react";
import { useAdmin } from "../AdminContext";
import { TABS, TAB_GROUPS } from "../constants";
import {
  filterGroupsByTabs,
  filterTabsByRole,
  roleLabel,
} from "../roles";

function userInitials(name = "", email = "") {
  const n = String(name || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(email || "AD").slice(0, 2).toUpperCase();
}

export default function AdminSidebar() {
  const { tab, setTab, sideCollapsed, toggleSide, user, logout } = useAdmin();
  const initials = userInitials(user?.name, user?.email);
  const allowedTabs = useMemo(
    () => filterTabsByRole(TABS, user?.role),
    [user?.role]
  );
  const groups = useMemo(
    () => filterGroupsByTabs(TAB_GROUPS, allowedTabs),
    [allowedTabs]
  );
  const roleText = user?.roleLabel || roleLabel(user?.role);

  return (
    <aside className={`admin-side${sideCollapsed ? " is-collapsed" : ""}`}>
      <div className="admin-side-glow" aria-hidden="true" />

      <div className="admin-side-top">
        <div className="admin-brand" title="BookMarket Admin">
          <span className="admin-brand-mark">
            <BookOpen size={18} />
          </span>
          <div className="admin-brand-text">
            <div className="brand">BookMarket</div>
            <small>Admin console</small>
          </div>
        </div>
        <button
          type="button"
          className="side-toggle"
          onClick={toggleSide}
          title={sideCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-label={sideCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-expanded={!sideCollapsed}
        >
          {sideCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="admin-nav" aria-label="Menu quản trị">
        {groups.map((group) => {
          const items = allowedTabs.filter((t) => t.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="admin-nav-group">
              <p className="admin-nav-group-label">{group.label}</p>
              <div className="admin-nav-group-items">
                {items.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => setTab(t.id)}
                      title={t.label}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="nav-ico" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="nav-label">{t.label}</span>
                      {active && <span className="nav-active-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="admin-side-foot">
        <div
          className="side-user-card"
          title={`${user?.name || ""} · ${roleText} · ${user?.email || ""}`}
        >
          <span className="side-user-avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="side-user">
            <span className="side-user-name">{user?.name || "Admin"}</span>
            <span className="side-user-email">{roleText}</span>
          </div>
        </div>

        <div className="side-foot-actions">
          <Link className="side-foot-btn" to="/" title="Về sàn sách">
            <Store size={16} />
            <span className="nav-label">Về sàn sách</span>
            <ExternalLink size={12} className="side-ext" aria-hidden="true" />
          </Link>
          <Link className="side-foot-btn" to="/ledger" title="Ledger public">
            <Link2 size={16} />
            <span className="nav-label">Ledger public</span>
            <ExternalLink size={12} className="side-ext" aria-hidden="true" />
          </Link>
          <button
            className="side-foot-btn danger"
            type="button"
            onClick={logout}
            title="Đăng xuất"
          >
            <LogOut size={16} />
            <span className="nav-label">Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
