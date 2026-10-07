/**
 * Phân quyền tab admin theo role (đồng bộ backend/constants/roles.js).
 */

export const ROLES = [
  { id: "user", label: "Người dùng" },
  { id: "admin", label: "Quản trị viên" },
  { id: "staff", label: "Nhân viên" },
  { id: "warehouse", label: "Thủ kho" },
  { id: "accountant", label: "Kế toán" },
];

export const STAFF_ROLES = ["admin", "staff", "warehouse", "accountant"];

const ROLE_SCOPES = {
  user: [],
  admin: ["*"],
  staff: ["dashboard", "mint", "books", "stock", "catalog"],
  warehouse: ["dashboard", "books", "stock", "catalog"],
  accountant: ["dashboard", "sales", "ledger"],
};

export const TAB_SCOPES = {
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

export function roleLabel(role) {
  return ROLES.find((r) => r.id === role)?.label || role || "—";
}

export function roleScopes(role) {
  return ROLE_SCOPES[role] || [];
}

export function hasScope(role, scope) {
  const scopes = roleScopes(role);
  return scopes.includes("*") || scopes.includes(scope);
}

export function canAccessAdmin(role) {
  return STAFF_ROLES.includes(role);
}

export function canAccessTab(role, tabId) {
  const scope = TAB_SCOPES[tabId];
  if (!scope) return false;
  return hasScope(role, scope);
}

export function filterTabsByRole(tabs, role) {
  return (tabs || []).filter((t) => canAccessTab(role, t.id));
}

export function filterGroupsByTabs(groups, tabs) {
  const ids = new Set((tabs || []).map((t) => t.group));
  return (groups || []).filter((g) => ids.has(g.id));
}

export function firstAllowedTab(role, preferred) {
  if (preferred && canAccessTab(role, preferred)) return preferred;
  const order = Object.keys(TAB_SCOPES);
  return order.find((id) => canAccessTab(role, id)) || "overview";
}
