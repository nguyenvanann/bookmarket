const mongoose = require("mongoose");

/**
 * Quản lý sách (catalog Mongo) + liên kết NFT on-chain.
 *
 * Catalog: name, isbn, category, authors, publisher, publishYear,
 *          price, quantity, description, image, status
 * Chain:   bookId, metadataURI, listedPriceWei, market*, ownerWallet, TxNode…
 * L2 file: contentHash, fileData…
 */
const bookSchema = new mongoose.Schema(
  {
    // —— Catalog (Mongo) ——
    name: { type: String, required: true, trim: true, index: true },
    isbn: { type: String, default: "", trim: true, index: true },
    /** Tên lá (cấp 3) — tương thích cũ */
    category: { type: String, default: "", trim: true, index: true },
    /** Danh mục 3 cấp — trỏ tới node (ưu tiên cấp 3) */
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    /** Breadcrumb: "Cấp1 / Cấp2 / Cấp3" */
    categoryPath: { type: String, default: "" },
    authors: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    /** Tên NXB — tương thích cũ */
    publisher: { type: String, default: "", trim: true, index: true },
    /** Liên kết bảng publishers */
    publisherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publisher",
      default: null,
      index: true,
    },
    publishYear: { type: Number, default: null, min: 1000, max: 3000 },
    /** Giá bán catalog (ETH, số thập phân) */
    price: { type: Number, default: 0, min: 0 },
    /** Giá vốn nhập kho gần nhất (ETH) — cập nhật khi nhập kho */
    costPrice: { type: Number, default: 0, min: 0 },
    /** Số lượng tồn (ấn bản / bản digital còn mở bán) */
    quantity: { type: Number, default: 1, min: 0 },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    status: {
      type: String,
      enum: ["available", "owned", "listed", "escrow", "out_of_stock", "inactive"],
      default: "available",
      index: true,
    },

    // —— Blockchain NFT ——
    bookId: { type: Number, required: true, unique: true, index: true },
    metadataURI: { type: String, default: "" },
    ownerWallet: { type: String, default: "", lowercase: true, index: true },
    listedPriceWei: { type: String, default: "0" },
    forSale: { type: Boolean, default: false },
    marketListed: { type: Boolean, default: false },
    marketPriceWei: { type: String, default: "0" },
    nodeIndexes: [{ type: Number }],
    latestNodeHash: { type: String, default: "" },

    // —— Layer-2 content (Mongo) ——
    contentHash: { type: String, default: "", index: true },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    fileData: { type: Buffer, select: false },
  },
  { timestamps: true }
);

bookSchema.virtual("hasFile").get(function hasFile() {
  return Boolean(this.contentHash && this.fileSize > 0);
});

/** Alias tương thích UI/API cũ */
bookSchema.virtual("title").get(function title() {
  return this.name;
});
bookSchema.virtual("author").get(function author() {
  return (this.authors || []).filter(Boolean).join(", ");
});
bookSchema.virtual("genre").get(function genre() {
  return this.category;
});
bookSchema.virtual("coverUrl").get(function coverUrl() {
  return this.image;
});

bookSchema.pre("validate", function normalizeCatalog(next) {
  if (Array.isArray(this.authors)) {
    this.authors = this.authors.map((a) => String(a || "").trim()).filter(Boolean);
  }
  if (this.quantity === 0 && ["available", "listed"].includes(this.status)) {
    this.status = "out_of_stock";
  }
  next();
});

bookSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.fileData;
    delete ret.__v;
    ret._id = String(ret._id);
    return ret;
  },
});

module.exports = mongoose.model("Book", bookSchema);
