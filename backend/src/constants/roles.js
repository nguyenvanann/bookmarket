/**
 * Phân quyền admin console theo role.
 * - user: chỉ sàn người dùng
 * - admin: toàn quyền
 * - staff: vận hành + danh mục
 * - warehouse: kho / NCC / danh mục
 * - accountant: hóa đơn + ledger
 */

const ROLES = ["user", "admin", "staff", "warehouse", "accountant"];

const STAFF_ROLES = ["admin", "staff", "warehouse", "accountant"];

const ROLE_META = {
  user: { label: "Người dùng", scopes: [] },
  admin: { label: "Quản trị viên", scopes: ["*"] },
  staff: {
    label: "Nhân viên",
    scopes: ["dashboard", "mint", "books", "stock", "catalog"],
  },
  warehouse: {
    label: "Thủ kho",
    scopes: ["dashboard", "books", "stock", "catalog"],
  },
  accountant: {
    label: "Kế toán",
    scopes: ["dashboard", "sales", "ledger"],
  },
};

/** Tab admin → scope */
const TAB_SCOPES = {
  overview: "dashboard",
  mint: "mint",
  books: "books",
  categories: "catalog",
  publishers: "catalog",
  suppliers: "catalog",
  sales: "sales",
  ledger: "ledger",
  faucet: "faucet",
  users: "users",
  system: "system",
};

function roleScopes(role) {
  return ROLE_META[role]?.scopes || [];
}

function hasScope(role, scope) {
  if (!role || !scope) return false;
  const scopes = roleScopes(role);
  return scopes.includes("*") || scopes.includes(scope);
}

function hasAnyScope(role, scopes = []) {
  return scopes.some((s) => hasScope(role, s));
}

function canAccessAdmin(role) {
  return STAFF_ROLES.includes(role);
}

function tabsForRole(role) {
  if (hasScope(role, "*")) return Object.keys(TAB_SCOPES);
  return Object.entries(TAB_SCOPES)
    .filter(([, scope]) => hasScope(role, scope))
    .map(([tab]) => tab);
}

function publicUser(user) {
  if (!user) return null;
  const role = user.role || "user";
  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name,
    role,
    roleLabel: ROLE_META[role]?.label || role,
    walletAddress: user.walletAddress || "",
    scopes: roleScopes(role),
    canAccessAdmin: canAccessAdmin(role),
    tabs: tabsForRole(role),
  };
}

function isAssignableRole(role) {
  return ROLES.includes(role);
}

module.exports = {
  ROLES,
  STAFF_ROLES,
  ROLE_META,
  TAB_SCOPES,
  roleScopes,
  hasScope,
  hasAnyScope,
  canAccessAdmin,
  tabsForRole,
  publicUser,
  isAssignableRole,
};
