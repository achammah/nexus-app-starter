/* Webhooks — a CLOSED, typed event catalog derived from the config (never free-text
   event names), HMAC-SHA256 signed deliveries, a per-endpoint delivery log, and a
   test-send. Delivery itself rides the job queue (retries + backoff live there). */

import crypto from "node:crypto";
import { enqueue } from "./jobs.mjs";

export const catalog = (config) => [
  ...config.objects.flatMap((o) => [`${o.key}.created`, `${o.key}.updated`, `${o.key}.deleted`]),
  "*",
];

/* fan an event out to every subscribed endpoint (call sites: the object routes) */
export function emitEvent(store, event, payload) {
  for (const w of store.webhooks ?? []) {
    if (!w.active) continue;
    if (w.events.includes(event) || w.events.includes("*")) {
      enqueue(store, "webhook-deliver", { webhookId: w.id, event, payload });
    }
  }
}

export async function handleWebhooks(req, res, url, readBody, send, store, config) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","webhooks",...]
  if (parts[1] !== "webhooks") return false;

  if (parts[2] === "catalog" && req.method === "GET") {
    send(res, 200, { events: catalog(config) });
    return true;
  }

  if (!parts[2]) {
    if (req.method === "GET") {
      const hooks = (store.webhooks ?? []).map(({ secret, ...w }) => ({ ...w, secret: `…${secret.slice(-4)}` }));
      send(res, 200, { webhooks: hooks });
      return true;
    }
    if (req.method === "POST") {
      const { url: target, events } = await readBody(req);
      try { new URL(String(target)); } catch { send(res, 400, { error: "a valid URL is required" }); return true; }
      const known = catalog(config);
      const chosen = Array.isArray(events) ? events.filter((e) => known.includes(e)) : [];
      if (chosen.length === 0) { send(res, 400, { error: "pick at least one event from the catalog" }); return true; }
      const hook = {
        id: `w_${++store.n}`, url: String(target), events: chosen,
        secret: crypto.randomBytes(24).toString("hex"),
        active: true, createdAt: new Date().toISOString(),
      };
      store.webhookAdd(hook);
      // the ONLY response that ever carries the full secret
      send(res, 201, hook);
      return true;
    }
  }

  const hook = (store.webhooks ?? []).find((w) => w.id === parts[2]);
  if (!hook) { send(res, 404, { error: "unknown webhook" }); return true; }

  if (parts[3] === "deliveries" && req.method === "GET") {
    const rows = (store.deliveries ?? []).filter((d) => d.webhookId === hook.id).reverse().slice(0, 50);
    send(res, 200, { deliveries: rows });
    return true;
  }

  if (parts[3] === "test" && req.method === "POST") {
    enqueue(store, "webhook-deliver", {
      webhookId: hook.id,
      event: "test",
      payload: { hello: "from the webhook test button", webhookId: hook.id },
    });
    send(res, 202, { ok: true });
    return true;
  }

  if (req.method === "PATCH") {
    const { active, events, url: target } = await readBody(req);
    const patch = {};
    if (typeof active === "boolean") patch.active = active;
    if (Array.isArray(events)) {
      const known = catalog(config);
      const chosen = events.filter((e) => known.includes(e));
      if (chosen.length) patch.events = chosen;
    }
    if (target) {
      try { new URL(String(target)); patch.url = String(target); } catch { send(res, 400, { error: "invalid URL" }); return true; }
    }
    store.webhookUpdate(hook.id, patch);
    const { secret, ...safe } = hook;
    send(res, 200, { ...safe, secret: `…${secret.slice(-4)}` });
    return true;
  }

  if (req.method === "DELETE") {
    store.webhookRemove(hook.id);
    send(res, 200, { ok: true });
    return true;
  }

  send(res, 404, { error: "no route" });
  return true;
}
