import { PackagePlus, X } from "lucide-react";
import { useAdmin } from "../../AdminContext";
import { bookName, stockQty } from "../../utils";

export default function StockInModal() {
  const {
    busy,
    books,
    suppliers,
    stockInForm,
    setStockInForm,
    closeModal,
    submitStockIn,
  } = useAdmin();

  const selected = books.find((b) => String(b.bookId) === String(stockInForm.bookId));
  const activeSuppliers = (suppliers || []).filter((s) => s.status !== "inactive");

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="modal-sheet edit-modal stock-in-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-in-title"
      >
        <header className="modal-head">
          <div>
            <p className="modal-eyebrow">Kho hàng · phiếu nhập</p>
            <h2 id="stock-in-title">Nhập kho</h2>
            <p className="muted">Tăng tồn theo số lượng và ghi giá vốn nhập (ETH)</p>
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

        <form onSubmit={submitStockIn} className="modal-body">
          <div className="field">
            <label>Sách (SKU) *</label>
            <select
              required
              value={stockInForm.bookId}
              onChange={(e) => {
                const id = e.target.value;
                const b = books.find((x) => String(x.bookId) === id);
                setStockInForm({
                  ...stockInForm,
                  bookId: id,
                  unitPrice:
                    b?.costPrice > 0
                      ? String(b.costPrice)
                      : b?.price != null
                        ? String(b.price)
                        : stockInForm.unitPrice,
                });
              }}
            >
              <option value="">— Chọn sách —</option>
              {[...books]
                .sort((a, b) => b.bookId - a.bookId)
                .map((b) => (
                  <option key={b.bookId} value={b.bookId}>
                    #{b.bookId} · {bookName(b)} · tồn {stockQty(b)}
                  </option>
                ))}
            </select>
          </div>

          {selected && (
            <div className="stock-in-preview">
              <div>
                <span className="muted">Tồn hiện tại</span>
                <strong>{stockQty(selected)}</strong>
              </div>
              <div>
                <span className="muted">Giá bán</span>
                <strong className="mono">{selected.price ?? 0} ETH</strong>
              </div>
              <div>
                <span className="muted">Giá vốn gần nhất</span>
                <strong className="mono">{selected.costPrice ?? 0} ETH</strong>
              </div>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Số lượng nhập *</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={stockInForm.quantity}
                onChange={(e) =>
                  setStockInForm({ ...stockInForm, quantity: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Giá nhập / đơn vị (ETH) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.0001"
                value={stockInForm.unitPrice}
                onChange={(e) =>
                  setStockInForm({ ...stockInForm, unitPrice: e.target.value })
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Nhà cung cấp (tuỳ chọn)</label>
            <select
              value={stockInForm.supplierId}
              onChange={(e) =>
                setStockInForm({ ...stockInForm, supplierId: e.target.value })
              }
            >
              <option value="">— Không chọn —</option>
              {activeSuppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ghi chú</label>
            <textarea
              rows={2}
              value={stockInForm.note}
              onChange={(e) => setStockInForm({ ...stockInForm, note: e.target.value })}
              placeholder="Lô nhập, hợp đồng, chứng từ…"
            />
          </div>

          <footer className="modal-foot">
            <button className="btn btn-ghost" type="button" onClick={closeModal} disabled={busy}>
              Huỷ
            </button>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              <PackagePlus size={16} />
              {busy ? "Đang nhập…" : "Xác nhận nhập kho"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
