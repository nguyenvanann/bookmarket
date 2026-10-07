import { useAdmin } from "../../AdminContext";
import { X } from "lucide-react";

export default function UserPasswordModal() {
  const {
    busy,
    passwordForm,
    setPasswordForm,
    passwordUser,
    closeModal,
    saveUserPassword,
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
        aria-labelledby="user-password-modal-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">password</p>
            <h2 id="user-password-modal-title">Đổi mật khẩu</h2>
            <p className="muted">
              {passwordUser?.name || passwordUser?.email
                ? `${passwordUser?.name || ""} · ${passwordUser?.email || ""}`
                : "Đặt mật khẩu mới cho tài khoản"}
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

        <form onSubmit={saveUserPassword} className="modal-body">
          <div className="field">
            <label>Mật khẩu mới *</label>
            <input
              required
              type="password"
              minLength={6}
              autoFocus
              value={passwordForm.password}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, password: e.target.value })
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
              value={passwordForm.passwordConfirm}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  passwordConfirm: e.target.value,
                })
              }
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
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
              Cập nhật mật khẩu
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
