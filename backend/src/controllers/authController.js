const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { publicUser, canAccessAdmin } = require("../constants/roles");

function jwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw Object.assign(new Error("Thiếu JWT_SECRET trên server"), { status: 503 });
  }
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    secret,
    { expiresIn: jwtExpiresIn() }
  );
}

function sessionPayload(user) {
  const token = signToken(user);
  const decoded = jwt.decode(token);
  return {
    token,
    expiresIn: jwtExpiresIn(),
    expiresAt: decoded?.exp ? decoded.exp * 1000 : null,
    user: publicUser(user),
  };
}

async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Thiếu email / password / name" });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email đã tồn tại" });

    const passwordHash = await bcrypt.hash(password, 10);
    // Không cho tự đăng ký role quản trị — chỉ admin gán sau
    const user = await User.create({
      email,
      passwordHash,
      name,
      role: "user",
    });
    res.status(201).json(sessionPayload(user));
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
    res.json(sessionPayload(user));
  } catch (e) {
    next(e);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({
      user: publicUser(user),
      canAccessAdmin: canAccessAdmin(user.role),
    });
  } catch (e) {
    next(e);
  }
}

async function linkWallet(req, res, next) {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ message: "Thiếu walletAddress" });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true }
    ).select("-passwordHash");
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login, me, linkWallet };
