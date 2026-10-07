/**
 * Tìm kiếm gần đúng: bỏ dấu tiếng Việt, không phân biệt hoa/thường,
 * khớp từng token (tất cả token phải xuất hiện).
 */

const VN_FOLD_MAP = {
  à: "a",
  á: "a",
  ả: "a",
  ã: "a",
  ạ: "a",
  ă: "a",
  ằ: "a",
  ắ: "a",
  ẳ: "a",
  ẵ: "a",
  ặ: "a",
  â: "a",
  ầ: "a",
  ấ: "a",
  ẩ: "a",
  ẫ: "a",
  ậ: "a",
  è: "e",
  é: "e",
  ẻ: "e",
  ẽ: "e",
  ẹ: "e",
  ê: "e",
  ề: "e",
  ế: "e",
  ể: "e",
  ễ: "e",
  ệ: "e",
  ì: "i",
  í: "i",
  ỉ: "i",
  ĩ: "i",
  ị: "i",
  ò: "o",
  ó: "o",
  ỏ: "o",
  õ: "o",
  ọ: "o",
  ô: "o",
  ồ: "o",
  ố: "o",
  ổ: "o",
  ỗ: "o",
  ộ: "o",
  ơ: "o",
  ờ: "o",
  ớ: "o",
  ở: "o",
  ỡ: "o",
  ợ: "o",
  ù: "u",
  ú: "u",
  ủ: "u",
  ũ: "u",
  ụ: "u",
  ư: "u",
  ừ: "u",
  ứ: "u",
  ử: "u",
  ữ: "u",
  ự: "u",
  ỳ: "y",
  ý: "y",
  ỷ: "y",
  ỹ: "y",
  ỵ: "y",
  đ: "d",
};

function foldVn(input) {
  const s = String(input || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  let out = "";
  for (const ch of s) {
    out += VN_FOLD_MAP[ch] || ch;
  }
  return out.replace(/đ/g, "d");
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mỗi ký tự ASCII → class regex nhận biến thể có dấu (gần đúng) */
const CHAR_CLASSES = {
  a: "[aàáảãạăằắẳẵặâầấẩẫậ]",
  e: "[eèéẻẽẹêềếểễệ]",
  i: "[iìíỉĩị]",
  o: "[oòóỏõọôồốổỗộơờớởỡợ]",
  u: "[uùúủũụưừứửữự]",
  y: "[yỳýỷỹỵ]",
  d: "[dđ]",
};

function tokenToAccentRegex(token) {
  const folded = foldVn(token).replace(/[^a-z0-9]+/g, "");
  if (!folded) return null;
  let body = "";
  for (const ch of folded) {
    body += CHAR_CLASSES[ch] || escapeRegex(ch);
  }
  return body;
}

/**
 * Mongo $or clauses cho query gần đúng trên các field text.
 * @param {string} q
 * @param {string[]} fields
 */
function buildFuzzyMongoOr(q, fields = []) {
  const tokens = foldVn(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 1);
  if (!tokens.length) return null;

  const patterns = tokens
    .map((t) => tokenToAccentRegex(t))
    .filter(Boolean)
    .map((p) => new RegExp(p, "i"));

  if (!patterns.length) return null;

  // Mỗi token phải khớp ít nhất một field; dùng $and của $or theo field
  return {
    $and: patterns.map((re) => ({
      $or: fields.map((f) => ({ [f]: re })),
    })),
  };
}

/**
 * Điểm gần đúng in-memory (cao hơn = khớp tốt hơn). 0 = không khớp.
 */
function fuzzyScore(haystack, query) {
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
    if (h === t) score += 8;
  }
  // Thưởng chuỗi liền
  if (h.includes(q.replace(/\s+/g, ""))) score += 3;
  return score;
}

function bookSearchBlob(book) {
  const authors = Array.isArray(book.authors)
    ? book.authors.join(" ")
    : book.author || "";
  return [
    book.name,
    book.title,
    book.isbn,
    authors,
    book.publisher,
    book.category,
    book.categoryPath,
    book.description,
    book.bookId,
    book.status,
  ]
    .filter((x) => x != null && x !== "")
    .join(" ");
}

module.exports = {
  foldVn,
  escapeRegex,
  buildFuzzyMongoOr,
  fuzzyScore,
  bookSearchBlob,
};
