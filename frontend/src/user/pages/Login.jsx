import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canAccessAdmin } from "../../admin/roles";

export default function Login() {
  const { login, register, user, loading, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "user@bookmarket.local",
    password: "user123",
    name: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (loading) {
    return (
      <div className="container muted" style={{ maxWidth: 460, padding: "2rem 1rem" }}>
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  // Đã có JWT hợp lệ → không bắt login lại
  if (isAuthenticated && user) {
    const dest =
      location.state?.from ||
      (user.canAccessAdmin || canAccessAdmin(user.role) ? "/admin" : "/");
    return <Navigate to={dest} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const email = form.email.trim();
    const password = form.password;
    if (!email || !password) {
      setError("Thiếu email hoặc mật khẩu");
      return;
    }
    setBusy(true);
    try {
      const next =
        mode === "login"
          ? await login(email, password)
          : await register({
              email,
              password,
              name: form.name.trim() || "Reader",
            });
      const dest =
        location.state?.from ||
        (next.canAccessAdmin || canAccessAdmin(next.role) ? "/admin" : "/");
      nav(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 460 }}>
      <div className="panel">
        <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2>
        <form onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
          {mode === "register" && (
            <div className="field">
              <label>Tên</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Mật khẩu</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: "100%" }}
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : mode === "login" ? "Vào sàn" : "Đăng ký"}
          </button>
        </form>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ width: "100%", marginTop: "0.7rem" }}
          disabled={busy}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
        <p style={{ marginTop: "1rem" }}>
          <Link to="/">← Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}
