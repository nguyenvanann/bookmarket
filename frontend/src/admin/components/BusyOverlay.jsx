import { Loader2 } from "lucide-react";
import { useAdmin } from "../AdminContext";

export default function BusyOverlay() {
  const { busy, busyLabel } = useAdmin();
  if (!busy) return null;

  return (
    <div className="status-overlay" role="alertdialog" aria-busy="true" aria-live="polite">
      <div className="status-card wait">
        <Loader2 size={28} className="spin" />
        <div>
          <strong>Đang xử lý</strong>
          <p>{busyLabel || "Vui lòng chờ…"}</p>
        </div>
      </div>
    </div>
  );
}
