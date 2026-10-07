import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../AdminContext";
import {
  BookOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Hash,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  bookName,
  bookAuthors,
  bookCategory,
  bookImage,
  statusOf,
  statusLabel,
  isImageSrc,
  matchesBookQuery,
  fuzzyScore,
} from "../../utils";
import { formatEth } from "../../../services/contract";

const PAGE_SIZE = 12;

export default function MintTab() {
  const {
    setTab,
    books,
    busy,
    highlightBookId,
    openMintModal,
    openEditModal,
    onRefreshBooks,
    removeBook,
    restoreBook,
  } = useAdmin();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("grid");

  const sortedFiltered = useMemo(() => {
    const list = books
      .filter((b) => matchesBookQuery(b, q))
      .map((b) => ({
        b,
        score: q.trim()
          ? fuzzyScore(
              [bookName(b), bookAuthors(b), b.isbn, b.publisher, bookCategory(b), b.bookId].join(
                " "
              ),
              q
            )
          : 0,
      }));
    list.sort((a, c) => {
      if (q.trim() && c.score !== a.score) return c.score - a.score;
      return Number(c.b.bookId) - Number(a.b.bookId);
    });
    return list.map((x) => x.b);
  }, [books, q]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE) || 1);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (highlightBookId == null) return;
    const idx = sortedFiltered.findIndex((b) => b.bookId === highlightBookId);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [highlightBookId, sortedFiltered]);

  const pageItems = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = sortedFiltered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, sortedFiltered.length);

  function pageList() {
    const pages = [];
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    const add = (n) => {
      if (!pages.includes(n)) pages.push(n);
    };
    add(1);
    let start = Math.max(2, page - 1);
    let end = Math.min(totalPages - 1, page + 1);
    if (page <= 3) {
      start = 2;
      end = 4;
    }
    if (page >= totalPages - 2) {
      start = totalPages - 3;
      end = totalPages - 1;
    }
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i += 1) add(i);
    if (end < totalPages - 1) pages.push("…");
    add(totalPages);
    return pages;
  }

  return (
    <section className="catalog mint-page">
      <div className="mint-hero">
        <div className="mint-hero-copy">
          <p className="mint-hero-eyebrow">
            <Sparkles size={14} /> Phát hành NFT + L2
          </p>
          <h2>Đưa sách lên chuỗi</h2>
          <p>
            Upload file → lưu Mongo · sha256 neo on-chain · mint NFT. Danh sách theo{" "}
            <strong>đầu sách</strong> (không liệt từng bản chain) — số NFT tăng khi nhập
            kho / bán thêm bản.
          </p>
          <div className="mint-hero-actions">
            <button className="btn btn-primary mint-cta" type="button" onClick={openMintModal}>
              <Plus size={18} /> Phát hành sách mới
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setTab("books")}>
              <Boxes size={16} /> Xem kho sách
            </button>
          </div>
        </div>
        <div className="mint-hero-aside" aria-hidden="true">
          <div className="mint-hero-orb" />
          <div className="mint-hero-card">
            <BookOpen size={22} />
            <div>
              <strong>{books.length}</strong>
              <span>đầu sách</span>
            </div>
          </div>
          <div className="mint-hero-card delay">
            <Hash size={20} />
            <div>
              <strong>sha256</strong>
              <span>neo nội dung L2</span>
            </div>
          </div>
        </div>
      </div>

      <ol className="mint-steps" aria-label="Quy trình phát hành">
        <li>
          <span className="mint-step-num">1</span>
          <div>
            <strong>Upload file</strong>
            <p>PDF / EPUB / TXT lưu Mongo (L2)</p>
          </div>
        </li>
        <li>
          <span className="mint-step-num">2</span>
          <div>
            <strong>Điền catalog</strong>
            <p>Tên, tác giả, danh mục 3 cấp, NXB</p>
          </div>
        </li>
        <li>
          <span className="mint-step-num">3</span>
          <div>
            <strong>Mint NFT</strong>
            <p>metadataURI = sha256 · TxNode trên chuỗi</p>
          </div>
        </li>
      </ol>

      <div className="mint-recent-head">
        <div>
          <h3>Toàn bộ sách đã phát hành</h3>
          <p className="muted">
            {sortedFiltered.length === books.length
              ? `${books.length} đầu sách`
              : `${sortedFiltered.length} / ${books.length} đầu sách`}
            {" · "}
            đã gộp trùng · badge <strong>N chain</strong> = số NFT ·{" "}
            <strong>Sửa</strong> catalog / L2
          </p>
        </div>
        <div className="mint-toolbar">
          <label className="mint-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm gần đúng: #id, tên, tác giả, ISBN… (bỏ dấu OK)"
              aria-label="Tìm sách đã phát hành"
            />
          </label>
          <div className="mint-view-toggle" role="group" aria-label="Kiểu xem">
            <button
              type="button"
              className={view === "grid" ? "is-on" : ""}
              onClick={() => setView("grid")}
              title="Lưới"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              className={view === "table" ? "is-on" : ""}
              onClick={() => setView("table")}
              title="Bảng"
              aria-pressed={view === "table"}
            >
              <List size={15} />
            </button>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={busy}
            onClick={onRefreshBooks}
          >
            <RefreshCw size={16} /> Sync kho
          </button>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="empty catalog-empty panel mint-empty">
          <BookOpen size={32} />
          <p>Chưa có sách nào — bắt đầu phát hành đầu tiên</p>
          <button className="btn btn-primary" type="button" onClick={openMintModal}>
            <Plus size={16} /> Phát hành sách
          </button>
        </div>
      ) : sortedFiltered.length === 0 ? (
        <div className="empty catalog-empty panel mint-empty">
          <Search size={28} />
          <p>Không có sách khớp «{q.trim()}»</p>
          <button className="btn btn-ghost" type="button" onClick={() => setQ("")}>
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <>
          {view === "grid" ? (
            <div className="mint-recent-grid">
              {pageItems.map((b) => {
                const cover = bookImage(b);
                const name = bookName(b);
                const st = statusOf(b);
                const hasFile = Boolean(b.hasFile || b.contentHash);
                return (
                  <article
                    key={b.bookId}
                    className={`mint-recent-card${
                      highlightBookId === b.bookId ? " is-flash" : ""
                    }`}
                  >
                    <div
                      className="mint-recent-cover"
                      style={
                        isImageSrc(cover)
                          ? { backgroundImage: `url(${cover})` }
                          : undefined
                      }
                    >
                      {!isImageSrc(cover) && (
                        <span>{(name || "?").slice(0, 1).toUpperCase()}</span>
                      )}
                      <span className={`mint-recent-st status-pill ${st}`}>
                        {statusLabel(st)}
                      </span>
                    </div>
                    <div className="mint-recent-body">
                      <Link to={`/books/${b.bookId}`} className="mint-recent-title">
                        {name}
                      </Link>
                      <p className="muted">{bookAuthors(b)}</p>
                      <div className="mint-recent-meta">
                        <span className="mono">#{b.bookId}</span>
                        <span>{bookCategory(b)}</span>
                        {Number(b.chainCount) > 0 && (
                          <span className="badge" title="Số NFT trên chain">
                            {b.chainCount} chain
                          </span>
                        )}
                        {hasFile && (
                          <span className="badge mint">
                            <FileText size={11} /> L2
                          </span>
                        )}
                      </div>
                      <div className="mint-recent-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => openEditModal(b)}
                        >
                          <Pencil size={14} /> Sửa
                        </button>
                        {statusOf(b) === "inactive" ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => restoreBook(b)}
                            title="Khôi phục"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => removeBook(b)}
                            title="Ngừng KD"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <Link className="btn btn-ghost" to={`/books/${b.bookId}`}>
                          <ExternalLink size={14} /> Xem
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="panel mint-table-wrap">
              <table className="mint-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Sách</th>
                    <th>Tác giả</th>
                    <th>Danh mục</th>
                    <th>Giá</th>
                    <th>Trạng thái</th>
                    <th>L2</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((b) => {
                    const st = statusOf(b);
                    const hasFile = Boolean(b.hasFile || b.contentHash);
                    return (
                      <tr
                        key={b.bookId}
                        className={highlightBookId === b.bookId ? "is-flash" : ""}
                      >
                        <td className="mono">#{b.bookId}</td>
                        <td>
                          <div className="mint-table-book">
                            <span
                              className="mint-table-thumb"
                              style={
                                isImageSrc(bookImage(b))
                                  ? { backgroundImage: `url(${bookImage(b)})` }
                                  : undefined
                              }
                            />
                            <div>
                              <strong>{bookName(b)}</strong>
                              {b.isbn ? <span className="muted">{b.isbn}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td>{bookAuthors(b)}</td>
                        <td>{bookCategory(b)}</td>
                        <td className="mono">
                          {b.price != null && Number(b.price) > 0
                            ? `${Number(b.price)} ETH`
                            : b.listedPriceWei && b.listedPriceWei !== "0"
                              ? formatEth(b.listedPriceWei)
                              : "—"}
                        </td>
                        <td>
                          <span className={`status-pill ${st}`}>{statusLabel(st)}</span>
                        </td>
                        <td>
                          {hasFile ? (
                            <span className="badge mint">
                              <FileText size={11} /> Có
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="mint-table-actions">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => openEditModal(b)}
                            >
                              <Pencil size={14} /> Sửa
                            </button>
                            {st === "inactive" ? (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => restoreBook(b)}
                                title="Khôi phục"
                              >
                                <RotateCcw size={14} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => removeBook(b)}
                                title="Ngừng KD"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            <Link className="btn btn-ghost" to={`/books/${b.bookId}`}>
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mint-pager" role="navigation" aria-label="Phân trang sách">
            <p className="mint-pager-info">
              Hiển thị <strong>{from}</strong>–<strong>{to}</strong> /{" "}
              <strong>{sortedFiltered.length}</strong>
              {" · "}
              {PAGE_SIZE}/trang
            </p>
            <div className="mint-pager-controls">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
              >
                <ChevronLeft size={16} /> Trước
              </button>
              {pageList().map((p, i) =>
                p === "…" ? (
                  <span key={`e-${i}`} className="mint-pager-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`mint-pager-num${page === p ? " is-on" : ""}`}
                    onClick={() => setPage(p)}
                    aria-current={page === p ? "page" : undefined}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
              >
                Sau <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
