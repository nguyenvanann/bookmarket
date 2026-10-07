/**
 * Kho bán sơ cấp: mỗi bản bán = 1 NFT forSale.
 * Khi còn tồn Mongo mà thiếu NFT đang mở bán → mint thêm bản (cùng ISBN / metadata).
 */
const Book = require("../models/Book");
const {
  mintBookOnChain,
  bookExistsOnChain,
  readBookOnChain,
  readTxNode,
  getLedgerTip,
} = require("./blockchainService");
const { upsertTxNode } = require("./blockchainListener");

function foldEditionPart(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Khóa đầu sách: luôn theo tên+tác giả (đã bỏ dấu).
 * Tránh tách đôi khi một bản có ISBN còn bản clone thiếu ISBN.
 */
function editionKey(book) {
  const name = foldEditionPart(book?.name || book?.title);
  const authors = foldEditionPart(
    Array.isArray(book?.authors)
      ? book.authors.join(" ")
      : book?.authors || book?.author || ""
  );
  if (name) return `title:${name}|${authors}`;
  const isbn = String(book?.isbn || "")
    .trim()
    .toLowerCase();
  if (isbn) return `isbn:${isbn}`;
  return `id:${book?.bookId}`;
}

/** Query Mongo cùng ấn bản — theo tên (chính), hoặc ISBN */
function editionQuery(book) {
  const name = String(book?.name || "").trim();
  if (name) {
    return { name: new RegExp(`^${escapeRegex(name)}$`, "i") };
  }
  const isbn = String(book?.isbn || "").trim();
  if (isbn) return { isbn };
  return { bookId: Number(book.bookId) };
}

function pickEditionRoot(members) {
  return members.reduce((best, cur) => {
    const bq = Number(best.quantity) || 0;
    const cq = Number(cur.quantity) || 0;
    if (cq !== bq) return cq > bq ? cur : best;
    const bi = String(best.isbn || "").trim();
    const ci = String(cur.isbn || "").trim();
    if (ci && !bi) return cur;
    if (bi && !ci) return best;
    // Ưu tiên bản có file L2 / ảnh
    const bFile = Boolean(best.contentHash || best.hasFile);
    const cFile = Boolean(cur.contentHash || cur.hasFile);
    if (cFile && !bFile) return cur;
    if (bFile && !cFile) return best;
    return Number(cur.bookId) < Number(best.bookId) ? cur : best;
  });
}

/**
 * Gộp các NFT cùng đầu sách → 1 bản ghi catalog.
 * quantity = tồn ấn bản (root); chainCount = số NFT on-chain đã mint.
 */
function groupBooksByEdition(docs = []) {
  const map = new Map();
  for (const b of docs) {
    if (!b) continue;
    const key = editionKey(b);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }

  const editions = [];
  for (const [key, members] of map.entries()) {
    const root = pickEditionRoot(members);
    const sellable = members.filter((m) => m.forSale && !m.marketListed);
    const market = members.filter((m) => m.marketListed);
    const chainBookIds = members
      .map((m) => Number(m.bookId))
      .filter((id) => id > 0)
      .sort((a, b) => a - b);
    const isbn =
      String(root.isbn || "").trim() ||
      members.map((m) => String(m.isbn || "").trim()).find(Boolean) ||
      "";
    const image =
      root.image ||
      members.map((m) => m.image).find((x) => x && String(x).trim()) ||
      "";
    const contentHash =
      root.contentHash ||
      members.map((m) => m.contentHash).find(Boolean) ||
      "";

    const stockQty = Number(root.quantity) || 0;
    // Còn tồn kho → vẫn mua được (prepare-checkout sẽ mint NFT forSale nếu thiếu)
    const buyablePrimary = sellable.length > 0 || stockQty > 0;
    const priceSource =
      sellable.find((m) => Number(m.price) > 0) ||
      members.find((m) => Number(m.price) > 0) ||
      root;
    const listedWeiSource =
      sellable.find(
        (m) => m.listedPriceWei && String(m.listedPriceWei) !== "0"
      ) ||
      members.find(
        (m) => m.listedPriceWei && String(m.listedPriceWei) !== "0"
      ) ||
      root;
    let editionPrice = Number(priceSource.price);
    if (!Number.isFinite(editionPrice) || editionPrice <= 0) {
      try {
        const { formatEther } = require("ethers");
        const wei = listedWeiSource?.listedPriceWei;
        if (wei && String(wei) !== "0") {
          editionPrice = Number(formatEther(String(wei)));
        }
      } catch {
        /* ignore */
      }
    }
    if (!Number.isFinite(editionPrice) || editionPrice <= 0) {
      // Giá 0 không mua được on-chain (listedPrice > 0) — mức mint mặc định
      editionPrice = buyablePrimary ? 0.01 : 0;
    }

    editions.push({
      ...root,
      isbn,
      image,
      contentHash: contentHash || root.contentHash || "",
      fileName: root.fileName || members.map((m) => m.fileName).find(Boolean) || "",
      mimeType: root.mimeType || members.map((m) => m.mimeType).find(Boolean) || "",
      fileSize: root.fileSize || members.map((m) => m.fileSize).find(Boolean) || 0,
      quantity: stockQty,
      price: editionPrice,
      listedPriceWei:
        listedWeiSource.listedPriceWei &&
        String(listedWeiSource.listedPriceWei) !== "0"
          ? String(listedWeiSource.listedPriceWei)
          : buyablePrimary
            ? "10000000000000000" // 0.01 ETH
            : String(root.listedPriceWei || "0"),
      forSale: buyablePrimary,
      marketListed: market.length > 0,
      status:
        market.length > 0
          ? "escrow"
          : buyablePrimary
            ? "listed"
            : root.status || "owned",
      chainCount: members.length,
      sellableCount: sellable.length,
      marketCount: market.length,
      chainBookIds,
      editionKey: key,
      isEdition: true,
    });
  }

  editions.sort((a, b) => Number(a.bookId) - Number(b.bookId));
  return editions;
}

/** Các NFT cùng ấn bản đang mở bán sơ cấp (chưa escrow) */
async function findSellableCopies(book, { limit = 50 } = {}) {
  const q = {
    forSale: true,
    marketListed: { $ne: true },
    ...editionQuery(book),
  };

  const rows = await Book.find(q)
    .select("bookId isbn name forSale marketListed listedPriceWei price quantity ownerWallet")
    .sort({ bookId: 1 })
    .limit(limit)
    .lean();

  const out = [];
  for (const row of rows) {
    if (!(await bookExistsOnChain(row.bookId))) {
      // Chain reset / bookId cũ — gỡ forSale Mongo để catalog không ảo
      await Book.updateOne(
        { bookId: row.bookId },
        { $set: { forSale: false, marketListed: false, status: "owned" } }
      ).catch(() => {});
      continue;
    }
    try {
      const on = await readBookOnChain(row.bookId);
      if (on?.forSale) {
        out.push(row);
      } else if (row.forSale) {
        await Book.updateOne(
          { bookId: row.bookId },
          { $set: { forSale: false } }
        ).catch(() => {});
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

async function mintCatalogCopy(template) {
  const to = process.env.DEPLOYER_ADDRESS;
  if (!to) throw Object.assign(new Error("Thiếu DEPLOYER_ADDRESS"), { status: 503 });

  const { formatEther, parseEther } = require("ethers");
  let priceWei = null;
  if (template.listedPriceWei && String(template.listedPriceWei) !== "0") {
    try {
      priceWei = BigInt(template.listedPriceWei);
    } catch {
      priceWei = null;
    }
  }
  if (priceWei == null || priceWei <= 0n) {
    const eth =
      template.price != null && Number(template.price) > 0
        ? String(template.price)
        : "0.01";
    priceWei = parseEther(eth);
  }
  const priceFromWei = Number(formatEther(priceWei));

  const result = await mintBookOnChain({
    to,
    title: String(template.name || `Book`).slice(0, 120),
    author: (Array.isArray(template.authors)
      ? template.authors.join(", ")
      : template.authors || "Unknown"
    ).slice(0, 80),
    genre: String(template.category || "General").slice(0, 40),
    metadataURI: template.metadataURI || "",
    priceWei: priceWei.toString(),
  });

  if (!result.bookId) {
    throw Object.assign(new Error("Mint bản sao thất bại — không có bookId"), {
      status: 500,
    });
  }

  try {
    const tip = await getLedgerTip();
    if (tip.latestNodeIndex > 0) {
      const node = await readTxNode(tip.latestNodeIndex);
      if (node?.bookId === result.bookId && node.action === "Mint") {
        await upsertTxNode(node.index, {
          txHash: result.txHash,
          blockNumber: result.blockNumber,
        });
      }
    }
  } catch {
    /* listener sẽ backfill */
  }

  const onchain = await readBookOnChain(result.bookId);
  const full = await Book.findOne({ bookId: template.bookId }).select("+fileData");

  const doc = {
    bookId: result.bookId,
    name: template.name,
    isbn: template.isbn || "",
    authors: template.authors || [],
    publisher: template.publisher || "",
    publisherId: template.publisherId || null,
    publishYear: template.publishYear,
    price: priceFromWei,
    costPrice: template.costPrice || 0,
    quantity: 0, // tồn kho gắn ấn bản gốc; bản sao chỉ là NFT bán
    description: template.description || "",
    image: template.image || "",
    status: "listed",
    category: template.category || "",
    categoryId: template.categoryId || null,
    categoryPath: template.categoryPath || "",
    metadataURI: onchain?.metadataURI || template.metadataURI || "",
    ownerWallet: (onchain?.ownerWallet || to).toLowerCase(),
    listedPriceWei:
      onchain?.listedPriceWei || priceWei.toString() || String(template.listedPriceWei || "0"),
    forSale: true,
    marketListed: false,
    marketPriceWei: "0",
    contentHash: template.contentHash || full?.contentHash || "",
    fileName: template.fileName || full?.fileName || "",
    mimeType: template.mimeType || full?.mimeType || "",
    fileSize: template.fileSize || full?.fileSize || 0,
  };

  if (full?.fileData) {
    doc.fileData = full.fileData;
  }

  // Xóa stub listener nếu có
  await Book.deleteOne({ bookId: result.bookId, isbn: { $ne: doc.isbn } }).catch(() => {});
  const existing = await Book.findOne({ bookId: result.bookId });
  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    return existing;
  }
  return Book.create(doc);
}

/** Bản gốc ấn bản — nơi gắn tồn kho quantity */
async function findEditionRoot(book) {
  if (!book) return null;
  const richest = await Book.findOne(editionQuery(book))
    .sort({ quantity: -1 })
    .select(
      "bookId isbn name authors category metadataURI price listedPriceWei contentHash fileName mimeType fileSize image description publisher publisherId publishYear categoryId categoryPath costPrice quantity"
    );
  if (richest) return richest;
  return book;
}

/**
 * Đảm bảo có đủ `quantity` NFT đang forSale cùng ấn bản với templateBookId.
 * @returns {{ bookIds: number[], minted: number, template: object }}
 */
async function ensureSellableUnits(templateBookId, quantity = 1) {
  const {
    assertRpcReady,
    getBookNFT,
    getProvider,
  } = require("./blockchainService");
  await assertRpcReady();

  const nft = getBookNFT();
  if (!nft) {
    throw Object.assign(
      new Error("Chưa cấu hình BOOK_NFT_ADDRESS — chạy deploy:local rồi restart backend"),
      { status: 503 }
    );
  }
  const code = await getProvider().getCode(await nft.getAddress());
  if (!code || code === "0x") {
    throw Object.assign(
      new Error(
        "Contract BookNFT không có trên chain. Chạy: cd smart-contract && npm run deploy:local"
      ),
      { status: 503 }
    );
  }

  const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
  const seed = await Book.findOne({ bookId: Number(templateBookId) });
  if (!seed) {
    throw Object.assign(new Error("Không tìm thấy sách mẫu"), { status: 404 });
  }
  const template = await findEditionRoot(seed);

  const stock = Number(template.quantity);
  // quantity trên bản gốc = tồn kho ấn bản; 0 = hết hàng
  const maxByStock = Number.isFinite(stock) ? Math.max(0, stock) : qty;
  if (maxByStock <= 0) {
    throw Object.assign(new Error("Ấn bản đã hết tồn kho"), { status: 409 });
  }
  const need = Math.min(qty, maxByStock, 20);

  let sellable = await findSellableCopies(template);
  let minted = 0;
  const maxMintAttempts = Math.max(2, need - sellable.length + 2);

  while (sellable.length < need && minted < maxMintAttempts) {
    const before = sellable.length;
    await mintCatalogCopy(template);
    minted += 1;
    sellable = await findSellableCopies(template);
    if (sellable.length <= before) {
      throw Object.assign(
        new Error(
          "Mint bản bán được nhưng không thấy trên chain/Mongo — kiểm tra DEPLOYER_ADDRESS / RPC"
        ),
        { status: 503 }
      );
    }
  }

  if (!sellable.length) {
    throw Object.assign(new Error("Không còn bản nào để bán trên chain"), {
      status: 409,
    });
  }

  const bookIds = sellable.slice(0, need).map((b) => Number(b.bookId));
  return {
    bookIds,
    minted,
    editionKey: editionKey(template),
    template: {
      bookId: template.bookId,
      isbn: template.isbn,
      name: template.name,
      quantity: template.quantity,
      price: template.price,
      listedPriceWei: template.listedPriceWei,
    },
  };
}

/** Sau khi bán: nếu ấn bản còn tồn kho → mint thêm 1 NFT forSale để kệ không trống */
async function restockAfterSale(soldBookId) {
  try {
    const sold = await Book.findOne({ bookId: Number(soldBookId) });
    if (!sold) return null;

    // Tìm ấn bản gốc theo tên/ISBN (không chỉ ISBN — nhiều sách lab thiếu ISBN)
    const root = (await findEditionRoot(sold)) || sold;

    if (Number(root.quantity) <= 0) return null;

    const sellable = await findSellableCopies(root, { limit: 5 });
    if (sellable.length > 0) return { skipped: true, available: sellable.length };

    const copy = await mintCatalogCopy(root);
    console.log(
      `[inventory] restock after sale #${soldBookId} → minted #${copy.bookId} (${root.isbn || root.name})`
    );
    return { mintedBookId: copy.bookId };
  } catch (e) {
    console.warn("[inventory] restockAfterSale:", e.message || e);
    return { error: e.message };
  }
}

module.exports = {
  editionKey,
  editionQuery,
  groupBooksByEdition,
  findSellableCopies,
  findEditionRoot,
  ensureSellableUnits,
  restockAfterSale,
  mintCatalogCopy,
};
