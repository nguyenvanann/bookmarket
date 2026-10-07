import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  clearSession,
  getCachedUser,
  getToken,
  hasValidSession,
  isTokenExpired,
  saveSession,
  updateCachedUser,
} from "../services/authSession";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    hasValidSession() ? getCachedUser() : null
  );
  const [loading, setLoading] = useState(() => hasValidSession());

  const applyUser = useCallback((next) => {
    setUser(next);
    if (next) updateCachedUser(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  /** Khôi phục phiên từ JWT trong localStorage → /auth/me */
  const restoreSession = useCallback(async () => {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      clearSession();
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { data } = await api.get("/auth/me");
      applyUser(data.user);
      return data.user;
    } catch {
      clearSession();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    if (!hasValidSession()) {
      clearSession();
      setUser(null);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    restoreSession().finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [restoreSession]);

  // Đăng xuất khi API báo 401 (token hết hạn / không hợp lệ)
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener("bm:auth-unauthorized", onUnauthorized);
    return () => window.removeEventListener("bm:auth-unauthorized", onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    saveSession({
      token: data.token,
      user: data.user,
      expiresIn: data.expiresIn,
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    saveSession({
      token: data.token,
      user: data.user,
      expiresIn: data.expiresIn,
    });
    setUser(data.user);
    return data.user;
  }, []);

  const linkWallet = useCallback(
    async (walletAddress) => {
      const { data } = await api.post("/auth/link-wallet", { walletAddress });
      applyUser(data.user);
      return data.user;
    },
    [applyUser]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user) && hasValidSession(),
      token: getToken(),
      login,
      register,
      logout,
      linkWallet,
      restoreSession,
    }),
    [user, loading, login, register, logout, linkWallet, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải dùng bên trong AuthProvider");
  }
  return ctx;
}
