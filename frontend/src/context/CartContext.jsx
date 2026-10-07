import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "bm-cart-v2";

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // migrate v1
      const v1 = localStorage.getItem("bm-cart-v1");
      if (!v1) return [];
      const parsed = JSON.parse(v1);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((x) => ({ ...x, quantity: Number(x.quantity) > 0 ? Number(x.quantity) : 1 }));
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeItem(book, quantity = 1) {
  const id = Number(book.bookId);
  const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
  return {
    bookId: id,
    name: book.name || book.title || `Sách #${id}`,
    authors: Array.isArray(book.authors)
      ? book.authors.join(", ")
      : book.author || book.authors || "",
    image: book.image || book.coverUrl || "",
    price: book.price != null ? Number(book.price) : null,
    priceWei: book.marketListed ? book.marketPriceWei : book.listedPriceWei || null,
    marketListed: Boolean(book.marketListed),
    forSale: Boolean(book.forSale || book.marketListed),
    isbn: book.isbn || "",
    stockQuantity: book.quantity != null ? Number(book.quantity) : null,
    quantity: qty,
    addedAt: Date.now(),
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadCart());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const api = useMemo(
    () => ({
      items,
      /** Tổng số bản (cộng dồn quantity) */
      count: items.reduce((s, x) => s + (Number(x.quantity) || 1), 0),
      lineCount: items.length,
      addItem(book, quantity = 1) {
        if (!book?.bookId && book?.bookId !== 0) return { ok: false, reason: "invalid" };
        const id = Number(book.bookId);
        const addQty = Math.max(1, Math.min(20, Number(quantity) || 1));
        const maxStock =
          book.quantity != null && Number(book.quantity) > 0
            ? Math.min(20, Number(book.quantity))
            : 20;
        let added = false;
        let newQty = addQty;
        setItems((prev) => {
          const idx = prev.findIndex((x) => Number(x.bookId) === id);
          if (idx >= 0) {
            const next = [...prev];
            const cur = Number(next[idx].quantity) || 1;
            newQty = Math.min(maxStock, cur + addQty);
            next[idx] = {
              ...next[idx],
              ...normalizeItem(book, newQty),
              quantity: newQty,
              addedAt: next[idx].addedAt,
            };
            added = newQty > cur;
            return next;
          }
          added = true;
          newQty = Math.min(maxStock, addQty);
          return [...prev, normalizeItem(book, newQty)];
        });
        return { ok: true, added, quantity: newQty };
      },
      setQuantity(bookId, quantity) {
        const id = Number(bookId);
        const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
        setItems((prev) =>
          prev.map((x) => {
            if (Number(x.bookId) !== id) return x;
            const max =
              x.stockQuantity != null && x.stockQuantity > 0
                ? Math.min(20, x.stockQuantity)
                : 20;
            return { ...x, quantity: Math.min(max, qty) };
          })
        );
      },
      removeItem(bookId) {
        const id = Number(bookId);
        setItems((prev) => prev.filter((x) => Number(x.bookId) !== id));
      },
      clear() {
        setItems([]);
      },
      has(bookId) {
        const id = Number(bookId);
        return items.some((x) => Number(x.bookId) === id);
      },
      getQuantity(bookId) {
        const id = Number(bookId);
        const row = items.find((x) => Number(x.bookId) === id);
        return row ? Number(row.quantity) || 1 : 0;
      },
    }),
    [items]
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart phải dùng trong CartProvider");
  return ctx;
}
