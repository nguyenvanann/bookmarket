import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../AdminContext";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Boxes,
  Eye,
  ExternalLink,
  FileDown,
  LayoutGrid,
  List,
  Minus,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
} from "lucide-react";
import { STOCK_FILTERS, LOW_STOCK_AT } from "../../constants";
import {
  bookName,
  bookAuthors,
  bookCategory,
  bookImage,
  statusOf,
  statusLabel,
  isImageSrc,
  stockQty,
  stockLevel,
  stockLevelLabel,
  isSelling,
  lineStockValue,
  summarizeStock,
  compareStockUrgency,
  matchesStockFilter,
  movementTypeLabel,
} from "../../utils";
import { formatEth } from "../../../services/contract";
import Pagination, { paginate } from "../../../user/components/Pagination";

const PAGE_SIZE = 10;

function formatStockValue(v) {
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1) return `${v.toFixed(3)} ETH`;
  return `${v.toFixed(4)} ETH`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function StockStepper({ book, busy, onChange }) {
  const qty = stockQty(book);
  return (
    <div className="stock-stepper" title="Điều chỉnh tồn (ghi phiếu điều chỉnh)">
      <button
        type="button"
        className="stock-step-btn"
        disabled={busy || qty <= 0}
        onClick={() => onChange(book, qty - 1)}
        aria-label="Giảm tồn"
      >
        <Minus size={14} />
      </button>
      <span className={`stock-step-qty lvl-${stockLevel(book)}`}>{qty}</span>
      <button
        type="button"
        className="stock-step-btn"
        disabled={busy}
        onClick={() => onChange(book, qty + 1)}
        aria-label="Tăng tồn"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function BooksTab() {
  const {
    books,
    busy,
    bookQ,
    setBookQ,
    bookFilter,
    setBookFilter,
    highlightBookId,
    bookView,
    setBookViewMode,
    openMintModal,
    openEditModal,
    openStockInModal,
    onRefreshBooks,
    refreshOne,
    updateStockQuantity,
    removeBook,
    restoreBook,
    filteredBooks,
    stockMovements,
    setTab,
    viewStockPdf,
    downloadStockPdf,
  } = useAdmin();

  const [sortMode, setSortMode] = useState("urgency");
  const [moveFilter, setMoveFilter] = useState("all");
  const [page, setPage] = useState(1);

  const stats = useMemo(() => summarizeStock(books), [books]);

  const moveStats = useMemo(() => {
    const list = stockMovements || [];
    return {
      in: list.filter((m) => m.type === "in").length,
      out: list.filter((m) => m.type === "out").length,
      adjust: list.filter((m) => m.type === "adjust").length,
    };
  }, [stockMovements]);

  const filterCounts = useMemo(() => {
    const counts = { all: books.length };
    for (const f of STOCK_FILTERS) {
      if (f.id === "all") continue;
      counts[f.id] = books.filter((b) => matchesStockFilter(b, f.id)).length;
    }
    return counts;
  }, [books]);

  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];
    if (sortMode === "urgency") list.sort(compareStockUrgency);
    else if (sortMode === "qty_desc") {
      list.sort((a, b) => stockQty(b) - stockQty(a) || b.bookId - a.bookId);
    } else if (sortMode === "name") {
      list.sort((a, b) => bookName(a).localeCompare(bookName(b), "vi"));
    } else {
      list.sort((a, b) => b.bookId - a.bookId);
    }
    return list;
  }, [filteredBooks, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [bookQ, bookFilter, sortMode]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedBooks.length / PAGE_SIZE) || 1);
    if (page > maxPage) setPage(maxPage);
  }, [page, sortedBooks.length]);

  useEffect(() => {
    if (highlightBookId == null) return;
    const idx = sortedBooks.findIndex((b) => b.bookId === highlightBookId);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [highlightBookId, sortedBooks]);

  const pageBooks = useMemo(
    () => paginate(sortedBooks, page, PAGE_SIZE),
    [sortedBooks, page]
  );

  const visibleMoves = useMemo(() => {
    const list = stockMovements || [];
    if (moveFilter === "all") return list;
    return list.filter((m) => m.type === moveFilter);
  }, [stockMovements, moveFilter]);

  return (
    <section className="catalog books-page warehouse-page">
      <div className="books-hero warehouse-hero">
        <div className="books-hero-copy">
          <p className="books-hero-eyebrow">
            <Warehouse size={14} /> Quản lý kho hàng
          </p>
          <h2>Kho sách</h2>
          <p>
            Hiển thị theo <strong>đầu sách</strong> (ISBN/tựa) — mỗi đầu có nhiều NFT
            trên chain theo số lượng nhập.
            <strong> Nhập kho</strong> tăng tồn; mua hàng mint/bán từng bản chain.
          </p>
          <div className="books-hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => openStockInModal()}>
              <PackagePlus size={16} /> Nhập kho
            </button>
            <button className="btn btn-ghost" type="button" onClick={openMintModal}>
              <Plus size={16} /> Phát hành SKU mới
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setTab("sales")}>
              <ArrowUpFromLine size={16} /> Xem xuất (HĐ)
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy}
              onClick={onRefreshBooks}
            >
              <RefreshCw size={16} /> Đồng bộ chain
            </button>
          </div>
        </div>
        <div className="books-hero-stats warehouse-kpis" aria-label="Chỉ số kho">
          <div className="books-hero-stat">
            <strong>{stats.sku}</strong>
            <span>SKU trong kho</span>
          </div>
          <div className="books-hero-stat">
            <strong>{stats.units}</strong>
            <span>Tổng đơn vị tồn</span>
          </div>
          <div className={`books-hero-stat${stats.low ? " is-warn" : ""}`}>
            <strong>{stats.low}</strong>
            <span>Sắp hết (≤{LOW_STOCK_AT})</span>
          </div>
          <div className={`books-hero-stat${stats.out ? " is-danger" : ""}`}>
            <strong>{stats.out}</strong>
            <span>Hết hàng</span>
          </div>
          <div className="books-hero-stat wide">
            <strong>{formatStockValue(stats.value)}</strong>
            <span>Giá trị tồn (theo giá vốn)</span>
          </div>
          <div className="books-hero-stat">
            <strong>{moveStats.out}</strong>
            <span>Phiếu xuất gần đây</span>
          </div>
        </div>
      </div>

      <div className="stock-flow-hint" aria-hidden="true">
        <div className="stock-flow-card in">
          <ArrowDownToLine size={18} />
          <div>
            <strong>Nhập kho</strong>
            <p>Admin nhập số lượng + giá vốn (± NCC)</p>
          </div>
        </div>
        <div className="stock-flow-card out">
          <ArrowUpFromLine size={18} />
          <div>
            <strong>Xuất kho</strong>
            <p>Tự động khi khách mua → hóa đơn GTGT</p>
          </div>
        </div>
        <div className="stock-flow-card adj">
          <SlidersHorizontal size={18} />
          <div>
            <strong>Điều chỉnh</strong>
            <p>Stepper ± khi cần khớp sổ tồn</p>
          </div>
        </div>
      </div>

      {(stats.low > 0 || stats.out > 0) && (
        <div className="stock-alerts" role="status">
          {stats.out > 0 && (
            <button
              type="button"
              className={`stock-alert danger${bookFilter === "out" ? " active" : ""}`}
              onClick={() => setBookFilter("out")}
            >
              <PackageMinus size={15} />
              <span>
                <strong>{stats.out}</strong> SKU hết hàng — cần nhập kho
              </span>
            </button>
          )}
          {stats.low > 0 && (
            <button
              type="button"
              className={`stock-alert warn${bookFilter === "low" ? " active" : ""}`}
              onClick={() => setBookFilter("low")}
            >
              <AlertTriangle size={15} />
              <span>
                <strong>{stats.low}</strong> SKU sắp hết (tồn ≤ {LOW_STOCK_AT})
              </span>
            </button>
          )}
        </div>
      )}

      <div className="books-toolbar warehouse-toolbar">
        <label className="search-field books-search">
          <Search size={16} />
          <input
            placeholder="Tìm gần đúng: tên, ISBN, tác giả… (vd. naruto, nguoi)"
            value={bookQ}
            onChange={(e) => setBookQ(e.target.value)}
          />
        </label>
        <select
          className="stock-sort"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          aria-label="Sắp xếp kho"
        >
          <option value="urgency">Ưu tiên: hết / sắp hết</option>
          <option value="qty_desc">Tồn nhiều → ít</option>
          <option value="newest">Mới (NFT #)</option>
          <option value="name">Tên A → Z</option>
        </select>
        <div className="books-view-toggle" role="group" aria-label="Chế độ xem">
          <button
            type="button"
            className={`books-view-btn${bookView === "table" ? " active" : ""}`}
            onClick={() => setBookViewMode("table")}
            title="Bảng tồn kho"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className={`books-view-btn${bookView === "grid" ? " active" : ""}`}
            onClick={() => setBookViewMode("grid")}
            title="Thẻ tồn"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      <div className="books-chips" role="group" aria-label="Lọc tồn kho">
        {STOCK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`books-chip stock-${f.id}${bookFilter === f.id ? " active" : ""}`}
            onClick={() => setBookFilter(f.id)}
          >
            {f.label} <em>{filterCounts[f.id] ?? 0}</em>
          </button>
        ))}
      </div>

      {sortedBooks.length === 0 ? (
        <div className="empty catalog-empty panel books-empty">
          <Boxes size={32} />
          <p>
            {books.length === 0
              ? "Kho chưa có SKU — phát hành sách rồi nhập kho"
              : bookQ.trim()
                ? "Không có SKU khớp tìm kiếm gần đúng / bộ lọc"
                : "Không có SKU khớp bộ lọc tồn"}
          </p>
          {books.length === 0 ? (
            <button className="btn btn-primary" type="button" onClick={openMintModal}>
              <BookOpen size={16} /> Phát hành SKU đầu tiên
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setBookFilter("all");
                setBookQ("");
              }}
            >
              Xem toàn kho
            </button>
          )}
        </div>
      ) : bookView === "table" ? (
        <div className="table-wrap panel catalog-table books-table warehouse-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Đầu sách</th>
                <th>Sách</th>
                <th>Danh mục / NXB</th>
                <th>Tồn</th>
                <th>Chain</th>
                <th>Mức tồn</th>
                <th>Giá vốn</th>
                <th>Giá bán</th>
                <th>Giá trị tồn</th>
                <th>Trạng thái KD</th>
                <th style={{ width: 200 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageBooks.map((b) => {
                const st = statusOf(b);
                const level = stockLevel(b);
                const cover = bookImage(b);
                const name = bookName(b);
                const sell =
                  b.price != null ? `${b.price} ETH` : formatEth(b.listedPriceWei);
                const cost =
                  b.costPrice != null && Number(b.costPrice) > 0
                    ? `${b.costPrice} ETH`
                    : "—";
                return (
                  <tr
                    key={b.bookId}
                    className={`stock-row lvl-${level}${
                      highlightBookId === b.bookId ? " row-flash" : ""
                    }`}
                  >
                    <td>
                      <div className="stock-sku">
                        <span className="mono">#{b.bookId}</span>
                        {b.isbn ? (
                          <span className="muted tiny mono">{b.isbn}</span>
                        ) : (
                          <span className="muted tiny">Chưa có ISBN</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="book-cell">
                        <div
                          className="book-thumb"
                          style={
                            isImageSrc(cover)
                              ? { backgroundImage: `url(${cover})` }
                              : undefined
                          }
                          aria-hidden
                        >
                          {!isImageSrc(cover) && (
                            <span>{(name || "?").slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="book-cell-text">
                          <Link to={`/books/${b.bookId}`}>
                            <strong>{name}</strong>
                          </Link>
                          <div className="muted tiny">{bookAuthors(b)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="stock-cat-cell" title={bookCategory(b)}>
                        {bookCategory(b)}
                      </div>
                      <div className="muted tiny">{b.publisher || "Chưa gắn NXB"}</div>
                    </td>
                    <td>
                      <StockStepper
                        book={b}
                        busy={busy}
                        onChange={updateStockQuantity}
                      />
                    </td>
                    <td>
                      <span className="mono" title="Số NFT đã mint trên chain">
                        {Number(b.chainCount) || 1}
                      </span>
                      {Number(b.sellableCount) > 0 ? (
                        <div className="muted tiny">{b.sellableCount} đang bán</div>
                      ) : (
                        <div className="muted tiny">hết NFT bán</div>
                      )}
                    </td>
                    <td>
                      <span className={`stock-level-pill ${level}`}>
                        {stockLevelLabel(level)}
                      </span>
                    </td>
                    <td className="mono">{cost}</td>
                    <td className="mono">{sell}</td>
                    <td className="mono">{formatStockValue(lineStockValue(b))}</td>
                    <td>
                      <span className={`status-pill ${st}`}>{statusLabel(st)}</span>
                      {isSelling(b) && level !== "inactive" && (
                        <div className="muted tiny">Đang mở bán</div>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openStockInModal(b)}
                          title="Nhập kho SKU này"
                        >
                          <PackagePlus size={14} />
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openEditModal(b)}
                          title="Sửa thông tin"
                        >
                          <Pencil size={14} />
                        </button>
                        {statusOf(b) === "inactive" ? (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={busy}
                            onClick={() => restoreBook(b)}
                            title="Khôi phục KD"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            type="button"
                            disabled={busy}
                            onClick={() => removeBook(b)}
                            title="Ngừng KD"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy}
                          onClick={() => refreshOne(b.bookId)}
                          title="Đồng bộ từ chain"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <Link
                          className="btn btn-ghost"
                          to={`/books/${b.bookId}`}
                          title="Trang bán"
                        >
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
      ) : (
        <div className="books-grid">
          {pageBooks.map((b) => {
            const st = statusOf(b);
            const level = stockLevel(b);
            const cover = bookImage(b);
            const name = bookName(b);
            const qty = stockQty(b);
            const price =
              b.price != null ? `${b.price} ETH` : formatEth(b.listedPriceWei);
            return (
              <article
                key={b.bookId}
                className={`stock-card lvl-${level}${
                  highlightBookId === b.bookId ? " is-flash" : ""
                }`}
              >
                <div
                  className="stock-cover"
                  style={
                    isImageSrc(cover) ? { backgroundImage: `url(${cover})` } : undefined
                  }
                >
                  {!isImageSrc(cover) && (
                    <span className="stock-cover-fallback">
                      {(name || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className={`stock-level-pill stock-st ${level}`}>
                    {stockLevelLabel(level)}
                  </span>
                  <span className="stock-qty-badge">
                    <Boxes size={11} /> {qty}
                  </span>
                </div>
                <div className="stock-body">
                  <Link to={`/books/${b.bookId}`} className="stock-title">
                    {name}
                  </Link>
                  <p className="stock-authors">{bookAuthors(b)}</p>
                  <div className="stock-meta">
                    <span className="mono">Đầu #{b.bookId}</span>
                    <span className="muted">
                      {Number(b.chainCount) || 1} chain
                      {Number(b.sellableCount) > 0
                        ? ` · ${b.sellableCount} bán`
                        : ""}
                    </span>
                  </div>
                  <div className="stock-price-row">
                    <strong className="mono">{price}</strong>
                    <span className="muted">{formatStockValue(lineStockValue(b))}</span>
                  </div>
                  <StockStepper book={b} busy={busy} onChange={updateStockQuantity} />
                  <div className="stock-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => openStockInModal(b)}
                    >
                      <PackagePlus size={14} />
                      <span>Nhập</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => openEditModal(b)}
                    >
                      <Pencil size={14} />
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
                  <div className="stock-meta">
                    <span className={`status-pill ${st}`}>{statusLabel(st)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {sortedBooks.length > 0 && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sortedBooks.length}
          onChange={setPage}
          label="SKU"
        />
      )}

      <section className="panel stock-ledger">
        <div className="panel-title stock-ledger-head">
          <div>
            <h2>Sổ xuất · nhập kho</h2>
            <p className="muted">
              Mỗi lần nhập/xuất có phiếu PDF mẫu 01-VT / 02-VT (Thông tư 99/2025/TT-BTC).
            </p>
          </div>
          <div className="books-chips stock-move-chips" role="group" aria-label="Lọc phiếu">
            {[
              { id: "all", label: "Tất cả" },
              { id: "in", label: "Nhập" },
              { id: "out", label: "Xuất" },
              { id: "adjust", label: "Điều chỉnh" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`books-chip${moveFilter === f.id ? " active" : ""}`}
                onClick={() => setMoveFilter(f.id)}
              >
                {f.label}
                <em>
                  {f.id === "all"
                    ? stockMovements.length
                    : f.id === "in"
                      ? moveStats.in
                      : f.id === "out"
                        ? moveStats.out
                        : moveStats.adjust}
                </em>
              </button>
            ))}
          </div>
        </div>

        {visibleMoves.length === 0 ? (
          <div className="empty catalog-empty" style={{ padding: "1.5rem" }}>
            <p className="muted">Chưa có phiếu xuất/nhập</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Phiếu</th>
                  <th>Loại</th>
                  <th>SKU</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>Tồn sau</th>
                  <th>Chứng từ</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {visibleMoves.map((m) => (
                  <tr key={m._id} className={`move-row type-${m.type}`}>
                    <td className="muted tiny">{formatWhen(m.createdAt)}</td>
                    <td>
                      <div className="mono tiny" title={m.voucherForm || ""}>
                        {m.voucherNumber || "—"}
                      </div>
                      {m.voucherForm ? (
                        <div className="muted tiny">Mẫu {m.voucherForm}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`move-pill ${m.type}`}>
                        {m.type === "in" && <ArrowDownToLine size={12} />}
                        {m.type === "out" && <ArrowUpFromLine size={12} />}
                        {m.type === "adjust" && <SlidersHorizontal size={12} />}
                        {movementTypeLabel(m.type)}
                      </span>
                    </td>
                    <td>
                      <div className="mono">#{m.bookId}</div>
                      <div className="muted tiny">{m.bookName || ""}</div>
                    </td>
                    <td className="mono">
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </td>
                    <td className="mono">
                      {m.unitPrice != null ? `${m.unitPrice} ETH` : "—"}
                    </td>
                    <td className="mono">{m.balanceAfter ?? "—"}</td>
                    <td>
                      {m.saleInvoiceNumber ? (
                        <span className="badge sale" title="Hóa đơn bán kèm phiếu xuất">
                          {m.saleInvoiceNumber}
                        </span>
                      ) : m.supplierName ? (
                        <span className="muted tiny">{m.supplierName}</span>
                      ) : m.attachedDoc ? (
                        <span className="muted tiny">{m.attachedDoc}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          disabled={busy}
                          title="Xem phiếu PDF"
                          onClick={() => viewStockPdf(m)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          disabled={busy}
                          title="Tải phiếu PDF"
                          onClick={() => downloadStockPdf(m)}
                        >
                          <FileDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
