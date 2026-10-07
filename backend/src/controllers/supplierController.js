const Supplier = require("../models/Supplier");

const STATUSES = ["active", "inactive"];

function normalize(body = {}) {
  const name = String(body.name || "").trim();
  const contactPerson = String(body.contactPerson || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const address = String(body.address || "").trim();
  const taxCode = String(body.taxCode || "").trim();
  const website = String(body.website || "").trim();
  const note = String(body.note || "").trim();
  let status = String(body.status || "active").trim();
  if (!STATUSES.includes(status)) status = "active";
  return { name, contactPerson, phone, email, address, taxCode, website, note, status };
}

async function listSuppliers(req, res, next) {
  try {
    const q = {};
    if (req.query.status && STATUSES.includes(req.query.status)) {
      q.status = req.query.status;
    }
    if (req.query.q) {
      const s = String(req.query.q).trim();
      q.$or = [
        { name: new RegExp(s, "i") },
        { contactPerson: new RegExp(s, "i") },
        { phone: new RegExp(s, "i") },
        { email: new RegExp(s, "i") },
        { address: new RegExp(s, "i") },
        { taxCode: new RegExp(s, "i") },
        { note: new RegExp(s, "i") },
      ];
    }
    const suppliers = await Supplier.find(q).sort({ status: 1, name: 1 });
    res.json({ suppliers });
  } catch (e) {
    next(e);
  }
}

async function getSupplier(req, res, next) {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });
    res.json({ supplier });
  } catch (e) {
    next(e);
  }
}

async function createSupplier(req, res, next) {
  try {
    const data = normalize(req.body);
    if (!data.name) return res.status(400).json({ message: "Thiếu name (tên nhà cung cấp)" });
    const dup = await Supplier.findOne({ name: data.name });
    if (dup) return res.status(409).json({ message: "Tên nhà cung cấp đã tồn tại" });
    const supplier = await Supplier.create(data);
    res.status(201).json({ supplier });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên nhà cung cấp đã tồn tại" });
    }
    next(e);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const existing = await Supplier.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });

    const data = normalize({
      name: req.body.name ?? existing.name,
      contactPerson: req.body.contactPerson ?? existing.contactPerson,
      phone: req.body.phone ?? existing.phone,
      email: req.body.email ?? existing.email,
      address: req.body.address ?? existing.address,
      taxCode: req.body.taxCode ?? existing.taxCode,
      website: req.body.website ?? existing.website,
      note: req.body.note ?? existing.note,
      status: req.body.status ?? existing.status,
    });
    if (!data.name) return res.status(400).json({ message: "Thiếu name" });

    Object.assign(existing, data);
    await existing.save();
    res.json({ supplier: existing });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Tên nhà cung cấp đã tồn tại" });
    }
    next(e);
  }
}

async function deleteSupplier(req, res, next) {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: "Không tìm thấy nhà cung cấp" });
    res.json({ ok: true, supplier });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
