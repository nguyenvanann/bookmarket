import { useAdmin } from "../../AdminContext";
import {
  Tags,
  X,
} from "lucide-react";
import { CATEGORY_STATUSES, LEVEL_LABELS } from "../../constants";

export default function CategoryModal() {
  const {
    busy,
    form,
    modal,
    categories,
    categoryForm,
    setCategoryForm,
    editingCategoryId,
    closeModal,
    saveCategory,
  } = useAdmin();

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="modal-sheet edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">categories · 3 cấp</p>
            <h2 id="category-modal-title">
              {editingCategoryId ? "Sửa danh mục" : "Thêm danh mục"}
            </h2>
            <p className="muted">
              {editingCategoryId
                ? "Không đổi cấp cha sau khi tạo"
                : categoryForm.parentId
                  ? "Tạo danh mục con dưới cấp đã chọn"
                  : "Không chọn cha → tạo cấp 1"}
            </p>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            disabled={busy}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={saveCategory} className="modal-body">
          <div className="field">
            <label>Danh mục cha</label>
            <select
              value={categoryForm.parentId}
              disabled={Boolean(editingCategoryId)}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, parentId: e.target.value })
              }
            >
              <option value="">— Không (cấp 1) —</option>
              {categories
                .filter((c) => (c.level || 1) < 3)
                .sort(
                  (a, b) =>
                    (a.level || 1) - (b.level || 1) ||
                    (a.pathNames || a.name).localeCompare(b.pathNames || b.name)
                )
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {LEVEL_LABELS[c.level] || `Cấp ${c.level}`} ·{" "}
                    {c.pathNames || c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label>name *</label>
            <input
              required
              autoFocus
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, name: e.target.value })
              }
              placeholder="VD: Tiểu thuyết"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>slug (tuỳ chọn)</label>
              <input
                value={categoryForm.slug}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, slug: e.target.value })
                }
                placeholder="tu-dong-tao-neu-de-trong"
                className="mono"
              />
            </div>
            <div className="field">
              <label>sortOrder</label>
              <input
                value={categoryForm.sortOrder}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, sortOrder: e.target.value })
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="field">
            <label>description</label>
            <textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, description: e.target.value })
              }
              placeholder="Mô tả danh mục…"
            />
          </div>
          <div className="field">
            <label>status</label>
            <select
              value={categoryForm.status}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, status: e.target.value })
              }
            >
              {CATEGORY_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <footer className="modal-foot">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={closeModal}
              disabled={busy}
            >
              Huỷ
            </button>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <Tags size={16} />
              {busy
                ? "Đang lưu…"
                : editingCategoryId
                  ? "Cập nhật danh mục"
                  : "Thêm danh mục"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
