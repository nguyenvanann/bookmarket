const Publisher = require("../models/Publisher");
const Book = require("../models/Book");

const DEFAULTS = [
  { name: "NXB Kim Đồng", code: "KD", description: "Sách thiếu nhi, manga & thiếu niên" },
  { name: "NXB Trẻ", code: "TRE", description: "Văn học & kiến thức phổ thông" },
  { name: "NXB Giáo dục Việt Nam", code: "GDVN", description: "Sách giáo khoa, tham khảo" },
  { name: "NXB Văn học", code: "VH", description: "Văn học trong nước & dịch" },
  { name: "NXB Hội Nhà Văn", code: "HNV", description: "Văn học đương đại" },
  {
    name: "IPM",
    code: "IPM",
    description: "Phát hành manga / light novel bản quyền VN",
    phone: "02473006868",
    email: "contact@ipm.vn",
    website: "https://ipm.vn",
  },
  {
    name: "Amak Books",
    code: "AMAK",
    description: "Light novel & manga bản quyền",
    website: "https://amak.vn",
  },
  {
    name: "Skybooks",
    code: "SKY",
    description: "Manga / manhwa / novel thanh thiếu niên",
    website: "https://skybooks.vn",
  },
  {
    name: "Nhã Nam Comics",
    code: "NNC",
    description: "Truyện tranh & graphic novel",
  },
];

async function seedPublishers() {
  try {
    let created = 0;
    for (const row of DEFAULTS) {
      const exists = await Publisher.findOne({ name: row.name });
      if (!exists) {
        await Publisher.create({ ...row, status: "active" });
        created += 1;
      }
    }

    // Thu thập tên publisher từ sách → tạo NXB nếu chưa có, gắn publisherId
    const names = await Book.distinct("publisher");
    let linked = 0;
    for (const raw of names) {
      const name = String(raw || "").trim();
      if (!name) continue;
      let pub = await Publisher.findOne({ name });
      if (!pub) {
        pub = await Publisher.create({ name, status: "active" });
        created += 1;
      }
      const r = await Book.updateMany(
        {
          publisher: name,
          $or: [{ publisherId: null }, { publisherId: { $exists: false } }],
        },
        { $set: { publisherId: pub._id, publisher: pub.name } }
      );
      linked += r.modifiedCount || 0;
    }

    if (created || linked) {
      console.log(`[seed] publishers · created=${created} booksLinked=${linked}`);
    }
    return { created, linked };
  } catch (e) {
    console.error("[seed] publishers failed:", e.message || e);
    return { error: e.message };
  }
}

module.exports = { seedPublishers, DEFAULTS };
