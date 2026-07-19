import * as React from "react";
import { Plus, Send, Webhook } from "lucide-react";
import { api } from "../api";
import { useToast } from "../App";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro, Checkbox } from "../../ui/primitives/fields";

/* Webhooks — endpoints subscribed to the CLOSED per-object event catalog
   (<object>.created/updated/deleted, or *). Deliveries are HMAC-signed and
   logged per endpoint; the secret is shown exactly once, at creation. */

type Hook = { id: string; url: string; events: string[]; active: boolean; secret: string };
type Delivery = { id: string; event: string; status: string; code: number; ts: string; error?: string };

export function WebhooksPage() {
  const toast = useToast();
  const [catalog, setCatalog] = React.useState<string[]>([]);
  const [hooks, setHooks] = React.useState<Hook[]>([]);
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<Record<string, boolean>>({});
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);
  const [openDeliveries, setOpenDeliveries] = React.useState<string | null>(null);
  const [deliveries, setDeliveries] = React.useState<Delivery[]>([]);

  const load = React.useCallback(() => {
    api.webhooks().then((r) => setHooks(r.webhooks)).catch(() => {});
  }, []);
  React.useEffect(() => {
    api.webhookCatalog().then(setCatalog).catch(() => {});
    load();
  }, [load]);

  const chosen = Object.keys(events).filter((e) => events[e]);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 820 }}>
      <div className="nxCard" style={{ padding: 18 }}>
        <Micro>New endpoint</Micro>
        <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
          <Input placeholder="https://example.com/hooks/records" value={url} data-testid="wh-url" onChange={(e) => setUrl(e.target.value)} />
          <Button
            variant="primary" icon={<Plus size={13} />} data-testid="wh-create"
            onClick={() =>
              api.webhookCreate(url.trim(), chosen).then((h) => {
                setFreshSecret(h.secret);
                setUrl("");
                setEvents({});
                load();
              }).catch((e) => toast(e.message))
            }
          >
            Create
          </Button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {catalog.map((ev) => (
            <label key={ev} style={{ display: "inline-flex", gap: 6, alignItems: "center", font: "var(--nx-text-meta)" }}>
              <Checkbox
                checked={!!events[ev]}
                data-testid={`wh-ev-${ev.replaceAll(/\W+/g, "-")}`}
                onCheckedChange={(v) => setEvents((m) => ({ ...m, [ev]: !!v }))}
              />
              <code>{ev}</code>
            </label>
          ))}
        </div>
        {freshSecret && (
          <div className="nxCard" style={{ marginTop: 12, padding: 12, borderColor: "var(--nx-warn)", background: "var(--nx-warn-soft)" }}>
            <Micro>Signing secret — shown ONCE, store it now</Micro>
            <code data-testid="wh-secret" style={{ display: "block", marginTop: 6, wordBreak: "break-all" }}>{freshSecret}</code>
            <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
              Verify deliveries: HMAC-SHA256 of the raw body with this secret must equal the <code>x-nx-signature</code> header (after <code>sha256=</code>).
            </span>
          </div>
        )}
      </div>

      <div className="nxCard" style={{ padding: 18 }}>
        <Micro>Endpoints</Micro>
        <div className="nxFieldList" style={{ marginTop: 8 }}>
          {hooks.length === 0 && <div style={{ padding: 12, color: "var(--nx-fg-faint)" }}>None yet.</div>}
          {hooks.map((h) => (
            <div key={h.id}>
              <div className="nxFieldRow" data-testid={`wh-row-${h.id}`} style={{ gridTemplateColumns: "1fr auto auto auto auto" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Webhook size={13} /> {h.url}
                  <span style={{ color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>{h.events.join(" · ")}</span>
                </span>
                <Badge tone={h.active ? "accent" : undefined}>{h.active ? "active" : "paused"}</Badge>
                <Button size="sm" variant="ghost" data-testid={`wh-toggle-${h.id}`}
                  onClick={() => api.webhookPatch(h.id, { active: !h.active }).then(load).catch((e) => toast(e.message))}>
                  {h.active ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" icon={<Send size={12} />} data-testid={`wh-test-${h.id}`}
                  onClick={() => api.webhookTest(h.id).then(() => toast("Test event queued")).catch((e) => toast(e.message))}>
                  Test
                </Button>
                <Button size="sm" variant="ghost" data-testid={`wh-deliveries-${h.id}`}
                  onClick={() => {
                    if (openDeliveries === h.id) return setOpenDeliveries(null);
                    api.webhookDeliveries(h.id).then((r) => {
                      setDeliveries(r.deliveries);
                      setOpenDeliveries(h.id);
                    }).catch((e) => toast(e.message));
                  }}>
                  Deliveries
                </Button>
              </div>
              {openDeliveries === h.id && (
                <div className="nxFieldList" data-testid="wh-delivery-list" style={{ margin: "4px 0 10px 20px" }}>
                  {deliveries.length === 0 && <div style={{ padding: 8, color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>No deliveries yet.</div>}
                  {deliveries.map((d) => (
                    <div className="nxFieldRow" key={d.id} style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
                      <Badge tone={d.status === "delivered" ? "ok" : "danger"}>{d.status}</Badge>
                      <code>{d.event}</code>
                      <span className="nxFieldLabel">{d.code || "—"}</span>
                      <span className="nxFieldLabel">{new Date(d.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
