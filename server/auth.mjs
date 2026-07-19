/* Auth seam — zero-dep signed-cookie sessions (HMAC-SHA256 over email+expiry+pwv).
   Two modes, one seam:
     · AUTH_USERS            — fixed user:pass gate (simple internal tools)
     · AUTH_MODE=accounts    — self-serve accounts: signup, email verification,
       password reset (with an anti-enumeration decoy), delete-by-confirmation.
       Mail rides the dev OUTBOX (server/email.mjs) until SMTP is wired.
   Password change bumps the user's pwv, which is baked into the session payload —
   outstanding cookies die on reset without server-side session state. */

import crypto from "node:crypto";
import { ACCOUNTS_ENABLED, AUTH_ENABLED, USERS, env } from "./env.mjs";
import { sendMail, templates } from "./email.mjs";

const COOKIE = "nx_session";
const TTL_S = 60 * 60 * 24 * 7;

const sign = (payload) =>
  crypto.createHmac("sha256", env.APP_SECRET ?? "dev").update(payload).digest("base64url");

export function makeSession(email, pwv = 0) {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  const payload = `${email}|${exp}|${pwv}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readSession(req, store) {
  const raw = (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [b64, sig] = raw.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [email, exp, pwv] = payload.split("|");
  if (Number(exp) < Date.now() / 1000) return null;
  if (ACCOUNTS_ENABLED && store) {
    const u = store.userByEmail(email);
    if (!u) return null;                       // deleted account → dead cookie
    if (Number(pwv ?? 0) !== u.pwv) return null; // password changed → dead cookie
  }
  return { email };
}

/* scrypt at-rest hashes: "saltHex:hashHex" */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(String(password), salt, 64).toString("hex")}`;
}
function verifyHash(password, stored) {
  const [salt, hex] = String(stored ?? "").split(":");
  if (!salt || !hex) return false;
  const a = crypto.scryptSync(String(password ?? ""), salt, 64);
  const b = Buffer.from(hex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyUser(email, password) {
  const stored = USERS.get(String(email ?? "").toLowerCase());
  if (!stored) return false;
  const a = Buffer.from(String(password ?? ""));
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const setSession = (res, email, pwv) =>
  res.setHeader("set-cookie", `${COOKIE}=${makeSession(email, pwv)}; HttpOnly; Path=/; Max-Age=${TTL_S}; SameSite=Lax`);
const clearSession = (res) =>
  res.setHeader("set-cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
const newToken = () => crypto.randomBytes(24).toString("base64url");

/* Route handler for /api/auth/*; returns true when it handled the request. */
export async function handleAuth(req, res, url, readBody, send, store) {
  if (!url.pathname.startsWith("/api/auth/")) return false;
  const leaf = url.pathname.split("/").pop();

  if (leaf === "me") {
    const s = AUTH_ENABLED ? readSession(req, store) : null;
    const u = s && ACCOUNTS_ENABLED ? store.userByEmail(s.email) : null;
    send(res, 200, {
      enabled: AUTH_ENABLED,
      accounts: ACCOUNTS_ENABLED,
      user: s?.email ?? null,
      ...(s ? { role: store.roleFor(s.email) } : {}),
      ...(u ? { name: u.name, verified: u.verified } : {}),
    });
    return true;
  }

  if (leaf === "login" && req.method === "POST") {
    if (!AUTH_ENABLED) {
      send(res, 400, { error: "auth disabled — set AUTH_USERS or AUTH_MODE=accounts (+ APP_SECRET)" });
      return true;
    }
    const { email, password } = await readBody(req);
    const norm = String(email ?? "").toLowerCase();
    if (ACCOUNTS_ENABLED) {
      const u = store.userByEmail(norm);
      if (u && verifyHash(password, u.hash)) {
        setSession(res, norm, u.pwv);
        send(res, 200, { ok: true, user: norm });
        return true;
      }
    }
    if (verifyUser(norm, password)) {
      setSession(res, norm, 0);
      send(res, 200, { ok: true, user: norm });
      return true;
    }
    send(res, 401, { error: "invalid credentials" });
    return true;
  }

  if (leaf === "logout" && req.method === "POST") {
    clearSession(res);
    send(res, 200, { ok: true });
    return true;
  }

  if (!ACCOUNTS_ENABLED) return false;

  if (leaf === "signup" && req.method === "POST") {
    const { email, name, password } = await readBody(req);
    const norm = String(email ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) return send(res, 400, { error: "a valid email is required" }), true;
    if (String(password ?? "").length < 8) return send(res, 400, { error: "password must be at least 8 characters" }), true;
    if (store.userByEmail(norm)) return send(res, 409, { error: "this address already has an account — sign in instead" }), true;
    const u = store.userAdd({ email: norm, name: String(name ?? "").trim() || norm.split("@")[0], hash: hashPassword(password) });
    const t = store.tokenIssue({ kind: "verify", email: norm, ttlMinutes: 60 * 24, token: newToken() });
    sendMail(store, { to: norm, kind: "verify", ...templates.verify(t.token) });
    setSession(res, norm, u.pwv);
    send(res, 201, { ok: true, user: norm });
    return true;
  }

  if (leaf === "verify" && req.method === "POST") {
    const { token } = await readBody(req);
    const t = store.tokenTake(String(token ?? ""), "verify");
    if (!t) return send(res, 400, { error: "invalid or expired verification token" }), true;
    store.userVerify(t.email);
    send(res, 200, { ok: true });
    return true;
  }

  if (leaf === "forgot" && req.method === "POST") {
    const { email } = await readBody(req);
    const norm = String(email ?? "").toLowerCase();
    const u = store.userByEmail(norm);
    // ANTI-ENUMERATION: identical response either way; the unknown address gets a
    // decoy mail so even mail-arrival timing looks the same from outside.
    if (u) {
      const t = store.tokenIssue({ kind: "reset", email: norm, ttlMinutes: 30, token: newToken() });
      sendMail(store, { to: norm, kind: "reset", ...templates.reset(t.token) });
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) {
      sendMail(store, { to: norm, kind: "reset-decoy", ...templates.resetDecoy() });
    }
    send(res, 200, { ok: true });
    return true;
  }

  if (leaf === "reset" && req.method === "POST") {
    const { token, password } = await readBody(req);
    if (String(password ?? "").length < 8) return send(res, 400, { error: "password must be at least 8 characters" }), true;
    const t = store.tokenTake(String(token ?? ""), "reset");
    if (!t) return send(res, 400, { error: "invalid or expired reset token" }), true;
    store.userSetHash(t.email, hashPassword(password));
    send(res, 200, { ok: true });
    return true;
  }

  if (leaf === "delete-request" && req.method === "POST") {
    const s = readSession(req, store);
    if (!s) return send(res, 401, { error: "sign in first" }), true;
    const t = store.tokenIssue({ kind: "delete", email: s.email, ttlMinutes: 30, token: newToken() });
    sendMail(store, { to: s.email, kind: "delete-confirm", ...templates.deleteConfirm(t.token) });
    send(res, 200, { ok: true });
    return true;
  }

  if (leaf === "delete-confirm" && req.method === "POST") {
    const { token } = await readBody(req);
    const t = store.tokenTake(String(token ?? ""), "delete");
    if (!t) return send(res, 400, { error: "invalid or expired deletion token" }), true;
    store.userSoftDelete(t.email);
    clearSession(res);
    send(res, 200, { ok: true });
    return true;
  }

  return false;
}

/* Gate: when enabled, every /api route needs a session EXCEPT auth, healthz, config
   (the login screen needs the app name) and — dev only — the mail outbox. */
export function gate(req, url, store) {
  if (!AUTH_ENABLED) return true;
  if (url.pathname.startsWith("/api/auth/")) return true;
  if (url.pathname === "/api/healthz" || url.pathname === "/api/config") return true;
  if (url.pathname === "/api/outbox" && !env.SMTP_URL) return true; // dev mail transport
  if (!url.pathname.startsWith("/api/")) return true; // static + SPA always serve (the client gate renders login)
  return readSession(req, store) !== null;
}
