import { Link, NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  Droplets,
  Library,
  Link2,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Store,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWallet } from "../../context/WalletContext";
import { canAccessAdmin } from "../../admin/roles";
import "./layout.css";

const NAV = [
  { to: "/", label: "Sàn sách", icon: Store, end: true },
  { to: "/my-books", label: "Sách của tôi", icon: Library },
];

export default function Layout() {
  const { user, logout, loading: authLoading } = useAuth();
  const { address, connect, ensureReady, busy, wrongNetwork, expectedChainId } = useWallet();
  const { count: cartCount } = useCart();
  const [faucetMsg, setFaucetMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function onFaucet() {
    try {
      const addr = (await (ensureReady?.() || connect())) || address;
      const { data } = await api.post("/wallet/faucet", { address: addr });
      setFaucetMsg(data.skipped ? data.message : `+${data.amountEth} ETH`);
      setTimeout(() => setFaucetMsg(""), 4000);
    } catch (e) {
      setFaucetMsg(e.response?.data?.message || e.message);
      setTimeout(() => setFaucetMsg(""), 5000);
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  async function onWalletClick() {
    try {
      if (wrongNetwork && ensureReady) await ensureReady();
      else await connect();
    } catch {
      /* error hiển thị qua WalletContext / MetaMask */
    }
  }

  return (
    <div className="shell">
      {wrongNetwork ? (
        <div
          className="container"
          style={{
            padding: "0.55rem 1rem",
            background: "rgba(180, 60, 40, 0.12)",
            borderBottom: "1px solid rgba(180, 60, 40, 0.35)",
            fontSize: "0.9rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <span>
            MetaMask đang sai mạng — cần chainId <strong>{expectedChainId}</strong> (BookMarket
            Private, RPC <code>http://127.0.0.1:8547</code>).
          </span>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onWalletClick}>
            Chuyển mạng
          </button>
        </div>
      ) : null}
      <header className={`topbar${scrolled ? " is-scrolled" : ""}`}>
        <div className="topbar-glow" aria-hidden="true" />
        <div className="container topbar-inner">
          <Link to="/" className="brand-lockup" onClick={closeMenu}>
            <span className="brand-mark">
              <BookOpen size={18} strokeWidth={2.2} />
            </span>
            <span className="brand-text">
              <span className="brand">BookMarket</span>
              <span className="brand-tag">Sàn sách NFT</span>
            </span>
          </Link>

          <nav className="nav desktop-nav" aria-label="Điều hướng chính">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            {(user?.canAccessAdmin || canAccessAdmin(user?.role)) && (
              <NavLink to="/admin" className="nav-link nav-admin">
                Admin
              </NavLink>
            )}
          </nav>

          <div className="top-actions">
            <Link
              to="/cart"
              className="icon-btn cart-btn"
              title="Giỏ hàng"
              aria-label={`Giỏ hàng${cartCount ? `, ${cartCount} sách` : ""}`}
            >
              <ShoppingCart size={18} />
              {cartCount > 0 ? <span className="cart-badge">{cartCount}</span> : null}
            </Link>

            {address && (
              <button
                type="button"
                className="icon-btn faucet-btn hide-sm"
                onClick={onFaucet}
                title="Nhận ETH faucet"
                aria-label="Faucet ETH"
              >
                <Droplets size={17} />
                {faucetMsg ? <span className="faucet-toast">{faucetMsg}</span> : null}
              </button>
            )}

            <button
              type="button"
              className={`wallet-chip${address ? " is-on" : ""}${wrongNetwork ? " is-warn" : ""}`}
              onClick={onWalletClick}
              disabled={busy}
              title={
                wrongNetwork
                  ? `Sai mạng — cần chainId ${expectedChainId}`
                  : address || "Kết nối MetaMask"
              }
            >
              <Wallet size={15} />
              <span className="wallet-chip-label">
                {wrongNetwork
                  ? "Sai mạng — bấm chuyển"
                  : address
                    ? `${address.slice(0, 6)}…${address.slice(-4)}`
                    : "Kết nối ví"}
              </span>
            </button>

            {authLoading ? (
              <span className="muted hide-sm" style={{ fontSize: "0.85rem" }}>
                …
              </span>
            ) : user ? (
              <button
                type="button"
                className="user-chip hide-sm"
                onClick={logout}
                title="Đăng xuất (xóa JWT)"
              >
                <span className="user-avatar" aria-hidden="true">
                  {(user.name || "U").slice(0, 1).toUpperCase()}
                </span>
                <span className="user-chip-name">{user.name}</span>
              </button>
            ) : (
              <Link className="btn btn-primary header-login hide-sm" to="/login">
                Đăng nhập
              </Link>
            )}

            <button
              type="button"
              className="icon-btn menu-toggle"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`nav-backdrop${menuOpen ? " is-open" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <aside
        id="mobile-nav-drawer"
        className={`mobile-drawer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <p className="mobile-drawer-label">Menu</p>
        <nav className="mobile-nav" aria-label="Menu di động">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="mobile-nav-link" onClick={closeMenu}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <NavLink to="/cart" className="mobile-nav-link" onClick={closeMenu}>
            <ShoppingCart size={18} />
            Giỏ hàng
            {cartCount > 0 ? <em>{cartCount}</em> : null}
          </NavLink>
          {(user?.canAccessAdmin || canAccessAdmin(user?.role)) && (
            <NavLink to="/admin" className="mobile-nav-link" onClick={closeMenu}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="mobile-drawer-foot">
          {address && (
            <button type="button" className="btn btn-ghost" onClick={onFaucet}>
              <Droplets size={16} /> {faucetMsg || "Faucet ETH"}
            </button>
          )}
          {user ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                logout();
                closeMenu();
              }}
            >
              <UserRound size={16} /> Đăng xuất · {user.name}
            </button>
          ) : (
            <Link className="btn btn-primary" to="/login" onClick={closeMenu}>
              Đăng nhập
            </Link>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="footer-brand">
            <span className="brand-mark sm">
              <BookOpen size={14} />
            </span>
            <span className="brand">BookMarket</span>
          </Link>
          <span className="muted">
            <Link2 size={14} style={{ verticalAlign: "middle" }} /> Mỗi giao dịch sách là một
            node trên chuỗi
          </span>
          <span className="muted hide-sm">
            <ShoppingBag size={14} style={{ verticalAlign: "middle" }} /> Clique · chainId 54321
          </span>
        </div>
      </footer>
    </div>
  );
}
