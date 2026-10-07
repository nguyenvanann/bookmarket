import { CATALOG_STATUSES, LOW_STOCK_AT } from "./constants";

export function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function actionBadgeClass(action) {
  if (action === "Mint") return "mint";
  if (action === "Faucet") return "faucet";
  return "sale";
}

export function actionLabel(n) {
  if (n.action === "Faucet" || n.bookId === 0) return "Faucet ETH";
  return `Book #${n.bookId}`;
}

export function bookName(b) {
  return b?.name || b?.title || "—";
}

export function bookAuthors(b) {
  if (Array.isArray(b?.authors) && b.authors.length) return b.authors.join(", ");
  return b?.author || "—";
}

export function bookCategory(b) {
  return b?.categoryPath || b?.category || b?.genre || "—";
}

export function bookImage(b) {
  return b?.image || b?.coverUrl || "";
}

export function statusOf(book) {
  if (book.status && CATALOG_STATUSES.some((s) => s.id === book.status)) return book.status;
  if (book.marketListed) return "escrow";
  if (book.forSale) return "listed";
  if (book.quantity === 0) return "out_of_stock";
  return "owned";
}

export function statusLabel(st) {
  return CATALOG_STATUSES.find((s) => s.id === st)?.label || st;
}

export function stockQty(book) {
  const n = Number(book?.quantity);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Mức tồn kho nghiệp vụ: out | low | ok | inactive */
export function stockLevel(book) {
  const st = statusOf(book);
  if (st === "inactive") return "inactive";
  const qty = stockQty(book);
  if (qty <= 0 || st === "out_of_stock") return "out";
  if (qty <= LOW_STOCK_AT) return "low";
  return "ok";
}

export function stockLevelLabel(level) {
  if (level === "out") return "Hết hàng";
  if (level === "low") return "Sắp hết";
  if (level === "inactive") return "Ngừng KD";
  return "Đủ tồn";
}

export function isSelling(book) {
  const st = statusOf(book);
  return st === "listed" || st === "escrow" || Boolean(book?.forSale || book?.marketListed);
}

export function matchesStockFilter(book, filter) {
  if (!filter || filter === "all") return true;
  const level = stockLevel(book);
  if (filter === "in_stock") return level === "ok" || level === "low";
  if (filter === "low") return level === "low";
  if (filter === "out") return level === "out";
  if (filter === "selling") return isSelling(book) && level !== "inactive";
  if (filter === "inactive") return level === "inactive";
  return statusOf(book) === filter;
}

/** Giá trị dòng tồn theo giá vốn (ưu tiên costPrice) × số lượng */
export function lineStockValue(book) {
  const cost = Number(book?.costPrice);
  const sell = Number(book?.price);
  const p = Number.isFinite(cost) && cost > 0 ? cost : Number.isFinite(sell) ? sell : 0;
  return stockQty(book) * p;
}

export function movementTypeLabel(type) {
  if (type === "in") return "Nhập kho";
  if (type === "out") return "Xuất kho";
  if (type === "adjust") return "Điều chỉnh";
  return type || "—";
}

export function summarizeStock(books = []) {
  let sku = books.length;
  let units = 0;
  let low = 0;
  let out = 0;
  let selling = 0;
  let value = 0;
  for (const b of books) {
    const level = stockLevel(b);
    const qty = stockQty(b);
    units += qty;
    value += lineStockValue(b);
    if (level === "low") low += 1;
    if (level === "out") out += 1;
    if (isSelling(b) && level !== "inactive") selling += 1;
  }
  return { sku, units, low, out, selling, value };
}

/** Sắp xếp kho: hết/sắp hết trước, rồi tồn tăng dần */
export function compareStockUrgency(a, b) {
  const rank = { out: 0, low: 1, ok: 2, inactive: 3 };
  const d = (rank[stockLevel(a)] ?? 9) - (rank[stockLevel(b)] ?? 9);
  if (d !== 0) return d;
  const q = stockQty(a) - stockQty(b);
  if (q !== 0) return q;
  return (b.bookId || 0) - (a.bookId || 0);
}

export function isHttpUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}

export function isImageSrc(u) {
  const s = String(u || "").trim();
  return isHttpUrl(s) || /^data:image\//i.test(s) || /^blob:/i.test(s);
}

export function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

export function shortHash(h) {
  if (!h) return "";
  const s = String(h).replace(/^sha256:/i, "");
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

/** Bỏ dấu tiếng Việt — dùng cho tìm kiếm gần đúng */
export function foldVn(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

function bookSearchBlob(b) {
  return [
    bookName(b),
    bookAuthors(b),
    b?.isbn,
    b?.publisher,
    bookCategory(b),
    b?.description,
    b?.bookId,
    b?.status,
  ]
    .filter((x) => x != null && x !== "")
    .join(" ");
}

/**
 * Tìm gần đúng: không dấu, khớp mọi token (vd. "naruto tap 1", "nguoi").
 * Trả về score > 0 nếu khớp.
 */
export function fuzzyScore(haystack, query) {
  const h = foldVn(haystack);
  const q = foldVn(query).trim();
  if (!q) return 1;
  if (!h) return 0;
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return h.includes(q) ? 1 : 0;
  let score = 0;
  for (const t of tokens) {
    const idx = h.indexOf(t);
    if (idx < 0) return 0;
    score += 10;
    if (idx === 0 || /[^a-z0-9]/.test(h[idx - 1] || " ")) score += 4;
  }
  return score;
}

export function matchesBookQuery(book, query) {
  const q = String(query || "").trim();
  if (!q) return true;
  const idRaw = q.replace(/^#/, "").trim();
  if (/^\d+$/.test(idRaw) && Number(book?.bookId) === Number(idRaw)) return true;
  return fuzzyScore(bookSearchBlob(book), q) > 0;
}

