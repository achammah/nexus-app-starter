import * as React from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "../ui/primitives/Button";
import { t } from "./i18n";

/* Embedded agent chat — rung 1 of the embed ladder: the EMBED deployment's widget
   in an iframe dock. Configure `chat.embedUrl` in starter.config.json with the
   deployment's embed URL; unconfigured → the dock renders nothing (deterministic).
   Rung 3 (API deployment + custom UI) starts from src/lib/chatBridge notes. */

export function ChatDock({ embedUrl }: { embedUrl?: string }) {
  const [open, setOpen] = React.useState(false);
  if (!embedUrl) return null;
  return (
    <>
      {open && (
        <div
          data-testid="chat-panel"
          style={{
            position: "fixed",
            right: 18,
            bottom: 74,
            width: "min(400px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 120px))",
            zIndex: 70,
            borderRadius: "var(--nx-radius-l)",
            overflow: "hidden",
            border: "1px solid var(--nx-border)",
            boxShadow: "var(--nx-shadow-2)",
            background: "var(--nx-bg-raised)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: "1px solid var(--nx-border)",
              font: "var(--nx-text-title)",
            }}
          >
            {t("chat.title")}
            <Button variant="ghost" size="sm" icon={<X size={14} />} aria-label="Close chat" onClick={() => setOpen(false)} />
          </div>
          <iframe title={t("chat.title")} src={embedUrl} style={{ border: 0, flex: 1, width: "100%" }} />
        </div>
      )}
      <button
        data-testid="chat-fab"
        aria-label={t("chat.open")}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 70,
          width: 46,
          height: 46,
          borderRadius: "50%",
          border: 0,
          cursor: "pointer",
          background: "var(--nx-accent)",
          color: "var(--nx-accent-fg)",
          display: "grid",
          placeItems: "center",
          boxShadow: "var(--nx-shadow-2)",
        }}
      >
        <MessageCircle size={20} />
      </button>
    </>
  );
}
