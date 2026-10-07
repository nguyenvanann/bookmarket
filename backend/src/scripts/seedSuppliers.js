const Supplier = require("../models/Supplier");

/** Dữ liệu mẫu NCC sách VN */
const DEFAULTS = [
  {
    name: "Công ty CP Sách & Thiết bị Giáo dục Hà Nội",
    contactPerson: "Nguyễn Văn An",
    phone: "02438221234",
    email: "lienhe@sachhanoi.vn",
    address: "25 Hàng Chuối, Hai Bà Trưng, Hà Nội",
    taxCode: "0100123456",
    website: "https://sachhanoi.vn",
    note: "Phân phối sách giáo khoa & tham khảo miền Bắc",
    status: "active",
  },
  {
    name: "Công ty TNHH Phát hành sách FAHASA",
    contactPerson: "Trần Thị Bình",
    phone: "02838225678",
    email: "doitac@fahasa.com",
    address: "60–62 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
    taxCode: "0301234567",
    website: "https://www.fahasa.com",
    note: "Chuỗi nhà sách & kho phân phối toàn quốc",
    status: "active",
  },
  {
    name: "Nhà sách Phương Nam",
    contactPerson: "Lê Minh Cường",
    phone: "02838339999",
    email: "cungcap@nhasachphuongnam.com",
    address: "2A Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
    taxCode: "0302345678",
    website: "https://nhasachphuongnam.com",
    note: "Đối tác văn học & sách ngoại ngữ",
    status: "active",
  },
  {
    name: "Công ty CP Văn hóa & Truyền thông Nhã Nam",
    contactPerson: "Phạm Thu Hà",
    phone: "02435148888",
    email: "order@nhanam.vn",
    address: "59 Đỗ Quang, Cầu Giấy, Hà Nội",
    taxCode: "0103456789",
    website: "https://nhanam.vn",
    note: "Cung cấp ấn bản văn học dịch & trong nước",
    status: "active",
  },
  {
    name: "Đối tác kho demo (ngừng)",
    contactPerson: "Hoàng Đức",
    phone: "0909123456",
    email: "demo@bookmarket.local",
    address: "Kho demo — không dùng cho đơn thật",
    taxCode: "",
    website: "",
    note: "Bản ghi mẫu trạng thái ngừng hợp tác",
    status: "inactive",
  },
  {
    name: "Công ty TNHH Văn hóa Sáng tạo Phong Long",
    contactPerson: "Vũ Minh Khoa",
    phone: "02473001234",
    email: "order@phonglong.vn",
    address: "Hà Nội",
    taxCode: "0104567890",
    website: "",
    note: "Phân phối manga / light novel miền Bắc",
    status: "active",
  },
  {
    name: "Kho sách Comic Hub (demo)",
    contactPerson: "Ngô Bảo Châu",
    phone: "02873004567",
    email: "kho@comichub.local",
    address: "Quận 3, TP. Hồ Chí Minh",
    taxCode: "0309876543",
    website: "",
    note: "NCC mẫu chuyên manga & artbook anime",
    status: "active",
  },
];

async function seedSuppliers() {
  try {
    let created = 0;
    let updated = 0;
    for (const row of DEFAULTS) {
      const existing = await Supplier.findOne({ name: row.name });
      if (!existing) {
        await Supplier.create(row);
        created += 1;
      } else {
        // Bổ sung field mới cho bản ghi seed cũ (không ghi đè nếu admin đã sửa phone/email)
        let dirty = false;
        for (const key of ["contactPerson", "taxCode", "website", "note"]) {
          if (!existing[key] && row[key]) {
            existing[key] = row[key];
            dirty = true;
          }
        }
        if (dirty) {
          await existing.save();
          updated += 1;
        }
      }
    }
    if (created || updated) {
      console.log(`[seed] suppliers · created=${created} enriched=${updated}`);
    }
    return { created, updated };
  } catch (e) {
    console.error("[seed] suppliers failed:", e.message || e);
    return { error: e.message };
  }
}

module.exports = { seedSuppliers, DEFAULTS };
