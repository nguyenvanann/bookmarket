const Publisher = require("../models/Publisher");
const Book = require("../models/Book");

const STATUSES = ["active", "inactive"];

function normalize(body = {}) {
  const name = String(body.name || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const address = String(body.address || "").trim();
  const website = String(body.website || "").trim();
  const description = String(body.description || "").trim();
  let status = String(body.status || "active").trim();
  if (!STATUSES.includes(status)) status = "active";
  return { name, code, phone, email, address, website, description, status };
}

async function listPublishers(req, res, next) {
  try {
    const q = {};
    if (req.query.status && STATUSES.includes(req.query.status)) {
      q.status = req.query.status;
    }
    if (req.query.q) {
      const s = String(req.query.q).trim();
      q.$or = [
        { name: new RegExp(s, "i") },
        { code: new RegExp(s, "i") },
        { phone: new RegExp(s, "i") },
        { email: new RegExp(s, "i") },
        { address: new RegExp(s, "i") },
        { website: new RegExp(s, "i") },
        { description: new RegExp(s, "i") },
      ];
    }
    const publishers = await Publisher.find(q).sort({ name: 1 });
    res.json({ publishers });
  } catch (e) {
    next(e);
  }
}

async function getPublisher(req, res, next) {
  try {
    const publisher = await Publisher.findById(req.params.id);
    if (!publisher) return res.status(404).json({ message: "Không tìm thấy nhà xuất bản" });
    const bookCount = await Book.countDocuments({
      $or: [{ publisherId: publisher._id }, { publisher: publisher.name }],
    });
    res.json({ publisher, bookCount });
  } catch (e) {
    next(e);
  }
}

async function createPublisher(req, res, next) {
  try {
    const data = normalize(req.body);
    if (!data.name) return res.status(400).json({ message: "Thiếu name (tên nhà xuất bản)" });
    const dup = await Publisher.findOne({ name: data.name });
    if (dup) return res.status(409).json({ message: "Tên nhà xuất bản đã tồn tại" });
    const publisher = await Publisher.create(data);
    res.status(201).json({ publisher });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên nhà xuất bản đã tồn tại" });
    }
    next(e);
  }
}

async function updatePublisher(req, res, next) {
  try {
    const existing = await Publisher.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Không tìm thấy nhà xuất bản" });

    const oldName = existing.name;
    const data = normalize({
      name: req.body.name ?? existing.name,
      code: req.body.code ?? existing.code,
      phone: req.body.phone ?? existing.phone,
      email: req.body.email ?? existing.email,
      address: req.body.address ?? existing.address,
      website: req.body.website ?? existing.website,
      description: req.body.description ?? existing.description,
      status: req.body.status ?? existing.status,
    });
    if (!data.name) return res.status(400).json({ message: "Thiếu name" });

    Object.assign(existing, data);
    await existing.save();

    if (oldName !== existing.name) {
      await Book.updateMany(
        { $or: [{ publisherId: existing._id }, { publisher: oldName }] },
        { $set: { publisher: existing.name, publisherId: existing._id } }
      );
    }

    res.json({ publisher: existing });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên nhà xuất bản đã tồn tại" });
    }
    next(e);
  }
}

async function deletePublisher(req, res, next) {
  try {
    const publisher = await Publisher.findById(req.params.id);
    if (!publisher) return res.status(404).json({ message: "Không tìm thấy nhà xuất bản" });

    const used = await Book.countDocuments({
      $or: [{ publisherId: publisher._id }, { publisher: publisher.name }],
    });
    if (used > 0) {
      return res.status(400).json({
        message: `Không xóa được: còn ${used} sách thuộc NXB «${publisher.name}»`,
      });
    }

    await publisher.deleteOne();
    res.json({ ok: true, publisher });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listPublishers,
  getPublisher,
  createPublisher,
  updatePublisher,
  deletePublisher,
};
