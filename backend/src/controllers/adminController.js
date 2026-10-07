const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Book = require("../models/Book");
const Supplier = require("../models/Supplier");
const Publisher = require("../models/Publisher");
const Sale = require("../models/Sale");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const { getLedgerStatus, getLedgerTip } = require("../services/blockchainService");
const { backfill, syncBookFromChain } = require("../services/blockchainListener");

const MIN_PASSWORD_LEN = 6;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeWallet(addr) {
  return String(addr || "").trim().toLowerCase();
}

function validatePassword(password) {
  if (!password || String(password).length < MIN_PASSWORD_LEN) {
    return `Mật khẩu tối thiểu ${MIN_PASSWORD_LEN} ký tự`;
  }
  return null;
}

async function dashboard(_req, res, next) {
  try {
    const [
      users,
      books,
      txs,
      listed,
      escrow,
      suppliers,
      publishers,
      salesIssued,
      categories,
      status,
      recentTx,
      recentBooks,
      recentSales,
    ] = await Promise.all([
      User.countDocuments(),
      Book.countDocuments(),
      Transaction.countDocuments(),
      Book.countDocuments({ forSale: true, marketListed: false }),
      Book.countDocuments({ marketListed: true }),
      Supplier.countDocuments({ status: "active" }),
      Publisher.countDocuments({ status: "active" }),
      Sale.countDocuments({ status: "issued" }),
      Category.countDocuments({ status: "active" }),
      getLedgerStatus(),
      Transaction.find().sort({ index: -1 }).limit(8),
      Book.find().sort({ bookId: -1 }).limit(5),
      Sale.find({ status: "issued" }).sort({ issueDate: -1 }).limit(5),
    ]);

    const byAction = await Transaction.aggregate([
      { $group: { _id: "$action", count: { $sum: 1 } } },
    ]);

    res.json({
      stats: {
        users,
        books,
        transactions: txs,
        listed,
        escrow,
        suppliers,
        publishers,
        sales: salesIssued,
        categories,
        soldActions: byAction.find((x) => x._id === "Sale")?.count || 0,
        mintActions: byAction.find((x) => x._id === "Mint")?.count || 0,
      },
      ledger: status,
      recentTx,
      recentBooks,
      recentSales,
      actionBreakdown: byAction,
    });
  } catch (e) {
    next(e);
  }
}

async function listUsers(_req, res, next) {
  try {
    const { publicUser, ROLE_META, ROLES } = require("../constants/roles");
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json({
      users: users.map(publicUser),
      roles: ROLES.map((id) => ({ id, label: ROLE_META[id].label })),
    });
  } catch (e) {
    next(e);
  }
}

async function setUserRole(req, res, next) {
  try {
    const { isAssignableRole, publicUser, ROLE_META } = require("../constants/roles");
    const { role } = req.body;
    if (!isAssignableRole(role)) {
      return res.status(400).json({
        message: `role hợp lệ: ${Object.keys(ROLE_META).join(", ")}`,
      });
    }
    if (String(req.params.id) === String(req.user.id) && role !== "admin") {
      return res.status(400).json({
        message: "Không thể tự hạ / đổi role quản trị của chính bạn",
      });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

async function createUser(req, res, next) {
  try {
    const { isAssignableRole, publicUser, ROLE_META } = require("../constants/roles");
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim();
    const password = req.body.password;
    const role = req.body.role || "user";
    const walletAddress = normalizeWallet(req.body.walletAddress);

    if (!email || !name) {
      return res.status(400).json({ message: "Thiếu email hoặc tên" });
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) return res.status(400).json({ message: pwdErr });
    if (!isAssignableRole(role)) {
      return res.status(400).json({
        message: `role hợp lệ: ${Object.keys(ROLE_META).join(", ")}`,
      });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email đã tồn tại" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      email,
      name,
      role,
      passwordHash,
      walletAddress,
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }
    next(e);
  }
}

async function updateUser(req, res, next) {
  try {
    const { isAssignableRole, publicUser, ROLE_META } = require("../constants/roles");
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    const isSelf = String(user._id) === String(req.user.id);
    const patch = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "Tên không được trống" });
      patch.name = name;
    }
    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email);
      if (!email) return res.status(400).json({ message: "Email không được trống" });
      if (email !== user.email) {
        const exists = await User.findOne({ email, _id: { $ne: user._id } });
        if (exists) return res.status(409).json({ message: "Email đã tồn tại" });
      }
      patch.email = email;
    }
    if (req.body.walletAddress !== undefined) {
      patch.walletAddress = normalizeWallet(req.body.walletAddress);
    }
    if (req.body.role !== undefined) {
      const role = req.body.role;
      if (!isAssignableRole(role)) {
        return res.status(400).json({
          message: `role hợp lệ: ${Object.keys(ROLE_META).join(", ")}`,
        });
      }
      if (isSelf && role !== "admin") {
        return res.status(400).json({
          message: "Không thể tự hạ / đổi role quản trị của chính bạn",
        });
      }
      patch.role = role;
    }

    Object.assign(user, patch);
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }
    next(e);
  }
}

async function deleteUser(req, res, next) {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ message: "Không thể xóa chính tài khoản đang đăng nhập" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: "Không thể xóa admin cuối cùng trong hệ thống",
        });
      }
    }

    await User.deleteOne({ _id: user._id });
    res.json({ ok: true, id: String(user._id) });
  } catch (e) {
    next(e);
  }
}

async function setUserPassword(req, res, next) {
  try {
    const pwdErr = validatePassword(req.body.password);
    if (pwdErr) return res.status(400).json({ message: pwdErr });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    user.passwordHash = await bcrypt.hash(String(req.body.password), 10);
    await user.save();
    res.json({ ok: true, id: String(user._id) });
  } catch (e) {
    next(e);
  }
}

async function resync(_req, res, next) {
  try {
    await backfill();
    const tip = await getLedgerTip();
    res.json({ ok: true, tip });
  } catch (e) {
    next(e);
  }
}

async function refreshAllBooks(_req, res, next) {
  try {
    const books = await Book.find().select("bookId");
    let ok = 0;
    for (const b of books) {
      try {
        await syncBookFromChain(b.bookId);
        ok += 1;
      } catch {
        /* skip missing */
      }
    }
    res.json({ ok: true, refreshed: ok, total: books.length });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  dashboard,
  listUsers,
  setUserRole,
  createUser,
  updateUser,
  deleteUser,
  setUserPassword,
  resync,
  refreshAllBooks,
};
