import * as React from "react";
import { LogIn, UserPlus, KeyRound } from "lucide-react";
import { Button } from "../ui/primitives/Button";
import { Input, Micro } from "../ui/primitives/fields";

/* Login gate — renders when the auth seam is enabled and no session exists.
   AUTH_USERS mode: sign-in only. AUTH_MODE=accounts adds signup, forgot/reset
   (tokens arrive by mail — the dev outbox in local setups), and honors
   #/reset?token=… deep links from those mails. */

type Pane = "signin" | "signup" | "forgot" | "reset";

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, status: res.status, error: data.error };
  } catch {
    return { ok: false, status: 0, error: "Network error — is the server up?" };
  }
}

export function Login({ appName, accounts, onDone }: { appName: string; accounts?: boolean; onDone: () => void }) {
  const resetToken = React.useMemo(() => {
    const m = window.location.hash.match(/#\/reset\?token=([^&]+)/);
    return m?.[1] ?? null;
  }, []);
  const [pane, setPane] = React.useState<Pane>(resetToken ? "reset" : "signin");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null); setNote(null);
    try { await fn(); } finally { setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (pane === "signin") {
        const r = await post("/api/auth/login", { email, password });
        if (!r.ok) return setErr(r.status === 401 ? "Invalid email or password." : r.error ?? `Login failed (${r.status}).`);
        onDone();
      } else if (pane === "signup") {
        const r = await post("/api/auth/signup", { email, name, password });
        if (!r.ok) return setErr(r.error ?? `Signup failed (${r.status}).`);
        onDone();
      } else if (pane === "forgot") {
        const r = await post("/api/auth/forgot", { email });
        if (!r.ok) return setErr(r.error ?? "Request failed.");
        setNote("If that address has an account, a reset link is on its way. Check your mail.");
      } else if (pane === "reset") {
        const r = await post("/api/auth/reset", { token: resetToken, password });
        if (!r.ok) return setErr(r.error ?? "Reset failed — the link may have expired.");
        window.location.hash = "#/";
        setNote("Password updated — sign in with the new one.");
        setPane("signin");
      }
    });
  };

  const title =
    pane === "signup" ? `Create your ${appName} account`
    : pane === "forgot" ? "Reset your password"
    : pane === "reset" ? "Choose a new password"
    : `Sign in to ${appName}`;

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 16 }}>
      <form className="nxCard" data-testid="login-card" onSubmit={submit}
        style={{ width: "min(380px, 100%)", padding: 28, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4, marginBottom: 4 }}>
          <span className="sideBrandMark" aria-hidden>{appName.slice(0, 1)}</span>
          <h1 style={{ font: "var(--nx-text-title)", fontSize: 18, margin: "10px 0 0" }}>{title}</h1>
          <Micro>{accounts ? "your data stays in your workspace" : "authorized users only"}</Micro>
        </div>

        {pane === "signup" && (
          <label style={{ display: "grid", gap: 4 }}>
            <Micro>Name</Micro>
            <Input data-testid="signup-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
        )}
        {pane !== "reset" && (
          <label style={{ display: "grid", gap: 4 }}>
            <Micro>Email</Micro>
            <Input type="email" required data-testid="login-email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={pane === "signin"} />
          </label>
        )}
        {pane !== "forgot" && (
          <label style={{ display: "grid", gap: 4 }}>
            <Micro>{pane === "reset" ? "New password" : "Password"}</Micro>
            <Input type="password" required data-testid="login-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}

        {err && <div data-testid="login-error" style={{ color: "var(--nx-danger)", font: "var(--nx-text-meta)" }}>{err}</div>}
        {note && <div data-testid="login-note" style={{ color: "var(--nx-ok)", font: "var(--nx-text-meta)" }}>{note}</div>}

        <Button
          variant="primary" type="submit" busy={busy}
          icon={pane === "signup" ? <UserPlus size={14} /> : pane === "forgot" || pane === "reset" ? <KeyRound size={14} /> : <LogIn size={14} />}
          data-testid="login-submit"
        >
          {pane === "signup" ? "Create account" : pane === "forgot" ? "Send reset link" : pane === "reset" ? "Set new password" : "Sign in"}
        </Button>

        {accounts && pane === "signin" && (
          <div style={{ display: "flex", justifyContent: "space-between", font: "var(--nx-text-meta)" }}>
            <button type="button" className="nxRowLink" data-testid="to-signup" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => { setErr(null); setPane("signup"); }}>
              Create an account
            </button>
            <button type="button" className="nxRowLink" data-testid="to-forgot" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => { setErr(null); setPane("forgot"); }}>
              Forgot password?
            </button>
          </div>
        )}
        {accounts && pane !== "signin" && (
          <button type="button" className="nxRowLink" data-testid="to-signin" style={{ background: "none", border: 0, cursor: "pointer", padding: 0, font: "var(--nx-text-meta)", textAlign: "left" }} onClick={() => { setErr(null); setPane("signin"); }}>
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
