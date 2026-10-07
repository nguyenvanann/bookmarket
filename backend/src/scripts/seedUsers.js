const bcrypt = require("bcryptjs");
const User = require("../models/User");

const STAFF_SEEDS = [
  {
    email: "admin@bookmarket.local",
    name: "Admin BookMarket",
    role: "admin",
    password: "admin123",
    walletFromEnv: true,
  },
  {
    email: "staff@bookmarket.local",
    name: "Nhân viên vận hành",
    role: "staff",
    password: "admin123",
  },
  {
    email: "warehouse@bookmarket.local",
    name: "Thủ kho",
    role: "warehouse",
    password: "admin123",
  },
  {
    email: "accountant@bookmarket.local",
    name: "Kế toán",
    role: "accountant",
    password: "admin123",
  },
  {
    email: "user@bookmarket.local",
    name: "Người đọc",
    role: "user",
    password: "user123",
  },
];

/**
 * Upsert tài khoản lab. Chỉ ghi đè password khi user chưa tồn tại
 * (tránh reset mật khẩu admin đã đổi khi mỗi lần boot).
 */
async function seedUsers({ forcePassword = false } = {}) {
  let created = 0;
  let updated = 0;

  for (const s of STAFF_SEEDS) {
    const email = s.email.toLowerCase();
    const existing = await User.findOne({ email });
    const passwordHash = await bcrypt.hash(s.password, 10);
    const walletAddress = s.walletFromEnv
      ? (process.env.DEPLOYER_ADDRESS || "").toLowerCase()
      : undefined;

    if (!existing) {
      await User.create({
        email,
        name: s.name,
        role: s.role,
        passwordHash,
        ...(walletAddress ? { walletAddress } : {}),
      });
      created += 1;
      continue;
    }

    const patch = {};
    if (existing.name !== s.name) patch.name = s.name;
    if (existing.role !== s.role) patch.role = s.role;
    if (forcePassword) patch.passwordHash = passwordHash;
    if (walletAddress && !existing.walletAddress) patch.walletAddress = walletAddress;

    if (Object.keys(patch).length) {
      await User.updateOne({ _id: existing._id }, { $set: patch });
      updated += 1;
    }
  }

  if (created || updated) {
    console.log(`[seed] users · created=${created} updated=${updated}`);
  }
  return { created, updated };
}

module.exports = { seedUsers, STAFF_SEEDS };
