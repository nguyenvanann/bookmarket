import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Chặn route khi chưa có phiên JWT hợp lệ.
 * @param {{ children: import("react").ReactNode, adminOnly?: boolean }} props
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container muted" style={{ padding: "2.5rem 1rem" }}>
        Đang khôi phục phiên đăng nhập…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (adminOnly && !user.canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
