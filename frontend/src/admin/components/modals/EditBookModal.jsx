import { useAdmin } from "../../AdminContext";
import {
  BookOpen,
  FileText,
  Hash,
  ImagePlus,
  Layers,
  Library,
  Pencil,
  RotateCcw,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CATALOG_STATUSES } from "../../constants";
import { isImageSrc, formatBytes, statusLabel } from "../../utils";

export default function EditBookModal() {
  const {
    busy,
    editingId,
    editMeta,
    setEditMeta,
    editFile,
    setEditFile,
    editCover,
    editCoverPreview,
    editHasFile,
    editFileName,
    closeModal,
    saveMeta,
    removeBook,
    restoreBook,
    onEditCoverPick,
    childrenOf,
    applyCascade,
    applyPublisherSelect,
    activePublishers,
  } = useAdmin();

  const coverSrc = editCoverPreview || editMeta.image;
  const hasCover = isImageSrc(coverSrc);
  const statusText =
    CATALOG_STATUSES.find((s) => s.id === editMeta.status)?.label ||
    statusLabel(editMeta.status) ||
    editMeta.status;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="modal-sheet edit-book-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        <header className="edit-book-head">
          <div className="edit-book-head-main">
            <p className="modal-eyebrow">
              <Pencil size={12} /> Chỉnh sửa phát hành
            </p>
            <div className="edit-book-title-row">
              <h2 id="edit-modal-title">Sửa sách</h2>
              <span className="edit-book-id">
                <Hash size={13} /> {editingId}
              </span>
            </div>
            <p className="edit-book-sub">
              Catalog & file L2 trên Mongo · bookId on-chain giữ nguyên
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

        <form onSubmit={saveMeta} className="edit-book-form">
          <aside className="edit-book-aside">
            <div
              className="edit-book-cover"
              style={hasCover ? { backgroundImage: `url(${coverSrc})` } : undefined}
            >
              {!hasCover && (
                <div className="edit-book-cover-fallback">
                  <BookOpen size={32} strokeWidth={1.5} />
                  <span>
                    {(editMeta.name?.trim() || "S").slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
              {editCover && <span className="edit-book-cover-flag">Ảnh mới</span>}
            </div>

            <div className="edit-book-aside-meta">
              <strong>{editMeta.name?.trim() || "Tên sách…"}</strong>
              <span>{editMeta.authors?.trim() || "Tác giả…"}</span>
              <div className="edit-book-chips">
                <span className="edit-chip">
                  <Tag size={11} />
                  {editMeta.category || "Chưa chọn danh mục"}
                </span>
                <span className="edit-chip tone-status">{statusText}</span>
                {(editFile || editHasFile) && (
                  <span className="edit-chip tone-l2">
                    <FileText size={11} />
                    {editFile ? "File mới" : "Có L2"}
                  </span>
                )}
              </div>
            </div>

            <div className="edit-book-media">
              <p className="edit-book-media-label">
                <ImagePlus size={13} /> Ảnh bìa
              </p>
              <label className={`edit-drop ${editCover ? "has-file" : ""}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(e) => onEditCoverPick(e.target.files?.[0] || null)}
                />
                <Upload size={16} />
                <div>
                  {editCover ? (
                    <>
                      <strong>{editCover.name}</strong>
                      <small>{formatBytes(editCover.size)}</small>
                    </>
                  ) : (
                    <>
                      <strong>Chọn ảnh bìa</strong>
                      <small>JPG · PNG · WEBP ≤ 5MB</small>
                    </>
                  )}
                </div>
                {editCover && (
                  <button
                    className="edit-drop-clear"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onEditCoverPick(null);
                    }}
                    aria-label="Xóa ảnh mới"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="field edit-url-field">
                <label>hoặc URL ảnh</label>
                <input
                  value={editMeta.image}
                  onChange={(e) => {
                    setEditMeta({ ...editMeta, image: e.target.value });
                    if (editCover) onEditCoverPick(null);
                  }}
                  placeholder="https://…"
                  disabled={Boolean(editCover)}
                />
              </div>
            </div>
          </aside>

          <div className="edit-book-main">
            <section className="edit-section">
              <header className="edit-section-head">
                <Library size={15} />
                <div>
                  <h3>Thông tin catalog</h3>
                  <p>Tên, tác giả, danh mục, giá & tồn kho</p>
                </div>
              </header>

              <div className="edit-grid-2">
                <div className="field">
                  <label>Tên sách *</label>
                  <input
                    required
                    value={editMeta.name}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, name: e.target.value })
                    }
                    placeholder="Nhập tên sách"
                  />
                </div>
                <div className="field">
                  <label>ISBN</label>
                  <input
                    value={editMeta.isbn}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, isbn: e.target.value })
                    }
                    placeholder="BM-…"
                  />
                </div>
              </div>

              <div className="field">
                <label>Tác giả *</label>
                <input
                  required
                  value={editMeta.authors}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, authors: e.target.value })
                  }
                  placeholder="Tác giả 1, Tác giả 2"
                />
              </div>

              <div className="field">
                <label>Danh mục 3 cấp *</label>
                <div className="edit-cat-row">
                  <select
                    required
                    value={editMeta.catL1}
                    onChange={(e) =>
                      setEditMeta(applyCascade(editMeta, 1, e.target.value))
                    }
                  >
                    <option value="">Cấp 1</option>
                    {childrenOf(null).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={editMeta.catL2}
                    disabled={!editMeta.catL1}
                    onChange={(e) =>
                      setEditMeta(applyCascade(editMeta, 2, e.target.value))
                    }
                  >
                    <option value="">Cấp 2</option>
                    {childrenOf(editMeta.catL1).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={editMeta.catL3}
                    disabled={!editMeta.catL2}
                    onChange={(e) =>
                      setEditMeta(applyCascade(editMeta, 3, e.target.value))
                    }
                  >
                    <option value="">Cấp 3</option>
                    {childrenOf(editMeta.catL2).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="edit-grid-2">
                <div className="field">
                  <label>Nhà xuất bản</label>
                  <select
                    value={editMeta.publisherId}
                    onChange={(e) =>
                      setEditMeta(applyPublisherSelect(editMeta, e.target.value))
                    }
                  >
                    <option value="">— Chọn NXB —</option>
                    {activePublishers.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Năm xuất bản</label>
                  <input
                    value={editMeta.publishYear}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, publishYear: e.target.value })
                    }
                    placeholder="2024"
                  />
                </div>
              </div>

              <div className="edit-grid-3">
                <div className="field">
                  <label>Giá bán (ETH)</label>
                  <input
                    value={editMeta.price}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, price: e.target.value })
                    }
                    placeholder="0.01"
                  />
                </div>
                <div className="field">
                  <label>Tồn kho</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editMeta.quantity}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Trạng thái</label>
                  <select
                    value={editMeta.status}
                    onChange={(e) =>
                      setEditMeta({ ...editMeta, status: e.target.value })
                    }
                  >
                    {CATALOG_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Mô tả</label>
                <textarea
                  rows={3}
                  value={editMeta.description}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, description: e.target.value })
                  }
                  placeholder="Tóm tắt nội dung, ghi chú catalog…"
                />
              </div>
            </section>

            <section className="edit-section">
              <header className="edit-section-head">
                <Layers size={15} />
                <div>
                  <h3>File nội dung (L2)</h3>
                  <p>PDF / EPUB lưu Mongo · sha256 neo metadata</p>
                </div>
              </header>

              {editHasFile && !editFile && (
                <p className="edit-l2-current">
                  <FileText size={14} />
                  Đang có: <strong>{editFileName || "book file"}</strong>
                  <span>— chọn file mới để thay thế</span>
                </p>
              )}

              <label className={`edit-drop edit-drop-l2 ${editFile ? "has-file" : ""}`}>
                <input
                  type="file"
                  accept=".pdf,.epub,.txt,.doc,.docx,.mobi,application/pdf,application/epub+zip,text/plain"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
                <Upload size={18} />
                <div>
                  {editFile ? (
                    <>
                      <strong>{editFile.name}</strong>
                      <small>
                        {formatBytes(editFile.size)} · sẽ cập nhật sha256 L2
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>
                        {editHasFile ? "Thay file sách…" : "Upload file sách"}
                      </strong>
                      <small>PDF, EPUB, TXT… ≤ 25MB</small>
                    </>
                  )}
                </div>
                {editFile && (
                  <button
                    className="edit-drop-clear"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditFile(null);
                    }}
                    aria-label="Bỏ file mới"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </section>
          </div>

          <footer className="edit-book-foot">
            <p className="edit-book-hint">
              <FileText size={13} /> Lưu chỉ cập nhật Mongo / L2 — không remint NFT
            </p>
            <div className="edit-book-actions">
              {editMeta.status === "inactive" ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    restoreBook({ bookId: editingId, name: editMeta.name })
                  }
                >
                  <RotateCcw size={16} /> Khôi phục
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    removeBook({ bookId: editingId, name: editMeta.name })
                  }
                >
                  <Trash2 size={16} /> Ngừng KD
                </button>
              )}
              <button
                className="btn btn-ghost"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Huỷ
              </button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                <Pencil size={16} />
                {busy ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
