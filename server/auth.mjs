/* Auth seam — zero-dep signed-cookie sessions (HMAC-SHA256 over email+expiry).
   Enabled ONLY when AUTH_USERS + APP_SECRET are set (env.mjs); disabled → every
   route stays open and /api/auth/me reports {enabled:false} (deterministic).
   This is deliberately a SEAM: swap `verifyUser` for the org SSO/platform check
   without touching routes or the client gate. */

import crypto from "node:crypto";
import { AUTH_ENABLED, USERS, env } from "./env.mjs";

const COOKIE = "nx_session";
const TTL_S = 60 * 60 * 24 * 7;

const sign = (payload) =>
  crypto.createHmac("sha256", env.APP_SECRET ?? "dev").update(payload).digest("base64url");

export function makeSession(email) {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  const payload = `${email}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readSession(req) {
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
  const [email, exp] = payload.split("|");
  if (Number(exp) < Date.now() / 1000) return null;
  return { email };
}

export function verifyUser(email, password) {
  const stored = USERS.get(String(email ?? "").toLowerCase());
  if (!stored) return false;
  const a = Buffer.from(String(password ?? ""));
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* Route handler for /api/auth/*; returns true when it handled the request. */
export async function handleAuth(req, res, url, readBody, send) {
  if (!url.pathname.startsWith("/api/auth/")) return false;
  const leaf = url.pathname.split("/").pop();
  if (leaf === "me") {
    const s = AUTH_ENABLED ? readSession(req) : null;
    send(res, 200, { enabled: AUTH_ENABLED, user: s?.email ?? null });
    return true;
  }
  if (leaf === "login" && req.method === "POST") {
    if (!AUTH_ENABLED) {
      send(res, 400, { error: "auth disabled — set AUTH_USERS + APP_SECRET" });
      return true;
    }
    const { email, password } = await readBody(req);
    if (!verifyUser(email, password)) {
      send(res, 401, { error: "invalid credentials" });
      return true;
    }
    res.setHeader("set-cookie", `${COOKIE}=${makeSession(String(email).toLowerCase())}; HttpOnly; Path=/; Max-Age=${TTL_S}; SameSite=Lax`);
    send(res, 200, { ok: true, user: String(email).toLowerCase() });
    return true;
  }
  if (leaf === "logout" && req.method === "POST") {
    res.setHeader("set-cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    send(res, 200, { ok: true });
    return true;
  }
  return false;
}

/* Gate: when enabled, every /api route needs a session EXCEPT auth, healthz, and
   config (app identity only — the login screen itself needs the app name; no
   record data rides it). */
export function gate(req, url) {
  if (!AUTH_ENABLED) return true;
  if (url.pathname.startsWith("/api/auth/")) return true;
  if (url.pathname === "/api/healthz" || url.pathname === "/api/config") return true;
  if (!url.pathname.startsWith("/api/")) return true; // static + SPA always serve (the client gate renders login)
  return readSession(req) !== null;
}
