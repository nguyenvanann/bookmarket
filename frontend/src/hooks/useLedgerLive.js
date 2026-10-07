import { useEffect, useRef } from "react";

/**
 * Subscribe SSE /api/ledger/stream — gọi onTx / onTip / onBook ngay khi chain cập nhật.
 */
export function useLedgerLive({ onTx, onTip, onBook, onHello, enabled = true } = {}) {
  const handlers = useRef({ onTx, onTip, onBook, onHello });
  handlers.current = { onTx, onTip, onBook, onHello };

  useEffect(() => {
    if (!enabled) return undefined;

    const base = import.meta.env.VITE_API_BASE_URL || "/api";
    const url = `${String(base).replace(/\/$/, "")}/ledger/stream`;
    const es = new EventSource(url);

    es.addEventListener("hello", (ev) => {
      try {
        handlers.current.onHello?.(JSON.parse(ev.data));
      } catch {
        handlers.current.onHello?.({ ok: true });
      }
    });

    es.addEventListener("tx", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handlers.current.onTx?.(data);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("tip", (ev) => {
      try {
        handlers.current.onTip?.(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("book", (ev) => {
      try {
        handlers.current.onBook?.(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      // EventSource tự reconnect
    };

    return () => es.close();
  }, [enabled]);
}
