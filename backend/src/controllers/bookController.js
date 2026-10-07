const crypto = require("crypto");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { syncBookFromChain, upsertTxNode } = require("../services/blockchainListener");
const chain = require("../services/blockchainService");
const {
  normalizeBookPayload,
  resolveCategoryFields,
  resolvePublisherFields,
  CATALOG_STATUSES,
} = require("../utils/bookCatalog");
const { pickUploaded, coverToDataUrl } = require("../middlewares/uploadMiddleware");
const {
  SAMPLE_PAGES,
  isPdfBook,
  buildSamplePdfBuffer,
} = require("../services/bookSampleService");
const {
  buildFuzzyMongoOr,
  fuzzyScore,
  bookSearchBlob,
} = require("../utils/fuzzySearch");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function formatBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function bookJson(book) {
  if (!book) return null;
  const j = book.toJSON ? book.toJSON() : book;
  const hasFile = Boolean(j.contentHash && j.fileSize);
  const mime = String(j.mimeType || "").toLowerCase();
  const name = String(j.fileName || "").toLowerCase();
  const sampleAvailable = hasFile && (mime.includes("pdf") || name.endsWith(".pdf"));
  return {
    ...j,
    hasFile,
    sampleAvailable,
    fileSizeLabel: formatBytes(j.fileSize),
  };
}

async function listBooks(req, res, next) {
  try {
    const filter = {};
    const category = req.query.category || req.query.genre;
    if (category) filter.category = new RegExp(String(category), "i");
    if (req.query.status) filter.status = req.query.status;
    else if (req.query.includeInactive !== "1") {
      filter.status = { $ne: "inactive" };
    }
    if (req.query.isbn) filter.isbn = new RegExp(String(req.query.isbn), "i");
    if (req.query.publisher) {
      filter.publisher = new RegExp(String(req.query.publisher), "i");
    }
    // forSale lọc sau khi gộp đầu sách (ấn bản còn bản bán)
    const forSaleOnly = req.query.forSale === "1";
    if (req.query.owner) {
      filter.ownerWallet = String(req.query.owner).toLowerCase();
    }

    const searchQ = String(req.query.q || "").trim();
    if (searchQ) {
      const fuzzy = buildFuzzyMongoOr(searchQ, [
        "name",
        "isbn",
        "authors",
        "publisher",
        "category",
        "categoryPath",
        "description",
      ]);
      const idRaw = searchQ.replace(/^#/, "").trim();
      const idNum = Number(idRaw);
      const idClause =
        Number.isFinite(idNum) && String(idNum) === idRaw
          ? [{ bookId: idNum }]
          : [];
      if (fuzzy) {
        filter.$and = [
          ...(filter.$and || []),
          idClause.length ? { $or: [fuzzy, ...idClause] } : fuzzy,
        ];
      } else if (idClause.length) {
        filter.bookId = idNum;
      }
    }

    const sortKey = String(req.query.sort || "bookId");
    const sortDir = String(req.query.order || "asc").toLowerCase() === "desc" ? -1 : 1;

    const pageRaw = req.query.page;
    const paginate = pageRaw != null && pageRaw !== "";
    const page = Math.max(1, Number(pageRaw) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.limit) || 12));

    // Mặc định gộp theo đầu sách. My Books (owner=) hoặc group=chain → từng NFT.
    const groupMode = String(req.query.group || "").toLowerCase();
    const byOwner = Boolean(req.query.owner);
    const groupByEdition =
      !byOwner && groupMode !== "chain" && groupMode !== "nft";

    const { groupBooksByEdition } = require("../services/inventoryService");

    // Luôn lấy ứng viên rồi gộp/xếp hạng (kho lab quy mô vừa)
    let rows = await Book.find(filter).select("-fileData").limit(5000).lean();

    if (groupByEdition) {
      rows = groupBooksByEdition(rows);
      if (forSaleOnly) {
        rows = rows.filter(
          (b) =>
            b.forSale ||
            b.marketListed ||
            Number(b.sellableCount) > 0 ||
            Number(b.quantity) > 0
        );
      }
    } else if (forSaleOnly) {
      rows = rows.filter(
        (b) => b.forSale || b.marketListed || Number(b.quantity) > 0
      );
    }

    if (searchQ) {
      rows = rows
        .map((b) => ({ b, score: fuzzyScore(bookSearchBlob(b), searchQ) }))
        .filter((x) => {
          if (x.score > 0) return true;
          const idRaw = searchQ.replace(/^#/, "").trim();
          return (
            /^\d+$/.test(idRaw) &&
            (Number(x.b.bookId) === Number(idRaw) ||
              (Array.isArray(x.b.chainBookIds) &&
                x.b.chainBookIds.includes(Number(idRaw))))
          );
        })
        .sort(
          (a, c) =>
            c.score - a.score || Number(a.b.bookId) - Number(c.b.bookId)
        )
        .map((x) => x.b);
    } else if (sortKey === "name") {
      rows.sort(
        (a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "vi") *
          sortDir
      );
    } else if (sortKey === "quantity") {
      rows.sort(
        (a, b) => ((Number(a.quantity) || 0) - (Number(b.quantity) || 0)) * sortDir
      );
    } else if (sortKey === "price") {
      rows.sort(
        (a, b) => ((Number(a.price) || 0) - (Number(b.price) || 0)) * sortDir
      );
    } else if (sortKey === "newest") {
      rows.sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0) ||
          Number(b.bookId) - Number(a.bookId)
      );
    } else {
      rows.sort((a, b) => (Number(a.bookId) - Number(b.bookId)) * sortDir);
    }

    const total = rows.length;
    const slice = paginate
      ? rows.slice((page - 1) * pageSize, page * pageSize)
      : rows;
    const books = slice.map(bookJson);
    const totalPages = paginate ? Math.max(1, Math.ceil(total / pageSize) || 1) : 1;

    res.json({
      books,
      total,
      page: paginate ? page : 1,
      pageSize: paginate ? pageSize : total,
      totalPages,
      q: searchQ || undefined,
      group: groupByEdition ? "edition" : "chain",
    });
  } catch (e) {
    next(e);
  }
}

async function getBook(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    let book = await Book.findOne({ bookId }).select("-fileData");
    if (!book) {
      book = await syncBookFromChain(bookId);
    }
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });

    const {
      editionQuery,
      findEditionRoot,
      groupBooksByEdition,
    } = require("../services/inventoryService");
    const root = await findEditionRoot(book);
    const siblings = await Book.find(editionQuery(root || book))
      .select("-fileData")
      .lean();
    const [edition] = groupBooksByEdition(siblings.length ? siblings : [book.toObject?.() || book]);
    const chainNodes = await Transaction.find({
      bookId: {
        $in:
          edition?.chainBookIds?.length > 0
            ? edition.chainBookIds
            : [bookId],
      },
    }).sort({ index: 1 });

    const payload = bookJson(root || book);
    const stockQty = Number(root?.quantity ?? book.quantity) || 0;
    const buyablePrimary =
      Boolean(edition?.forSale) ||
      Number(edition?.sellableCount) > 0 ||
      stockQty > 0;
    res.json({
      book: {
        ...payload,
        quantity: stockQty,
        // Gộp cờ bán theo ấn bản — tránh bản copy đã owned che mất khả năng mua thêm
        forSale: buyablePrimary,
        marketListed: Boolean(edition?.marketListed),
        status:
          edition?.status ||
          (buyablePrimary ? "listed" : payload.status || "owned"),
        price:
          edition?.price != null
            ? edition.price
            : buyablePrimary && !(Number(payload.price) > 0)
              ? 0.01
              : payload.price,
        listedPriceWei:
          edition?.listedPriceWei ||
          payload.listedPriceWei ||
          (buyablePrimary ? "10000000000000000" : "0"),
        chainCount: edition?.chainCount || 1,
        sellableCount: edition?.sellableCount || 0,
        marketCount: edition?.marketCount || 0,
        chainBookIds: edition?.chainBookIds || [bookId],
        editionKey: edition?.editionKey,
        isEdition: true,
        viewedBookId: bookId,
      },
      chain: chainNodes,
      edition,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Mint NFT + lưu catalog Mongo + file L2.
 * On-chain metadataURI = sha256:<hash> khi có file.
 */
async function adminMint(req, res, next) {
  try {
    const categoryFields = await resolveCategoryFields(req.body);
    const publisherFields = await resolvePublisherFields(req.body);
    const { catalog, chainTitle, chainAuthor, chainGenre, priceEth } =
      normalizeBookPayload(req.body, categoryFields, publisherFields);

    if (!catalog.name || !catalog.authors.length) {
      return res.status(400).json({ message: "Thiếu name (tên sách) / authors" });
    }

    const file = pickUploaded(req, "bookFile") || req.file;
    const coverFile = pickUploaded(req, "coverImage");
    const coverDataUrl = coverFile ? coverToDataUrl(coverFile) : "";
    let contentHash = "";
    let onChainUri = req.body.metadataURI || catalog.image || "";

    if (file?.buffer?.length) {
      contentHash = sha256Hex(file.buffer);
      onChainUri = `sha256:${contentHash}`;
    }
    if (coverDataUrl) {
      catalog.image = coverDataUrl;
    }

    const recipient = req.body.to || process.env.DEPLOYER_ADDRESS;
    const result = await chain.mintBookOnChain({
      to: recipient,
      title: chainTitle,
      author: chainAuthor,
      genre: chainGenre,
      metadataURI: onChainUri,
      priceEth: priceEth || "0",
    });

    await new Promise((r) => setTimeout(r, 2000));
    const tip = await chain.getLedgerTip();
    const node = tip.latestNodeIndex
      ? await chain.readTxNode(tip.latestNodeIndex)
      : null;

    if (node) {
      await upsertTxNode(node.index, {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
      });
      const book = await syncBookFromChain(node.bookId);
      if (book) {
        Object.assign(book, catalog);
        book.price = catalog.price;
        if (catalog.quantity === 0) book.status = "out_of_stock";
        else if (book.forSale) book.status = "listed";
        else if (book.marketListed) book.status = "escrow";
        else book.status = catalog.status || "available";

        if (file?.buffer?.length) {
          book.contentHash = contentHash;
          book.fileName = file.originalname || `book-${book.bookId}`;
          book.mimeType = file.mimetype || "application/octet-stream";
          book.fileSize = file.buffer.length;
          book.fileData = file.buffer;
          book.metadataURI = onChainUri;
        }
        await book.save();
      }
      return res.status(201).json({
        book: bookJson(book),
        txHash: result.txHash,
        node,
        layer2: file?.buffer?.length
          ? {
              storage: "mongodb",
              contentHash,
              metadataURI: onChainUri,
              fileName: file.originalname,
              fileSize: file.buffer.length,
            }
          : null,
      });
    }
    res.status(201).json({ txHash: result.txHash, message: "Minted — chờ sync" });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function userOwnsBook(user, book) {
  if (!user) return false;
  const { hasScope } = require("../constants/roles");
  if (hasScope(user.role, "*")) return true;
  const wallet = (user.walletAddress || "").toLowerCase();
  if (!wallet) return false;
  const mongoOwner = (book.ownerWallet || "").toLowerCase();
  if (wallet && wallet === mongoOwner) return true;
  try {
    const onChain = await chain.readBookOnChain(book.bookId);
    const chainOwner = String(onChain?.owner || "").toLowerCase();
    if (wallet && chainOwner && wallet === chainOwner) return true;
  } catch {
    /* chain offline — rely on Mongo */
  }
  return false;
}

async function downloadBookFile(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId }).select("+fileData");
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });
    if (!book.fileData?.length || !book.contentHash) {
      return res.status(404).json({ message: "Sách chưa có file nội dung (L2)" });
    }

    const user = await User.findById(req.user.id).select("role walletAddress");
    const allowed = await userOwnsBook(user, book);
    if (!allowed) {
      return res.status(403).json({
        message:
          "Chỉ admin hoặc chủ sở hữu NFT mới đọc được toàn bộ sách. Hãy mua sách và liên kết ví với tài khoản.",
      });
    }

    const liveHash = sha256Hex(book.fileData);
    if (book.contentHash && liveHash !== book.contentHash) {
      return res.status(409).json({
        message: "File Mongo lệch contentHash — dữ liệu có thể bị hỏng",
        expected: book.contentHash,
        actual: liveHash,
      });
    }

    const inline = ["1", "true", "yes"].includes(
      String(req.query.view || "").toLowerCase()
    );
    const filename = book.fileName || `book-${bookId}.pdf`;
    res.setHeader("Content-Type", book.mimeType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("X-Content-Hash", book.contentHash);
    res.setHeader("X-Metadata-URI", book.metadataURI || `sha256:${book.contentHash}`);
    res.setHeader("X-Read-Mode", "full");
    res.send(book.fileData);
  } catch (e) {
    next(e);
  }
}

/**
 * Đọc thử công khai: 10 trang đầu PDF (không cần mua / đăng nhập).
 * GET /books/:bookId/sample
 */
async function downloadBookSample(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId }).select("+fileData");
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });
    if (!book.fileData?.length || !book.contentHash) {
      return res.status(404).json({ message: "Sách chưa có file nội dung để đọc thử" });
    }
    if (!isPdfBook(book)) {
      return res.status(400).json({
        message: "Đọc thử hiện chỉ hỗ trợ sách định dạng PDF",
      });
    }

    // Luôn cắt cứng tối đa 10 trang đầu — không nhận tham số vượt
    const sample = await buildSamplePdfBuffer(book.fileData);
    if (sample.pageCount > SAMPLE_PAGES) {
      return res.status(500).json({ message: "Bản đọc thử vượt quá 10 trang" });
    }
    const filename = `${(book.fileName || `book-${bookId}`).replace(/\.pdf$/i, "")}-mau-${sample.pageCount}trang.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.setHeader("X-Read-Mode", "sample");
    res.setHeader("X-Sample-Pages", String(sample.pageCount));
    res.setHeader("X-Sample-Max", String(SAMPLE_PAGES));
    res.setHeader("X-Total-Pages", String(sample.totalPages));
    res.setHeader("Cache-Control", "no-store");
    res.send(sample.buffer);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

/** Cập nhật catalog + (tuỳ chọn) thay file L2 / ảnh bìa */
async function updateBookMeta(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId }).select("+fileData");
    if (!book) return res.status(404).json({ message: "Not found" });

    const coverFile = pickUploaded(req, "coverImage");
    if (coverFile?.buffer?.length > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "Ảnh bìa tối đa 5MB" });
    }

    let imageValue = req.body.image ?? req.body.coverUrl ?? book.image;
    if (coverFile?.buffer?.length) {
      imageValue = coverToDataUrl(coverFile);
    }

    const categoryFields = await resolveCategoryFields({
      categoryId:
        req.body.categoryId !== undefined && req.body.categoryId !== ""
          ? req.body.categoryId
          : book.categoryId,
      category: req.body.category ?? req.body.genre ?? book.category,
      categoryPath: req.body.categoryPath ?? book.categoryPath,
    });
    const publisherFields = await resolvePublisherFields({
      publisherId:
        req.body.publisherId !== undefined && req.body.publisherId !== ""
          ? req.body.publisherId
          : book.publisherId,
      publisher: req.body.publisher ?? book.publisher,
    });
    const { catalog } = normalizeBookPayload(
      {
        name: req.body.name ?? req.body.title ?? book.name,
        authors: req.body.authors ?? req.body.author ?? book.authors,
        category: categoryFields.category,
        categoryId: categoryFields.categoryId,
        categoryPath: categoryFields.categoryPath,
        image: imageValue,
        description: req.body.description ?? book.description,
        isbn: req.body.isbn ?? book.isbn,
        publisher: publisherFields.publisher,
        publisherId: publisherFields.publisherId,
        publishYear: req.body.publishYear ?? book.publishYear,
        price: req.body.price ?? book.price,
        quantity: req.body.quantity ?? book.quantity,
        status: req.body.status,
        priceEth: req.body.priceEth,
      },
      categoryFields,
      publisherFields
    );

    if (!catalog.name || !catalog.authors.length) {
      return res.status(400).json({ message: "Thiếu name / authors" });
    }

    Object.assign(book, catalog);

    const bookFile = pickUploaded(req, "bookFile") || req.file;
    let layer2 = null;
    if (bookFile?.buffer?.length) {
      const contentHash = sha256Hex(bookFile.buffer);
      const onChainUri = `sha256:${contentHash}`;
      book.contentHash = contentHash;
      book.fileName = bookFile.originalname || `book-${book.bookId}`;
      book.mimeType = bookFile.mimetype || "application/octet-stream";
      book.fileSize = bookFile.buffer.length;
      book.fileData = bookFile.buffer;
      book.metadataURI = onChainUri;
      layer2 = {
        storage: "mongodb",
        contentHash,
        metadataURI: onChainUri,
        fileName: book.fileName,
        fileSize: book.fileSize,
      };
    }

    if (req.body.status && CATALOG_STATUSES.includes(req.body.status)) {
      book.status = req.body.status;
    } else if (catalog.quantity === 0) {
      book.status = "out_of_stock";
    } else if (book.marketListed) {
      book.status = "escrow";
    } else if (book.forSale) {
      book.status = "listed";
    }

    await book.save();
    res.json({ book: bookJson(book), layer2 });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function refreshBook(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await syncBookFromChain(bookId);
    if (!book) return res.status(404).json({ message: "Not found on chain" });

    // Sau thanh toán: sync TxNode Sale + xuất HĐ nếu listener bỏ lỡ event
    let invoice = null;
    try {
      const {
        getBookNFT,
        readTxNode,
      } = require("../services/blockchainService");
      const { upsertTxNode } = require("../services/blockchainListener");
      const { issueSaleInvoiceFromTxNode } = require("../services/saleInvoiceService");
      const nft = getBookNFT();
      if (nft) {
        const idxs = await nft.getBookNodeIndexes(bookId);
        const recent = idxs.map(Number).slice(-5);
        for (const idx of recent) {
          const doc = await upsertTxNode(idx);
          if (doc?.action === "Sale") {
            invoice = (await issueSaleInvoiceFromTxNode(doc)) || invoice;
          } else {
            // đảm bảo Mongo có node dù không phải Sale
            await readTxNode(idx).catch(() => null);
          }
        }
      }
    } catch (syncErr) {
      console.warn("[refresh] sale sync:", syncErr.message);
    }

    res.json({
      book: bookJson(book),
      ...(invoice ? { sale: { invoiceNumber: invoice.invoiceNumber } } : {}),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Ngừng kinh doanh (soft-delete): status=inactive, gỡ forSale trên Mongo.
 * ?hard=1 — xóa hẳn document (không xóa NFT on-chain).
 */
async function deleteBook(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId });
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });

    const hard =
      req.query.hard === "1" ||
      req.body?.hard === true ||
      req.body?.hard === "1";

    if (hard) {
      if (book.marketListed) {
        return res.status(409).json({
          message: "Sách đang escrow marketplace — hủy listing trước khi xóa cứng",
        });
      }
      await Book.deleteOne({ bookId });
      return res.json({
        ok: true,
        hard: true,
        bookId,
        message: `Đã xóa cứng catalog #${bookId} (NFT on-chain vẫn còn)`,
      });
    }

    book.status = "inactive";
    book.forSale = false;
    await book.save();
    res.json({
      ok: true,
      hard: false,
      book: bookJson(book),
      message: `Đã ngừng KD sách #${bookId}`,
    });
  } catch (e) {
    next(e);
  }
}

/** Khôi phục sách đã soft-delete */
async function restoreBook(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId });
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });

    if (book.quantity === 0) book.status = "out_of_stock";
    else if (book.marketListed) book.status = "escrow";
    else if (book.forSale) book.status = "listed";
    else book.status = "available";

    await book.save();
    res.json({ ok: true, book: bookJson(book), message: `Đã khôi phục #${bookId}` });
  } catch (e) {
    next(e);
  }
}

/**
 * Chuẩn bị N bản NFT forSale cùng ấn bản (mint thêm nếu thiếu) — dùng trước khi mua hàng loạt / mua nhiều cuốn.
 * Public lab: không yêu cầu JWT (giống mua on-chain).
 */
async function prepareCheckoutUnits(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const quantity = Number(req.body?.quantity || req.query?.quantity || 1);
    const { ensureSellableUnits } = require("../services/inventoryService");
    const result = await ensureSellableUnits(bookId, quantity);
    res.json({
      ok: true,
      bookIds: result.bookIds,
      minted: result.minted,
      editionKey: result.editionKey,
      template: result.template,
      count: result.bookIds.length,
    });
  } catch (e) {
    const msg = String(e.message || e);
    if (
      e.status === 503 ||
      /ECONNREFUSED|RPC timeout|Không kết nối được Geth/i.test(msg)
    ) {
      return res.status(503).json({
        message:
          e.message ||
          "Không kết nối được Geth tại http://127.0.0.1:8547. Hãy chạy private-net (node1) rồi thử lại.",
      });
    }
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
}

async function listEditionAvailability(req, res, next) {
  try {
    const bookId = Number(req.params.bookId);
    const book = await Book.findOne({ bookId }).select(
      "bookId isbn name quantity price listedPriceWei forSale marketListed"
    );
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });
    const { findSellableCopies, findEditionRoot } = require("../services/inventoryService");
    const root = await findEditionRoot(book);
    const stock = Number(root?.quantity) || 0;
    const sellable = await findSellableCopies(root || book);
    res.json({
      bookId,
      isbn: book.isbn || root?.isbn,
      stockQuantity: stock,
      sellableCount: sellable.length,
      sellableBookIds: sellable.map((b) => b.bookId),
      maxCheckout: Math.min(20, Math.max(0, stock)),
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listBooks,
  getBook,
  adminMint,
  downloadBookFile,
  downloadBookSample,
  updateBookMeta,
  refreshBook,
  deleteBook,
  restoreBook,
  prepareCheckoutUnits,
  listEditionAvailability,
};
