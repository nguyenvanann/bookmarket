/**
 * Mint / gắn 20 sách manga seed lên Geth (TxNode Mint) + remap bookId Mongo.
 * Usage: npm run seed:anime:chain
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { seedAnimeBooks } = require("./seedAnimeBooks");
const { seedCategories } = require("./seedCategories");
const { seedPublishers } = require("./seedPublishers");
const { seedSuppliers } = require("./seedSuppliers");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookmarket";
  await mongoose.connect(uri);
  console.log("MongoDB connected · mint seed books on-chain…");
  await seedCategories();
  await seedPublishers();
  await seedSuppliers();
  const result = await seedAnimeBooks({ mintOnChain: true });
  console.log(result);
  await mongoose.disconnect();
  if (result?.error) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
