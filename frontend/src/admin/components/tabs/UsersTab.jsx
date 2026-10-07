import { useAdmin } from "../../AdminContext";
import {
  Droplets,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { shortAddr } from "../../utils";
import { ROLES, hasScope, roleLabel } from "../../roles";

export default function UsersTab() {
  const {
    users,
    busy,
    user,
    userQ,
    setUserQ,
    userRoleFilter,
    setUserRoleFilter,
    filteredUsers,
    openUserModal,
    openUserPasswordModal,
    removeUser,
    fundUserWallet,
  } = useAdmin();
  const canFaucet = hasScope(user?.role, "faucet");
  const selfId = String(user?.id || user?._id || "");
  const list = filteredUsers || users;

  return (
    <section className="catalog">
      <div className="catalog-hero">
        <div>
          <h2>Người dùng</h2>
          <p className="muted">
            CRUD tài khoản, phân quyền role và đặt lại mật khẩu đăng nhập
          </p>
        </div>
        <div className="catalog-hero-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openUserModal()}
          >
            <Plus size={16} /> Thêm user
          </button>
        </div>
      </div>

      <div className="catalog-stats">
        <div className="catalog-stat">
          <strong>{users.length}</strong>
          <span>Tổng tài khoản</span>
        </div>
        {ROLES.filter((r) => r.id !== "user").map((r) => (
          <div className="catalog-stat" key={r.id}>
            <strong>{users.filter((u) => u.role === r.id).length}</strong>
            <span>{r.label}</span>
          </div>
        ))}
        <div className="catalog-stat">
          <strong>{users.filter((u) => u.role === "user").length}</strong>
          <span>Người dùng</span>
        </div>
      </div>

      <div className="toolbar catalog-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Tìm tên, email, wallet, role…"
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
          />
        </label>
        <select
          value={userRoleFilter}
          onChange={(e) => setUserRoleFilter(e.target.value)}
        >
          <option value="all">Tất cả role</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap panel catalog-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Email</th>
              <th>Role</th>
              <th>Wallet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const uid = u.id || u._id;
              const isSelf = String(uid) === selfId;
              return (
                <tr key={uid}>
                  <td>
                    <div className="cell-title">
                      <Users size={14} aria-hidden="true" />
                      <span>
                        {u.name}
                        {isSelf ? (
                          <span className="muted"> · bạn</span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="badge">{roleLabel(u.role)}</span>
                  </td>
                  <td className="mono" title={u.walletAddress}>
                    {shortAddr(u.walletAddress) || "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => openUserModal(u)}
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => openUserPasswordModal(u)}
                        title="Đổi mật khẩu"
                      >
                        <KeyRound size={14} />
                      </button>
                      {canFaucet ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={busy || !u.walletAddress}
                          onClick={() => fundUserWallet(u.walletAddress)}
                          title="Cấp ETH"
                        >
                          <Droplets size={14} />
                        </button>
                      ) : null}
                      <button
                        className="btn btn-danger"
                        type="button"
                        disabled={busy || isSelf}
                        onClick={() => removeUser(uid, u.name || u.email)}
                        title={
                          isSelf
                            ? "Không thể xóa chính mình"
                            : "Xóa tài khoản"
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  Không có tài khoản phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
