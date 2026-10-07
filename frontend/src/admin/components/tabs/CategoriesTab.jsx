import { useAdmin } from "../../AdminContext";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { CATEGORY_STATUSES, LEVEL_LABELS, flattenCategoryTree } from "../../constants";

export default function CategoriesTab() {
  const {
    busy,
    categories,
    categoryQ,
    setCategoryQ,
    categoryFilter,
    setCategoryFilter,
    catExpanded,
    openCategoryModal,
    removeCategory,
    toggleCatExpand,
    expandAllCats,
    collapseAllCats,
    displayCategoryTree,
    bookCountByCategory,
  } = useAdmin();

  return (
    <section className="catalog cat-section">
      <div className="catalog-hero">
        <div>
          <h2>Danh mục sách 3 cấp</h2>
          <p className="muted">
            Cây phân cấp: Cấp 1 → Cấp 2 → Cấp 3 (lá gắn vào sách khi phát hành).
          </p>
        </div>
        <div className="catalog-hero-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={expandAllCats}
            title="Mở tất cả nhánh"
          >
            <FolderOpen size={16} /> Mở hết
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={collapseAllCats}
            title="Thu gọn cây"
          >
            <Folder size={16} /> Thu gọn
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openCategoryModal()}
          >
            <Plus size={16} /> Thêm cấp 1
          </button>
        </div>
      </div>

      <div className="catalog-stats cat-stats">
        <div className="catalog-stat cat-stat-l1">
          <strong>{categories.filter((c) => (c.level || 1) === 1).length}</strong>
          <span>Cấp 1 · gốc</span>
        </div>
        <div className="catalog-stat cat-stat-l2">
          <strong>{categories.filter((c) => c.level === 2).length}</strong>
          <span>Cấp 2 · nhóm</span>
        </div>
        <div className="catalog-stat cat-stat-l3">
          <strong>{categories.filter((c) => c.level === 3).length}</strong>
          <span>Cấp 3 · lá</span>
        </div>
        <div className="catalog-stat">
          <strong>{categories.filter((c) => c.status === "active").length}</strong>
          <span>Đang dùng</span>
        </div>
      </div>

      <div className="cat-legend" aria-hidden="true">
        <span className="cat-legend-item L1">
          <Folder size={14} /> Cấp 1
        </span>
        <span className="cat-legend-item L2">
          <FolderOpen size={14} /> Cấp 2
        </span>
        <span className="cat-legend-item L3">
          <Tags size={14} /> Cấp 3 (gắn sách)
        </span>
      </div>

      <div className="toolbar catalog-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Lọc cây theo tên, đường dẫn, slug…"
            value={categoryQ}
            onChange={(e) => setCategoryQ(e.target.value)}
          />
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {CATEGORY_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="panel cat-tree-panel">
        <div className="cat-tree-head">
          <FolderTree size={18} />
          <span>Cây danh mục</span>
          <span className="muted tiny-inline">
            {flattenCategoryTree(displayCategoryTree).length} mục đang hiện
          </span>
        </div>

        {displayCategoryTree.length === 0 ? (
          <div className="empty catalog-empty">
            <Tags size={28} />
            <p>Chưa có danh mục phù hợp</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openCategoryModal()}
            >
              <Plus size={16} /> Thêm danh mục cấp 1
            </button>
          </div>
        ) : (
          <ul className="cat-tree" role="tree">
            {displayCategoryTree.map((node, i) => {
              const renderNode = (c, depth, isLast, ancestorsLast) => {
                const id = String(c._id);
                const kids = c.children || [];
                const hasKids = kids.length > 0;
                const open = catExpanded.has(id);
                const level = c.level || depth + 1;
                const canAddChild = level < 3;
                const bookCount =
                  (bookCountByCategory.get(id) || 0) +
                  (bookCountByCategory.get(`name:${c.name}`) || 0);
                const q = categoryQ.trim().toLowerCase();
                const hit =
                  q &&
                  ((c.name || "").toLowerCase().includes(q) ||
                    (c.pathNames || "").toLowerCase().includes(q) ||
                    (c.slug || "").toLowerCase().includes(q));

                return (
                  <li
                    key={id}
                    className={`cat-node L${level}${isLast ? " is-last" : ""}${
                      hit ? " is-hit" : ""
                    }${c.status === "inactive" ? " is-inactive" : ""}`}
                    role="treeitem"
                    aria-expanded={hasKids ? open : undefined}
                  >
                    <div className="cat-node-row">
                      <div className="cat-node-guides" aria-hidden="true">
                        {ancestorsLast.map((ancLast, gi) => (
                          <span
                            key={gi}
                            className={`cat-guide${ancLast ? " blank" : ""}`}
                          />
                        ))}
                        {depth > 0 && (
                          <span
                            className={`cat-guide elbow${isLast ? " last" : ""}`}
                          />
                        )}
                      </div>
                      {hasKids ? (
                        <button
                          type="button"
                          className="cat-twist"
                          onClick={() => toggleCatExpand(id)}
                          aria-label={open ? "Thu gọn" : "Mở rộng"}
                        >
                          {open ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                      ) : (
                        <span className="cat-twist spacer" />
                      )}

                      <span className={`cat-icon L${level}`}>
                        {level === 3 ? (
                          <Tags size={15} />
                        ) : open && hasKids ? (
                          <FolderOpen size={15} />
                        ) : (
                          <Folder size={15} />
                        )}
                      </span>

                      <div className="cat-node-main">
                        <div className="cat-node-title">
                          <strong>{c.name}</strong>
                          <span className={`cat-level-badge L${level}`}>
                            {LEVEL_LABELS[level] || `Cấp ${level}`}
                          </span>
                          {c.status === "inactive" && (
                            <span className="status-pill inactive">Ẩn</span>
                          )}
                          {level === 3 && (
                            <span className="cat-leaf-tag">lá</span>
                          )}
                        </div>
                        <div className="cat-node-meta">
                          {c.slug && <span className="mono">{c.slug}</span>}
                          {hasKids && (
                            <span>
                              {kids.length} mục con
                              {!open ? " · đã thu" : ""}
                            </span>
                          )}
                          <span>
                            {bookCount} sách
                            {level < 3 ? " (trực tiếp)" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="cat-node-actions">
                        {canAddChild && (
                          <button
                            className="btn btn-ghost cat-act"
                            type="button"
                            title={`Thêm ${LEVEL_LABELS[level + 1] || "con"}`}
                            onClick={() => openCategoryModal(null, c)}
                          >
                            <Plus size={14} />
                            <span>Con</span>
                          </button>
                        )}
                        <button
                          className="btn btn-ghost cat-act"
                          type="button"
                          title="Sửa"
                          onClick={() => openCategoryModal(c)}
                        >
                          <Pencil size={14} />
                          <span>Sửa</span>
                        </button>
                        <button
                          className="btn btn-danger cat-act"
                          type="button"
                          disabled={busy}
                          title="Xóa"
                          onClick={() => removeCategory(c._id, c.name)}
                        >
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>

                    {hasKids && open && (
                      <ul className="cat-children" role="group">
                        {kids.map((child, ci) =>
                          renderNode(
                            child,
                            depth + 1,
                            ci === kids.length - 1,
                            [...ancestorsLast, isLast]
                          )
                        )}
                      </ul>
                    )}
                  </li>
                );
              };

              return renderNode(node, 0, i === displayCategoryTree.length - 1, []);
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
