const mongoose = require("mongoose");
const Category = require("../models/Category");
const Book = require("../models/Book");

const STATUSES = ["active", "inactive"];
const MAX_LEVEL = 3;

function normalize(body = {}) {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase();
  let status = String(body.status || "active").trim();
  if (!STATUSES.includes(status)) status = "active";
  let sortOrder = Number(body.sortOrder);
  if (!Number.isFinite(sortOrder)) sortOrder = 0;
  const parentId =
    body.parentId === "" || body.parentId == null || body.parentId === "null"
      ? null
      : body.parentId;
  return { name, description, slug, status, sortOrder, parentId };
}

function buildTree(flat) {
  const map = new Map();
  const roots = [];
  for (const c of flat) {
    const node = { ...c, children: [] };
    map.set(String(c._id), node);
  }
  for (const node of map.values()) {
    const pid = node.parentId ? String(node.parentId) : null;
    if (pid && map.has(pid)) map.get(pid).children.push(node);
    else roots.push(node);
  }
  const sortRec = (arr) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

async function resolveParent(parentId) {
  if (!parentId) return null;
  if (!mongoose.isValidObjectId(parentId)) {
    const err = new Error("parentId không hợp lệ");
    err.status = 400;
    throw err;
  }
  const parent = await Category.findById(parentId);
  if (!parent) {
    const err = new Error("Không tìm thấy danh mục cha");
    err.status = 404;
    throw err;
  }
  if (parent.level >= MAX_LEVEL) {
    const err = new Error("Chỉ hỗ trợ tối đa 3 cấp danh mục");
    err.status = 400;
    throw err;
  }
  return parent;
}

async function computePath(doc, parent) {
  const id = String(doc._id);
  if (!parent) {
    doc.level = 1;
    doc.path = id;
    doc.pathNames = doc.name;
    return;
  }
  doc.level = parent.level + 1;
  doc.path = `${parent.path}/${id}`;
  doc.pathNames = `${parent.pathNames} / ${doc.name}`;
}

async function listCategories(req, res, next) {
  try {
    const q = {};
    if (req.query.status && STATUSES.includes(req.query.status)) {
      q.status = req.query.status;
    }
    if (req.query.level) q.level = Number(req.query.level);
    if (req.query.parentId === "null" || req.query.parentId === "") {
      q.parentId = null;
    } else if (req.query.parentId) {
      q.parentId = req.query.parentId;
    }
    if (req.query.q) {
      const s = String(req.query.q).trim();
      q.$or = [
        { name: new RegExp(s, "i") },
        { description: new RegExp(s, "i") },
        { slug: new RegExp(s, "i") },
        { pathNames: new RegExp(s, "i") },
      ];
    }

    const categories = await Category.find(q).sort({ level: 1, sortOrder: 1, name: 1 });
    const plain = categories.map((c) => c.toJSON());
    const payload = { categories: plain };
    if (req.query.tree === "1" || req.query.tree === "true") {
      // tree luôn lấy full (theo filter status nếu có) để dựng cây
      const allQ = {};
      if (q.status) allQ.status = q.status;
      const all = await Category.find(allQ).sort({ sortOrder: 1, name: 1 });
      payload.tree = buildTree(all.map((c) => c.toJSON()));
    }
    res.json(payload);
  } catch (e) {
    next(e);
  }
}

async function getCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Không tìm thấy danh mục" });
    const children = await Category.find({ parentId: category._id }).sort({
      sortOrder: 1,
      name: 1,
    });
    res.json({ category, children });
  } catch (e) {
    next(e);
  }
}

async function createCategory(req, res, next) {
  try {
    const data = normalize(req.body);
    if (!data.name) return res.status(400).json({ message: "Thiếu name (tên danh mục)" });

    const parent = await resolveParent(data.parentId);
    const dup = await Category.findOne({
      name: data.name,
      parentId: parent ? parent._id : null,
    });
    if (dup) {
      return res.status(409).json({ message: "Tên danh mục đã tồn tại trong cùng cấp cha" });
    }

    const category = new Category({
      name: data.name,
      slug: data.slug,
      description: data.description,
      status: data.status,
      sortOrder: data.sortOrder,
      parentId: parent ? parent._id : null,
      level: parent ? parent.level + 1 : 1,
    });
    await category.save();
    await computePath(category, parent);
    await category.save();

    res.status(201).json({ category });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên danh mục đã tồn tại trong cùng cấp cha" });
    }
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function updateCategory(req, res, next) {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Không tìm thấy danh mục" });

    const oldName = existing.name;
    const data = normalize({
      name: req.body.name ?? existing.name,
      description: req.body.description ?? existing.description,
      slug: req.body.slug ?? existing.slug,
      status: req.body.status ?? existing.status,
      sortOrder: req.body.sortOrder ?? existing.sortOrder,
      parentId: req.body.parentId !== undefined ? req.body.parentId : existing.parentId,
    });
    if (!data.name) return res.status(400).json({ message: "Thiếu name" });

    // Không cho đổi parent làm hỏng cây 3 cấp (đơn giản: khóa đổi parent)
    const nextParentId = data.parentId ? String(data.parentId) : null;
    const curParentId = existing.parentId ? String(existing.parentId) : null;
    if (nextParentId !== curParentId) {
      return res.status(400).json({
        message: "Không hỗ trợ đổi danh mục cha. Hãy tạo mới dưới cấp cha mong muốn.",
      });
    }

    existing.name = data.name;
    existing.description = data.description;
    existing.slug = data.slug || existing.slug;
    existing.status = data.status;
    existing.sortOrder = data.sortOrder;

    const parent = existing.parentId ? await Category.findById(existing.parentId) : null;
    await computePath(existing, parent);
    await existing.save();

    // Cập nhật pathNames của toàn bộ con cháu
    await refreshDescendantPaths(existing);

    // Đồng bộ breadcrumb sách trong cả nhánh (đổi tên cấp cha cũng cập nhật path)
    const subtree = await Category.find({
      $or: [{ _id: existing._id }, { path: new RegExp(`^${existing.path}/`) }],
    });
    for (const node of subtree) {
      await Book.updateMany(
        { categoryId: node._id },
        {
          $set: {
            category: node.name,
            categoryPath: node.pathNames,
          },
        }
      );
    }
    if (oldName !== existing.name) {
      await Book.updateMany(
        { category: oldName, $or: [{ categoryId: null }, { categoryId: { $exists: false } }] },
        { $set: { category: existing.name, categoryPath: existing.pathNames } }
      );
    }

    res.json({ category: existing });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên danh mục đã tồn tại trong cùng cấp cha" });
    }
    next(e);
  }
}

async function refreshDescendantPaths(node) {
  const children = await Category.find({ parentId: node._id });
  for (const child of children) {
    await computePath(child, node);
    await child.save();
    await refreshDescendantPaths(child);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Không tìm thấy danh mục" });

    const childCount = await Category.countDocuments({ parentId: category._id });
    if (childCount > 0) {
      return res.status(400).json({
        message: `Không xóa được: còn ${childCount} danh mục con`,
      });
    }

    const used = await Book.countDocuments({
      $or: [{ categoryId: category._id }, { category: category.name }],
    });
    if (used > 0) {
      return res.status(400).json({
        message: `Không xóa được: còn ${used} sách thuộc danh mục «${category.name}»`,
      });
    }

    await category.deleteOne();
    res.json({ ok: true, category });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  buildTree,
};
