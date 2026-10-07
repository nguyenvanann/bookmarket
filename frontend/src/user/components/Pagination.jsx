import { ChevronLeft, ChevronRight } from "lucide-react";
import "./pagination.css";

function buildPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [];
  const push = (v) => {
    if (!pages.includes(v)) pages.push(v);
  };
  push(1);
  let start = Math.max(2, current - 1);
  let end = Math.min(total - 1, current + 1);
  if (current <= 3) {
    start = 2;
    end = 4;
  }
  if (current >= total - 2) {
    start = total - 3;
    end = total - 1;
  }
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i += 1) push(i);
  if (end < total - 1) pages.push("…");
  push(total);
  return pages;
}

/**
 * @param {{ page: number, pageSize: number, total: number, onChange: (p: number) => void, label?: string }} props
 */
export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = "sách",
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  if (total <= pageSize) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = buildPages(page, totalPages);

  return (
    <nav className="bm-pager" aria-label="Phân trang">
      <p className="bm-pager-info">
        <span className="bm-pager-range">
          {from}–{to}
        </span>
        <span className="bm-pager-sep">/</span>
        <span>
          {total} {label}
        </span>
      </p>

      <div className="bm-pager-controls">
        <button
          type="button"
          className="bm-pager-nav"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} />
          <span>Trước</span>
        </button>

        <div className="bm-pager-nums" role="list">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="bm-pager-ellipsis" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                role="listitem"
                className={`bm-pager-num${page === p ? " is-on" : ""}`}
                onClick={() => onChange(p)}
                aria-label={`Trang ${p}`}
                aria-current={page === p ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="bm-pager-nav"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <span>Sau</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
