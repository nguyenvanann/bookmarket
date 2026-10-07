import { Component } from "react";

/**
 * Bắt lỗi render để tránh #root trống (trắng màn hình) khi F5 / crash component.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container" style={{ padding: "3rem 1rem", maxWidth: 560 }}>
          <div className="panel">
            <h2>Có lỗi khi tải trang</h2>
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              {this.state.error?.message || "Unknown error"}
            </p>
            <div className="row-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => window.location.reload()}
              >
                Tải lại
              </button>
              <a className="btn btn-ghost" href="/">
                Về trang chủ
              </a>
              <a className="btn btn-ghost" href="/admin">
                Admin
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
