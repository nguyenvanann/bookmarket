/**
 * Chuyển sách cũ (title/author/genre/coverUrl) → catalog mới
 * (name/authors/category/image/…).
 */
async function migrateBookCatalog(Book) {
  const cursor = Book.collection.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: "" }],
  });

  let n = 0;
  for await (const doc of cursor) {
    const authors = Array.isArray(doc.authors) && doc.authors.length
      ? doc.authors
      : doc.author
        ? [String(doc.author)]
        : ["Unknown"];

    const patch = {
      name: doc.name || doc.title || `Book #${doc.bookId}`,
      authors,
      category: doc.category || doc.genre || "",
      image: doc.image || doc.coverUrl || "",
      isbn: doc.isbn || "",
      publisher: doc.publisher || "",
      publishYear: doc.publishYear ?? null,
      price: typeof doc.price === "number" ? doc.price : 0,
      quantity: typeof doc.quantity === "number" ? doc.quantity : 1,
      description: doc.description || "",
    };

    await Book.collection.updateOne({ _id: doc._id }, { $set: patch });
    n += 1;
  }

  if (n) console.log(`[migrate] book catalog: ${n} documents`);
  return n;
}

module.exports = { migrateBookCatalog };
