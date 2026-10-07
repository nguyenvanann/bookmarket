require("dotenv").config();
const mongoose = require("mongoose");
const { seedUsers, STAFF_SEEDS } = require("./seedUsers");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookmarket");
  await seedUsers({ forcePassword: true });
  for (const s of STAFF_SEEDS) {
    console.log(`Seeded ${s.role}:`, s.email, `/ ${s.password}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
