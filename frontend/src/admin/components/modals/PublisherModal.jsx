import { useAdmin } from "../../AdminContext";
import {
  Building2,
  X,
} from "lucide-react";
import { PUBLISHER_STATUSES } from "../../constants";

export default function PublisherModal() {
  const {
    publishers,
    busy,
    form,
    modal,
    publisherForm,
    setPublisherForm,
    editingPublisherId,
    closeModal,
    savePublisher,
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
        aria-labelledby="publisher-modal-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">publishers</p>
            <h2 id="publisher-modal-title">
              {editingPublisherId ? "Sửa nhà xuất bản" : "Thêm nhà xuất bản"}
            </h2>
            <p className="muted">name · code · liên hệ · website · status</p>
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
        <form onSubmit={savePublisher} className="modal-body">
          <div className="field">
            <label>Tên NXB *</label>
            <input
              required
              autoFocus
              value={publisherForm.name}
              onChange={(e) =>
                setPublisherForm({ ...publisherForm, name: e.target.value })
              }
              placeholder="VD: NXB Kim Đồng"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Mã (tuỳ chọn)</label>
              <input
                value={publisherForm.code}
                onChange={(e) =>
                  setPublisherForm({ ...publisherForm, code: e.target.value })
                }
                placeholder="KD"
                className="mono"
              />
            </div>
            <div className="field">
              <label>status</label>
              <select
                value={publisherForm.status}
                onChange={(e) =>
                  setPublisherForm({ ...publisherForm, status: e.target.value })
                }
              >
                {PUBLISHER_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>phone</label>
              <input
                value={publisherForm.phone}
                onChange={(e) =>
                  setPublisherForm({ ...publisherForm, phone: e.target.value })
                }
                placeholder="0xxx…"
              />
            </div>
            <div className="field">
              <label>email</label>
              <input
                type="email"
                value={publisherForm.email}
                onChange={(e) =>
                  setPublisherForm({ ...publisherForm, email: e.target.value })
                }
                placeholder="nxb@email.com"
              />
            </div>
          </div>
          <div className="field">
            <label>website</label>
            <input
              value={publisherForm.website}
              onChange={(e) =>
                setPublisherForm({ ...publisherForm, website: e.target.value })
              }
              placeholder="https://…"
            />
          </div>
          <div className="field">
            <label>address</label>
            <textarea
              rows={2}
              value={publisherForm.address}
              onChange={(e) =>
                setPublisherForm({ ...publisherForm, address: e.target.value })
              }
              placeholder="Địa chỉ…"
            />
          </div>
          <div className="field">
            <label>description</label>
            <textarea
              rows={2}
              value={publisherForm.description}
              onChange={(e) =>
                setPublisherForm({ ...publisherForm, description: e.target.value })
              }
              placeholder="Mô tả ngắn…"
            />
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
              <Building2 size={16} />
              {busy
                ? "Đang lưu…"
                : editingPublisherId
                  ? "Cập nhật NXB"
                  : "Thêm NXB"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
