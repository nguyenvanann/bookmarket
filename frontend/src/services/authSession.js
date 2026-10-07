/**
 * Lưu phiên đăng nhập JWT trên trình duyệt (localStorage).
 * Token gửi kèm Authorization: Bearer … qua api interceptor.
 */

const TOKEN_KEY = "bm_token";
const USER_KEY = "bm_user";
const EXPIRES_KEY = "bm_token_exp";

/** @returns {string|null} */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Decode payload JWT (không verify — verify ở backend). */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Epoch seconds → ms; null nếu không có exp */
export function tokenExpiresAtMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return Number(payload.exp) * 1000;
}

export function isTokenExpired(token = getToken()) {
  if (!token) return true;
  const expMs = tokenExpiresAtMs(token);
  if (expMs == null) return false;
  // buffer 30s trước khi hết hạn
  return Date.now() >= expMs - 30_000;
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Lưu phiên sau login/register.
 * @param {{ token: string, user: object, expiresIn?: string|number }} session
 */
export function saveSession({ token, user, expiresIn } = {}) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  const expMs = tokenExpiresAtMs(token);
  if (expMs != null) {
    localStorage.setItem(EXPIRES_KEY, String(expMs));
  } else if (expiresIn) {
    // fallback: "7d" / seconds — chỉ lưu timestamp ước lượng nếu không parse được JWT
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + 7 * 24 * 3600 * 1000));
  }
}

export function updateCachedUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

/** Phiên còn hiệu lực trên client (có token + chưa hết hạn) */
export function hasValidSession() {
  const token = getToken();
  return Boolean(token) && !isTokenExpired(token);
}

export const AUTH_STORAGE_KEYS = { TOKEN_KEY, USER_KEY, EXPIRES_KEY };
