import { BookOpen } from "lucide-react";
import { bookImage, bookName, isImageSrc } from "../utils/book";

/**
 * Ảnh bìa đồng bộ admin (http URL hoặc data:image từ upload).
 */
export default function BookCover({
  book,
  className = "",
  showTitle = true,
  showId = false,
  ratio = "portrait",
}) {
  const cover = bookImage(book);
  const name = bookName(book);
  const hasImg = isImageSrc(cover);

  return (
    <div
      className={`book-cover ratio-${ratio}${hasImg ? " has-image" : ""}${className ? ` ${className}` : ""}`}
    >
      {hasImg ? (
        <img className="book-cover-img" src={cover} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="book-cover-fallback" aria-hidden="true">
          <BookOpen size={28} strokeWidth={1.5} />
        </span>
      )}
      <div className="book-cover-shade" aria-hidden="true" />
      <div className="book-cover-meta">
        {showId && book?.bookId != null && (
          <span className="book-cover-id">#{book.bookId}</span>
        )}
        {showTitle && <strong className="book-cover-title">{name}</strong>}
      </div>
    </div>
  );
}
