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
import { RemoteStore } from "./store-remote.mjs";
import { bigqueryWarehouse } from "./warehouse.mjs";
import { env, AUTH_ENABLED, FEATURES } from "./env.mjs";
import { handleAuth, gate, readSession } from "./auth.mjs";
import { handleTeams } from "./teams.mjs";
import { can } from "./permissions.mjs";
import { enqueue, startScheduler } from "./jobs.mjs";
import { handleWebhooks, emitEvent } from "./webhooks.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const cfgFile = env.CONFIG_PATH || "starter.config.json";
const CONFIG = JSON.parse(
  readFileSync(path.isAbsolute(cfgFile) ? cfgFile : path.join(ROOT, cfgFile), "utf8"),
);
const VERSION = readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
// WAREHOUSE=bigquery → the command-log spine (persistent, Nexus-native);
// unset → the in-memory mock. Same contract either way.
const store = env.WAREHOUSE === "bigquery" ? new RemoteStore(CONFIG, bigqueryWarehouse()) : new Store(CONFIG);
if (store.ready) await store.ready; // replay the event log before serving
startScheduler(store);

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

function notifyWatchers(objKey, id, summary, session) {
  if (store.watchers(objKey, id).length === 0) return;
  enqueue(store, "notify-subscribers", { objectKey: objKey, id, summary, actor: session?.email ?? null });
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
    if (parts[1] === "config") return send(res, 200, { ...CONFIG, demo: store.demo, features: FEATURES });

    const session = AUTH_ENABLED ? readSession(req, store) : null;
    // one flag → nav + page + API together: a disabled feature's routes 404
    if (parts[1] === "teams" && !FEATURES.teams) return send(res, 404, { error: "teams disabled (FEATURE_TEAMS=0)" });
    if (parts[1] === "webhooks" && !FEATURES.webhooks) return send(res, 404, { error: "webhooks disabled (FEATURE_WEBHOOKS=0)" });
    if (await handleTeams(req, res, url, readBody, send, store, session)) return;
    if (await handleWebhooks(req, res, url, readBody, send, store, CONFIG)) return;
    if (parts[1] === "jobs" && req.method === "GET") {
      const rows = [...(store.jobs ?? [])].reverse().slice(0, 50).map(({ payload, result, ...j }) => j);
      return send(res, 200, { jobs: rows });
    }
    // role for permission checks: auth off → owner-equivalent (open); on → from teams
    const role = AUTH_ENABLED ? store.roleFor(session?.email) : "owner";
    if (parts[1] === "healthz") return send(res, 200, { ok: true, version: VERSION, app: CONFIG.app.slug });

    if (parts[1] === "views") {
      const viewer = session?.email ?? null;
      if (!parts[2] && req.method === "GET") {
        const objectKey = url.searchParams.get("object") ?? "";
        return send(res, 200, { views: store.viewList(objectKey, viewer) });
      }
      if (!parts[2] && req.method === "POST") {
        const { objectKey, name, layout, state, visibility } = await readBody(req);
        if (!CONFIG.objects.some((o) => o.key === objectKey)) return send(res, 400, { error: `unknown object ${objectKey}` });
        if (!String(name ?? "").trim()) return send(res, 400, { error: "name required" });
        return send(res, 201, store.viewAdd({ objectKey, name: String(name).trim(), layout, state, visibility, createdBy: viewer }));
      }
      const view = (store.views ?? []).find((v) => v.id === parts[2]);
      if (!view) return send(res, 404, { error: "unknown view" });
      if (req.method === "PATCH") return send(res, 200, store.viewUpdate(view.id, await readBody(req)));
      if (req.method === "DELETE") { store.viewRemove(view.id); return send(res, 200, { ok: true }); }
    }

    if (parts[1] === "users" && req.method === "GET") {
      const names = (store.users ?? []).filter((u) => !u.deletedAt).map((u) => u.name);
      return send(res, 200, { users: names.length ? names : (CONFIG.users ?? []) });
    }

    if (parts[1] === "outbox") {
      // dev mail transport (server/email.mjs) — gone once SMTP_URL is set
      if (env.SMTP_URL) return send(res, 404, { error: "outbox disabled (SMTP configured)" });
      return send(res, 200, { mail: store.outboxList() });
    }

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
      // TEAM-SCOPED objects: rows belong to a team; the caller acts under the
      // x-nx-team context and their PER-TEAM role (not the app-wide highest)
      const scoped = !!cfg.teamScoped && AUTH_ENABLED;
      let teamCtx = null;
      let effRole = role;
      if (scoped) {
        const slug = String(req.headers["x-nx-team"] ?? "");
        teamCtx = slug ? store.teamBySlug(slug) : null;
        if (!teamCtx) return send(res, 400, { error: `${cfg.label.toLowerCase()} are team-scoped — pick a team (x-nx-team header)` });
        const r = store.roleIn(teamCtx.id, session?.email);
        if (!r) return send(res, 403, { error: `you are not a member of ${teamCtx.name}` });
        effRole = r;
      }
      // permission gate — config-declared (server/permissions.mjs); ctx.own covers editOwn/deleteOwn
      const deny = (action, ctx) => {
        if (can(effRole, cfg, action, ctx)) return false;
        send(res, 403, { error: `your role (${effRole}) cannot ${action} ${cfg.label.toLowerCase()}` });
        return true;
      };

      if (!parts[3]) {
        if (req.method === "GET") {
          if (deny("view")) return;
          const q = Object.fromEntries(url.searchParams);
          let rows = store.list(objKey, q);
          // scoped: only the active team's rows (rows with NO team stay visible — seed/global)
          if (scoped) rows = rows.filter((r) => !r._team || r._team === teamCtx.id);
          return send(res, 200, { rows });
        }
        if (req.method === "POST") {
          if (deny("create")) return;
          const body = await readBody(req);
          const invalid = store.validate(objKey, body);
          if (invalid) return send(res, 400, { error: invalid });
          const created = store.create(objKey, body, { createdBy: session?.email, teamId: teamCtx?.id });
          emitEvent(store, `${objKey}.created`, { row: created });
          return send(res, 201, created);
        }
      }

      if (parts[3] === "rev") return send(res, 200, { rev: store.rev(objKey) });

      const id = parts[3];
      const row0 = store.get(objKey, id);
      if (scoped && row0?._team && row0._team !== teamCtx.id) return send(res, 404, { error: "not found" });
      const own = !!(row0 && session?.email && row0._createdBy === session.email);
      if (parts[4] === "timeline") {
        if (deny("view")) return;
        return send(res, 200, { events: store.timeline(objKey, id) });
      }
      if (parts[4] === "notes" && req.method === "POST") {
        if (deny("edit", { own })) return;
        const { text } = await readBody(req);
        if (!text) return send(res, 400, { error: "text required" });
        const note = store.addNote(objKey, id, text);
        // @mentions: match account users by name → auto-subscribe + notify them
        for (const u of store.users ?? []) {
          if (u.deletedAt || !text.includes(`@${u.name}`)) continue;
          store.watchToggle(objKey, id, u.email, true);
        }
        notifyWatchers(objKey, id, `Note: ${String(text).slice(0, 140)}`, session);
        return send(res, 201, note);
      }
      if (parts[4] === "activities" && req.method === "POST") {
        if (deny("edit", { own })) return;
        const { kind, text } = await readBody(req);
        if (!["call", "email", "meeting"].includes(kind)) return send(res, 400, { error: "kind must be call|email|meeting" });
        if (!text) return send(res, 400, { error: "text required" });
        const act = store.addActivity(objKey, id, kind, text);
        notifyWatchers(objKey, id, `${kind[0].toUpperCase()}${kind.slice(1)} logged: ${String(text).slice(0, 140)}`, session);
        return send(res, 201, act);
      }
      if (parts[4] === "files") {
        if (!parts[5]) {
          if (req.method === "GET") {
            if (deny("view")) return;
            return send(res, 200, { files: store.fileList(objKey, id) });
          }
          if (req.method === "POST") {
            if (deny("edit", { own })) return;
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
      if (parts[4] === "watch" && req.method === "POST") {
        if (!session?.email) return send(res, 400, { error: "watching needs accounts (AUTH_MODE=accounts) and a session" });
        const { on } = await readBody(req);
        store.watchToggle(objKey, id, session.email, on !== false);
        return send(res, 200, { ok: true, watchers: store.watchers(objKey, id).length, me: on !== false });
      }
      if (parts[4] === "watchers" && req.method === "GET") {
        const emails = store.watchers(objKey, id);
        return send(res, 200, { count: emails.length, me: session?.email ? emails.includes(session.email) : false });
      }
      /* AI-enrichment seam — MOCK: computes a labeled placeholder value for a field
         whose config carries `primitive`. Prod: replace the mockValue line with a
         platform call (task execute / workflow trigger) using primitive.id. */
      if (parts[4] === "enrich" && req.method === "POST") {
        if (deny("edit", { own })) return;
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
        if (deny("view")) return;
        const row = store.get(objKey, id);
        return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
      }
      if (req.method === "PATCH") {
        if (deny("edit", { own })) return;
        const patch = await readBody(req);
        const invalid = store.validate(objKey, patch, id);
        if (invalid) return send(res, 400, { error: invalid });
        const row = store.patch(objKey, id, patch);
        if (row) {
          emitEvent(store, `${objKey}.updated`, { row, patch });
          notifyWatchers(objKey, id, `${Object.keys(patch).join(", ")} updated`, session);
        }
        return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
      }
      if (req.method === "DELETE") {
        if (deny("delete", { own })) return;
        const removed = store.remove(objKey, id);
        if (removed) emitEvent(store, `${objKey}.deleted`, { id });
        return removed ? send(res, 200, { ok: true }) : send(res, 404, { error: "not found" });
      }
    }
    return send(res, 404, { error: "no route" });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message ? e.message : e) });
  }
}

async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (await handleAuth(req, res, url, readBody, send, store)) return;
  if (!gate(req, url, store)) return send(res, 401, { error: "unauthorized" });
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
