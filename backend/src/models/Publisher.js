const mongoose = require("mongoose");

/**
 * publishers – Nhà xuất bản sách
 */
const publisherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    code: { type: String, default: "", trim: true, uppercase: true, index: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

publisherSchema.pre("validate", function ensureCode(next) {
  if (!this.code && this.name) {
    this.code = String(this.name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 12);
  }
  next();
});

publisherSchema.set("toJSON", {
  transform(_doc, ret) {
    ret._id = String(ret._id);
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Publisher", publisherSchema);
