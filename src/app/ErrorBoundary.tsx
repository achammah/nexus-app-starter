import * as React from "react";

/* Last-resort error boundary — a render crash shows a recoverable card with the
   actual message (never a white screen), and the reload path is one click. */

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[boundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 16 }}>
        <div className="nxCard" data-testid="error-boundary" style={{ maxWidth: 520, padding: 24 }}>
          <h1 style={{ font: "var(--nx-text-title)", fontSize: 16, margin: 0 }}>Something broke in the UI</h1>
          <pre style={{ font: "var(--nx-text-meta)", fontFamily: "var(--nx-font-mono)", whiteSpace: "pre-wrap", color: "var(--nx-fg-muted)", margin: "10px 0 14px", maxHeight: 160, overflow: "auto" }}>
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button className="nxBtn" style={{ background: "var(--nx-accent)", color: "var(--nx-accent-fg)", border: 0, borderRadius: 6, padding: "7px 14px", cursor: "pointer", font: "var(--nx-text-body)", fontWeight: 500 }}
            onClick={() => location.reload()}>
            Reload the app
          </button>
        </div>
      </div>
    );
  }
}
