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
import { handleApiKeys, resolveApiKey } from "./apikeys.mjs";
import { handleSchema } from "./schema.mjs";
import { sendMail } from "./email.mjs";

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

/* CSV import rows arrive as strings — coerce each value to its field's
   declared type so the type validators judge real values, and DROP keys that
   match no field (an unmapped column must never become a phantom property).
   Empty strings are omitted (an empty CSV cell is "no value", not ""). */
/* local-clock yyyy-mm-dd (due dates are calendar days, not instants) */
const ymdLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ymdPlusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymdLocal(d); };

/* Task validation. Link liveness is checked at WRITE time for links the task
   does not already carry — a link whose record gets destroyed LATER stays on
   the task (dangling, rendered degraded) and must never block a later patch
   that merely keeps it (e.g. unlinking a sibling). */
function validateTask(body, { partial = false, prior = [] } = {}) {
  if ((!partial || body.title !== undefined) && !String(body.title ?? "").trim()) return "title required";
  if (body.status !== undefined && !["todo", "doing", "done"].includes(body.status)) return "status must be todo|doing|done";
  if (body.due !== undefined && body.due !== null && body.due !== "") {
    const s = String(body.due);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s).getTime())) return "due must be a yyyy-mm-dd date";
  }
  if (body.assignee !== undefined && body.assignee !== null && typeof body.assignee !== "string") return "assignee must be text";
  if (body.links !== undefined) {
    if (!Array.isArray(body.links)) return "links must be a list";
    const kept = new Set(prior.map((l) => `${l.obj}:${l.id}`));
    for (const l of body.links) {
      const cfg = CONFIG.objects.find((o) => o.key === l?.obj);
      if (!cfg) return `links: unknown object ${l?.obj}`;
      if (!kept.has(`${l.obj}:${l.id}`) && !store.get(l.obj, l.id))
        return `links: no live ${cfg.labelOne.toLowerCase()} ${l?.id}`;
    }
  }
  return null;
}

/* task-assignment mail: fires only when the assignee resolves to a live account
   user who isn't the actor (self-assignment stays silent). Route-side, never in
   the store op — replay must not re-mail. */
function mailTaskAssignee(task, session) {
  const u = (store.users ?? []).find((x) => !x.deletedAt && x.name === task.assignee);
  if (!u || u.email === session?.email) return;
  sendMail(store, {
    to: u.email, kind: "task-assigned",
    subject: `Task assigned: ${task.title}`,
    text: `${task.title}${task.due ? `\nDue: ${task.due}` : ""}\n\nOpen: /#/p/tasks\n\nYou get this because the task was assigned to you.`,
  });
}

function coerceImportRow(cfg, raw) {
  const out = {};
  for (const f of cfg.fields) {
    let v = raw?.[f.key];
    if (typeof v === "string") v = v.trim();
    if (v === undefined || v === null || v === "") continue;
    if ((f.type === "number" || f.type === "currency" || f.type === "rating") && typeof v === "string") {
      const n = Number(v.replaceAll(",", ""));
      if (!Number.isNaN(n)) v = n; // NaN → keep the string; the validator names the field
    }
    if (f.type === "boolean" && typeof v === "string") {
      if (["true", "yes", "1"].includes(v.toLowerCase())) v = true;
      else if (["false", "no", "0"].includes(v.toLowerCase())) v = false;
    }
    if ((f.type === "array" || f.type === "multiselect") && typeof v === "string") {
      v = v.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    }
    out[f.key] = v;
  }
  return out;
}

async function api(req, res, url, apiKey = null) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api", ...]
  try {
    if (parts[1] === "config") return send(res, 200, { ...CONFIG, demo: store.demo, features: FEATURES });

    const session = AUTH_ENABLED ? readSession(req, store) : null;
    // one flag → nav + page + API together: a disabled feature's routes 404
    if (parts[1] === "teams" && !FEATURES.teams) return send(res, 404, { error: "teams disabled (FEATURE_TEAMS=0)" });
    if (parts[1] === "webhooks" && !FEATURES.webhooks) return send(res, 404, { error: "webhooks disabled (FEATURE_WEBHOOKS=0)" });
    if (parts[1] === "apikeys" && !FEATURES.apikeys) return send(res, 404, { error: "apikeys disabled (FEATURE_APIKEYS=0)" });
    if (parts[1] === "tasks" && !FEATURES.tasks) return send(res, 404, { error: "tasks disabled (FEATURE_TASKS=0)" });
    if (parts[1] === "schema" && !FEATURES.schema) return send(res, 404, { error: "schema editing disabled (FEATURE_SCHEMA=0)" });
    if (await handleTeams(req, res, url, readBody, send, store, session)) return;
    if (await handleWebhooks(req, res, url, readBody, send, store, CONFIG)) return;
    if (parts[1] === "jobs" && req.method === "GET") {
      const rows = [...(store.jobs ?? [])].reverse().slice(0, 50).map(({ payload, result, ...j }) => j);
      return send(res, 200, { jobs: rows });
    }
    // role for permission checks: an API key acts as ITS role (with auth off a
    // key scopes DOWN); no key → auth off = owner-equivalent, on = from teams
    const role = apiKey ? apiKey.role : AUTH_ENABLED ? store.roleFor(session?.email) : "owner";
    if (await handleApiKeys(req, res, url, readBody, send, store, role)) return;
    if (await handleSchema(req, res, url, readBody, send, store, role)) return;
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

    if (parts[1] === "tasks") {
      // any signed-in member manages tasks (auth off → owner); VIEWER is read-only
      const denyWrite = () => {
        if (role !== "viewer") return false;
        send(res, 403, { error: "your role (viewer) cannot manage tasks" });
        return true;
      };
      // labels resolve LIVE at read time (rename-safe); a destroyed/trashed
      // record leaves label:null — the UIs render the link degraded
      const enrich = (t) => ({
        ...t,
        links: t.links.map((l) => {
          const cfg = CONFIG.objects.find((o) => o.key === l.obj);
          const row = cfg ? store.get(l.obj, l.id) : null;
          const primary = cfg?.fields.find((f) => f.primary) ?? cfg?.fields[0];
          return { ...l, label: row ? String(row[primary.key] ?? l.id) : null, objLabel: cfg?.labelOne ?? l.obj };
        }),
      });
      if (!parts[2]) {
        if (req.method === "GET") {
          let rows = [...(store.tasks ?? [])];
          const q = url.searchParams;
          if (q.get("status")) rows = rows.filter((t) => t.status === q.get("status"));
          if (q.get("assignee")) rows = rows.filter((t) => t.assignee === q.get("assignee"));
          if (q.get("record")) {
            const [obj, ...rest] = q.get("record").split(":");
            const rid = rest.join(":");
            rows = rows.filter((t) => t.links.some((l) => l.obj === obj && l.id === rid));
          }
          const dueQ = q.get("due");
          if (dueQ) {
            const today = ymdLocal();
            rows = rows.filter((t) => {
              if (!t.due) return false;
              if (dueQ === "overdue") return t.due < today && t.status !== "done";
              if (dueQ === "today") return t.due === today;
              if (dueQ === "week") return t.due >= today && t.due <= ymdPlusDays(7);
              return true;
            });
          }
          // me = the session's DIRECTORY name (assignees are names) — feeds my-tasks-first
          const me = session?.email ? (store.userByEmail(session.email)?.name ?? null) : null;
          return send(res, 200, { tasks: rows.map(enrich), me });
        }
        if (req.method === "POST") {
          if (denyWrite()) return;
          const body = await readBody(req);
          const invalid = validateTask(body);
          if (invalid) return send(res, 400, { error: invalid });
          const t = store.taskAdd({
            title: String(body.title).trim(), status: body.status, due: body.due,
            assignee: body.assignee, links: body.links, createdBy: session?.email,
          });
          mailTaskAssignee(t, session);
          return send(res, 201, enrich(t));
        }
      }
      const task0 = (store.tasks ?? []).find((x) => x.id === parts[2]);
      if (!task0) return send(res, 404, { error: "task not found" });
      if (req.method === "PATCH") {
        if (denyWrite()) return;
        const patch = await readBody(req);
        const invalid = validateTask(patch, { partial: true, prior: task0.links });
        if (invalid) return send(res, 400, { error: invalid });
        const prevAssignee = task0.assignee;
        const t = store.taskUpdate(task0.id, patch);
        if (t.assignee && t.assignee !== prevAssignee) mailTaskAssignee(t, session);
        return send(res, 200, enrich(t));
      }
      if (req.method === "DELETE") {
        if (denyWrite()) return;
        store.taskRemove(task0.id);
        return send(res, 200, { ok: true });
      }
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
          // upsert semantic: a unique value colliding with a TRASHED row silently
          // restores that row and applies the incoming data (import/re-sync friendly)
          const zombie = store.uniqueResurrectMatch(objKey, body);
          if (zombie) {
            const invalid = store.validate(objKey, body, zombie.id);
            if (invalid) return send(res, 400, { error: invalid });
            store.restoreRow(objKey, zombie.id);
            const row = store.project(objKey, store.patch(objKey, zombie.id, body));
            emitEvent(store, `${objKey}.restored`, { row });
            return send(res, 200, { ...row, _resurrected: true });
          }
          const invalid = store.validate(objKey, body);
          if (invalid) return send(res, 400, { error: invalid });
          const created = store.project(objKey, store.create(objKey, body, { createdBy: session?.email, teamId: teamCtx?.id }));
          emitEvent(store, `${objKey}.created`, { row: created });
          return send(res, 201, created);
        }
      }

      if (parts[3] === "trash" && !parts[4]) {
        if (req.method === "GET") {
          if (deny("view")) return;
          let rows = store.trashList(objKey);
          if (scoped) rows = rows.filter((r) => !r._team || r._team === teamCtx.id);
          return send(res, 200, { rows });
        }
      }

      if (parts[3] === "merge" && !parts[4] && req.method === "POST") {
        if (deny("edit") || deny("delete")) return;
        const { ids, winnerId, preview } = await readBody(req);
        if (!Array.isArray(ids) || ids.length < 2) return send(res, 400, { error: "pick at least two records to merge" });
        if (ids.length > 10) return send(res, 400, { error: "merge at most 10 records at a time" });
        if (!ids.includes(winnerId)) return send(res, 400, { error: "winnerId must be one of ids" });
        const missing = ids.find((x) => !store.get(objKey, x));
        if (missing) return send(res, 404, { error: `record ${missing} not found` });
        if (preview) {
          const plan = store.mergePlan(objKey, ids, winnerId);
          return send(res, 200, { fields: plan.fields, winnerId });
        }
        const winner = store.mergeRows(objKey, ids, winnerId);
        emitEvent(store, `${objKey}.updated`, { row: winner });
        for (const id of ids) if (id !== winnerId) emitEvent(store, `${objKey}.deleted`, { id });
        return send(res, 200, { row: winner, merged: ids.length - 1 });
      }

      /* Batch CSV import — rows arrive already mapped {fieldKey: value}. Same
         semantics as N sequential creates: a unique hit on a LIVE row skips
         (duplicate), on a TRASHED row resurrects (the existing upsert), an
         invalid row fails with the validator's reason. preview:true runs the
         same classification without mutating. The loop lives HERE so the
         command log stays a deterministic sequence of the existing logged ops
         (create / restoreRow / patch) — no new store op. */
      if (parts[3] === "import" && !parts[4] && req.method === "POST") {
        if (deny("create")) return;
        const { rows: incoming, preview } = await readBody(req);
        if (!Array.isArray(incoming) || incoming.length === 0) return send(res, 400, { error: "rows[] required" });
        if (incoming.length > 2000) return send(res, 400, { error: "import at most 2000 rows per call" });
        const primary = cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
        const results = [];
        const totals = { created: 0, restored: 0, skipped: 0, failed: 0 };
        // in-file duplicate guard: preview and run must AGREE. Unique values a
        // prior row of THIS batch consumed (created/restored) mark the next
        // occurrence "skipped" in both paths — in a live run the collision
        // would surface anyway, but preview mutates nothing, so only this set
        // keeps its verdicts honest (and the reason clearer).
        const seenUnique = new Map(); // field key → Set of consumed values
        const uniqueVals = (body) =>
          cfg.fields.filter((f) => f.unique && body[f.key] !== undefined && body[f.key] !== null && body[f.key] !== "")
            .map((f) => [f.key, String(body[f.key])]);
        const inFileDup = (body) => uniqueVals(body).some(([k, v]) => seenUnique.get(k)?.has(v));
        const markSeen = (body) => {
          for (const [k, v] of uniqueVals(body)) {
            if (!seenUnique.has(k)) seenUnique.set(k, new Set());
            seenUnique.get(k).add(v);
          }
        };
        for (let i = 0; i < incoming.length; i++) {
          const body = coerceImportRow(cfg, incoming[i]);
          if (body[primary.key] === undefined) {
            totals.failed++;
            results.push({ index: i, verdict: "failed", reason: `${primary.label} is required` });
            continue;
          }
          if (inFileDup(body)) {
            totals.skipped++;
            results.push({ index: i, verdict: "skipped", reason: "duplicate within this file" });
            continue;
          }
          const live = store.uniqueLiveMatch(objKey, body);
          if (live) {
            totals.skipped++;
            results.push({ index: i, verdict: "skipped", id: live.id, reason: "duplicate — a live row already holds this unique value" });
            continue;
          }
          const zombie = store.uniqueResurrectMatch(objKey, body);
          if (zombie) {
            const invalid = store.validate(objKey, body, zombie.id);
            if (invalid) {
              totals.failed++;
              results.push({ index: i, verdict: "failed", reason: invalid });
              continue;
            }
            if (!preview) {
              store.restoreRow(objKey, zombie.id);
              const row = store.patch(objKey, zombie.id, body);
              emitEvent(store, `${objKey}.restored`, { row });
            }
            totals.restored++;
            markSeen(body);
            results.push({ index: i, verdict: "restored", id: zombie.id });
            continue;
          }
          const invalid = store.validate(objKey, body);
          if (invalid) {
            totals.failed++;
            results.push({ index: i, verdict: "failed", reason: invalid });
            continue;
          }
          totals.created++;
          markSeen(body);
          if (preview) {
            results.push({ index: i, verdict: "created" });
            continue;
          }
          const created = store.create(objKey, body, { createdBy: session?.email, teamId: teamCtx?.id });
          emitEvent(store, `${objKey}.created`, { row: created });
          results.push({ index: i, verdict: "created", id: created.id });
        }
        return send(res, 200, { results, totals, preview: !!preview });
      }

      /* Duplicate sweep — read-only, deterministic (see store duplicateGroups:
         normalized-name / word-boundary-prefix / email / domain rules; unique
         fields skipped because the server already rejects live collisions).
         Team-scoped objects sweep only the caller's visible rows. */
      if (parts[3] === "duplicates" && !parts[4] && req.method === "GET") {
        if (deny("view")) return;
        const pool = scoped ? (store.rows[objKey] ?? []).filter((r) => !r._team || r._team === teamCtx.id) : null;
        return send(res, 200, { groups: store.duplicateGroups(objKey, pool) });
      }

      if (parts[3] === "rev") return send(res, 200, { rev: store.rev(objKey) });

      const id = parts[3];
      const row0 = store.getAny(objKey, id);
      if (scoped && row0?._team && row0._team !== teamCtx.id) return send(res, 404, { error: "not found" });
      const own = !!(row0 && session?.email && row0._createdBy === session.email);
      if (parts[4] === "timeline") {
        if (deny("view")) return;
        return send(res, 200, { events: store.timeline(objKey, id) });
      }
      /* Possible duplicates for ONE record (feeds the record-page panel) */
      if (parts[4] === "duplicates" && req.method === "GET") {
        if (deny("view")) return;
        const pool = scoped ? (store.rows[objKey] ?? []).filter((r) => !r._team || r._team === teamCtx.id) : null;
        return send(res, 200, { candidates: store.duplicatesFor(objKey, id, pool) });
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
        return send(res, 200, store.project(objKey, store.enrich(objKey, id, field, mockValue, via)));
      }
      if (parts[4] === "restore" && req.method === "POST") {
        if (deny("restore", { own })) return;
        const row = store.restoreRow(objKey, id);
        if (!row) return send(res, 404, { error: "not in trash" });
        emitEvent(store, `${objKey}.restored`, { row: store.project(objKey, row) });
        return send(res, 200, store.project(objKey, row));
      }
      if (parts[4] === "destroy" && req.method === "DELETE") {
        if (deny("destroy", { own })) return;
        if (!row0) return send(res, 404, { error: "not found" });
        store.destroyRow(objKey, id);
        emitEvent(store, `${objKey}.destroyed`, { id });
        return send(res, 200, { ok: true });
      }
      if (req.method === "GET") {
        if (deny("view")) return;
        const row = store.getView(objKey, id);
        return row ? send(res, 200, row) : send(res, 404, { error: "not found" });
      }
      if (req.method === "PATCH") {
        if (deny("edit", { own })) return;
        const patch = await readBody(req);
        const invalid = store.validate(objKey, patch, id);
        if (invalid) return send(res, 400, { error: invalid });
        const row = store.project(objKey, store.patch(objKey, id, patch));
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
    // store write ops throw {status:400} for relation-normalization errors
    // (ambiguous label, unknown target) — surface them as client errors
    return send(res, e && e.status ? e.status : 500, { error: String(e && e.message ? e.message : e) });
  }
}

async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (await handleAuth(req, res, url, readBody, send, store)) return;
  // API keys authenticate BEFORE the session gate: a valid key acts as its
  // role whether or not account auth is on; a dead key is an explicit 401,
  // never a silent fall-through to anonymous access
  const viaKey = resolveApiKey(req, store);
  if (viaKey?.error) return send(res, 401, { error: viaKey.error });
  if (!viaKey && !gate(req, url, store)) return send(res, 401, { error: "unauthorized" });
  if (url.pathname.startsWith("/api/")) return api(req, res, url, viaKey?.key ?? null);

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
