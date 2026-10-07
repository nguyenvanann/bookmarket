import { useAdmin } from "../../AdminContext";
import { X } from "lucide-react";
import { ROLES } from "../../roles";

export default function UserModal() {
  const {
    busy,
    userForm,
    setUserForm,
    editingUserId,
    closeModal,
    saveUser,
  } = useAdmin();
  const isEdit = Boolean(editingUserId);

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
        aria-labelledby="user-modal-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">users</p>
            <h2 id="user-modal-title">
              {isEdit ? "Sửa tài khoản" : "Thêm tài khoản"}
            </h2>
            <p className="muted">
              {isEdit
                ? "Cập nhật thông tin và phân quyền"
                : "Tạo tài khoản mới với mật khẩu đăng nhập"}
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

        <form onSubmit={saveUser} className="modal-body">
          <div className="field-row">
            <div className="field">
              <label>Tên *</label>
              <input
                required
                autoFocus
                value={userForm.name}
                onChange={(e) =>
                  setUserForm({ ...userForm, name: e.target.value })
                }
                placeholder="Họ tên"
              />
            </div>
            <div className="field">
              <label>Role *</label>
              <select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Email *</label>
            <input
              required
              type="email"
              value={userForm.email}
              onChange={(e) =>
                setUserForm({ ...userForm, email: e.target.value })
              }
              placeholder="email@example.com"
            />
          </div>

          <div className="field">
            <label>Wallet (tuỳ chọn)</label>
            <input
              className="mono"
              value={userForm.walletAddress}
              onChange={(e) =>
                setUserForm({ ...userForm, walletAddress: e.target.value })
              }
              placeholder="0x…"
            />
          </div>

          {!isEdit && (
            <div className="field-row">
              <div className="field">
                <label>Mật khẩu *</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={userForm.password}
                  onChange={(e) =>
                    setUserForm({ ...userForm, password: e.target.value })
                  }
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label>Xác nhận mật khẩu *</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={userForm.passwordConfirm}
                  onChange={(e) =>
                    setUserForm({
                      ...userForm,
                      passwordConfirm: e.target.value,
                    })
                  }
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

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
              {isEdit ? "Lưu thay đổi" : "Tạo tài khoản"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
