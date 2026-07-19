import * as React from "react";
import { LogIn } from "lucide-react";
import { Button } from "../ui/primitives/Button";
import { Input, Micro } from "../ui/primitives/fields";

/* Login gate — renders when the auth seam is enabled (/api/auth/me → enabled && no
   user). Deliberately minimal; a richer screen is one copy away in
   src/ui/blocks/login-03. */

export function Login({ appName, onDone }: { appName: string; onDone: () => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setErr(res.status === 401 ? "Invalid email or password." : `Login failed (${res.status}).`);
        return;
      }
      onDone();
    } catch {
      setErr("Network error — is the server up?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 16 }}>
      <form className="nxCard" data-testid="login-card" onSubmit={submit}
        style={{ width: "min(380px, 100%)", padding: 28, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 4, marginBottom: 4 }}>
          <span className="sideBrandMark" aria-hidden>{appName.slice(0, 1)}</span>
          <h1 style={{ font: "var(--nx-text-title)", fontSize: 18, margin: "10px 0 0" }}>Sign in to {appName}</h1>
          <Micro>authorized users only</Micro>
        </div>
        <label style={{ display: "grid", gap: 4 }}>
          <Micro>Email</Micro>
          <Input type="email" required data-testid="login-email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <Micro>Password</Micro>
          <Input type="password" required data-testid="login-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <div data-testid="login-error" style={{ color: "var(--nx-danger)", font: "var(--nx-text-meta)" }}>{err}</div>}
        <Button variant="primary" type="submit" busy={busy} icon={<LogIn size={14} />} data-testid="login-submit">
          Sign in
        </Button>
      </form>
    </div>
  );
}
