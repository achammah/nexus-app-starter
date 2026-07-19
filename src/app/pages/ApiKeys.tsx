import * as React from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import { api, type ApiKeyMeta } from "../api";
import { useToast } from "../App";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro } from "../../ui/primitives/fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/components/ui/alert-dialog";

/* API keys — let another system call the app. A key carries a role
   (viewer/member/admin) and goes through the same permission tables as a
   signed-in member; the full secret renders exactly once, at creation.
   Management is owner/admin — the server 403s everyone else; this page just
   mirrors that with a notice. */

const ROLES = ["viewer", "member", "admin"] as const;

export function ApiKeysPage() {
  const toast = useToast();
  const [me, setMe] = React.useState<{ enabled: boolean; role?: string } | null>(null);
  const [keys, setKeys] = React.useState<ApiKeyMeta[]>([]);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<string>("viewer");
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);
  const [revoking, setRevoking] = React.useState<ApiKeyMeta | null>(null);

  const load = React.useCallback(() => {
    api.apiKeys().then(setKeys).catch(() => {});
  }, []);
  React.useEffect(() => {
    api.me().then(setMe).catch(() => setMe({ enabled: false }));
    load();
  }, [load]);

  // server is the real gate — this only spares non-admins a dead form
  if (me?.enabled && me.role && !["owner", "admin"].includes(me.role)) {
    return (
      <div className="nxCard" style={{ padding: 24, maxWidth: 560 }} data-testid="apikeys-denied">
        <Micro>API keys</Micro>
        <p style={{ marginTop: 8, color: "var(--nx-fg-muted)" }}>
          API keys are managed by owners and admins. Ask one to create a key for you.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 820 }}>
      <div className="nxCard" style={{ padding: 18 }}>
        <Micro>New key</Micro>
        <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
          <Input
            placeholder="Reporting bot"
            value={name}
            data-testid="apikey-name"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select
            className="nxInput"
            data-testid="apikey-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: 130 }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button
            variant="primary"
            icon={<Plus size={13} />}
            data-testid="apikey-create"
            disabled={!name.trim()}
            onClick={() =>
              api
                .apiKeyCreate(name.trim(), role)
                .then((k) => {
                  setFreshSecret(k.secret);
                  setName("");
                  load();
                })
                .catch((e) => toast(e.message))
            }
          >
            Create
          </Button>
        </div>
        <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
          The key acts as its role through the same permissions as a signed-in member — a viewer key reads, it never writes.
        </span>
        {freshSecret && (
          <div className="nxCard" style={{ marginTop: 12, padding: 12, borderColor: "var(--nx-warn)", background: "var(--nx-warn-soft)" }}>
            <Micro>Your API key — shown ONCE, store it now</Micro>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <code data-testid="apikey-secret" style={{ wordBreak: "break-all", flex: 1 }}>{freshSecret}</code>
              <Button
                size="sm"
                icon={<Copy size={12} />}
                data-testid="apikey-copy"
                onClick={() => navigator.clipboard?.writeText(freshSecret).then(() => toast("Key copied")).catch(() => {})}
              >
                Copy
              </Button>
            </div>
            <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
              Send it as <code>x-api-key: {freshSecret.slice(0, 10)}…</code> (or <code>Authorization: Bearer</code>) on any API call.
            </span>
          </div>
        )}
      </div>

      <div className="nxCard" style={{ padding: 18 }}>
        <Micro>Keys</Micro>
        <div className="nxFieldList" style={{ marginTop: 8 }}>
          {keys.length === 0 && <div style={{ padding: 12, color: "var(--nx-fg-faint)" }}>None yet.</div>}
          {keys.map((k) => (
            <div className="nxFieldRow" key={k.id} data-testid={`apikey-row-${k.id}`} style={{ gridTemplateColumns: "1fr auto auto auto auto" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={13} /> {k.name}
                <code style={{ color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>
                  {k.prefix}…{k.last4}
                </code>
              </span>
              <Badge>{k.role}</Badge>
              <span style={{ color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              {k.revokedAt ? (
                <Badge tone="danger">revoked</Badge>
              ) : (
                <Badge tone="ok">active</Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                data-testid={`apikey-revoke-${k.id}`}
                disabled={!!k.revokedAt}
                onClick={() => setRevoking(k)}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!revoking} onOpenChange={(v) => { if (!v) setRevoking(null); }}>
        <AlertDialogContent data-testid="apikey-revoke-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{revoking?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Every request using {revoking?.prefix}…{revoking?.last4} answers 401 from now on. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="apikey-revoke-confirm"
              onClick={() => {
                const k = revoking;
                setRevoking(null);
                if (!k) return;
                api.apiKeyRevoke(k.id).then(() => { toast("Key revoked"); load(); }).catch((e) => toast(e.message));
              }}
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
