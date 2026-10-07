/** Đồng bộ field ảnh với admin: `image` (Mongo) + virtual `coverUrl`. */

export function bookName(b) {
  return b?.name || b?.title || "Không tên";
}

export function bookAuthors(b) {
  if (Array.isArray(b?.authors) && b.authors.length) return b.authors.join(", ");
  return b?.author || "";
}

export function bookCategory(b) {
  return b?.categoryPath || b?.category || b?.genre || "";
}

export function bookImage(b) {
  return String(b?.image || b?.coverUrl || "").trim();
}

export function isHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || "").trim());
}

/** Admin upload → data:image; mint URL → http(s); blob preview */
export function isImageSrc(u) {
  const s = String(u || "").trim();
  return isHttpUrl(s) || /^data:image\//i.test(s) || /^blob:/i.test(s);
}
