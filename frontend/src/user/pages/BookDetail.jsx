import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Download, Eye, Minus, Plus, ShoppingCart } from "lucide-react";
import api from "../../services/api";
import {
  buyBooksBatch,
  buyFromMarket,
  cancelMarketListing,
  formatEth,
  getWalletBalance,
  listOnMarket,
  listPrimary,
  quoteBook,
  refreshBooksAfterBuy,
} from "../../services/contract";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWallet } from "../../context/WalletContext";
import BookCover from "../components/BookCover";
import { bookAuthors, bookCategory, bookName } from "../utils/book";
import "./detail.css";

export default function BookDetail() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user, linkWallet } = useAuth();
  const { address, connect, ensureReady, wrongNetwork } = useWallet();
  const { addItem, has: inCart, getQuantity } = useCart();
  const [book, setBook] = useState(null);
  const [chain, setChain] = useState([]);
  const [quote, setQuote] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyQty, setBuyQty] = useState(1);
  const [availability, setAvailability] = useState(null);
  const [resalePrice, setResalePrice] = useState("0.03");
  const [primaryPrice, setPrimaryPrice] = useState("0.02");
  const [balance, setBalance] = useState(null);

  const load = useCallback(async () => {
    await api.post(`/books/${bookId}/refresh`).catch(() => {});
    const { data } = await api.get(`/books/${bookId}`);
    setBook(data.book);
    setChain(data.chain || []);
    if (data.book?.listedPriceWei && data.book.listedPriceWei !== "0") {
      try {
        setPrimaryPrice(formatEth(data.book.listedPriceWei).replace(" ETH", ""));
      } catch {
        /* ignore */
      }
    }
  }, [bookId]);

  const loadQuote = useCallback(async () => {
    if (!address) {
      setQuote(null);
      return;
    }
    try {
      const q = await quoteBook(bookId);
      setQuote(q);
    } catch {
      setQuote(null);
    }
  }, [address, bookId]);

  const loadAvailability = useCallback(async () => {
    try {
      const { data } = await api.get(`/books/${bookId}/availability`);
      setAvailability(data);
      const max = Math.max(1, Number(data.maxCheckout) || 1);
      setBuyQty((q) => Math.min(q, max));
    } catch {
      setAvailability(null);
    }
  }, [bookId]);

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [load]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }
    getWalletBalance(address)
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [address, msg]);

  async function ensureWallet() {
    // Luôn ép MetaMask sang chain 54321 trước khi ký (kể cả đã có address)
    if (ensureReady) return ensureReady();
    return address ? address : connect();
  }

  async function onFaucet() {
    setBusy(true);
    setMsg("");
    try {
      const addr = await ensureWallet();
      const { data } = await api.post("/wallet/faucet", { address: addr });
      if (data.skipped) {
        setMsg(data.message || `Ví đã có ${data.balanceEth || "?"} ETH — đủ để mua.`);
      } else {
        setMsg(
          `Đã nhận ${data.amountEth || "1"} ETH faucet · tx ${String(data.txHash || "").slice(0, 12)}…`
        );
      }
      const bal = await getWalletBalance(addr);
      setBalance(bal);
    } catch (e) {
      setMsg(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onBuy() {
    setBusy(true);
    setMsg("");
    let boughtIds = [Number(bookId)];
    let receipt;
    let phase = "Kết nối ví";
    try {
      const addr = await ensureWallet();
      // Luôn quote lại sau khi đúng mạng — tránh nhầm primary vs marketplace
      phase = "Đọc trạng thái sách trên blockchain";
      let liveQuote = null;
      try {
        liveQuote = await quoteBook(bookId);
        setQuote(liveQuote);
      } catch {
        liveQuote = null;
      }
      const qty = Math.max(1, Math.min(20, Number(buyQty) || 1));
      if (liveQuote?.marketListed) {
        if (qty > 1) throw new Error("Listing marketplace chỉ mua 1 bản mỗi lần.");
        phase = "Gửi giao dịch và chờ MetaMask xác nhận";
        receipt = await buyFromMarket(bookId);
      } else {
        setMsg(qty > 1 ? `Đang chuẩn bị ${qty} bản NFT…` : "Đang chuẩn bị giao dịch…");
        phase = "Chuẩn bị sách qua backend";
        const { data } = await api.post(`/books/${bookId}/prepare-checkout`, {
          quantity: qty,
        });
        boughtIds = (data.bookIds || []).map(Number);
        if (!boughtIds.length) throw new Error("Không còn bản nào để bán.");
        setMsg(
          boughtIds.length > 1
            ? `Mua ${boughtIds.length} bản trong một giao dịch MetaMask…`
            : "Đang gửi giao dịch MetaMask…"
        );
        phase = "Gửi giao dịch và chờ MetaMask xác nhận";
        receipt = await buyBooksBatch(boughtIds);
      }
      phase = "Đồng bộ dữ liệu sau giao dịch";
      setMsg(
        `Mua thành công${boughtIds.length > 1 ? ` (${boughtIds.length} bản)` : ""} · ${String(receipt.hash || "").slice(0, 18)}… — đang đồng bộ…`
      );
      await refreshBooksAfterBuy(boughtIds);
      await load();
      await loadQuote();
      await loadAvailability();
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const { data } = await api.get(`/sales/by-book/${boughtIds[0]}`, {
            params: { wallet: addr },
          });
          if (data.sale?.invoiceNumber) {
            setMsg(
              `Mua thành công · HĐ ${data.sale.invoiceNumber} · mở Sách của tôi để đọc toàn bộ`
            );
            break;
          }
        } catch {
          /* chưa có HĐ */
        }
      }
    } catch (e) {
      if (receipt) {
        const txHash = String(receipt.hash || "").slice(0, 18);
        setMsg(
          `Mua thành công · ${txHash}… · Đồng bộ dữ liệu chưa hoàn tất. Tải lại trang sau ít phút.`
        );
      } else {
        const detail = e.response?.data?.message || e.message;
        setMsg(`${phase}: ${detail}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onListMarket() {
    setBusy(true);
    setMsg("");
    try {
      await ensureWallet();
      const receipt = await listOnMarket(bookId, resalePrice);
      setMsg(`Đã treo marketplace · ${receipt.hash.slice(0, 18)}…`);
      await load();
      await loadQuote();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onListPrimary() {
    setBusy(true);
    setMsg("");
    try {
      await ensureWallet();
      const receipt = await listPrimary(bookId, primaryPrice);
      setMsg(`Đã mở bán sơ cấp · ${receipt.hash.slice(0, 18)}…`);
      await load();
      await loadQuote();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    setMsg("");
    try {
      await ensureWallet();
      const receipt = await cancelMarketListing(bookId);
      setMsg(`Đã hủy listing · ${receipt.hash.slice(0, 18)}…`);
      await load();
      await loadQuote();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!book) return <div className="container muted">Đang tải sách…</div>;

  /** quote ưu tiên; chưa có ví thì tin Mongo marketListed */
  const thisOnMarket =
    quote != null ? Boolean(quote.marketListed) : Boolean(book.marketListed);
  const editionStock =
    availability?.stockQuantity != null
      ? Number(availability.stockQuantity)
      : book.quantity != null
        ? Number(book.quantity)
        : 0;
  const forSale =
    Boolean(book.forSale) ||
    Boolean(quote?.forSale) ||
    Number(book.sellableCount) > 0 ||
    Number(availability?.sellableCount) > 0 ||
    editionStock > 0;
  const onSale = thisOnMarket || forSale || Boolean(book.marketListed);
  const priceWei = thisOnMarket
    ? quote?.priceWei != null
      ? quote.priceWei
      : book.marketPriceWei
    : quote?.forSale && quote?.priceWei
      ? quote.priceWei
      : book.listedPriceWei && String(book.listedPriceWei) !== "0"
        ? book.listedPriceWei
        : forSale
          ? "10000000000000000"
          : quote?.priceWei ?? book.listedPriceWei;
  const ownerWallet = (quote?.owner || book.ownerWallet || "").toLowerCase();
  const isOwner = address && ownerWallet && address.toLowerCase() === ownerWallet;
  const isSeller =
    address &&
    thisOnMarket &&
    quote?.seller &&
    address.toLowerCase() === quote.seller;
  const hasFile = Boolean(book.hasFile || book.contentHash);
  const sampleAvailable =
    book.sampleAvailable ??
    (hasFile &&
      (/pdf/i.test(book.mimeType || "") || /\.pdf$/i.test(book.fileName || "")));
  /** Đã mua / đang giữ NFT (bản đang xem) */
  const purchased = Boolean(isOwner);
  const maxBuyQty = Math.max(
    1,
    Math.min(20, Number(availability?.maxCheckout) || editionStock || 20)
  );
  /** Marketplace: mua đúng listing. Primary: còn tồn → prepare-checkout (kể cả đã owned) */
  const showBuyMarket = thisOnMarket && !isOwner && !isSeller;
  const showBuyPrimary = !thisOnMarket && !isSeller && editionStock > 0;
  const showBuy = showBuyMarket || showBuyPrimary;
  /** Hiện nút tải khi có file — chưa mua sẽ chuyển giỏ hàng */
  const showDownload = hasFile;

  function addToCartAndGo(reason = "") {
    const qty = Math.max(1, Math.min(20, Number(buyQty) || 1));
    addItem(
      {
        ...book,
        marketListed: thisOnMarket,
        forSale: showBuyPrimary || forSale,
        marketPriceWei: book.marketPriceWei,
        listedPriceWei: priceWei,
        quantity: editionStock > 0 ? editionStock : book.quantity,
      },
      qty
    );
    if (reason) setMsg(reason);
    navigate("/cart");
  }

  async function onDownloadFile() {
    // Chưa mua → thêm giỏ hàng + chuyển trang giỏ
    if (!purchased) {
      addToCartAndGo(
        "Chưa mua sách — đã thêm vào giỏ hàng. Mua xong mới tải được file đầy đủ."
      );
      return;
    }
    if (!user) {
      setMsg("Đăng nhập và liên kết ví để tải file sách đã mua");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      if (
        address &&
        (!user.walletAddress ||
          user.walletAddress.toLowerCase() !== address.toLowerCase())
      ) {
        try {
          await linkWallet(address);
        } catch {
          /* ví có thể đã gắn tài khoản khác */
        }
      }
      const { data, headers } = await api.get(`/books/${bookId}/file`, {
        responseType: "blob",
      });
      const blob = new Blob([data], {
        type: headers["content-type"] || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = book.fileName || `book-${bookId}`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Đã tải file sách đầy đủ");
    } catch (e) {
      let message = e.message;
      if (e.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await e.response.data.text())?.message || message;
        } catch {
          /* ignore */
        }
      } else {
        message = e.response?.data?.message || message;
      }
      if (e.response?.status === 403) {
        addToCartAndGo("Chưa được phép tải — đã chuyển sang giỏ hàng để mua.");
        return;
      }
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  function onAddToCart() {
    const qty = Math.max(1, Math.min(maxBuyQty, Number(buyQty) || 1));
    const r = addItem(
      {
        ...book,
        marketListed: thisOnMarket,
        forSale: showBuyPrimary || forSale,
        listedPriceWei: priceWei,
        quantity: editionStock > 0 ? editionStock : book.quantity,
      },
      qty
    );
    const inQty = getQuantity?.(book.bookId) || qty;
    setMsg(
      r.added
        ? `Đã thêm ${qty} bản vào giỏ (tổng dòng: ${inQty})`
        : `Giỏ đã có tối đa cho sách này (${inQty} bản)`
    );
  }

  const title = bookName(book);
  const authors = bookAuthors(book);
  const category = bookCategory(book);

  return (
    <div className="container detail">
      <div className="detail-hero panel">
        <BookCover
          book={book}
          className="detail-cover"
          showTitle={false}
          showId
          ratio="portrait"
        />
        <div className="detail-meta">
          <p className="detail-eyebrow">
            Đầu sách
            {book.isbn ? ` · ISBN ${book.isbn}` : ""}
            {Number(book.chainCount) > 0
              ? ` · ${book.chainCount} bản trên chain`
              : ""}
          </p>
          <h1 className="detail-title">{title}</h1>
          {authors ? <p className="detail-authors">{authors}</p> : null}
          <div className="detail-badges">
            <span className="badge">{category || "Tiểu thuyết"}</span>
            {book.status && <span className="badge sale">{book.status}</span>}
            {book.isbn && <span className="badge">ISBN {book.isbn}</span>}
            {Number(book.sellableCount) > 0 && (
              <span className="badge sale">
                {book.sellableCount} NFT đang bán
              </span>
            )}
          </div>
          <p className="muted detail-desc">
            {book.description || "Bản sách NFT trên BookMarket."}
          </p>
          <p className="muted detail-submeta">
            {book.publisher ? `NXB: ${book.publisher}` : "NXB: —"}
            {book.publishYear ? ` · ${book.publishYear}` : ""}
            {editionStock > 0 ? ` · Tồn kho: ${editionStock}` : ""}
            {Array.isArray(book.chainBookIds) && book.chainBookIds.length > 0
              ? ` · NFT #${book.chainBookIds.join(", #")}`
              : ` · NFT #${book.bookId}`}
          </p>
          {hasFile && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              File L2: <strong>{book.fileName || "ebook"}</strong>
              {book.fileSize ? ` · ${(book.fileSize / 1024).toFixed(1)} KB` : ""}
              <br />
              On-chain: <code>{book.metadataURI || `sha256:${book.contentHash}`}</code>
            </p>
          )}
          <p>
            Chủ sở hữu:{" "}
            <code>{ownerWallet ? `${ownerWallet.slice(0, 10)}…` : "—"}</code>
            {thisOnMarket && <span className="badge sale"> marketplace escrow</span>}
          </p>
          <p className="price">
            {onSale
              ? Number(book.price) > 0
                ? `${book.price} ETH`
                : formatEth(priceWei)
              : "Không mở bán"}
          </p>
          {address && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Số dư ví: {balance != null ? formatEth(balance) : "…"}{" "}
              <button className="btn btn-ghost" style={{ padding: "0.35rem 0.7rem" }} disabled={busy} onClick={onFaucet}>
                Nhận ETH faucet
              </button>
            </p>
          )}
          {!address && (
            <button className="btn btn-ghost" disabled={busy} onClick={connect}>
              Kết nối MetaMask để mua/bán
            </button>
          )}

          {showBuy && (
            <div className="detail-qty" aria-label="Số lượng mua">
              <button
                type="button"
                className="detail-qty-btn"
                disabled={busy || buyQty <= 1 || showBuyMarket}
                onClick={() => setBuyQty((q) => Math.max(1, q - 1))}
                aria-label="Giảm"
              >
                <Minus size={14} />
              </button>
              <input
                className="detail-qty-input"
                type="number"
                min={1}
                max={maxBuyQty}
                disabled={busy || showBuyMarket}
                value={buyQty}
                onChange={(e) => {
                  setBuyQty(
                    Math.max(1, Math.min(maxBuyQty, Number(e.target.value) || 1))
                  );
                }}
              />
              <button
                type="button"
                className="detail-qty-btn"
                disabled={busy || showBuyMarket || buyQty >= maxBuyQty}
                onClick={() =>
                  setBuyQty((q) => Math.min(maxBuyQty, q + 1))
                }
                aria-label="Tăng"
              >
                <Plus size={14} />
              </button>
              {showBuyMarket ? (
                <span className="muted detail-qty-hint">Marketplace: 1 bản</span>
              ) : editionStock > 0 ? (
                <span className="muted detail-qty-hint">
                  Còn {editionStock} bản ấn bản
                </span>
              ) : null}
            </div>
          )}

          <div className="detail-actions">
            {showBuy && (
              <button className="btn btn-primary" disabled={busy} onClick={onBuy}>
                {busy
                  ? "Đang gửi tx…"
                  : purchased && showBuyPrimary
                    ? buyQty > 1
                      ? `Mua thêm ${buyQty} bản`
                      : "Mua thêm bản khác"
                    : buyQty > 1
                      ? `Mua ${buyQty} bản · ${formatEth(priceWei)}/bản`
                      : `Mua ${formatEth(priceWei)}`}
              </button>
            )}

            {sampleAvailable && !purchased && (
              <Link
                className="btn btn-ghost"
                to={`/books/${bookId}/read?mode=sample`}
              >
                <Eye size={16} /> Đọc thử
              </Link>
            )}

            {showBuy && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={onAddToCart}
              >
                <ShoppingCart size={16} />
                {inCart(book.bookId)
                  ? `Giỏ · ${getQuantity?.(book.bookId) || 1}`
                  : buyQty > 1
                    ? `Thêm ${buyQty} vào giỏ`
                    : "Thêm vào giỏ"}
              </button>
            )}

            {purchased && hasFile && (
              <Link className="btn btn-ghost" to="/my-books">
                <BookOpen size={16} /> Đọc trong Sách của tôi
              </Link>
            )}

            {isOwner && !thisOnMarket && (
              <>
                <input
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  title="Giá marketplace (ETH)"
                  className="detail-price-input"
                />
                <button className="btn btn-ghost" disabled={busy} onClick={onListMarket}>
                  Treo bán lại
                </button>
                {!quote?.forSale && (
                  <>
                    <input
                      value={primaryPrice}
                      onChange={(e) => setPrimaryPrice(e.target.value)}
                      title="Giá bán sơ cấp (ETH)"
                      className="detail-price-input"
                    />
                    <button className="btn btn-ghost" disabled={busy} onClick={onListPrimary}>
                      Mở bán sơ cấp
                    </button>
                  </>
                )}
              </>
            )}

            {isSeller && (
              <button className="btn btn-danger" disabled={busy} onClick={onCancel}>
                Hủy listing marketplace
              </button>
            )}

            {showDownload && (
              <button className="btn btn-ghost" disabled={busy} onClick={onDownloadFile}>
                <Download size={16} /> Tải file
              </button>
            )}
          </div>
          {sampleAvailable && !purchased && (
            <p className="muted detail-sample-hint">
              Đọc thử = 10 trang đầu. Bấm <strong>Tải file</strong> khi chưa mua sẽ
              chuyển sang <Link to="/cart">giỏ hàng</Link>.
            </p>
          )}
          {purchased && (
            <p className="muted detail-sample-hint">
              Đã mua — tải file đầy đủ tại đây hoặc đọc trong{" "}
              <Link to="/my-books">Sách của tôi</Link>.
            </p>
          )}
          {msg && (
            <p className={/thành công|Đã nhận|Đã treo|Đã mở|Đã hủy/i.test(msg) ? "ok-msg" : "err-msg"}>
              {msg}
            </p>
          )}
        </div>
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Chuỗi provenance của cuốn sách</h2>
        <p className="muted">Mỗi node nối `prevNodeHash` → `nodeHash`</p>
        <div className="chain-list" style={{ marginTop: "1rem" }}>
          {chain.length === 0 && <div className="panel muted">Chưa có node</div>}
          {chain.map((n) => (
            <div className="chain-node" key={n.index}>
              <div className="chain-index">{n.index}</div>
              <div>
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.35rem" }}>
                  <span className={`badge ${n.action === "Mint" ? "mint" : "sale"}`}>
                    {n.action}
                  </span>
                  <span className="badge">{formatEth(n.priceWei)}</span>
                </div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {n.from?.slice(0, 10) || "0x0"} → {n.to?.slice(0, 10)}
                </div>
                <div className="hash-line">prev: {n.prevNodeHash}</div>
                <div className="hash-line">hash: {n.nodeHash}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
