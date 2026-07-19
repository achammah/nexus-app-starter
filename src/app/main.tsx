import React from "react";
import ReactDOM from "react-dom/client";
import "../ui/tokens/tokens.css";
import "../ui/styles/shadcn.css";
import "../ui/primitives/primitives.css";
import "../ui/record-core/record-core.css";
import "./app.css";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

// Theme boot: stored choice wins, else the OS preference — ALWAYS stamped on <html>
// so both the token overrides and shadcn's `dark:` variant key off one source.
const stored = localStorage.getItem("nx-theme");
document.documentElement.dataset.theme =
  stored === "light" || stored === "dark"
    ? stored
    : matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";

// Skin boot: inject the cached skin CSS BEFORE first paint (App re-applies the
// authoritative skin from /api/config once it loads — no flash after first visit).
try {
  const cached = localStorage.getItem("nx-skin-css");
  if (cached) {
    const el = document.createElement("style");
    el.id = "nx-skin";
    el.textContent = cached;
    document.head.appendChild(el);
  }
} catch { /* private mode */ }

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
