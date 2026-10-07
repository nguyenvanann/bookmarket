const mongoose = require("mongoose");

/**
 * categories – Danh mục sách 3 cấp
 * Cấp 1 (parentId=null) → Cấp 2 → Cấp 3 (lá, gắn vào sách)
 */
const categorySchema = new mongoose.Schema(
  {
    /** Không unique toàn cục — cùng tên được phép dưới parent khác */
    name: { type: String, required: true, trim: true },
    slug: { type: String, default: "", trim: true, lowercase: true },
    description: { type: String, default: "", trim: true },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    /** 1 | 2 | 3 */
    level: { type: Number, enum: [1, 2, 3], default: 1, index: true },
    /** Đường dẫn id: "l1Id/l2Id/l3Id" */
    path: { type: String, default: "", index: true },
    /** Đường dẫn tên: "Văn học / VN / Tiểu thuyết" */
    pathNames: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

// Unique theo cặp (cha, tên) — không unique name toàn cục
categorySchema.index({ parentId: 1, name: 1 }, { unique: true });
categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ level: 1, status: 1 });

categorySchema.pre("validate", function ensureSlug(next) {
  if (!this.slug && this.name) {
    this.slug = String(this.name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  next();
});

categorySchema.set("toJSON", {
  transform(_doc, ret) {
    ret._id = String(ret._id);
    if (ret.parentId) ret.parentId = String(ret.parentId);
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Category", categorySchema);
