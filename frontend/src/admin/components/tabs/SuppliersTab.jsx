import { useAdmin } from "../../AdminContext";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserRound,
} from "lucide-react";
import { SUPPLIER_STATUSES, supplierInitials } from "../../constants";

export default function SuppliersTab() {
  const {
    dash,
    suppliers,
    busy,
    supplierQ,
    setSupplierQ,
    supplierFilter,
    setSupplierFilter,
    suppliersLoaded,
    suppliersLoading,
    flash,
    beginBusy,
    endBusy,
    loadSuppliers,
    openSupplierModal,
    removeSupplier,
    filteredSuppliers,
  } = useAdmin();

  return (
    <section className="catalog supplier-section">
      <div className="catalog-hero">
        <div>
          <h2>Nhà cung cấp</h2>
          <p className="muted">
            Đối tác phân phối sách — liên hệ, mã số thuế, ghi chú hợp tác.
          </p>
        </div>
        <div className="catalog-hero-actions">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={suppliersLoading}
            onClick={async () => {
              beginBusy("Đang tải nhà cung cấp…");
              try {
                await loadSuppliers();
                flash("Đã tải danh sách NCC");
              } catch (e) {
                flash(e.message, "err");
              } finally {
                endBusy();
              }
            }}
            title="Làm mới danh sách"
          >
            <RefreshCw size={16} className={suppliersLoading ? "spin" : undefined} />
            Làm mới
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openSupplierModal()}
          >
            <Plus size={16} /> Thêm NCC
          </button>
        </div>
      </div>

      <div className="catalog-stats supplier-stats">
        <div className="catalog-stat">
          <strong>{suppliersLoaded ? suppliers.length : "…"}</strong>
          <span>Tổng NCC</span>
        </div>
        <div className="catalog-stat">
          <strong>
            {suppliersLoaded
              ? suppliers.filter((s) => s.status === "active").length
              : (dash?.stats?.suppliers ?? "…")}
          </strong>
          <span>Đang hợp tác</span>
        </div>
        <div className="catalog-stat">
          <strong>
            {suppliersLoaded
              ? suppliers.filter((s) => s.status === "inactive").length
              : "…"}
          </strong>
          <span>Ngừng</span>
        </div>
        <div className="catalog-stat">
          <strong>{suppliersLoaded ? filteredSuppliers.length : "…"}</strong>
          <span>Đang hiện</span>
        </div>
      </div>

      <div className="supplier-filters">
        <label className="search-field supplier-search">
          <Search size={16} />
          <input
            placeholder="Tìm tên, người liên hệ, SĐT, email, MST…"
            value={supplierQ}
            onChange={(e) => setSupplierQ(e.target.value)}
          />
        </label>
        <div className="supplier-chips" role="group" aria-label="Lọc trạng thái">
          <button
            type="button"
            className={`supplier-chip${supplierFilter === "all" ? " active" : ""}`}
            onClick={() => setSupplierFilter("all")}
          >
            Tất cả
          </button>
          {SUPPLIER_STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`supplier-chip ${s.id}${
                supplierFilter === s.id ? " active" : ""
              }`}
              onClick={() => setSupplierFilter(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {suppliersLoading && !suppliersLoaded ? (
        <div className="panel supplier-loading">
          <RefreshCw size={22} className="spin" />
          <p>Đang tải nhà cung cấp…</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="empty catalog-empty panel">
          <Truck size={28} />
          <p>
            {suppliersLoaded
              ? "Không có NCC khớp bộ lọc"
              : "Chưa tải được danh sách NCC"}
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => openSupplierModal()}
          >
            <Plus size={16} /> Thêm NCC
          </button>
        </div>
      ) : (
        <div className="supplier-grid">
          {[...filteredSuppliers]
            .sort(
              (a, b) =>
                (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
                a.name.localeCompare(b.name)
            )
            .map((s) => (
              <article
                key={s._id}
                className={`supplier-card${
                  s.status === "inactive" ? " is-inactive" : ""
                }`}
              >
                <header className="supplier-card-head">
                  <div className="supplier-avatar" aria-hidden="true">
                    {supplierInitials(s.name)}
                  </div>
                  <div className="supplier-card-title">
                    <strong>{s.name}</strong>
                    <span
                      className={`status-pill ${
                        s.status === "active" ? "available" : "inactive"
                      }`}
                    >
                      {SUPPLIER_STATUSES.find((x) => x.id === s.status)?.label ||
                        s.status}
                    </span>
                  </div>
                </header>

                <div className="supplier-card-body">
                  {s.contactPerson && (
                    <div className="supplier-line">
                      <UserRound size={14} />
                      <span>{s.contactPerson}</span>
                    </div>
                  )}
                  {s.phone && (
                    <div className="supplier-line">
                      <Phone size={14} />
                      <a href={`tel:${s.phone}`}>{s.phone}</a>
                    </div>
                  )}
                  {s.email && (
                    <div className="supplier-line">
                      <Mail size={14} />
                      <a href={`mailto:${s.email}`}>{s.email}</a>
                    </div>
                  )}
                  {s.address && (
                    <div className="supplier-line">
                      <MapPin size={14} />
                      <span>{s.address}</span>
                    </div>
                  )}
                  {s.taxCode && (
                    <div className="supplier-line muted">
                      <span className="mono">MST {s.taxCode}</span>
                    </div>
                  )}
                  {s.note && <p className="supplier-note">{s.note}</p>}
                </div>

                <footer className="supplier-card-foot">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => openSupplierModal(s)}
                  >
                    <Pencil size={14} /> Sửa
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => removeSupplier(s._id, s.name)}
                  >
                    <Trash2 size={14} /> Xóa
                  </button>
                </footer>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
