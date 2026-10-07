import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Search } from "lucide-react";
import api from "../../services/api";
import { formatEth } from "../../services/contract";
import BookCover from "../components/BookCover";
import Pagination, { paginate } from "../components/Pagination";
import {
  bookAuthors,
  bookCategory,
  bookImage,
  bookName,
  isImageSrc,
} from "../utils/book";
import "./home.css";

const PAGE_SIZE = 10;

function sampleOk(b) {
  if (b?.sampleAvailable) return true;
  const has = Boolean(b?.hasFile || b?.contentHash);
  return has && (/pdf/i.test(b?.mimeType || "") || /\.pdf$/i.test(b?.fileName || ""));
}

/** Còn bán: listing / forSale / còn tồn (prepare-checkout sẽ mint NFT) */
function isBuyable(b) {
  return (
    Boolean(b?.marketListed || b?.forSale) ||
    Number(b?.sellableCount) > 0 ||
    Number(b?.quantity) > 0
  );
}

export default function Home() {
  const [books, setBooks] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get("/books")
      .then((r) => {
        if (alive) setBooks(r.data.books || []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const featuredCovers = useMemo(
    () =>
      books
        .filter((b) => isImageSrc(bookImage(b)))
        .slice(0, 3),
    [books]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return books.filter((b) => {
      const onSale = isBuyable(b);
      if (filter === "sale" && !onSale) return false;
      if (filter === "owned" && onSale) return false;
      if (!s) return true;
      const name = bookName(b).toLowerCase();
      const authors = bookAuthors(b).toLowerCase();
      const category = bookCategory(b).toLowerCase();
      return (
        name.includes(s) ||
        authors.includes(s) ||
        category.includes(s) ||
        (b.isbn || "").toLowerCase().includes(s) ||
        (b.publisher || "").toLowerCase().includes(s) ||
        String(b.bookId).includes(s)
      );
    });
  }, [books, q, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);

  useEffect(() => {
    setPage(1);
  }, [q, filter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => paginate(filtered, page, PAGE_SIZE),
    [filtered, page]
  );

  function goPage(p) {
    setPage(p);
    const el = document.getElementById("catalog");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const saleCount = books.filter(isBuyable).length;

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Sàn sách truyện · on-chain</p>
            <h1 className="brand hero-brand">BookMarket</h1>
            <p className="hero-lead">
              Sàn sách NFT: đọc thử 10 trang miễn phí, mua bằng MetaMask rồi đọc
              toàn bộ trong kệ của bạn — mỗi giao dịch gắn một node trên chuỗi.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#catalog">
                Duyệt kệ sách
              </a>
              <Link className="btn btn-ghost" to="/ledger">
                Chuỗi giao dịch
              </Link>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            {featuredCovers.length > 0 ? (
              <div className="hero-stack">
                {featuredCovers.map((b, i) => (
                  <div
                    key={b.bookId}
                    className={`hero-stack-card stack-${i}`}
                    style={{ backgroundImage: `url(${bookImage(b)})` }}
                  />
                ))}
              </div>
            ) : (
              <div className="hero-spines">
                <div className="spine spine-a" />
                <div className="spine spine-b" />
                <div className="spine spine-c" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="container catalog" id="catalog">
        <div className="section-head">
          <div>
            <h2>Kệ sách đang mở</h2>
            <p className="muted">Đọc thử → mua NFT → đọc full trong Sách của tôi</p>
          </div>
          <label className="search-wrap">
            <Search size={16} aria-hidden="true" />
            <input
              className="search"
              placeholder="Tìm tên, tác giả, ISBN, NXB…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>

        <div className="catalog-filters" role="group" aria-label="Lọc kệ sách">
          {[
            { id: "all", label: "Tất cả", n: books.length },
            { id: "sale", label: "Đang bán", n: saleCount },
            { id: "owned", label: "Đã giữ", n: Math.max(0, books.length - saleCount) },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`catalog-chip${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <em>{loading ? "—" : f.n}</em>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="catalog-skeleton" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skel-tile" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel catalog-empty">
            <p className="muted">
              {q || filter !== "all"
                ? "Không có sách khớp bộ lọc."
                : "Chưa có sách. Admin mint hoặc đồng bộ từ chain."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid-books">
              {pageItems.map((b, i) => {
                const name = bookName(b);
                const authors = bookAuthors(b);
                const category = bookCategory(b);
                const priceWei = b.marketListed ? b.marketPriceWei : b.listedPriceWei;
                const onSale = isBuyable(b);
                const hasSample = sampleOk(b);
                const priceLabel =
                  Number(b.price) > 0
                    ? `${b.price} ETH`
                    : priceWei && String(priceWei) !== "0"
                      ? formatEth(priceWei)
                      : onSale
                        ? "0.01 ETH"
                        : null;
                return (
                  <article
                    key={b.editionKey || b.isbn || b.bookId}
                    className="book-tile market-tile"
                    style={{ animationDelay: `${Math.min(i, 12) * 0.04}s` }}
                  >
                    <Link to={`/books/${b.bookId}`} className="market-cover-link">
                      <BookCover book={b} showTitle={false} />
                      {hasSample && <span className="sample-ribbon">Đọc thử</span>}
                    </Link>
                    <div className="book-body">
                      <Link to={`/books/${b.bookId}`} className="book-tile-title">
                        {name}
                      </Link>
                      {authors ? <div className="book-body-authors">{authors}</div> : null}
                      <div className="book-body-row">
                        {category ? <span className="badge">{category}</span> : null}
                        {onSale ? (
                          <span className="badge sale">{priceLabel}</span>
                        ) : (
                          <span className="badge">{b.status || "owned"}</span>
                        )}
                        {Number(b.quantity) > 0 ? (
                          <span className="badge">Tồn {b.quantity}</span>
                        ) : null}
                        {Number(b.chainCount) > 1 ? (
                          <span className="badge" title="Số bản NFT trên chain">
                            {b.chainCount} bản chain
                          </span>
                        ) : null}
                      </div>
                      <div className="market-tile-actions">
                        <Link className="btn btn-primary btn-sm" to={`/books/${b.bookId}`}>
                          {onSale ? "Xem & mua" : "Chi tiết"}
                        </Link>
                        {hasSample && (
                          <Link
                            className="btn btn-ghost btn-sm"
                            to={`/books/${b.bookId}/read?mode=sample`}
                          >
                            <Eye size={14} /> Đọc thử
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={goPage}
              label="sách"
            />
          </>
        )}
      </section>
    </div>
  );
}
