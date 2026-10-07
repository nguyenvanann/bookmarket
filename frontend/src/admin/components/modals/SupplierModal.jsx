import { useAdmin } from "../../AdminContext";
import {
  Truck,
  X,
} from "lucide-react";
import { SUPPLIER_STATUSES } from "../../constants";

export default function SupplierModal() {
  const {
    suppliers,
    busy,
    form,
    modal,
    supplierForm,
    setSupplierForm,
    editingSupplierId,
    closeModal,
    saveSupplier,
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
        className="modal-sheet edit-modal supplier-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">suppliers</p>
            <h2 id="supplier-modal-title">
              {editingSupplierId ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
            </h2>
            <p className="muted">Thông tin đối tác phân phối sách</p>
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
        <form onSubmit={saveSupplier} className="modal-body">
          <div className="field">
            <label>Tên nhà cung cấp *</label>
            <input
              required
              autoFocus
              value={supplierForm.name}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, name: e.target.value })
              }
              placeholder="VD: Công ty CP Sách FAHASA"
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Người liên hệ</label>
              <input
                value={supplierForm.contactPerson}
                onChange={(e) =>
                  setSupplierForm({
                    ...supplierForm,
                    contactPerson: e.target.value,
                  })
                }
                placeholder="Họ tên"
              />
            </div>
            <div className="field">
              <label>Trạng thái</label>
              <select
                value={supplierForm.status}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, status: e.target.value })
                }
              >
                {SUPPLIER_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Điện thoại</label>
              <input
                value={supplierForm.phone}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, phone: e.target.value })
                }
                placeholder="0xxx…"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, email: e.target.value })
                }
                placeholder="ncc@email.com"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Mã số thuế</label>
              <input
                value={supplierForm.taxCode}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, taxCode: e.target.value })
                }
                placeholder="0100…"
                className="mono"
              />
            </div>
            <div className="field">
              <label>Website</label>
              <input
                value={supplierForm.website}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, website: e.target.value })
                }
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="field">
            <label>Địa chỉ</label>
            <textarea
              rows={2}
              value={supplierForm.address}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, address: e.target.value })
              }
              placeholder="Địa chỉ kho / văn phòng…"
            />
          </div>
          <div className="field">
            <label>Ghi chú</label>
            <textarea
              rows={2}
              value={supplierForm.note}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, note: e.target.value })
              }
              placeholder="Phạm vi hợp tác, điều khoản ngắn…"
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
              <Truck size={16} />
              {busy
                ? "Đang lưu…"
                : editingSupplierId
                  ? "Cập nhật NCC"
                  : "Thêm NCC"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
