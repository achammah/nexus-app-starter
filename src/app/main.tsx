import React from "react";
import ReactDOM from "react-dom/client";
import "../ui/tokens/tokens.css";
import "./app.css";
import { App } from "./App";

// Theme boot: stored choice wins; else OS. Stamped on <html> so [data-theme] overrides
// the media query in both directions (tokens.css contract).
const stored = localStorage.getItem("nx-theme");
if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
