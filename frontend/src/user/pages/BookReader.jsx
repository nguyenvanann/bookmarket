import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Lock,
  ShoppingBag,
  Maximize2,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";
import { bookAuthors, bookName } from "../utils/book";
import "./reader.css";

async function blobErrorMessage(err) {
  let message = err.message;
  if (err.response?.data instanceof Blob) {
    try {
      message = JSON.parse(await err.response.data.text())?.message || message;
    } catch {
      /* ignore */
    }
  } else {
    message = err.response?.data?.message || message;
  }
  return message;
}

export default function BookReader() {
  const { bookId } = useParams();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "full" ? "full" : "sample";
  const navigate = useNavigate();
  const { user, linkWallet } = useAuth();
  const { address, connect } = useWallet();

  const [book, setBook] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [meta, setMeta] = useState({ samplePages: 10, totalPages: null });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);

  const loadBook = useCallback(async () => {
    const { data } = await api.get(`/books/${bookId}`);
    setBook(data.book);
    return data.book;
  }, [bookId]);

  const loadPdf = useCallback(
    async (b) => {
      setBusy(true);
      setErr("");
      try {
        if (mode === "full") {
          if (!user) {
            setErr("Đăng nhập và sở hữu NFT để đọc toàn bộ sách.");
            setBusy(false);
            return;
          }
          if (address && (!user.walletAddress || user.walletAddress.toLowerCase() !== address.toLowerCase())) {
            try {
              await linkWallet(address);
            } catch {
              /* may already be linked to another account */
            }
          }
          const { data, headers } = await api.get(`/books/${bookId}/file`, {
            responseType: "blob",
            params: { view: 1 },
          });
          const blob = new Blob([data], {
            type: headers["content-type"] || "application/pdf",
          });
          const url = URL.createObjectURL(blob);
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setMeta({ samplePages: null, totalPages: null, mode: "full" });
        } else {
          const { data, headers } = await api.get(`/books/${bookId}/sample`, {
            responseType: "blob",
          });
          const blob = new Blob([data], {
            type: headers["content-type"] || "application/pdf",
          });
          const url = URL.createObjectURL(blob);
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          const samplePages = Number(headers["x-sample-pages"]) || 10;
          const sampleMax = Number(headers["x-sample-max"]) || 10;
          setMeta({
            samplePages: Math.min(samplePages, sampleMax, 10),
            totalPages: Number(headers["x-total-pages"]) || null,
            mode: "sample",
            bookTitle: b ? bookName(b) : "",
          });
        }
      } catch (e) {
        setErr(await blobErrorMessage(e));
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return "";
        });
      } finally {
        setBusy(false);
      }
    },
    [address, bookId, linkWallet, mode, user]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await loadBook();
        if (!alive) return;
        await loadPdf(b);
      } catch (e) {
        if (alive) {
          setErr(e.response?.data?.message || e.message);
          setBusy(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadBook, loadPdf]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const title = book ? bookName(book) : `Sách #${bookId}`;
  const authors = book ? bookAuthors(book) : "";
  const isSample = mode === "sample";

  return (
    <div className="reader-shell">
      <header className="reader-bar">
        <div className="reader-bar-inner">
          <button
            type="button"
            className="btn btn-ghost reader-back"
            onClick={() => navigate(isSample ? `/books/${bookId}` : "/my-books")}
          >
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="reader-titles">
            <strong>{title}</strong>
            <span className="muted">
              {authors || "—"}
              {isSample
                ? ` · Đọc thử ${meta.samplePages || 10} trang đầu`
                : " · Bản đầy đủ (đã sở hữu)"}
              {meta.totalPages ? ` · Tổng ${meta.totalPages} trang` : ""}
            </span>
          </div>
          <div className="reader-bar-actions">
            {isSample ? (
              <Link className="btn btn-primary" to={`/books/${bookId}`}>
                <ShoppingBag size={16} /> Mua để đọc full
              </Link>
            ) : (
              <Link className="btn btn-ghost" to={`/books/${bookId}`}>
                <BookOpen size={16} /> Chi tiết
              </Link>
            )}
            {pdfUrl && (
              <a className="btn btn-ghost" href={pdfUrl} target="_blank" rel="noreferrer">
                <Maximize2 size={16} /> Tab mới
              </a>
            )}
          </div>
        </div>
      </header>

      {isSample && (
        <div className="reader-banner sample">
          <Lock size={14} /> Đọc thử chỉ mở{" "}
          <strong>{meta.samplePages || 10} trang đầu</strong>
          {meta.totalPages ? ` / ${meta.totalPages} trang` : ""} — các trang sau bị khóa.
          Mua NFT rồi đọc full trong <Link to="/my-books">Sách của tôi</Link>.
        </div>
      )}

      <div className="reader-stage">
        {busy && <p className="muted reader-status">Đang tải nội dung…</p>}
        {!busy && err && (
          <div className="panel reader-error">
            <p>{err}</p>
            {!user && mode === "full" && (
              <Link className="btn btn-primary" to="/login">
                Đăng nhập
              </Link>
            )}
            {user && mode === "full" && !address && (
              <button className="btn btn-primary" type="button" onClick={connect}>
                Kết nối ví sở hữu
              </button>
            )}
            {mode === "full" && (
              <Link className="btn btn-ghost" to={`/books/${bookId}/read?mode=sample`}>
                Đọc thử 10 trang
              </Link>
            )}
          </div>
        )}
        {!busy && !err && pdfUrl && (
          <iframe
            className="reader-frame"
            title={`${title} — ${isSample ? "đọc thử" : "đọc full"}`}
            src={`${pdfUrl}#view=FitH`}
          />
        )}
      </div>
    </div>
  );
}
