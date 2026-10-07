require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const saleRoutes = require("./routes/saleRoutes");
const stockRoutes = require("./routes/stockRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const publisherRoutes = require("./routes/publisherRoutes");
const walletRoutes = require("./routes/walletRoutes");
const errorHandler = require("./middlewares/errorHandler");
const { startBlockchainListener } = require("./services/blockchainListener");
const { getLedgerStatus } = require("./services/blockchainService");
const { migrateBookCatalog } = require("./scripts/migrateBookCatalog");
const { seedCategories } = require("./scripts/seedCategories");
const { seedPublishers } = require("./scripts/seedPublishers");
const { seedSuppliers } = require("./scripts/seedSuppliers");
const { seedAnimeBooks } = require("./scripts/seedAnimeBooks");
const { seedUsers } = require("./scripts/seedUsers");
const Book = require("./models/Book");


const app = express();
const PORT = process.env.PORT || 5002;

const allowedOrigins = (
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://localhost:5175"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return cb(null, true);
      }
      // lab: cho phép mọi localhost Vite
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    exposedHeaders: [
      "Content-Disposition",
      "X-Read-Mode",
      "X-Sample-Pages",
      "X-Sample-Max",
      "X-Total-Pages",
      "X-Content-Hash",
    ],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    skip: (req) => req.path.startsWith("/api/ledger/stream"),
  })
);

app.get("/api/health", async (_req, res) => {
  try {
    const ledger = await getLedgerStatus();
    res.json({ ok: true, mongo: mongoose.connection.readyState === 1, ledger });
  } catch (e) {
    res.json({ ok: true, mongo: mongoose.connection.readyState === 1, error: e.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/publishers", publisherRoutes);
app.use("/api/wallet", walletRoutes);

app.use(errorHandler);

async function boot() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bookmarket";
  await mongoose.connect(uri);
  console.log("MongoDB connected");
  await migrateBookCatalog(Book);
  await seedUsers();
  await seedCategories();
  await seedPublishers();
  await seedSuppliers();
  // Catalog Mongo trước (nhanh) — mint on-chain chạy nền để không chặn API
  await seedAnimeBooks({ mintOnChain: false });
  startBlockchainListener();
  const server = app.listen(PORT, () => {
    console.log(`BookMarket API http://localhost:${PORT}`);
    seedAnimeBooks({ mintOnChain: true })
      .then((r) => {
        if (r?.minted || r?.linked) {
          console.log(
            `[seed] on-chain ensure done · minted=${r.minted || 0} linked=${r.linked || 0}`
          );
        }
      })
      .catch((e) => console.error("[seed] on-chain ensure failed:", e.message || e));
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} đang bị chiếm (EADDRINUSE). ` +
          `Đóng process cũ: netstat -ano | findstr :${PORT} rồi taskkill /PID <pid> /F`
      );
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });
}

boot().catch((e) => {
  console.error(e);
  process.exit(1);
});
