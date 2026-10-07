import axios from "axios";
import { clearSession, getToken, isTokenExpired } from "./authSession";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    if (isTokenExpired(token)) {
      clearSession();
      window.dispatchEvent(new CustomEvent("bm:auth-unauthorized"));
      return Promise.reject(
        Object.assign(new Error("Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại"), {
          code: "TOKEN_EXPIRED",
          config,
        })
      );
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url || "");
    // Không đá session khi chính login/register thất bại
    const isAuthAttempt = /\/auth\/(login|register)\b/.test(url);
    if (status === 401 && !isAuthAttempt && getToken()) {
      clearSession();
      window.dispatchEvent(new CustomEvent("bm:auth-unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default api;
