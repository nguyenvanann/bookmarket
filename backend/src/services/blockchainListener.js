const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const {
  getBookNFT,
  getMarketplace,
  getProvider,
  readTxNode,
  readBookOnChain,
  actionName,
  getLedgerTip,
} = require("./blockchainService");
const { broadcast } = require("./liveHub");
const { issueSaleInvoiceFromTxNode } = require("./saleInvoiceService");

let started = false;

async function upsertTxNode(index, meta = {}) {
  const node = await readTxNode(index);
  if (!node) return null;

  const doc = await Transaction.findOneAndUpdate(
    { index: node.index },
    {
      ...node,
      txHash: meta.txHash || "",
      blockNumber: meta.blockNumber || 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // bookId = 0 dùng cho Faucet — không gắn vào Book
  if (node.bookId > 0) {
    await Book.findOneAndUpdate(
      { bookId: node.bookId },
      {
        $addToSet: { nodeIndexes: node.index },
        latestNodeHash: node.nodeHash,
        ownerWallet: node.to?.toLowerCase() || undefined,
      }
    );
  }

  return doc;
}

async function publishTxUpdate(doc) {
  if (!doc) return;
  const tip = await getLedgerTip().catch(() => null);
  const node = doc.toObject ? doc.toObject() : doc;
  broadcast("tx", { node, tip });
  broadcast("tip", tip);
}

async function syncBookFromChain(bookId) {
  const onchain = await readBookOnChain(bookId);
  if (!onchain) return null;

  const market = getMarketplace();
  let marketListed = false;
  let marketPriceWei = "0";
  let marketSeller = "";
  if (market) {
    try {
      const L = await market.getListing(bookId);
      marketListed = L.active;
      marketPriceWei = L.price.toString();
      if (marketListed) marketSeller = String(L.seller).toLowerCase();
    } catch {
      /* ignore */
    }
  }

  let status = "owned";
  if (marketListed) status = "escrow";
  else if (onchain.forSale) status = "listed";

  // Khi escrow: ownerOf = marketplace — lưu seller thật vào ownerWallet để UI nhận diện
  const ownerWallet = marketListed && marketSeller ? marketSeller : onchain.ownerWallet;

  let nodeIndexes = [];
  let latestNodeHash = "";
  try {
    const nft = getBookNFT();
    const idxs = await nft.getBookNodeIndexes(bookId);
    nodeIndexes = idxs.map((x) => Number(x));
    if (nodeIndexes.length) {
      const tipNode = await readTxNode(nodeIndexes[nodeIndexes.length - 1]);
      latestNodeHash = tipNode?.nodeHash || "";
    }
  } catch {
    /* ignore */
  }

  const existing = await Book.findOne({ bookId }).select(
    "name authors category price quantity image description isbn publisher publishYear"
  );

  const listedPriceWei = marketListed ? "0" : onchain.listedPriceWei;
  const patch = {
    bookId,
    metadataURI: onchain.metadataURI,
    ownerWallet,
    listedPriceWei,
    forSale: marketListed ? false : onchain.forSale,
    marketListed,
    marketPriceWei,
    status,
    ...(nodeIndexes.length ? { nodeIndexes, latestNodeHash } : {}),
  };

  // Catalog: chỉ ghi từ chain khi tạo mới hoặc field còn trống (không đè ISBN/NXB…)
  if (!existing?.name) patch.name = onchain.title || `Book #${bookId}`;
  if (!existing?.authors?.length) {
    patch.authors = onchain.author ? [onchain.author] : ["Unknown"];
  }
  if (!existing?.category) patch.category = onchain.genre || "";

  if (!existing?.image && onchain.title) {
    const catalogCover = await Book.findOne({
      name: onchain.title,
      image: { $nin: ["", null] },
    }).select("image");
    if (catalogCover?.image) patch.image = catalogCover.image;
  }

  if (existing == null) {
    try {
      const { formatEther } = require("ethers");
      patch.price = Number(formatEther(listedPriceWei || "0"));
    } catch {
      patch.price = 0;
    }
    patch.quantity = patch.quantity ?? 1;
  }

  return Book.findOneAndUpdate({ bookId }, patch, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });
}

async function backfill() {
  const nft = getBookNFT();
  if (!nft) {
    console.warn("[listener] BOOK_NFT_ADDRESS chưa cấu hình — bỏ qua sync");
    return;
  }
  const tip = Number(await nft.latestNodeIndex());
  // Xóa node Mongo lệch tip (sau redeploy / chain reset)
  const purged = await Transaction.deleteMany({ index: { $gt: tip } });
  if (purged.deletedCount) {
    console.log(`[listener] purged ${purged.deletedCount} stale TxNode > tip ${tip}`);
  }
  console.log(`[listener] backfill TxNode 1..${tip}`);
  for (let i = 1; i <= tip; i++) {
    try {
      const doc = await upsertTxNode(i);
      const node = await readTxNode(i);
      if (node?.bookId > 0) await syncBookFromChain(node.bookId);
      if (doc?.action === "Sale" && doc.bookId > 0) {
        await issueSaleInvoiceFromTxNode(doc).catch((e) =>
          console.warn(`[listener] invoice node ${i}:`, e.message)
        );
      }
    } catch (e) {
      console.warn(`[listener] node ${i}:`, e.message);
    }
  }
}

function startBlockchainListener() {
  if (started) return;
  const nft = getBookNFT();
  if (!nft) {
    console.warn("[listener] chưa có contract — bỏ qua");
    return;
  }
  started = true;

  backfill().catch((e) => console.error("[listener] backfill", e.message));

  nft.on(
    "TxNodeCreated",
    async (index, bookId, prevNodeHash, nodeHash, from, to, action, price, event) => {
      try {
        console.log(
          `[listener] TxNode #${index} book=${bookId} action=${actionName(action)}`
        );
        const doc = await upsertTxNode(Number(index), {
          txHash: event.log?.transactionHash || event.transactionHash,
          blockNumber: event.log?.blockNumber || event.blockNumber,
        });
        const bid = Number(bookId);
        if (bid > 0) await syncBookFromChain(bid);

        // Xuất hóa đơn GTGT chỉ khi Sale on-chain thành công (TxNode đã ghi)
        if (doc?.action === "Sale" && bid > 0) {
          try {
            const invoice = await issueSaleInvoiceFromTxNode(doc);
            if (invoice) {
              broadcast("sale", { sale: invoice });
              console.log(
                `[listener] Hóa đơn ${invoice.invoiceNumber} ← TxNode #${doc.index}`
              );
            }
          } catch (invErr) {
            console.error("[listener] issue invoice", invErr.message);
          }
        }

        await publishTxUpdate(doc);
      } catch (e) {
        console.error("[listener] TxNodeCreated", e.message);
      }
    }
  );

  nft.on("BookMinted", async (bookId) => {
    try {
      await syncBookFromChain(Number(bookId));
    } catch (e) {
      console.error("[listener] BookMinted", e.message);
    }
  });

  nft.on("BookListed", async (bookId) => {
    try {
      await syncBookFromChain(Number(bookId));
    } catch (e) {
      console.error("[listener] BookListed", e.message);
    }
  });

  nft.on("BookSold", async (bookId) => {
    try {
      const book = await syncBookFromChain(Number(bookId));
      if (book) broadcast("book", { book });
    } catch (e) {
      console.error("[listener] BookSold", e.message);
    }
  });

  const market = getMarketplace();
  if (market) {
    market.on("Listed", async (bookId) => {
      try {
        const book = await syncBookFromChain(Number(bookId));
        if (book) broadcast("book", { book });
      } catch (e) {
        console.error("[listener] Listed", e.message);
      }
    });
    market.on("Cancelled", async (bookId) => {
      try {
        const book = await syncBookFromChain(Number(bookId));
        if (book) broadcast("book", { book });
      } catch (e) {
        console.error("[listener] Cancelled", e.message);
      }
    });
    market.on("Purchased", async (bookId) => {
      try {
        const book = await syncBookFromChain(Number(bookId));
        if (book) broadcast("book", { book });
      } catch (e) {
        console.error("[listener] Purchased", e.message);
      }
    });
  }

  getProvider()
    .getBlockNumber()
    .then((n) => console.log(`[listener] listening from block ${n}`))
    .catch(() => {});
}

module.exports = {
  startBlockchainListener,
  backfill,
  syncBookFromChain,
  upsertTxNode,
  publishTxUpdate,
};
