import {
  BookOpen,
  Boxes,
  Building2,
  Droplets,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings2,
  Tags,
  Truck,
  Users,
} from "lucide-react";

export const TABS = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, group: "operate" },
  { id: "mint", label: "Phát hành", icon: BookOpen, group: "operate" },
  { id: "books", label: "Kho sách", icon: Boxes, group: "operate" },
  { id: "categories", label: "Danh mục", icon: Tags, group: "catalog" },
  { id: "publishers", label: "NXB", icon: Building2, group: "catalog" },
  { id: "suppliers", label: "NCC", icon: Truck, group: "catalog" },
  { id: "sales", label: "Hóa đơn", icon: Receipt, group: "finance" },
  { id: "ledger", label: "Giao dịch", icon: ScrollText, group: "finance" },
  { id: "faucet", label: "Cấp ETH", icon: Droplets, group: "finance" },
  { id: "users", label: "Người dùng", icon: Users, group: "system" },
  { id: "system", label: "Hệ thống", icon: Settings2, group: "system" },
];

export const TAB_GROUPS = [
  { id: "operate", label: "Vận hành" },
  { id: "catalog", label: "Danh mục" },
  { id: "finance", label: "Tài chính" },
  { id: "system", label: "Hệ thống" },
];

export const SUPPLIER_STATUSES = [
  { id: "active", label: "Đang hợp tác" },
  { id: "inactive", label: "Ngừng" },
];

export const PUBLISHER_STATUSES = [
  { id: "active", label: "Đang hoạt động" },
  { id: "inactive", label: "Ngừng" },
];

export const CATEGORY_STATUSES = [
  { id: "active", label: "Đang dùng" },
  { id: "inactive", label: "Ẩn" },
];

export const emptySupplier = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxCode: "",
  website: "",
  note: "",
  status: "active",
};

export function supplierInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NCC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const emptyPublisher = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  description: "",
  status: "active",
};

export const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  status: "active",
  parentId: "",
};

export const LEVEL_LABELS = { 1: "Cấp 1", 2: "Cấp 2", 3: "Cấp 3" };

export function buildCategoryTree(flat = []) {
  const map = new Map();
  const roots = [];
  for (const c of flat) {
    map.set(String(c._id), { ...c, children: [] });
  }
  for (const node of map.values()) {
    const pid = node.parentId ? String(node.parentId) : null;
    if (pid && map.has(pid)) map.get(pid).children.push(node);
    else roots.push(node);
  }
  const sortRec = (arr) => {
    arr.sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function flattenCategoryTree(nodes, depth = 0) {
  const out = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) out.push(...flattenCategoryTree(n.children, depth + 1));
  }
  return out;
}

/** Resolve L1/L2/L3 ids từ categoryId hoặc pathNames */
export function resolveCascadeIds(book, categories) {
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  if (book?.categoryId && byId.has(String(book.categoryId))) {
    let node = byId.get(String(book.categoryId));
    const chain = [];
    while (node) {
      chain.unshift(node);
      node = node.parentId ? byId.get(String(node.parentId)) : null;
    }
    return {
      catL1: chain[0]?._id || "",
      catL2: chain[1]?._id || "",
      catL3: chain[2]?._id || "",
      categoryId: book.categoryId,
      category: chain[chain.length - 1]?.name || book.category || "",
    };
  }
  const name = book?.category || book?.genre || "";
  const leaf =
    categories.find((c) => c.level === 3 && c.name === name) ||
    categories.find((c) => c.name === name);
  if (leaf) return resolveCascadeIds({ categoryId: leaf._id, category: leaf.name }, categories);
  return { catL1: "", catL2: "", catL3: "", categoryId: "", category: name || "" };
}

export const CATALOG_STATUSES = [
  { id: "available", label: "Còn hàng" },
  { id: "listed", label: "Đang bán" },
  { id: "escrow", label: "Marketplace" },
  { id: "owned", label: "Trong ví" },
  { id: "out_of_stock", label: "Hết hàng" },
  { id: "inactive", label: "Ngừng KD" },
];

/** Bộ lọc nghiệp vụ kho (tồn / mở bán) — khác status catalog */
export const STOCK_FILTERS = [
  { id: "all", label: "Toàn kho" },
  { id: "in_stock", label: "Còn tồn" },
  { id: "low", label: "Sắp hết" },
  { id: "out", label: "Hết hàng" },
  { id: "selling", label: "Đang mở bán" },
  { id: "inactive", label: "Ngừng KD" },
];

/** Ngưỡng cảnh báo sắp hết (đơn vị tồn) */
export const LOW_STOCK_AT = 3;

export const emptyMint = {
  name: "",
  isbn: "",
  category: "",
  categoryId: "",
  catL1: "",
  catL2: "",
  catL3: "",
  authors: "",
  publisher: "",
  publisherId: "",
  publishYear: String(new Date().getFullYear()),
  price: "0.02",
  quantity: "1",
  description: "",
  image: "",
  status: "available",
  to: "",
};

export const emptyEdit = {
  name: "",
  isbn: "",
  category: "",
  categoryId: "",
  catL1: "",
  catL2: "",
  catL3: "",
  authors: "",
  publisher: "",
  publisherId: "",
  publishYear: "",
  price: "0",
  quantity: "1",
  description: "",
  image: "",
  status: "available",
};

export const emptyUserForm = {
  name: "",
  email: "",
  role: "user",
  walletAddress: "",
  password: "",
  passwordConfirm: "",
};

export const emptyPasswordForm = {
  password: "",
  passwordConfirm: "",
};

