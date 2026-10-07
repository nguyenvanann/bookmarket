/**
 * Seed sách mẫu + liên kết danh mục, NXB, NCC, PDF đọc thử, phiếu nhập kho.
 * Idempotent theo ISBN (chạy lại an toàn).
 */
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const Book = require("../models/Book");
const Category = require("../models/Category");
const Publisher = require("../models/Publisher");
const Supplier = require("../models/Supplier");
const StockMovement = require("../models/StockMovement");
const { stockIn } = require("../services/stockService");
const {
  mintBookOnChain,
  bookExistsOnChain,
  readBookOnChain,
  readTxNode,
  getLedgerTip,
  getBookNFT,
} = require("../services/blockchainService");

const SEED_NOTE = "[seed-anime]";
/** bookId tạm khi chưa mint — sẽ remap sang id on-chain thật */
const BOOK_ID_BASE = 9001;
const MINT_ON_CHAIN = String(process.env.SEED_MINT_ON_CHAIN || "true").toLowerCase() !== "false";

/** Sách mẫu manga, anime và tiểu thuyết (bản mô phỏng catalog VN) */
const CATALOG = [
  {
    slug: "one-piece",
    name: "One Piece - Tập 1: Romance Dawn",
    authors: ["Eiichiro Oda"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2020,
    price: 0.018,
    cost: 0.01,
    qty: 48,
    isbn: "BM-MANGA-01",
    hue: 210,
    description:
      "Monkey D. Luffy bắt đầu hành trình trở thành Vua Hải Tặc. Series shonen dài nhất và nổi tiếng nhất thế giới.",
  },
  {
    slug: "naruto",
    name: "Naruto - Tập 1",
    authors: ["Masashi Kishimoto"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2019,
    price: 0.016,
    cost: 0.009,
    qty: 40,
    isbn: "BM-MANGA-02",
    hue: 28,
    description:
      "Naruto Uzumaki — ninja làng Lá mang trong mình Cửu Vĩ — ước mơ trở thành Hokage.",
  },
  {
    slug: "dragon-ball",
    name: "Dragon Ball - Tập 1",
    authors: ["Akira Toriyama"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2018,
    price: 0.015,
    cost: 0.008,
    qty: 36,
    isbn: "BM-MANGA-03",
    hue: 42,
    description:
      "Son Goku và hành trình tìm Ngọc Rồng cùng Bulma — khởi nguồn của văn hóa shonen hiện đại.",
  },
  {
    slug: "attack-on-titan",
    name: "Attack on Titan - Tập 1",
    authors: ["Hajime Isayama"],
    categoryLeaf: "Seinen",
    publisher: "IPM",
    year: 2021,
    price: 0.022,
    cost: 0.012,
    qty: 32,
    isbn: "BM-MANGA-04",
    hue: 0,
    description:
      "Nhân loại sống sau tường thành để tránh Titan. Eren Yeager tuyên chiến với những kẻ khổng lồ.",
  },
  {
    slug: "demon-slayer",
    name: "Demon Slayer: Kimetsu no Yaiba - Tập 1",
    authors: ["Koyoharu Gotouge"],
    categoryLeaf: "Shonen",
    publisher: "IPM",
    year: 2021,
    price: 0.02,
    cost: 0.011,
    qty: 45,
    isbn: "BM-MANGA-05",
    hue: 330,
    description:
      "Tanjiro Kamado gia nhập Sát Quỷ Đoàn để cứu em gái Nezuko và trả thù cho gia đình.",
  },
  {
    slug: "jujutsu-kaisen",
    name: "Jujutsu Kaisen - Tập 1",
    authors: ["Gege Akutami"],
    categoryLeaf: "Shonen",
    publisher: "IPM",
    year: 2022,
    price: 0.021,
    cost: 0.011,
    qty: 42,
    isbn: "BM-MANGA-06",
    hue: 270,
    description:
      "Yuji Itadori nuốt ngón tay Sukuna và bước vào thế giới chú thuật đầy nguy hiểm.",
  },
  {
    slug: "my-hero-academia",
    name: "My Hero Academia - Tập 1",
    authors: ["Kohei Horikoshi"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2020,
    price: 0.017,
    cost: 0.009,
    qty: 38,
    isbn: "BM-MANGA-07",
    hue: 200,
    description:
      "Izuku Midoriya — cậu bé không quirk — nhận di sản One For All từ All Might.",
  },
  {
    slug: "spy-x-family",
    name: "Spy × Family - Tập 1",
    authors: ["Tatsuya Endo"],
    categoryLeaf: "Shonen",
    publisher: "Amak Books",
    year: 2022,
    price: 0.019,
    cost: 0.01,
    qty: 50,
    isbn: "BM-MANGA-08",
    hue: 350,
    description:
      "Điệp viên Twilight lập gia đình giả với sát thủ Yor và con gái tâm linh Anya — hài hước & ấm áp.",
  },
  {
    slug: "chainsaw-man",
    name: "Chainsaw Man - Tập 1",
    authors: ["Tatsuki Fujimoto"],
    categoryLeaf: "Seinen",
    publisher: "IPM",
    year: 2022,
    price: 0.023,
    cost: 0.013,
    qty: 28,
    isbn: "BM-MANGA-09",
    hue: 15,
    description:
      "Denji hợp nhất với quỷ cưa Pochita, trở thành Chainsaw Man trong thế giới đen tối đầy quỷ dữ.",
  },
  {
    slug: "death-note",
    name: "Death Note - Tập 1",
    authors: ["Tsugumi Ohba", "Takeshi Obata"],
    categoryLeaf: "Seinen",
    publisher: "NXB Trẻ",
    year: 2019,
    price: 0.02,
    cost: 0.011,
    qty: 30,
    isbn: "BM-MANGA-10",
    hue: 220,
    description:
      "Light Yagami nhặt được quyển sổ tử thần. Cuộc đấu trí với thám tử L bắt đầu.",
  },
  {
    slug: "fullmetal-alchemist",
    name: "Fullmetal Alchemist - Tập 1",
    authors: ["Hiromu Arakawa"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2018,
    price: 0.018,
    cost: 0.01,
    qty: 34,
    isbn: "BM-MANGA-11",
    hue: 45,
    description:
      "Anh em Edward & Alphonse Elric tìm đá Philosopher để lấy lại cơ thể sau thí nghiệm thất bại.",
  },
  {
    slug: "hunter-x-hunter",
    name: "Hunter × Hunter - Tập 1",
    authors: ["Yoshihiro Togashi"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2019,
    price: 0.017,
    cost: 0.009,
    qty: 33,
    isbn: "BM-MANGA-12",
    hue: 140,
    description:
      "Gon Freecss thi tuyển Hunter để tìm cha — khởi đầu chuyến phiêu lưu đầy bí ẩn.",
  },
  {
    slug: "bleach",
    name: "Bleach - Tập 1",
    authors: ["Tite Kubo"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2018,
    price: 0.016,
    cost: 0.008,
    qty: 29,
    isbn: "BM-MANGA-13",
    hue: 190,
    description:
      "Ichigo Kurosaki trở thành Shinigami thay thế, bảo vệ người sống khỏi Hollow.",
  },
  {
    slug: "tokyo-ghoul",
    name: "Tokyo Ghoul - Tập 1",
    authors: ["Sui Ishida"],
    categoryLeaf: "Seinen",
    publisher: "IPM",
    year: 2020,
    price: 0.021,
    cost: 0.012,
    qty: 26,
    isbn: "BM-MANGA-14",
    hue: 355,
    description:
      "Kaneki Ken nửa người nửa ghoul — sống giữa Tokyo nơi kẻ ăn thịt người ẩn mình.",
  },
  {
    slug: "sailor-moon",
    name: "Sailor Moon - Tập 1",
    authors: ["Naoko Takeuchi"],
    categoryLeaf: "Shojo",
    publisher: "NXB Kim Đồng",
    year: 2019,
    price: 0.015,
    cost: 0.008,
    qty: 35,
    isbn: "BM-MANGA-15",
    hue: 300,
    description:
      "Usagi Tsukino thức tỉnh thành Thủy thủ Mặt Trăng, bảo vệ tình yêu và công lý.",
  },
  {
    slug: "cardcaptor-sakura",
    name: "Cardcaptor Sakura - Tập 1",
    authors: ["CLAMP"],
    categoryLeaf: "Shojo",
    publisher: "Skybooks",
    year: 2021,
    price: 0.016,
    cost: 0.009,
    qty: 31,
    isbn: "BM-MANGA-16",
    hue: 320,
    description:
      "Sakura Kinomoto thu thập thẻ Clow cùng thú nuôi Kerberos trong thế giới phép thuật dễ thương.",
  },
  {
    slug: "detective-conan",
    name: "Thám tử lừng danh Conan - Tập 1",
    authors: ["Gosho Aoyama"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2017,
    price: 0.014,
    cost: 0.007,
    qty: 55,
    isbn: "BM-MANGA-17",
    hue: 205,
    description:
      "Shinichi Kudo bị thuốc độc biến thành trẻ con — phá án dưới cái tên Edogawa Conan.",
  },
  {
    slug: "haikyuu",
    name: "Haikyu!! - Tập 1",
    authors: ["Haruichi Furudate"],
    categoryLeaf: "Shonen",
    publisher: "NXB Kim Đồng",
    year: 2020,
    price: 0.016,
    cost: 0.009,
    qty: 37,
    isbn: "BM-MANGA-18",
    hue: 25,
    description:
      "Hinata Shoyo thấp bé nhưng cháy bỏng với bóng chuyền — cùng Kageyama dựng lại đội Karasuno.",
  },
  {
    slug: "sword-art-online",
    name: "Sword Art Online - Aincrad (Light Novel)",
    authors: ["Reki Kawahara"],
    categoryLeaf: "Fantasy LN",
    publisher: "Amak Books",
    year: 2021,
    price: 0.024,
    cost: 0.014,
    qty: 27,
    isbn: "BM-MANGA-19",
    hue: 250,
    description:
      "Kirito mắc kẹt trong game VR chết người. Light novel isekai / game tiên phong của thập niên 2010.",
  },
  {
    slug: "your-name",
    name: "Your Name. (Kimi no Na wa)",
    authors: ["Makoto Shinkai"],
    categoryLeaf: "Romance LN",
    publisher: "Nhã Nam Comics",
    year: 2020,
    price: 0.025,
    cost: 0.014,
    qty: 40,
    isbn: "BM-MANGA-20",
    hue: 195,
    description:
      "Mitsuha và Taki hoán đổi thân xác qua giấc mơ — tiểu thuyết chuyển thể từ phim anime đình đám.",
  },
  {
    slug: "nha-gia-kim",
    name: "Nhà giả kim",
    authors: ["Paulo Coelho"],
    categoryLeaf: "Tiểu thuyết",
    categoryParent: "Văn học nước ngoài",
    coverLabel: "VĂN HỌC THẾ GIỚI",
    publisher: "NXB Văn học",
    year: 1988,
    price: 0.02,
    cost: 0.01,
    qty: 25,
    isbn: "BM-NOVEL-01",
    hue: 35,
    description:
      "Santiago, chàng chăn cừu trẻ, lên đường theo đuổi kho báu và khám phá ý nghĩa của hành trình mình lựa chọn.",
  },
  {
    slug: "khong-gia-dinh",
    name: "Không gia đình",
    authors: ["Hector Malot"],
    categoryLeaf: "Tiểu thuyết",
    categoryParent: "Văn học nước ngoài",
    coverLabel: "VĂN HỌC THẾ GIỚI",
    publisher: "NXB Kim Đồng",
    year: 1878,
    price: 0.018,
    cost: 0.009,
    qty: 25,
    isbn: "BM-NOVEL-02",
    hue: 205,
    description:
      "Cuộc phiêu lưu của Rémi, cậu bé không gia đình, qua những chặng đường gian khó và những tình bạn đáng nhớ.",
  },
  {
    slug: "tram-nam-co-don",
    name: "Trăm năm cô đơn",
    authors: ["Gabriel García Márquez"],
    categoryLeaf: "Tiểu thuyết",
    categoryParent: "Văn học nước ngoài",
    coverLabel: "VĂN HỌC THẾ GIỚI",
    publisher: "NXB Văn học",
    year: 1967,
    price: 0.022,
    cost: 0.011,
    qty: 20,
    isbn: "BM-NOVEL-03",
    hue: 145,
    description:
      "Lịch sử nhiều thế hệ nhà Buendía tại Macondo, kết hợp ký ức, huyền thoại và những đổi thay của một vùng đất.",
  },
];

function coverSvgDataUrl(title, subtitle, hue, label = "MANGA · ANIME") {
  const h = Number(hue) || 200;
  const safe = String(title || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const sub = String(subtitle || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = wrapTitle(safe, 18);
  const textBlocks = lines
    .map(
      (line, i) =>
        `<text x="36" y="${420 + i * 28}" fill="#f7f1e8" font-family="Georgia, serif" font-size="22" font-weight="700">${line}</text>`
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${h},62%,38%)"/>
      <stop offset="100%" stop-color="hsl(${(h + 40) % 360},55%,18%)"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)"/>
  <rect x="18" y="18" width="364" height="564" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>
  <text x="36" y="64" fill="rgba(255,255,255,0.75)" font-family="Helvetica,Arial,sans-serif" font-size="13" letter-spacing="3">BOOKMARKET</text>
  <text x="36" y="96" fill="rgba(255,255,255,0.55)" font-family="Helvetica,Arial,sans-serif" font-size="12">${label}</text>
  <circle cx="300" cy="200" r="70" fill="rgba(255,255,255,0.08)"/>
  <circle cx="330" cy="240" r="40" fill="rgba(255,255,255,0.06)"/>
  ${textBlocks}
  <text x="36" y="540" fill="rgba(247,241,232,0.8)" font-family="Helvetica,Arial,sans-serif" font-size="13">${sub}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function wrapTitle(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function ethToWeiString(eth) {
  const n = Number(eth) || 0;
  // tránh phụ thuộc ethers trong seed
  const wei = BigInt(Math.round(n * 1e6)) * 10n ** 12n;
  return wei.toString();
}

function buildSamplePdfBuffer({ title, authors, description }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 48, info: { Title: title, Author: authors } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const authorLine = authors.join(", ");
    for (let page = 1; page <= 12; page += 1) {
      if (page > 1) doc.addPage();
      doc
        .fontSize(11)
        .fillColor("#666")
        .text(`BookMarket · Đọc thử · Trang ${page}/12`, { align: "right" });
      doc.moveDown(0.8);
      doc.fontSize(18).fillColor("#111").text(title, { align: "left" });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor("#444").text(authorLine);
      doc.moveDown(0.8);
      doc
        .fontSize(11)
        .fillColor("#222")
        .text(
          page === 1
            ? description
            : `Đoạn mẫu trang ${page} — nội dung minh họa cho bản đọc thử (tối đa 10 trang trên sàn). ` +
              `Sách thuộc catalog demo, dùng để minh họa danh mục, kho và giao diện người dùng BookMarket. ` +
                `Mua NFT để mở toàn bộ file PDF trong mục Sách của tôi.`,
          { align: "justify", lineGap: 4 }
        );
      doc.moveDown(1);
      doc
        .fontSize(10)
        .fillColor("#888")
        .text(
          "Đây là dữ liệu mẫu seed — không phải bản scan chính thức của nhà xuất bản.",
          { align: "left" }
        );
    }
    doc.end();
  });
}

async function resolveLeaf(name, parentName) {
  if (!parentName) return Category.findOne({ name, level: 3, status: "active" });
  const parent = await Category.findOne({ name: parentName, level: 2, status: "active" });
  return parent
    ? Category.findOne({ name, parentId: parent._id, level: 3, status: "active" })
    : null;
}

async function resolvePublisher(name) {
  let pub = await Publisher.findOne({ name });
  if (!pub) {
    pub = await Publisher.create({ name, status: "active" });
  }
  return pub;
}

async function pickCatalogSupplier(row) {
  const preferred = row.categoryLeaf === "Tiểu thuyết"
    ? [
        "Công ty TNHH Phát hành sách FAHASA",
        "Công ty CP Văn hóa & Truyền thông Nhã Nam",
        "Nhà sách Phương Nam",
      ]
    : [
        "Kho sách Comic Hub (demo)",
        "Công ty TNHH Văn hóa Sáng tạo Phong Long",
        "Công ty TNHH Phát hành sách FAHASA",
      ];
  for (const name of preferred) {
    const s = await Supplier.findOne({ name, status: "active" });
    if (s) return s;
  }
  return Supplier.findOne({ status: "active" });
}

function titlesMatch(a, b) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[×x]/g, "x")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}

/** Tìm bookId on-chain đã mint cùng title (tránh mint trùng khi seed bị cắt ngang) */
async function findOnChainIdByTitle(title) {
  const nft = getBookNFT();
  if (!nft) return null;
  let max = 64;
  try {
    // heuristic: tip node + buffer
    const tip = await getLedgerTip();
    max = Math.max(32, (tip.latestNodeIndex || 0) + 8);
  } catch {
    /* ignore */
  }
  for (let id = 1; id <= max; id += 1) {
    if (!(await bookExistsOnChain(id))) continue;
    try {
      const b = await readBookOnChain(id);
      if (b && titlesMatch(b.title, title)) return id;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Gắn bookId on-chain vào bản ghi catalog (ISBN), gộp stub do listener tạo, remap phiếu kho.
 */
async function attachChainBookId(isbn, newBookId, chainPatch) {
  const byIsbn = await Book.findOne({ isbn });
  let byId = await Book.findOne({ bookId: newBookId });

  if (byIsbn && byId && String(byIsbn._id) !== String(byId._id)) {
    const oldId = byIsbn.bookId;
    await Book.deleteOne({ _id: byId._id });
    byId = null;
    if (oldId && oldId !== newBookId) {
      await StockMovement.updateMany({ bookId: oldId }, { $set: { bookId: newBookId } });
    }
  }

  if (byIsbn) {
    const oldId = byIsbn.bookId;
    if (oldId && oldId !== newBookId) {
      await StockMovement.updateMany({ bookId: oldId }, { $set: { bookId: newBookId } });
    }
    Object.assign(byIsbn, chainPatch, { bookId: newBookId });
    await byIsbn.save();
    return byIsbn;
  }

  if (byId) {
    Object.assign(byId, chainPatch, { bookId: newBookId, isbn });
    await byId.save();
    return byId;
  }

  return Book.create({ ...chainPatch, bookId: newBookId, isbn });
}

async function ensureMintedOnChain(row, catalogFields) {
  const { upsertTxNode } = require("../services/blockchainListener");
  const existing = await Book.findOne({ isbn: row.isbn }).select(
    "bookId metadataURI contentHash name"
  );
  if (existing?.bookId && (await bookExistsOnChain(existing.bookId))) {
    return { bookId: existing.bookId, minted: false, linked: false };
  }

  const to = process.env.DEPLOYER_ADDRESS;
  if (!to) throw new Error("Thiếu DEPLOYER_ADDRESS để mint seed on-chain");

  // Seed bị cắt ngang: NFT đã mint nhưng Mongo còn bookId 900x
  let bookId = await findOnChainIdByTitle(row.name);
  let minted = false;
  let txHash = "";
  let blockNumber = 0;

  if (!bookId) {
    const result = await mintBookOnChain({
      to,
      title: row.name.slice(0, 120),
      author: row.authors.join(", ").slice(0, 80),
      genre: (catalogFields.category || row.categoryLeaf || "Manga").slice(0, 40),
      metadataURI: catalogFields.metadataURI || "",
      priceEth: row.price,
    });
    if (!result.bookId) {
      throw new Error(`Mint seed thất bại — không đọc được bookId (${row.isbn})`);
    }
    bookId = result.bookId;
    minted = true;
    txHash = result.txHash;
    blockNumber = result.blockNumber;

    try {
      const tip = await getLedgerTip();
      if (tip.latestNodeIndex > 0) {
        const node = await readTxNode(tip.latestNodeIndex);
        if (node?.bookId === bookId && node.action === "Mint") {
          await upsertTxNode(node.index, { txHash, blockNumber });
        }
      }
    } catch (e) {
      console.warn("[seed] upsert TxNode mint:", e.message);
    }
  }

  const onchain = await readBookOnChain(bookId);
  const chainPatch = {
    ...catalogFields,
    metadataURI: onchain?.metadataURI || catalogFields.metadataURI,
    ownerWallet: (onchain?.ownerWallet || to).toLowerCase(),
    listedPriceWei: onchain?.listedPriceWei || catalogFields.listedPriceWei,
    forSale: onchain ? onchain.forSale : true,
    marketListed: false,
    marketPriceWei: "0",
    status: "listed",
  };

  await attachChainBookId(row.isbn, bookId, chainPatch);
  return { bookId, minted, linked: !minted, txHash };
}

async function seedAnimeBooks(opts = {}) {
  const doMint = opts.mintOnChain != null ? Boolean(opts.mintOnChain) : MINT_ON_CHAIN;
  const rows = opts.onlyNovels
    ? CATALOG.filter((row) => row.categoryLeaf === "Tiểu thuyết")
    : CATALOG;
  try {
    let created = 0;
    let updated = 0;
    let stocked = 0;
    let minted = 0;
    let mintSkipped = 0;
    let linked = 0;

    for (const row of rows) {
      const provisionalId = BOOK_ID_BASE + CATALOG.indexOf(row);
      const supplier = await pickCatalogSupplier(row);
      const stockNote = row.categoryLeaf === "Tiểu thuyết" ? "[seed-novel]" : SEED_NOTE;
      const leaf = await resolveLeaf(row.categoryLeaf, row.categoryParent);
      const pub = await resolvePublisher(row.publisher);
      const authorsLine = row.authors.join(", ");
      const image = coverSvgDataUrl(row.name, authorsLine, row.hue, row.coverLabel);
      const pdf = await buildSamplePdfBuffer({
        title: row.name,
        authors: row.authors,
        description: row.description,
      });
      const contentHash = crypto.createHash("sha256").update(pdf).digest("hex");
      const wei = ethToWeiString(row.price);

      const catalogFields = {
        name: row.name,
        isbn: row.isbn,
        authors: row.authors,
        publisher: pub.name,
        publisherId: pub._id,
        publishYear: row.year,
        price: row.price,
        costPrice: row.cost,
        quantity: row.qty,
        description: row.description,
        image,
        status: "listed",
        category: leaf?.name || row.categoryLeaf,
        categoryId: leaf?._id || null,
        categoryPath:
          leaf?.pathNames || [row.categoryParent, row.categoryLeaf].filter(Boolean).join(" / "),
        metadataURI: `sha256:${contentHash}`,
        ownerWallet: (process.env.DEPLOYER_ADDRESS || "").toLowerCase(),
        listedPriceWei: wei,
        forSale: true,
        marketListed: false,
        marketPriceWei: "0",
        contentHash,
        fileName: `${row.slug}-mau.pdf`,
        mimeType: "application/pdf",
        fileSize: pdf.length,
        fileData: pdf,
      };

      const existing = await Book.findOne({ isbn: row.isbn });
      if (existing) {
        const keepId = existing.bookId || provisionalId;
        Object.assign(existing, {
          ...catalogFields,
          bookId: keepId,
          quantity: existing.quantity > 0 ? existing.quantity : row.qty,
        });
        await existing.save();
        updated += 1;
      } else {
        let bookId = provisionalId;
        const clash = await Book.findOne({ bookId });
        if (clash && clash.isbn !== row.isbn) {
          const max = await Book.findOne().sort({ bookId: -1 }).select("bookId");
          bookId = Math.max((max?.bookId || BOOK_ID_BASE) + 1, provisionalId);
        }
        await Book.create({ ...catalogFields, bookId });
        created += 1;
      }

      // Mint NFT + TxNode Mint trên Geth (idempotent nếu đã có on-chain)
      if (doMint) {
        try {
          const m = await ensureMintedOnChain(row, catalogFields);
          if (m.minted) minted += 1;
          else if (m.linked) linked += 1;
          else mintSkipped += 1;
          if (m.minted || m.linked) {
            console.log(
              `[seed] on-chain ${row.isbn} → #${m.bookId}` +
                (m.minted ? " (minted)" : " (linked)")
            );
          }
        } catch (e) {
          console.error(`[seed] mint on-chain ${row.isbn}:`, e.message || e);
        }
      }

      const book = await Book.findOne({ isbn: row.isbn }).select("bookId quantity");
      if (!book) continue;

      const alreadyStock = await StockMovement.exists({
        bookId: book.bookId,
        type: "in",
        note: stockNote,
      });
      if (!alreadyStock && supplier) {
        await stockIn({
          bookId: book.bookId,
          quantity: row.qty,
          unitPrice: row.cost,
          supplierId: supplier._id,
          note: stockNote,
        });
        const after = await Book.findOne({ bookId: book.bookId });
        if (after && Number(after.quantity) !== row.qty) {
          after.quantity = row.qty;
          await after.save();
        }
        stocked += 1;
      }
    }

    if (created || updated || stocked || minted || linked) {
      console.log(
        `[seed] sample books · created=${created} updated=${updated} stockIn=${stocked}` +
          ` minted=${minted} linked=${linked} alreadyOnChain=${mintSkipped}`
      );
    }
    return {
      created,
      updated,
      stocked,
      minted,
      linked,
      mintSkipped,
      total: rows.length,
    };
  } catch (e) {
    console.error("[seed] anime books failed:", e.message || e);
    return { error: e.message };
  }
}

module.exports = { seedAnimeBooks, CATALOG };
