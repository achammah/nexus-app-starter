#!/usr/bin/env node
/* Zero-dependency backend for the starter.
   - Serves dist/ (built UI) with an index fallback that never crash-loops
     (missing dist → a plain placeholder page, so a delivery failure reads as a
     placeholder, not a boot mystery).
   - /api: config-driven record store (list/get/patch/create), timeline + notes,
     and the app_state kv (append-only history + latest-per-key restore — the
     data-spine pattern; swap `store.mjs` for a warehouse-backed client in prod).
   - Binds PORT + 3000 + 8080 simultaneously (auto-build images may probe an
     unspecified port).
   - GET /healthz carries VERSION + sha marker for deploy_watch content checks. */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.mjs";
import { env } from "./env.mjs";
import { handleAuth, gate } from "./auth.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const cfgFile = env.CONFIG_PATH || "starter.config.json";
const CONFIG = JSON.parse(
  readFileSync(path.isAbsolute(cfgFile) ? cfgFile : path.join(ROOT, cfgFile), "utf8"),
);
const VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
const store = new Store(CONFIG);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function send(res, code, body, type = "application/json") {
  const data = type === "application/json" ? JSON.stringify(body) : body;
  // API JSON is NEVER browser-cacheable: a max-age here serves stale lists/timelines
  // for 60s after every write — the "moved card still in the old column" class
  // (measured by this repo's own journey suite).
  const cache = type === "application/json" ? "no-store"
    : type === "text/html" ? "no-cache" : "public, max-age=60";
  res.writeHead(code, { "content-type": type, "cache-control": cache });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  try {
    if (parts[1] === "config") return send(res, 200, { ...CONFIG, demo: store.demo });
    if (parts[1] === "healthz") return send(res, 200, { ok: true, version: VERSION, app: CONFIG.app.slug });

    if (parts[1] === "state") {
      if (req.method === "GET") return send(res, 200, store.stateLatest());
      if (req.method === "POST") {
        const { key, value } = await readBody(req);
        if (!key) return send(res, 400, { error: "key required" });
        return send(res, 200, store.stateAppend(key, value));
      }
    }

    if (parts[1] === "objects") {
      const objKey = parts[2];
      const cfg = CONFIG.objects.find((o) => o.key === objKey);
      if (!cfg) return send(res, 404, { error: `unknown object ${objKey}` });

      if (!parts[3]) {
        if (req.method === "GET") {
          const q = Object.fromEntries(url.searchParams);
          return send(res, 200, { rows: store.list(objKey, q) });
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          const invalid = store.validate(objKey, body);
          if (invalid) return send(res, 400, { error: invalid });
          return send(res, 201, store.create(objKey, body));
        }
      }

      if (parts[3] === "rev") return send(res, 200, { rev: store.rev(objKey) });

      const id = parts[3];
      if (parts[4] === "timeline") return send(res, 200, { events: store.timeline(objKey, id) });
      if (parts[4] === "notes" && req.method === "POST") {
        const { text } = await readBody(req);
        if (!text) return send(res, 400, { error: "text required" });
        return send(res, 201, store.addNote(objKey, id, text));
      }
      if (parts[4] === "activities" && req.method === "POST") {
        const { kind, text } = await readBody(req);
        if (!["call", "email", "meeting"].includes(kind)) return send(res, 400, { error: "kind must be call|email|meeting" });
        if (!text) return send(res, 400, { error: "text required" });
        return send(res, 201, store.addActivity(objKey, id, kind, text));
      }
      if (parts[4] === "files") {
        if (!parts[5]) {
          if (req.method === "GET") return send(res, 200, { files: store.fileList(objKey, id) });
          if (req.method === "POST") {
            const { name, mime, data } = await readBody(req);
            if (!name || typeof data !== "string") return send(res, 400, { error: "name + base64 data required" });
            if (data.length > 7_000_000) return send(res, 413, { error: "file too large (5 MB max)" });
            return send(res, 201, store.fileAdd(objKey, id, { name, mime: mime || "application/octet-stream", data }));
          }
        }
        const f = store.fileGet(objKey, id, parts[5]);
        if (!f) return send(res, 404, { error: "file not found" });
        res.writeHead(200, {
          "content-type": f.mime,
          "content-disposition": `attachment; filename="${f.name.replaceAll('"', "")}"`,
          "cache-control": "no-store",
        });
        return res.end(Buffer.from(f.data, "base64"));
      }
      /* AI-enrichment seam — MOCK: computes a labeled placeholder value for a field
         whose config carries `primitive`. Prod: replace the mockValue line with a
         platform call (task execute / workflow trigger) using primitive.id. */
      if (parts[4] === "enrich" && req.method === "POST") {
        const { field } = await readBody(req);
        const f = cfg.fields.find((x) => x.key === field);
        if (!f) return send(res, 400, { error: `unknown field ${field}` });
        if (!f.primitive) return send(res, 400, { error: `field ${field} has no primitive configured` });
        const row = store.get(objKey, id);
        if (!row) return send(res, 404, { error: "not found" });
        const namePrimary = cfg.fields.find((x) => x.primary) ?? cfg.fields[0];
        const via = `${f.primitive.label ?? f.primitive.kind} (mock)`;
        const mockValue = `(mock) ${f.label} for ${row[namePrimary.key] ?? id} — replace the /enrich mock in server/server.mjs with a real ${f.primitive.kind} call.`;
        return send(res, 200, store.enrich(objKey, id, field, mockValue, via));
      }
      if (req.method === "GET") {
        const row = store.get(objKey, id);
        return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
      }
      if (req.method === "PATCH") {
        const patch = await readBody(req);
        const invalid = store.validate(objKey, patch);
        if (invalid) return send(res, 400, { error: invalid });
        const row = store.patch(objKey, id, patch);
        return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
      }
      if (req.method === "DELETE") {
        return store.remove(objKey, id) ? send(res, 200, { ok: true }) : send(res, 404, { error: "not found" });
      }
    }
    return send(res, 404, { error: "no route" });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message ? e.message : e) });
  }
}

async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (await handleAuth(req, res, url, readBody, send)) return;
  if (!gate(req, url)) return send(res, 401, { error: "unauthorized" });
  if (url.pathname.startsWith("/api/")) return api(req, res, url);

  // static: dist/ with SPA fallback; placeholder when dist is missing
  let fp = path.join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(fp)) fp = path.join(DIST, "index.html");
  if (!existsSync(fp)) {
    return send(res, 200,
      `<!doctype html><meta charset="utf-8"><title>${CONFIG.app.name}</title>
       <body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
       <div style="text-align:center"><h1>${CONFIG.app.name}</h1>
       <p>UI bundle not built yet — run <code>npm run build</code>. API is live at <code>/api/healthz</code> (v${VERSION}).</p>
       </div></body>`, "text/html");
  }
  try {
    const data = await readFile(fp);
    send(res, 200, data, MIME[path.extname(fp)] || "application/octet-stream");
  } catch {
    send(res, 404, { error: "not found" });
  }
}

const ports = [...new Set([env.PORT, 3000, 8080])];
for (const p of ports) {
  const srv = http.createServer(handler);
  srv.on("error", (e) => console.error(`[server] port ${p}: ${e.code}`));
  srv.listen(p, () => console.log(`[server] ${CONFIG.app.slug} v${VERSION} on :${p}`));
}
