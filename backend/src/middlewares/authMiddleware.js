const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { hasScope, canAccessAdmin, STAFF_ROLES } = require("../constants/roles");

function readBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("Thiếu JWT_SECRET");
    err.name = "JsonWebTokenError";
    throw err;
  }
  return jwt.verify(token, secret);
}

function authRequired(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ message: "Chưa đăng nhập (thiếu JWT)" });
  }
  try {
    const payload = verifyJwt(token);
    req.user = payload;
    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn" });
    }
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
}

function authOptional(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    try {
      req.user = verifyJwt(token);
    } catch {
      /* ignore — khách chưa login / token cũ */
    }
  }
  next();
}

async function attachDbRole(req) {
  if (!req.user?.id) return null;
  const user = await User.findById(req.user.id).select("role email name");
  if (!user) return null;
  req.user.role = user.role;
  req.user.email = user.email;
  req.user.name = user.name;
  return user;
}

/** Cho phép nếu role nằm trong danh sách */
function requireRole(...roles) {
  const allowed = roles.length ? roles : STAFF_ROLES;
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const user = await attachDbRole(req);
    if (!user || !allowed.includes(user.role)) {
      return res.status(403).json({ message: "Không đủ quyền truy cập" });
    }
    next();
  };
}

/** Bất kỳ role có quyền vào admin console */
function requireStaffAccess() {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const user = await attachDbRole(req);
    if (!user || !canAccessAdmin(user.role)) {
      return res.status(403).json({ message: "Không có quyền vào trang quản trị" });
    }
    next();
  };
}

/** Yêu cầu ít nhất một scope (admin = *) */
function requireScope(...scopes) {
  return async (req, res, next) => {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const user = await attachDbRole(req);
    if (!user) return res.status(403).json({ message: "Forbidden" });
    const ok = scopes.some((s) => hasScope(user.role, s));
    if (!ok) {
      return res.status(403).json({
        message: `Thiếu quyền: cần ${scopes.join(" hoặc ")}`,
      });
    }
    next();
  };
}

module.exports = {
  authRequired,
  authOptional,
  requireRole,
  requireStaffAccess,
  requireScope,
};
