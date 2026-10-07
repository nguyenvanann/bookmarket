import { useAdmin } from "../../AdminContext";
import {
  BookOpen,
  FileText,
  Hash,
  Layers,
  Sparkles,
  Tags,
  Upload,
  X,
} from "lucide-react";
import { CATALOG_STATUSES } from "../../constants";
import { isImageSrc, formatBytes } from "../../utils";

export default function MintModal() {
  const {
    busy,
    form,
    setForm,
    mintFile,
    setMintFile,
    mintCover,
    mintCoverPreview,
    onMintCoverPick,
    closeModal,
    onMint,
    childrenOf,
    applyCascade,
    applyPublisherSelect,
    activePublishers,
  } = useAdmin();

  const coverPreview = mintCoverPreview || form.image;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="modal-sheet mint-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mint-modal-title"
      >
        <header className="modal-head mint-modal-head">
          <div>
            <p className="modal-eyebrow">
              <Layers size={12} /> L2 Mongo · NFT on-chain
            </p>
            <h2 id="mint-modal-title">Phát hành sách mới</h2>
            <p className="muted">Hoàn tất checklist bên phải rồi mint một lần</p>
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

        <div className="mint-checklist" aria-label="Tiến độ form">
          <span className={`mint-check${mintFile ? " ok" : ""}`}>
            <Upload size={12} /> File
          </span>
          <span
            className={`mint-check${
              form.name?.trim() && form.authors?.trim() ? " ok" : ""
            }`}
          >
            <BookOpen size={12} /> Thông tin
          </span>
          <span className={`mint-check${form.categoryId ? " ok" : ""}`}>
            <Tags size={12} /> Danh mục
          </span>
          <span className={`mint-check${form.price !== "" ? " ok" : ""}`}>
            <Sparkles size={12} /> Giá
          </span>
        </div>

        <form onSubmit={onMint} className="modal-body mint-modal-grid">
          <aside className="mint-preview">
            <div
              className="mint-preview-cover"
              style={
                isImageSrc(coverPreview)
                  ? { backgroundImage: `url(${coverPreview})` }
                  : undefined
              }
            >
              {!isImageSrc(coverPreview) && (
                <div className="mint-preview-fallback">
                  <BookOpen size={28} />
                  <span>{form.name?.trim() || "Bìa sách"}</span>
                </div>
              )}
            </div>
            <div className="mint-preview-meta">
              <strong>{form.name?.trim() || "Tên sách…"}</strong>
              <span className="muted">{form.authors?.trim() || "Tác giả…"}</span>
              {form.publisher && (
                <span className="muted tiny">{form.publisher}</span>
              )}
              <div className="mint-preview-tags">
                <span className="badge">{form.category || "danh mục…"}</span>
                <span className="badge sale">{form.price || "0"} ETH</span>
                <span className="badge">×{form.quantity || 0}</span>
                {mintFile && (
                  <span className="badge mint">
                    <FileText size={12} /> {mintFile.name}
                  </span>
                )}
              </div>
            </div>
          </aside>

          <div className="mint-fields">
            <section className="mint-block">
              <h3 className="mint-block-title">
                <Upload size={15} /> File nội dung (L2)
              </h3>
              <label className={`file-drop ${mintFile ? "has-file" : ""}`}>
                <input
                  type="file"
                  accept=".pdf,.epub,.txt,.doc,.docx,.mobi,application/pdf,application/epub+zip,text/plain"
                  onChange={(e) => setMintFile(e.target.files?.[0] || null)}
                />
                <Upload size={20} />
                <div>
                  {mintFile ? (
                    <>
                      <strong>{mintFile.name}</strong>
                      <div className="muted">
                        {formatBytes(mintFile.size)} · sẽ neo sha256 on-chain
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Kéo thả hoặc chọn file sách *</strong>
                      <div className="muted">PDF, EPUB, TXT… tối đa 25MB</div>
                    </>
                  )}
                </div>
                {mintFile && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setMintFile(null);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </section>

            <section className="mint-block">
              <h3 className="mint-block-title">
                <BookOpen size={15} /> Thông tin sách
              </h3>
              <div className="field-row">
                <div className="field">
                  <label>Tên sách *</label>
                  <input
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Số đỏ"
                  />
                </div>
                <div className="field">
                  <label>ISBN</label>
                  <input
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    placeholder="978-…"
                  />
                </div>
              </div>
              <div className="field">
                <label>Tác giả * (cách nhau bởi dấu phẩy)</label>
                <input
                  required
                  value={form.authors}
                  onChange={(e) => setForm({ ...form, authors: e.target.value })}
                  placeholder="Vũ Trọng Phụng, …"
                />
              </div>
              <div className="field">
                <label>Mô tả</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tóm tắt nội dung…"
                />
              </div>
              <div className="field">
                <label>Ảnh bìa (upload hoặc URL)</label>
                <label className={`file-drop compact ${mintCover ? "has-file" : ""}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={(e) => onMintCoverPick(e.target.files?.[0] || null)}
                  />
                  <Upload size={18} />
                  <div>
                    {mintCover ? (
                      <>
                        <strong>{mintCover.name}</strong>
                        <div className="muted">{formatBytes(mintCover.size)}</div>
                      </>
                    ) : (
                      <>
                        <strong>Chọn ảnh bìa</strong>
                        <div className="muted">JPG, PNG, WEBP… tối đa 5MB</div>
                      </>
                    )}
                  </div>
                  {mintCover && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onMintCoverPick(null);
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <input
                  style={{ marginTop: "0.55rem" }}
                  value={form.image}
                  onChange={(e) => {
                    if (mintCover) onMintCoverPick(null);
                    setForm({ ...form, image: e.target.value });
                  }}
                  placeholder="hoặc dán URL https://…"
                  disabled={Boolean(mintCover)}
                />
              </div>
            </section>

            <section className="mint-block">
              <h3 className="mint-block-title">
                <Tags size={15} /> Phân loại & NXB
              </h3>
              <div className="field category-cascade">
                <label>Danh mục 3 cấp *</label>
                <div className="field-row mint-cat-row">
                  <select
                    required
                    value={form.catL1}
                    onChange={(e) => setForm(applyCascade(form, 1, e.target.value))}
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
                    value={form.catL2}
                    disabled={!form.catL1}
                    onChange={(e) => setForm(applyCascade(form, 2, e.target.value))}
                  >
                    <option value="">Cấp 2</option>
                    {childrenOf(form.catL1).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={form.catL3}
                    disabled={!form.catL2}
                    onChange={(e) => setForm(applyCascade(form, 3, e.target.value))}
                  >
                    <option value="">Cấp 3</option>
                    {childrenOf(form.catL2).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Nhà xuất bản</label>
                  <select
                    value={form.publisherId}
                    onChange={(e) =>
                      setForm(applyPublisherSelect(form, e.target.value))
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
                  <label>Năm XB</label>
                  <input
                    value={form.publishYear}
                    onChange={(e) =>
                      setForm({ ...form, publishYear: e.target.value })
                    }
                    placeholder="2024"
                  />
                </div>
              </div>
            </section>

            <section className="mint-block">
              <h3 className="mint-block-title">
                <Sparkles size={15} /> Giá & phát hành
              </h3>
              <div className="field-row">
                <div className="field">
                  <label>Giá (ETH)</label>
                  <input
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.02"
                  />
                </div>
                <div className="field">
                  <label>Số lượng</label>
                  <input
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Trạng thái</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {CATALOG_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Mint tới ví</label>
                  <input
                    value={form.to}
                    onChange={(e) => setForm({ ...form, to: e.target.value })}
                    placeholder="Mặc định: deployer"
                    className="mono"
                  />
                </div>
              </div>
            </section>
          </div>

          <footer className="modal-foot mint-modal-foot">
            <p className="mint-foot-hint">
              <Hash size={13} /> File → Mongo · hash → metadataURI · mint NFT
            </p>
            <div className="mint-foot-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Huỷ
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy ||
                  !mintFile ||
                  !form.name?.trim() ||
                  !form.authors?.trim() ||
                  !form.categoryId
                }
                title={
                  !mintFile
                    ? "Cần chọn file sách"
                    : !form.categoryId
                      ? "Chọn đủ danh mục 3 cấp"
                      : undefined
                }
              >
                <Sparkles size={16} />
                {busy ? "Đang phát hành…" : "Mint + lưu L2"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
