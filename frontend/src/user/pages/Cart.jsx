import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2, Wallet } from "lucide-react";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";
import { useWallet } from "../../context/WalletContext";
import {
  buyBookSmart,
  buyBooksBatch,
  formatEth,
  refreshBooksAfterBuy,
} from "../../services/contract";
import BookCover from "../components/BookCover";
import "./cart.css";

export default function Cart() {
  const { items, removeItem, clear, count, setQuantity } = useCart();
  const { address, connect, ensureReady } = useWallet();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");

  const estimatedTotal = useMemo(() => {
    return items.reduce((s, it) => {
      const unit = it.price != null ? Number(it.price) : 0;
      return s + unit * (Number(it.quantity) || 1);
    }, 0);
  }, [items]);

  async function readyWallet() {
    if (ensureReady) return ensureReady();
    if (!address) return connect();
    return address;
  }

  /** Chuẩn bị đủ NFT forSale theo quantity, trả về danh sách bookId */
  async function resolveUnits(item) {
    const qty = Math.max(1, Number(item.quantity) || 1);
    if (item.marketListed) {
      if (qty > 1) {
        throw new Error(
          `«${item.name}» đang escrow marketplace — chỉ mua 1 bản (giảm số lượng về 1).`
        );
      }
      return [Number(item.bookId)];
    }
    const { data } = await api.post(`/books/${item.bookId}/prepare-checkout`, {
      quantity: qty,
    });
    const ids = (data.bookIds || []).map(Number);
    if (ids.length < qty) {
      throw new Error(
        `Chỉ chuẩn bị được ${ids.length}/${qty} bản «${item.name}» (hết tồn hoặc mint lỗi).`
      );
    }
    return ids.slice(0, qty);
  }

  async function checkoutOne(item) {
    setMsg("");
    try {
      await readyWallet();
      setBusyId(item.bookId);
      const ids = await resolveUnits(item);
      setMsg(
        ids.length > 1
          ? `Đang mua ${ids.length} bản · xác nhận MetaMask…`
          : "Đang gửi giao dịch MetaMask…"
      );
      if (item.marketListed) {
        await buyBookSmart(ids[0]);
      } else {
        await buyBooksBatch(ids);
      }
      await refreshBooksAfterBuy(ids);
      removeItem(item.bookId);
      setMsg(
        `Đã mua ${ids.length} bản «${item.name}» · mở Sách của tôi để đọc/tải`
      );
    } catch (e) {
      setMsg(e.response?.data?.message || e.message || "Mua thất bại");
    } finally {
      setBusyId(null);
    }
  }

  async function checkoutAll() {
    if (!items.length) return;
    setMsg("");
    const cartSnapshot = [...items];
    const boughtLineIds = [];
    const allBoughtBookIds = [];
    try {
      await readyWallet();
      setBusyId("all");

      const primaryPairs = []; // { lineBookId, ids }
      const marketItems = [];

      for (const item of cartSnapshot) {
        if (item.marketListed) {
          marketItems.push(item);
          continue;
        }
        setMsg(`Chuẩn bị NFT «${item.name}»…`);
        const ids = await resolveUnits(item);
        primaryPairs.push({ lineBookId: item.bookId, ids });
      }

      const primaryIds = primaryPairs.flatMap((p) => p.ids);
      if (primaryIds.length) {
        setMsg(
          primaryIds.length > 20
            ? `Đang mua ${primaryIds.length} bản (chia nhiều giao dịch MetaMask)…`
            : `Đang mua ${primaryIds.length} bản sơ cấp…`
        );
        await buyBooksBatch(primaryIds);
        allBoughtBookIds.push(...primaryIds);
        for (const p of primaryPairs) boughtLineIds.push(p.lineBookId);
      }

      for (const item of marketItems) {
        setMsg(`Đang mua marketplace #${item.bookId}…`);
        await buyBookSmart(item.bookId);
        allBoughtBookIds.push(Number(item.bookId));
        boughtLineIds.push(item.bookId);
      }

      await refreshBooksAfterBuy(allBoughtBookIds);
      if (boughtLineIds.length >= cartSnapshot.length) clear();
      else for (const id of boughtLineIds) removeItem(id);
      setMsg("Đã thanh toán giỏ hàng. Vào Sách của tôi để đọc toàn bộ / tải file.");
      navigate("/my-books");
    } catch (e) {
      for (const id of boughtLineIds) removeItem(id);
      if (allBoughtBookIds.length) {
        await refreshBooksAfterBuy(allBoughtBookIds).catch(() => {});
      }
      setMsg(
        (boughtLineIds.length
          ? `Đã mua ${boughtLineIds.length} dòng; phần còn lại lỗi: `
          : "") + (e.response?.data?.message || e.message || "Thanh toán giỏ hàng bị dừng")
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!count) {
    return (
      <div className="container cart-page">
        <div className="panel cart-empty">
          <span className="cart-empty-ico" aria-hidden="true">
            <ShoppingCart size={28} />
          </span>
          <h2>Giỏ hàng trống</h2>
          <p className="muted">
            Thêm sách từ sàn — có thể chọn số lượng nhiều bản cùng tựa (trong hạn tồn kho).
          </p>
          <Link className="btn btn-primary" to="/">
            Duyệt sàn sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <header className="cart-head">
        <div>
          <h2>Giỏ hàng</h2>
          <p className="muted">
            {count} bản · {items.length} dòng · ước tính ~{estimatedTotal.toFixed(4)} ETH
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={clear}>
          Xóa hết
        </button>
      </header>

      {msg && (
        <p className={/Đã mua|Đã thanh|Đang/i.test(msg) ? "ok-msg" : "err-msg"}>
          {msg}
        </p>
      )}

      <div className="cart-list">
        {items.map((item) => {
          const qty = Number(item.quantity) || 1;
          const max =
            item.stockQuantity != null && item.stockQuantity > 0
              ? Math.min(20, item.stockQuantity)
              : 20;
          return (
            <article key={item.bookId} className="cart-row panel">
              <Link to={`/books/${item.bookId}`} className="cart-cover">
                <BookCover book={item} showTitle={false} ratio="portrait" />
              </Link>
              <div className="cart-info">
                <Link to={`/books/${item.bookId}`} className="cart-title">
                  {item.name}
                </Link>
                <p className="muted">{item.authors || "—"}</p>
                <p className="cart-price">
                  {item.price != null
                    ? `${item.price} ETH / bản`
                    : item.priceWei
                      ? `${formatEth(item.priceWei)} / bản`
                      : "Xem giá trên chain"}
                  {qty > 1 && item.price != null ? (
                    <span className="muted"> · tạm tính {(item.price * qty).toFixed(4)} ETH</span>
                  ) : null}
                </p>

                <div className="cart-qty" aria-label="Số lượng">
                  <button
                    type="button"
                    className="cart-qty-btn"
                    disabled={busyId != null || qty <= 1}
                    onClick={() => setQuantity(item.bookId, qty - 1)}
                    aria-label="Giảm"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    className="cart-qty-input"
                    type="number"
                    min={1}
                    max={max}
                    value={qty}
                    disabled={busyId != null}
                    onChange={(e) => setQuantity(item.bookId, e.target.value)}
                  />
                  <button
                    type="button"
                    className="cart-qty-btn"
                    disabled={busyId != null || qty >= max}
                    onClick={() => setQuantity(item.bookId, qty + 1)}
                    aria-label="Tăng"
                  >
                    <Plus size={14} />
                  </button>
                  <span className="muted tiny">tối đa {max}</span>
                </div>

                <div className="cart-row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId != null}
                    onClick={() => checkoutOne(item)}
                  >
                    <Wallet size={15} />
                    {busyId === item.bookId
                      ? "Đang mua…"
                      : qty > 1
                        ? `Mua ${qty} bản`
                        : "Mua sách này"}
                  </button>
                  <Link className="btn btn-ghost" to={`/books/${item.bookId}`}>
                    Chi tiết
                  </Link>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId != null}
                    onClick={() => removeItem(item.bookId)}
                    title="Xóa khỏi giỏ"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="cart-foot panel">
        <div>
          <strong>Thanh toán giỏ hàng</strong>
          <p className="muted">
            Sơ cấp: một giao dịch MetaMask cho cả giỏ (buyBooks). Marketplace: từng sách một lần.
            Hệ thống tự mint thêm bản nếu còn tồn kho.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busyId != null}
          onClick={checkoutAll}
        >
          {busyId != null ? "Đang xử lý…" : `Mua tất cả (${count} bản)`}
        </button>
      </footer>
    </div>
  );
}
