import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function ToastHost() {
  const { toasts, dismissToast } = useAdmin();

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-pop ${t.type}`} role="status">
          <span className="toast-pop-ico">
            {t.type === "err" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          </span>
          <span className="toast-pop-text">{t.text}</span>
          <button
            type="button"
            className="toast-pop-close"
            onClick={() => dismissToast(t.id)}
            aria-label="Đóng"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
