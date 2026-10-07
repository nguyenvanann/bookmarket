const Category = require("../models/Category");
const Book = require("../models/Book");

/** Cây danh mục mẫu 3 cấp */
const TREE = [
  {
    name: "Văn học",
    description: "Danh mục cấp 1",
    children: [
      {
        name: "Văn học Việt Nam",
        description: "Cấp 2",
        children: [
          { name: "Tiểu thuyết", description: "Cấp 3" },
          { name: "Truyện ngắn", description: "Cấp 3" },
        ],
      },
      {
        name: "Văn học nước ngoài",
        description: "Cấp 2",
        children: [
          { name: "Tiểu thuyết", description: "Tiểu thuyết dịch và văn học thế giới" },
          { name: "Kỳ ảo", description: "Cấp 3" },
          { name: "Trinh thám", description: "Cấp 3" },
        ],
      },
    ],
  },
  {
    name: "Truyện tranh & Manga",
    description: "Manga / manhwa / anime adaptation",
    children: [
      {
        name: "Manga Nhật Bản",
        description: "Ấn bản manga dịch VN",
        children: [
          { name: "Shonen", description: "Thiếu niên · hành động, phiêu lưu" },
          { name: "Shojo", description: "Thiếu nữ · lãng mạn, học đường" },
          { name: "Seinen", description: "Thanh niên · kịch tính, đen tối" },
          { name: "Isekai", description: "Xuyên không / thế giới khác" },
        ],
      },
      {
        name: "Light Novel",
        description: "Tiểu thuyết minh họa kiểu Nhật",
        children: [
          { name: "Fantasy LN", description: "Kỳ ảo / game / isekai LN" },
          { name: "Romance LN", description: "Tình cảm học đường" },
        ],
      },
      {
        name: "Anime & Media",
        description: "Sách liên quan anime",
        children: [
          { name: "Artbook", description: "Sách ảnh / setting" },
          { name: "Fanbook", description: "Guidebook / databook" },
        ],
      },
    ],
  },
  {
    name: "Thiếu nhi & Giáo dục",
    description: "Danh mục cấp 1",
    children: [
      {
        name: "Thiếu nhi",
        description: "Cấp 2",
        children: [{ name: "Truyện tranh thiếu nhi", description: "Cấp 3 · alias Thiếu nhi" }],
      },
      {
        name: "Khác",
        description: "Cấp 2",
        children: [{ name: "Tổng hợp", description: "Cấp 3 · alias Khác" }],
      },
    ],
  },
];

/**
 * Schema cũ có unique name_1 / slug_1 — xung đột cây 3 cấp (cùng tên khác cha).
 * Drop index unique thừa; giữ unique compound (parentId, name).
 */
async function ensureCategoryIndexes() {
  const coll = Category.collection;
  let dropped = [];
  try {
    const indexes = await coll.indexes();
    for (const idx of indexes) {
      if (idx.name === "_id_") continue;
      const keys = Object.keys(idx.key || {});
      const isLegacyNameUnique =
        idx.unique && keys.length === 1 && keys[0] === "name";
      const isLegacySlugUnique =
        idx.unique && keys.length === 1 && keys[0] === "slug";
      if (isLegacyNameUnique || isLegacySlugUnique) {
        await coll.dropIndex(idx.name);
        dropped.push(idx.name);
      }
    }
  } catch (e) {
    console.warn("[seed] ensureCategoryIndexes list/drop:", e.message);
  }

  try {
    await Category.syncIndexes();
  } catch (e) {
    console.warn("[seed] syncIndexes:", e.message);
  }

  if (dropped.length) {
    console.log(`[seed] dropped legacy unique indexes: ${dropped.join(", ")}`);
  }
  return dropped;
}

function applyPath(doc, parent) {
  if (!parent) {
    doc.level = 1;
    doc.parentId = null;
    doc.path = String(doc._id);
    doc.pathNames = doc.name;
  } else {
    doc.level = parent.level + 1;
    doc.parentId = parent._id;
    doc.path = `${parent.path}/${doc._id}`;
    doc.pathNames = `${parent.pathNames} / ${doc.name}`;
  }
}

async function ensureNode({ name, description, parent, sortOrder }) {
  const parentId = parent ? parent._id : null;
  let doc = await Category.findOne({ name, parentId });

  // Nhận orphan phẳng (cùng tên, không cha, không con) → gắn vào đúng chỗ trong cây
  if (!doc && parent) {
    const orphan = await Category.findOne({
      name,
      $or: [{ parentId: null }, { parentId: { $exists: false } }],
    });
    if (orphan) {
      const childCount = await Category.countDocuments({ parentId: orphan._id });
      if (childCount === 0 && (orphan.level === 1 || !orphan.level || !orphan.path)) {
        doc = orphan;
      }
    }
  }

  if (!doc) {
    doc = new Category({
      name,
      description: description || "",
      parentId,
      level: parent ? parent.level + 1 : 1,
      sortOrder: sortOrder ?? 0,
      status: "active",
    });
    await doc.save();
  } else {
    if (description && !doc.description) doc.description = description;
    if (sortOrder != null) doc.sortOrder = sortOrder;
    if (doc.status !== "active" && doc.status !== "inactive") doc.status = "active";
  }

  applyPath(doc, parent);
  await doc.save();
  return doc;
}

async function seedTree() {
  let createdHint = 0;
  let order = 0;
  for (const l1 of TREE) {
    order += 1;
    const before = await Category.countDocuments();
    const n1 = await ensureNode({
      name: l1.name,
      description: l1.description,
      parent: null,
      sortOrder: order,
    });
    let o2 = 0;
    for (const l2 of l1.children || []) {
      o2 += 1;
      const n2 = await ensureNode({
        name: l2.name,
        description: l2.description,
        parent: n1,
        sortOrder: o2,
      });
      let o3 = 0;
      for (const l3 of l2.children || []) {
        o3 += 1;
        await ensureNode({
          name: l3.name,
          description: l3.description,
          parent: n2,
          sortOrder: o3,
        });
      }
    }
    createdHint += Math.max(0, (await Category.countDocuments()) - before);
  }
  return createdHint;
}

/** Nâng danh mục phẳng cũ → cấp 1 (chỉ khi chưa có path) */
async function migrateFlatToLevel1() {
  const flats = await Category.find({
    $or: [{ level: { $exists: false } }, { path: "" }, { path: { $exists: false } }],
  });
  let n = 0;
  for (const c of flats) {
    if (!c.parentId) {
      applyPath(c, null);
      await c.save();
      n += 1;
    }
  }
  return n;
}

/** Map sách.category (tên) → lá cấp 3 nếu trùng tên / alias */
async function linkBooksToLeaves() {
  const leaves = await Category.find({ level: 3, status: "active" });
  const byName = new Map(leaves.map((c) => [c.name, c]));
  const alias = {
    "Thiếu nhi": leaves.find((c) => /thiếu nhi/i.test(c.name)),
    Khác: leaves.find((c) => /tổng hợp/i.test(c.name)),
  };

  const books = await Book.find({
    $or: [{ categoryId: null }, { categoryId: { $exists: false } }],
  }).select("category categoryId categoryPath");

  let linked = 0;
  for (const b of books) {
    const name = String(b.category || "").trim();
    if (!name) continue;
    const leaf = byName.get(name) || alias[name];
    if (!leaf) continue;
    b.categoryId = leaf._id;
    b.category = leaf.name;
    b.categoryPath = leaf.pathNames;
    await b.save();
    linked += 1;
  }
  return linked;
}

async function seedCategories() {
  try {
    await ensureCategoryIndexes();
    const migrated = await migrateFlatToLevel1();
    const grown = await seedTree();
    const linked = await linkBooksToLeaves();
    if (migrated || grown || linked) {
      console.log(
        `[seed] categories 3-level · migrate=${migrated} tree+=${grown} booksLinked=${linked}`
      );
    }
    return { migrated, grown, linked };
  } catch (e) {
    // Không crash API — log rõ để sửa tay nếu cần
    console.error("[seed] categories failed:", e.message || e);
    return { error: e.message };
  }
}

module.exports = { seedCategories, TREE, ensureCategoryIndexes };
