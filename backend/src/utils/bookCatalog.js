/**
 * Chuẩn hoá payload quản lý sách (catalog).
 * Hỗ trợ cả field mới (name, authors…) và alias cũ (title, author…).
 */

const Category = require("../models/Category");
const Publisher = require("../models/Publisher");

function parseAuthors(input) {
  if (Array.isArray(input)) {
    return input.map((a) => String(a || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[,;|/]+/)
      .map((a) => a.trim())
      .filter(Boolean);
  }
  return [];
}

function parsePublishYear(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parsePrice(v) {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseQuantity(v) {
  if (v === "" || v == null) return 1;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.trunc(n);
}

/**
 * Resolve categoryId → name + pathNames (ưu tiên lá cấp 3).
 */
async function resolveCategoryFields(body = {}) {
  let categoryId =
    body.categoryId === "" || body.categoryId == null || body.categoryId === "null"
      ? null
      : body.categoryId;
  let category = String(body.category || body.genre || "").trim();
  let categoryPath = String(body.categoryPath || "").trim();

  if (categoryId) {
    const cat = await Category.findById(categoryId);
    if (!cat) {
      const err = new Error("Không tìm thấy danh mục");
      err.status = 400;
      throw err;
    }
    return {
      categoryId: cat._id,
      category: cat.name,
      categoryPath: cat.pathNames || cat.name,
    };
  }

  if (category) {
    const cat =
      (await Category.findOne({ name: category, level: 3, status: "active" })) ||
      (await Category.findOne({ name: category, status: "active" }).sort({ level: -1 }));
    if (cat) {
      return {
        categoryId: cat._id,
        category: cat.name,
        categoryPath: cat.pathNames || cat.name,
      };
    }
  }

  if (!category) category = "Tiểu thuyết";
  return { categoryId: null, category, categoryPath: categoryPath || category };
}

/** Resolve publisherId → tên NXB */
async function resolvePublisherFields(body = {}) {
  let publisherId =
    body.publisherId === "" || body.publisherId == null || body.publisherId === "null"
      ? null
      : body.publisherId;
  let publisher = String(body.publisher || "").trim();

  if (publisherId) {
    const pub = await Publisher.findById(publisherId);
    if (!pub) {
      const err = new Error("Không tìm thấy nhà xuất bản");
      err.status = 400;
      throw err;
    }
    return { publisherId: pub._id, publisher: pub.name };
  }

  if (publisher) {
    const pub = await Publisher.findOne({ name: publisher });
    if (pub) return { publisherId: pub._id, publisher: pub.name };
  }

  return { publisherId: null, publisher };
}

/**
 * @returns {{ catalog: object, chainTitle: string, chainAuthor: string, chainGenre: string, priceEth: string }}
 */
function normalizeBookPayload(body = {}, categoryFields = {}, publisherFields = {}) {
  const name = String(body.name || body.title || "").trim();
  const authors = parseAuthors(body.authors?.length ? body.authors : body.author);
  const category = String(
    categoryFields.category || body.category || body.genre || "Tiểu thuyết"
  ).trim();
  const categoryId =
    categoryFields.categoryId !== undefined
      ? categoryFields.categoryId
      : body.categoryId || null;
  const categoryPath = String(
    categoryFields.categoryPath || body.categoryPath || category
  ).trim();
  const image = String(body.image || body.coverUrl || "").trim();
  const description = String(body.description || "");
  const isbn = String(body.isbn || "").trim();
  const publisher = String(
    publisherFields.publisher !== undefined
      ? publisherFields.publisher
      : body.publisher || ""
  ).trim();
  const publisherId =
    publisherFields.publisherId !== undefined
      ? publisherFields.publisherId
      : body.publisherId || null;
  const publishYear = parsePublishYear(body.publishYear);
  const price = parsePrice(body.price != null ? body.price : body.priceEth);
  const quantity = parseQuantity(body.quantity);
  const status = body.status || undefined;

  const catalog = {
    name,
    isbn,
    category,
    categoryId,
    categoryPath,
    authors,
    publisher,
    publisherId,
    publishYear,
    price,
    quantity,
    description,
    image,
  };
  if (status) catalog.status = status;

  return {
    catalog,
    chainTitle: name,
    chainAuthor: authors[0] || "Unknown",
    chainGenre: category || "Tiểu thuyết",
    priceEth: String(body.priceEth != null && body.priceEth !== "" ? body.priceEth : price || "0"),
  };
}

const CATALOG_STATUSES = [
  "available",
  "owned",
  "listed",
  "escrow",
  "out_of_stock",
  "inactive",
];

module.exports = {
  parseAuthors,
  normalizeBookPayload,
  resolveCategoryFields,
  resolvePublisherFields,
  CATALOG_STATUSES,
};
