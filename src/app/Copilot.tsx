import * as React from "react";
import { CopilotPanel } from "../ui/blocks/copilot";
import { api, type AppConfig } from "./api";

/* App wiring for the reusable copilot panel: reads the `copilot` config block, builds
   the per-turn context from what the user is looking at (driven by each object's
   `contextFields`, never a hardcoded object/field), and injects the server transport
   (api.copilot → the /api/copilot emulator proxy). The panel itself lives in nexus-ui. */

/* what the user is looking at right now → a short context string for the agent. Purely
   config-driven: a record contributes the object's `contextFields` (or its primary
   field); a list/page contributes its label; the home contributes the app name. */
async function buildContext(config: AppConfig): Promise<string> {
  const hash = window.location.hash;
  const objs = config.objects ?? [];
  const label = (key: string) => objs.find((o) => o.key === key)?.label ?? key;

  // a record — full page (#/o/<obj>/r/<id>) or the side peek (#/o/<obj>?peek=<id>)
  const full = /#\/o\/([^/?&]+)\/r\/([^/?&]+)/.exec(hash);
  const listM = /#\/o\/([^/?&]+)/.exec(hash);
  const peekM = /[?&]peek=([^&]+)/.exec(hash);
  const rec: [string, string] | null = full
    ? [full[1], full[2]]
    : listM && peekM ? [listM[1], peekM[1]] : null;
  if (rec) {
    const [objKey, id] = rec;
    const obj = objs.find((o) => o.key === objKey);
    try {
      const row = (await api.get(objKey, id)) as Record<string, unknown>;
      const keys = obj?.contextFields?.length
        ? obj.contextFields
        : [obj?.fields.find((f) => f.primary)?.key ?? obj?.fields[0]?.key].filter(Boolean) as string[];
      const lines = keys
        .map((k) => {
          const f = obj?.fields.find((ff) => ff.key === k);
          const v = row[k];
          if (v === undefined || v === null || v === "") return null;
          return `${f?.label ?? k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`;
        })
        .filter(Boolean);
      return `The user is viewing a ${obj?.labelOne ?? objKey}.\n${lines.join("\n")}`;
    } catch {
      return `The user is viewing a ${obj?.labelOne ?? objKey}.`;
    }
  }

  const page = /#\/p\/([^/?&]+)/.exec(hash);
  if (page) return `The user is on the "${page[1]}" page.`;
  const list = /#\/o\/([^/?&]+)/.exec(hash);
  if (list) return `The user is viewing the ${label(list[1])} list.`;
  return `The user is in ${config.app.name}.`;
}

export function Copilot({ open, onClose, config }: { open: boolean; onClose: () => void; config: AppConfig }) {
  const send = React.useCallback(
    (message: string, sessionId: string | undefined, context: string) => api.copilot(message, sessionId, context),
    [],
  );
  const getContext = React.useCallback(() => buildContext(config), [config]);

  return (
    <div className={`nxCopilotDock${open ? " is-open" : ""}`} data-testid="copilot-dock" aria-hidden={!open}>
      <CopilotPanel open={open} onClose={onClose} config={config.copilot} send={send} getContext={getContext} />
    </div>
  );
}
