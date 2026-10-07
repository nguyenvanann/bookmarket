const mongoose = require("mongoose");

/**
 * suppliers – Nhà cung cấp sách / đối tác phân phối
 */
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    contactPerson: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    taxCode: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

supplierSchema.set("toJSON", {
  transform(_doc, ret) {
    ret._id = String(ret._id);
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Supplier", supplierSchema);
