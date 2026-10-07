import { useAdmin } from "../../AdminContext";
import {
  Building2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { PUBLISHER_STATUSES } from "../../constants";

export default function PublishersTab() {
  const {
    books,
    publishers,
    busy,
    publisherQ,
    setPublisherQ,
    publisherFilter,
    setPublisherFilter,
    openPublisherModal,
    removePublisher,
    filteredPublishers,
  } = useAdmin();

  return (
    <section className="catalog">
      <div className="catalog-hero">
        <div>
          <h2>Nhà xuất bản</h2>
          <p className="muted">
            Quản lý NXB: name, code, liên hệ — dùng khi phát hành / sửa sách
          </p>
        </div>
        <div className="catalog-hero-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openPublisherModal()}
          >
            <Plus size={16} /> Thêm NXB
          </button>
        </div>
      </div>

      <div className="catalog-stats">
        <div className="catalog-stat">
          <strong>{publishers.length}</strong>
          <span>Tổng NXB</span>
        </div>
        <div className="catalog-stat">
          <strong>{publishers.filter((p) => p.status === "active").length}</strong>
          <span>Đang hoạt động</span>
        </div>
        <div className="catalog-stat">
          <strong>{publishers.filter((p) => p.status === "inactive").length}</strong>
          <span>Ngừng</span>
        </div>
        <div className="catalog-stat">
          <strong>{filteredPublishers.length}</strong>
          <span>Đang hiện</span>
        </div>
      </div>

      <div className="toolbar catalog-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Tìm tên, mã, email, website…"
            value={publisherQ}
            onChange={(e) => setPublisherQ(e.target.value)}
          />
        </label>
        <select
          value={publisherFilter}
          onChange={(e) => setPublisherFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          {PUBLISHER_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap panel catalog-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên NXB</th>
              <th>Mã</th>
              <th>Liên hệ</th>
              <th>Website</th>
              <th>Sách</th>
              <th>status</th>
              <th style={{ width: 160 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {[...filteredPublishers]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => {
                const bookCount = books.filter(
                  (b) =>
                    String(b.publisherId || "") === String(p._id) ||
                    (!b.publisherId && b.publisher === p.name)
                ).length;
                return (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description && (
                        <div className="muted tiny">{p.description}</div>
                      )}
                    </td>
                    <td className="mono">{p.code || "—"}</td>
                    <td>
                      <div>{p.phone || "—"}</div>
                      <div className="muted tiny">{p.email || ""}</div>
                    </td>
                    <td>
                      {p.website ? (
                        <a
                          href={
                            p.website.startsWith("http")
                              ? p.website
                              : `https://${p.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="mono"
                        >
                          {p.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{bookCount}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          p.status === "active" ? "available" : "inactive"
                        }`}
                      >
                        {PUBLISHER_STATUSES.find((x) => x.id === p.status)?.label ||
                          p.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openPublisherModal(p)}
                        >
                          <Pencil size={14} /> Sửa
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={busy}
                          onClick={() => removePublisher(p._id, p.name)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {filteredPublishers.length === 0 && (
          <div className="empty catalog-empty">
            <Building2 size={28} />
            <p>Chưa có nhà xuất bản</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openPublisherModal()}
            >
              <Plus size={16} /> Thêm NXB đầu tiên
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
