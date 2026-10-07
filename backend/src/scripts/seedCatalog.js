/**
 * Seed danh mục + NXB + NCC + 20 sách manga/anime mẫu.
 * Usage: npm run seed:anime
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { seedCategories } = require("./seedCategories");
const { seedPublishers } = require("./seedPublishers");
const { seedSuppliers } = require("./seedSuppliers");
const { seedAnimeBooks } = require("./seedAnimeBooks");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookmarket";
  await mongoose.connect(uri);
  console.log("MongoDB connected · seeding catalog…");
  await seedCategories();
  await seedPublishers();
  await seedSuppliers();
  const result = await seedAnimeBooks();
  console.log("Done:", result);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
