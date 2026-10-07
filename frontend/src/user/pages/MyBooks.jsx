import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Library, Wallet } from "lucide-react";
import api from "../../services/api";
import { formatEth } from "../../services/contract";
import { useWallet } from "../../context/WalletContext";
import BookCover from "../components/BookCover";
import Pagination, { paginate } from "../components/Pagination";
import { bookAuthors, bookName } from "../utils/book";
import "./my-books.css";

const PAGE_SIZE = 10;

function canReadFull(b) {
  return Boolean(b?.hasFile || b?.contentHash);
}

export default function MyBooks() {
  const { address, connect, busy: walletBusy } = useWallet();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!address) {
      setBooks([]);
      setPage(1);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .get("/books", { params: { owner: address } })
      .then((r) => {
        if (alive) {
          setBooks(r.data.books || []);
          setPage(1);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [address]);

  const totalPages = Math.max(1, Math.ceil(books.length / PAGE_SIZE) || 1);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => paginate(books, page, PAGE_SIZE), [books, page]);

  if (!address) {
    return (
      <div className="container my-books">
        <div className="panel my-books-gate">
          <span className="my-books-gate-ico" aria-hidden="true">
            <Library size={28} />
          </span>
          <h2>Sách của tôi</h2>
          <p className="muted">
            Kết nối MetaMask để xem kệ sách đã mua và đọc toàn bộ nội dung PDF.
          </p>
          <button className="btn btn-primary" onClick={connect} disabled={walletBusy}>
            <Wallet size={16} /> Kết nối ví
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-books">
      <header className="my-books-head">
        <div>
          <h2>Sách của tôi</h2>
          <p className="muted mono-addr">
            Ví: {address.slice(0, 8)}…{address.slice(-6)} · Đã mua → đọc full
          </p>
        </div>
        <span className="badge">{loading ? "…" : `${books.length} cuốn`}</span>
      </header>

      {loading ? (
        <p className="muted">Đang tải kệ sách…</p>
      ) : books.length === 0 ? (
        <div className="panel my-books-empty">
          <p className="muted">Bạn chưa sở hữu sách nào. Mua trên sàn rồi quay lại đọc full.</p>
          <Link className="btn btn-primary" to="/">
            Duyệt sàn sách
          </Link>
        </div>
      ) : (
        <>
          <div className="grid-books">
            {pageItems.map((b, i) => (
              <article
                key={b.bookId}
                className="book-tile my-book-tile"
                style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}
              >
                <Link to={`/books/${b.bookId}`} className="my-book-cover-link">
                  <BookCover book={b} showTitle={false} />
                </Link>
                <div className="book-body">
                  <Link to={`/books/${b.bookId}`} className="book-tile-title">
                    {bookName(b)}
                  </Link>
                  <div className="book-body-authors">{bookAuthors(b) || "—"}</div>
                  <div className="book-body-row">
                    <span className="badge">
                      {b.marketListed
                        ? `Đang treo ${formatEth(b.marketPriceWei)}`
                        : b.status || "Trong ví"}
                    </span>
                  </div>
                  <div className="my-book-actions">
                    {canReadFull(b) ? (
                      <Link
                        className="btn btn-primary"
                        to={`/books/${b.bookId}/read?mode=full`}
                      >
                        <BookOpen size={15} /> Đọc toàn bộ
                      </Link>
                    ) : (
                      <span className="muted tiny">Chưa có file PDF</span>
                    )}
                    <Link className="btn btn-ghost" to={`/books/${b.bookId}`}>
                      Chi tiết
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={books.length}
            onChange={setPage}
            label="cuốn"
          />
        </>
      )}
    </div>
  );
}
