/* API keys — programmatic access with role scoping. A key is `nak_<32 hex>`;
   the store keeps only its sha256 hash (+ display prefix/last4), never the
   secret. A request carrying `x-api-key: nak_…` (or `Authorization: Bearer
   nak_…`) acts as the key's role (viewer|member|admin) across the whole /api
   surface through the same permission tables as a signed-in member; an
   unknown or revoked key answers 401 — presenting a credential is a claim,
   never a silent fall-through. Keys work with account auth on OR off (auth
   off: a key still scopes DOWN to its role). Team-scoped objects stay
   session-only — keys carry no team membership.
   Management (list/create/revoke) is owner/admin; the create response is the
   ONLY one carrying the full secret (webhooks set that precedent). */

import crypto from "node:crypto";

const ROLES = ["viewer", "member", "admin"];

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function secretFrom(req) {
  const direct = req.headers["x-api-key"];
  if (typeof direct === "string" && direct.startsWith("nak_")) return direct;
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer nak_")) return auth.slice(7);
  return null;
}

/* null = no key presented · {key} = valid · {error} = presented but dead */
export function resolveApiKey(req, store) {
  const secret = secretFrom(req);
  if (!secret) return null;
  const hash = sha256(secret);
  const key = (store.apiKeys ?? []).find((k) => k.hash === hash);
  if (!key) return { error: "unknown API key" };
  if (key.revokedAt) return { error: "this API key is revoked" };
  return { key };
}

const safe = ({ hash, ...k }) => k;

/* Route handler for /api/apikeys*; returns true when it handled the request. */
export async function handleApiKeys(req, res, url, readBody, send, store, role) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","apikeys",...]
  if (parts[1] !== "apikeys") return false;

  if (!["owner", "admin"].includes(role)) {
    send(res, 403, { error: `your role (${role}) cannot manage API keys` });
    return true;
  }

  if (!parts[2]) {
    if (req.method === "GET") {
      send(res, 200, { keys: (store.apiKeys ?? []).map(safe) });
      return true;
    }
    if (req.method === "POST") {
      const { name, role: keyRole } = await readBody(req);
      if (!String(name ?? "").trim()) { send(res, 400, { error: "name required" }); return true; }
      if (!ROLES.includes(keyRole)) { send(res, 400, { error: `role must be one of: ${ROLES.join(", ")}` }); return true; }
      // the secret is born HERE — logged store ops must replay deterministically,
      // so randomness never lives inside a store method
      const secret = `nak_${crypto.randomBytes(16).toString("hex")}`;
      const key = store.apiKeyAdd({
        name: String(name).trim(), role: keyRole,
        prefix: secret.slice(0, 10), last4: secret.slice(-4), hash: sha256(secret),
      });
      send(res, 201, { ...safe(key), secret });
      return true;
    }
  }

  const key = (store.apiKeys ?? []).find((k) => k.id === parts[2]);
  if (!key) { send(res, 404, { error: "unknown API key" }); return true; }

  if (parts[3] === "revoke" && req.method === "POST") {
    store.apiKeyRevoke(key.id);
    send(res, 200, { ok: true, key: safe(key) });
    return true;
  }

  send(res, 404, { error: "no route" });
  return true;
}
