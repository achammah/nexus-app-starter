/* In-memory record store + app_state kv (the data-spine SHAPE, mock edition).
   Contract mirrored by prod: swap this module for a warehouse-backed client and the
   /api surface (and therefore the UI + journeys) does not change.
   app_state: APPEND-ONLY history + latest-per-key reads — append-only is what makes
   a clobber recoverable; keep that property in any production twin. */

import { seed } from "./seed.mjs";

/* URL-or-domain probe shared by `url` and `links` validation — bare domains
   ("acme.example") are fine, probed with a scheme prefixed. */
const urlOk = (s) => [s, `https://${s}`].some((u) => { try { new URL(u); return u.includes("."); } catch { return false; } });

/* Readable flat text for a field value in timeline summaries — shaped values
   log as "12500 EUR" / "a; b" / "street, city" / "First Last", never
   "[object Object]". Server-side twin of the UI's cell formats (kept
   consistent by convention; this module cannot import from src/ui). */
const flatVal = (v, type) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => flatVal(x, undefined)).join("; ") : "—";
  if (typeof v === "object") {
    if (type === "money" && typeof v.amount === "number") return `${v.amount} ${v.code ?? ""}`.trim();
    if (type === "fullName") return [v.first, v.last].filter(Boolean).join(" ") || "—";
    if (type === "address") return [v.street, v.city].filter(Boolean).join(", ") || "—";
    const vals = Object.values(v).filter((x) => x !== null && x !== undefined && x !== "");
    return vals.length ? vals.map((x) => flatVal(x, undefined)).join(", ") : "—";
  }
  return String(v);
};

/* Duplicate-detection normalizers. dupNorm compares names ignoring case,
   accents, spacing and punctuation (values pass through flatVal first, so
   shaped primaries like fullName compare as their readable text); dupHost
   compares url fields by domain (scheme, www. and path stripped). */
const dupNorm = (v, type) =>
  flatVal(v, type)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const dupHost = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .trim();

export class Store {
  /* Time is injectable: during warehouse replay (store-remote.mjs) _nowOverride pins
     every timestamp to the ORIGINAL event's clock, so restored state renders true. */
  _now() {
    return this._nowOverride ? new Date(this._nowOverride) : new Date();
  }
  _nowMs() {
    return this._nowOverride ? new Date(this._nowOverride).getTime() : Date.now();
  }

  constructor(config) {
    this.config = config;
    const seeded = seed(config);
    this.rows = seeded.rows;           // { objectKey: RecordRow[] }
    this.events = seeded.events;       // { objectKey: { id: TimelineEvent[] } }
    this.state = [];                   // append-only [{key, value, ts}]
    this.files = {};                   // { objectKey: { id: [{id,name,mime,size,ts,data}] } }
    this.revs = {};                    // { objectKey: n } — bumped on ANY mutation (live-sync poll target)
    this.n = 1000;
    // seeded fictional rows present → surfaces as a "Demo data" badge in the UI
    this.demo = Object.values(this.rows).some((rows) => rows.length > 0);
    this._normalizeAllRelations();
  }

  /* ---- relation identity: rows STORE target ids; every read PROJECTS labels ----
     Wire shapes: single = "re_1001" · multiple = ["ce_1001", …] · polymorphic =
     { object, id } (poly refs carry their object key — id prefixes can collide
     across objects). Writes accept an id, an {object?, id} ref, or a primary-label
     string that resolves uniquely; an ambiguous label errors (400), an unmatched
     label stays verbatim (a dangling label — today's behavior). Reads return the
     projected LABEL in the field itself, so the API keeps its historical label
     semantics, plus a `_refs` decoration carrying the raw ids for identity-aware
     UI (pickers, disambiguation, integrity checks). */

  relFields(objKey) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    return (cfg?.fields ?? []).filter((f) => f.type === "relation");
  }

  relTargets(f) {
    return Array.isArray(f.relationTargets) && f.relationTargets.length ? f.relationTargets : f.relation ? [f.relation] : [];
  }

  /* a target row's display label = its primary field, shaped-aware (fullName → joined) */
  relLabel(targetKey, row) {
    const cfg = this.config.objects.find((o) => o.key === targetKey);
    if (!cfg || !row) return "";
    const primary = cfg.fields.find((x) => x.primary) ?? cfg.fields[0];
    const s = flatVal(row[primary.key], primary.type);
    return s === "—" ? "" : s;
  }

  /* per-call id→row maps over the targets of the given relation fields — built
     once per projection, never persisted. Includes trashed rows: a trashed
     target keeps projecting its label (restore heals silently). */
  _relMaps(rels) {
    const maps = {};
    for (const f of rels) for (const t of this.relTargets(f)) maps[t] ??= new Map((this.rows[t] ?? []).map((r) => [r.id, r]));
    return maps;
  }

  _refLabel(f, ref, maps) {
    const isObj = typeof ref === "object" && ref !== null;
    const tKey = isObj ? ref.object : this.relTargets(f)[0];
    const hit = maps[tKey]?.get(isObj ? ref.id : ref);
    if (hit) return this.relLabel(tKey, hit);
    return isObj ? "" : String(ref ?? ""); // unmatched string = dangling label, verbatim
  }

  _projectRow(objKey, row, rels, maps) {
    const out = { ...row };
    const refs = {};
    for (const f of rels) {
      const v = row[f.key];
      if (v === null || v === undefined || v === "") continue;
      if (f.multiple) {
        const list = Array.isArray(v) ? v : [v];
        refs[f.key] = list.map((x) => (typeof x === "object" && x !== null ? { ...x } : x));
        out[f.key] = list.map((x) => this._refLabel(f, x, maps));
      } else if (typeof v === "object") {
        refs[f.key] = { ...v };
        out[f.key] = this._refLabel(f, v, maps);
      } else {
        if (this.relTargets(f).some((t) => maps[t]?.has(v))) refs[f.key] = v;
        out[f.key] = this._refLabel(f, v, maps); // dangling labels pass through verbatim
      }
    }
    if (Object.keys(refs).length) out._refs = refs;
    return out;
  }

  /* projected single row — route GET / create / patch responses */
  project(objKey, row) {
    if (!row) return row;
    const rels = this.relFields(objKey).filter((f) => f.isActive !== false);
    if (!rels.length) return row;
    return this._projectRow(objKey, row, rels, this._relMaps(rels));
  }

  getView(objKey, id) {
    return this.project(objKey, this.get(objKey, id));
  }

  /* readable label text for a relation VALUE (timeline summaries, merge preview) */
  _relDisplayText(f, v) {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "";
    const maps = this._relMaps([f]);
    const list = f.multiple && Array.isArray(v) ? v : [v];
    return list.map((x) => this._refLabel(f, x, maps)).filter(Boolean).join("; ");
  }

  _relThrow(msg) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }

  /* Write-side normalization — lives in the STORE WRITE OPS (create/patch), so
     every writer (routes, CSV import, merge's fill, any future caller) shares
     ONE implementation; routes never normalize. Mutates the body in place, so
     the command log records the NORMALIZED values. Errors throw with status
     400 (thrown ops are never logged — the wrapper logs after success). */
  normalizeRelations(objKey, body) {
    for (const f of this.relFields(objKey)) {
      if (!(f.key in body)) continue;
      const v = body[f.key];
      if (v === null || v === undefined || v === "") continue;
      if (f.multiple) {
        if (!Array.isArray(v)) this._relThrow(`${f.label} must be a list`);
        const out = [];
        const seen = new Set();
        for (const entry of v) {
          const norm = this._normOneRef(f, entry);
          const key = typeof norm === "object" && norm !== null ? `${norm.object}:${norm.id}` : String(norm);
          if (!seen.has(key)) { seen.add(key); out.push(norm); }
        }
        body[f.key] = out;
      } else {
        body[f.key] = this._normOneRef(f, v);
      }
    }
  }

  _normOneRef(f, entry) {
    const targets = this.relTargets(f);
    if (typeof entry === "object" && entry !== null) {
      const tKey = entry.object ?? targets[0];
      if (!targets.includes(tKey)) this._relThrow(`${f.label}: "${tKey}" is not an allowed target (${targets.join(", ")})`);
      if (!(this.rows[tKey] ?? []).some((r) => r.id === entry.id)) this._relThrow(`${f.label}: no ${tKey} record "${entry.id}"`);
      return f.relationTargets ? { object: tKey, id: entry.id } : entry.id;
    }
    const s = String(entry);
    for (const tKey of targets) {
      if ((this.rows[tKey] ?? []).some((r) => r.id === s)) return f.relationTargets ? { object: tKey, id: s } : s;
    }
    const hits = [];
    for (const tKey of targets) {
      for (const r of this.rows[tKey] ?? []) {
        if (!r._deletedAt && this.relLabel(tKey, r) === s) hits.push({ object: tKey, id: r.id });
      }
    }
    if (hits.length === 1) return f.relationTargets ? hits[0] : hits[0].id;
    if (hits.length > 1) this._relThrow(`${f.label}: "${s}" matches ${hits.length} records (${hits.map((h) => `${h.object}/${h.id}`).join(", ")}) — pass an id`);
    return s; // no match → dangling label kept verbatim
  }

  /* Boot pass: legacy label values in seed/config rows normalize to ids ONCE —
     in memory, BEFORE any command-log replay, logging nothing, id counter
     untouched. INVARIANT: idempotent — ids resolve to themselves and dangling
     labels stay verbatim, so running it over already-normalized rows is a
     no-op. An ambiguous seed label stays verbatim rather than guessing. */
  _normalizeAllRelations() {
    for (const o of this.config.objects) {
      const rels = (o.fields ?? []).filter((f) => f.type === "relation");
      if (!rels.length) continue;
      for (const row of this.rows[o.key] ?? []) {
        for (const f of rels) {
          const v = row[f.key];
          if (v === null || v === undefined || v === "") continue;
          try {
            if (f.multiple) { if (Array.isArray(v)) row[f.key] = v.map((x) => this._normOneRef(f, x)); }
            else row[f.key] = this._normOneRef(f, v);
          } catch { /* ambiguous/bad seed value — keep verbatim, deterministically */ }
        }
      }
    }
  }

  rev(objKey) {
    return this.revs[objKey] ?? 0;
  }

  /* ---- accounts (AUTH_MODE=accounts): users · one-time tokens · dev outbox ---- */

  userAdd({ email, name, hash }) {
    const u = {
      id: `u_${++this.n}`, email: email.toLowerCase(), name, hash,
      verified: false, pwv: 0, createdAt: this._now().toISOString(), deletedAt: null,
    };
    (this.users ??= []).push(u);
    return u;
  }

  userByEmail(email) {
    return (this.users ?? []).find((u) => u.email === String(email ?? "").toLowerCase() && !u.deletedAt) ?? null;
  }

  userVerify(email) {
    const u = this.userByEmail(email);
    if (u) u.verified = true;
    return u;
  }

  /* password change bumps pwv — outstanding session cookies die with it */
  userSetHash(email, hash) {
    const u = this.userByEmail(email);
    if (u) { u.hash = hash; u.pwv += 1; }
    return u;
  }

  userSoftDelete(email) {
    const u = this.userByEmail(email);
    if (u) { u.deletedAt = this._now().toISOString(); u.email = `deleted:${this._nowMs()}:${u.email}`; }
    return u;
  }

  tokenIssue({ kind, email, ttlMinutes, token }) {
    const t = { token, kind, email: email.toLowerCase(), expires: this._nowMs() + ttlMinutes * 60_000 };
    (this.tokens ??= []).push(t);
    return t;
  }

  /* single-use: a successful take removes the token */
  tokenTake(token, kind) {
    const list = this.tokens ?? [];
    const i = list.findIndex((t) => t.token === token && t.kind === kind);
    if (i === -1) return null;
    const [t] = list.splice(i, 1);
    return t.expires > this._nowMs() ? t : null;
  }

  /* ---- teams: membership + invitations (records stay app-global; teams carry
     roles — the permissions layer reads them) ---- */

  teamAdd(name, ownerEmail, inviteCode) {
    const base = String(name).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "team";
    let slug = base;
    for (let i = 2; (this.teams ?? []).some((t) => t.slug === slug); i++) slug = `${base}-${i}`;
    const team = { id: `t_${++this.n}`, slug, name, inviteCode, createdAt: this._now().toISOString() };
    (this.teams ??= []).push(team);
    this.memberAdd(team.id, ownerEmail, "owner", "active");
    return team;
  }

  teamBySlug(slug) {
    return (this.teams ?? []).find((t) => t.slug === slug) ?? null;
  }

  teamByCode(code) {
    return (this.teams ?? []).find((t) => t.inviteCode === code) ?? null;
  }

  teamsFor(email) {
    const mine = (this.members ?? []).filter((m) => m.email === email.toLowerCase() && m.status === "active");
    return mine.map((m) => ({ ...this.teams.find((t) => t.id === m.teamId), role: m.role }));
  }

  memberAdd(teamId, email, role, status) {
    const m = { teamId, email: email.toLowerCase(), role, status, addedAt: this._now().toISOString() };
    (this.members ??= []).push(m);
    return m;
  }

  memberOf(teamId, email) {
    return (this.members ?? []).find((m) => m.teamId === teamId && m.email === String(email).toLowerCase()) ?? null;
  }

  memberList(teamId) {
    return (this.members ?? []).filter((m) => m.teamId === teamId);
  }

  memberSetRole(teamId, email, role) {
    const m = this.memberOf(teamId, email);
    if (m) m.role = role;
    return m;
  }

  memberRemove(teamId, email) {
    const list = this.members ?? [];
    const i = list.findIndex((m) => m.teamId === teamId && m.email === String(email).toLowerCase());
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  }

  /* the caller's app-wide role: highest across active memberships; no team → member;
     (auth disabled entirely → routes never ask) */
  roleFor(email) {
    const ranks = { owner: 4, admin: 3, member: 2, viewer: 1 };
    const mine = (this.members ?? []).filter((m) => m.email === String(email ?? "").toLowerCase() && m.status === "active");
    if (mine.length === 0) return "member";
    return mine.sort((a, b) => ranks[b.role] - ranks[a.role])[0].role;
  }

  /* per-team role — the one that governs teamScoped objects */
  roleIn(teamId, email) {
    const m = this.memberOf(teamId, email);
    return m && m.status === "active" ? m.role : null;
  }

  memberActivate(teamId, email) {
    const m = this.memberOf(teamId, email);
    if (m) m.status = "active";
    return m;
  }

  /* bind an issued token to a team (invitation tokens carry their team) */
  tokenBind(token, teamId) {
    const t = (this.tokens ?? []).find((x) => x.token === token);
    if (t) t.teamId = teamId;
    return t;
  }

  webhookAdd(hook) {
    (this.webhooks ??= []).push(hook);
    return hook;
  }

  webhookUpdate(id, patch) {
    const hook = (this.webhooks ?? []).find((w) => w.id === id);
    if (!hook) return null;
    if (typeof patch.active === "boolean") hook.active = patch.active;
    if (Array.isArray(patch.events) && patch.events.length) hook.events = patch.events;
    if (patch.url) hook.url = patch.url;
    return hook;
  }

  webhookRemove(id) {
    this.webhooks = (this.webhooks ?? []).filter((w) => w.id !== id);
    return true;
  }

  /* ---- API keys: only the secret's sha256 hash is stored (plus display
     prefix/last4 — the hash is one-way, so display bits are captured at
     creation). Revocation is a stamp, never a splice — the log replays it. ---- */

  apiKeyAdd({ name, role, prefix, last4, hash }) {
    const k = {
      id: `ak_${++this.n}`, name, role, prefix, last4, hash,
      createdAt: this._now().toISOString(), revokedAt: null,
    };
    (this.apiKeys ??= []).push(k);
    return k;
  }

  apiKeyRevoke(id) {
    const k = (this.apiKeys ?? []).find((x) => x.id === id);
    if (k && !k.revokedAt) k.revokedAt = this._now().toISOString();
    return k ?? null;
  }

  /* team audit trail: who invited/joined/changed whom */
  teamEvent(teamId, kind, summary, actor) {
    const ev = { id: `te_${++this.n}`, teamId, kind, summary, actor: actor ?? null, ts: this._now().toISOString() };
    (this.teamEvents ??= []).push(ev);
    return ev;
  }

  teamActivity(teamId) {
    return (this.teamEvents ?? []).filter((e) => e.teamId === teamId).reverse().slice(0, 50);
  }

  /* ---- saved views: named, per-object, shareable snapshots of list state ---- */

  viewAdd({ objectKey, name, layout, state, visibility, createdBy }) {
    const v = {
      id: `vw_${++this.n}`, objectKey, name, layout: layout ?? "table",
      visibility: visibility === "personal" ? "personal" : "workspace",
      order: (this.views ?? []).filter((x) => x.objectKey === objectKey).length,
      state: state ?? {}, createdBy: createdBy ?? null, createdAt: this._now().toISOString(),
    };
    (this.views ??= []).push(v);
    return v;
  }

  viewList(objectKey, viewer) {
    return (this.views ?? [])
      .filter((v) => v.objectKey === objectKey)
      .filter((v) => v.visibility === "workspace" || !v.createdBy || v.createdBy === viewer)
      .sort((a, b) => a.order - b.order);
  }

  viewUpdate(id, patch) {
    const v = (this.views ?? []).find((x) => x.id === id);
    if (!v) return null;
    if (patch.name) v.name = String(patch.name);
    if (patch.state) v.state = patch.state;
    if (patch.visibility) v.visibility = patch.visibility === "personal" ? "personal" : "workspace";
    if (typeof patch.order === "number") v.order = patch.order;
    return v;
  }

  viewRemove(id) {
    this.views = (this.views ?? []).filter((x) => x.id !== id);
    return true;
  }

  /* ---- tasks: cross-record to-dos (status, due, assignee, record links) ----
     System entity like teams/webhooks — config-less, replay-logged. Timeline
     coupling lives INSIDE the ops so warehouse replay reconstructs the record
     events; rev bumps ride along so open record pages live-refresh their tasks
     (_ev bumps on add/done; link-only changes bump explicitly). */

  taskAdd({ title, status, due, assignee, links, createdBy }) {
    const t = {
      id: `tk_${++this.n}`,
      title: String(title),
      status: ["todo", "doing", "done"].includes(status) ? status : "todo",
      due: due || null,
      assignee: assignee || null,
      links: (links ?? []).map((l) => ({ obj: l.obj, id: l.id })),
      createdBy: createdBy ?? null,
      createdAt: this._now().toISOString(),
      doneAt: null,
    };
    if (t.status === "done") t.doneAt = this._now().toISOString();
    (this.tasks ??= []).push(t);
    for (const l of t.links) this._ev(l.obj, l.id, "updated", `Task added: ${t.title}`);
    return t;
  }

  taskUpdate(id, patch) {
    const t = (this.tasks ?? []).find((x) => x.id === id);
    if (!t) return null;
    // live-sync: every object linked BEFORE or AFTER the patch refetches
    const touched = new Set(t.links.map((l) => l.obj));
    if (patch.title !== undefined) t.title = String(patch.title);
    if (patch.due !== undefined) t.due = patch.due || null;
    if (patch.assignee !== undefined) t.assignee = patch.assignee || null;
    if (Array.isArray(patch.links)) {
      t.links = patch.links.map((l) => ({ obj: l.obj, id: l.id }));
      for (const l of t.links) touched.add(l.obj);
    }
    if (patch.status !== undefined && patch.status !== t.status) {
      const was = t.status;
      t.status = ["todo", "doing", "done"].includes(patch.status) ? patch.status : t.status;
      if (t.status === "done" && was !== "done") {
        t.doneAt = this._now().toISOString();
        for (const l of t.links) this._ev(l.obj, l.id, "updated", `Task done: ${t.title}`);
      } else if (was === "done" && t.status !== "done") {
        t.doneAt = null;
      }
    }
    for (const k of touched) this._bump(k);
    return t;
  }

  taskRemove(id) {
    const list = this.tasks ?? [];
    const i = list.findIndex((x) => x.id === id);
    if (i === -1) return false;
    const [t] = list.splice(i, 1);
    for (const l of t.links) this._bump(l.obj);
    return true;
  }

  /* ---- record subscriptions (watchers) ---- */

  watchToggle(objectKey, id, email, on) {
    const norm = String(email).toLowerCase();
    let sub = (this.subscribers ??= []).find((s) => s.objectKey === objectKey && s.id === id);
    if (!sub) {
      sub = { objectKey, id, emails: [] };
      this.subscribers.push(sub);
    }
    const has = sub.emails.includes(norm);
    if (on && !has) sub.emails.push(norm);
    if (!on && has) sub.emails = sub.emails.filter((e) => e !== norm);
    return sub;
  }

  watchers(objectKey, id) {
    return (this.subscribers ?? []).find((s) => s.objectKey === objectKey && s.id === id)?.emails ?? [];
  }

  outboxAdd({ to, subject, text, kind }) {
    const m = { id: `m_${++this.n}`, to: to.toLowerCase(), subject, text, kind, ts: this._now().toISOString() };
    (this.outbox ??= []).push(m);
    return m;
  }

  outboxList() {
    return [...(this.outbox ?? [])].reverse();
  }

  _bump(objKey) {
    this.revs[objKey] = (this.revs[objKey] ?? 0) + 1;
  }

  list(objKey, q = {}) {
    let rows = (this.rows[objKey] ?? []).filter((r) => !r._deletedAt);
    // project BEFORE filter/search/sort so relation fields filter, match and
    // sort by their LABELS (the API's historical semantics), not by stored ids
    const rels = this.relFields(objKey).filter((f) => f.isActive !== false);
    if (rels.length) {
      const maps = this._relMaps(rels);
      rows = rows.map((r) => this._projectRow(objKey, r, rels, maps));
    }
    if (q.filterField && q.filterValue !== undefined) {
      const op = q.filterOp || "eq";
      rows = rows.filter((r) => {
        const v = String(r[q.filterField] ?? "").toLowerCase();
        const t = String(q.filterValue).toLowerCase();
        return op === "contains" ? v.includes(t) : op === "neq" ? v !== t : v === t;
      });
    }
    if (q.q) {
      const t = String(q.q).toLowerCase();
      // shaped values (money/address/fullName objects, string[] lists) match on
      // their inner text — a plain String() would hide them behind "[object Object]"
      const flat = (v) =>
        v === null || v === undefined ? ""
        : Array.isArray(v) ? v.map(flat).join(" ")
        : typeof v === "object" ? Object.values(v).map(flat).join(" ")
        : String(v);
      rows = rows.filter((r) => Object.values(r).some((v) => flat(v).toLowerCase().includes(t)));
    }
    if (q.sortField) {
      const dir = q.sortDir === "desc" ? -1 : 1;
      rows.sort((a, b) => (a[q.sortField] > b[q.sortField] ? dir : -dir));
    }
    return rows;
  }

  get(objKey, id) {
    return (this.rows[objKey] ?? []).find((r) => r.id === id && !r._deletedAt) ?? null;
  }

  getAny(objKey, id) {
    return (this.rows[objKey] ?? []).find((r) => r.id === id) ?? null;
  }

  trashList(objKey) {
    return (this.rows[objKey] ?? []).filter((r) => r._deletedAt);
  }

  /* Field-type-implied validation: the config declaring `type: "email"` IS the
     validation rule — no parallel validation block to keep in sync. Returns an
     error string or null. */
  validate(objKey, patch, excludeId = null) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    if (!cfg) return null;
    const optionValues = (opts) => (opts ?? []).map((o) => (typeof o === "string" ? o : o.value));
    for (const [k, v] of Object.entries(patch)) {
      const f = cfg.fields.find((x) => x.key === k);
      if (f && f.isActive === false) return `${f.label} is deactivated`;
      if (!f || v === null || v === undefined || v === "") continue;
      if (f.unique) {
        const dup = (this.rows[objKey] ?? []).find((r) => !r._deletedAt && r.id !== excludeId && String(r[k] ?? "") === String(v));
        if (dup) return `${f.label} must be unique — "${v}" already exists`;
      }
      if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))
        return `${f.label} must be a valid email address`;
      if (f.type === "url" && !urlOk(String(v)))
        return `${f.label} must be a valid URL or domain`;
      if ((f.type === "number" || f.type === "currency") && (typeof v !== "number" || Number.isNaN(v)))
        return `${f.label} must be a number`;
      if ((f.type === "date" || f.type === "dateTime") && Number.isNaN(new Date(String(v)).getTime()))
        return `${f.label} must be a valid date`;
      if (f.type === "boolean" && typeof v !== "boolean")
        return `${f.label} must be true or false`;
      if (f.type === "rating") {
        const scale = f.scale ?? 5;
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > scale)
          return `${f.label} must be a whole number between 0 and ${scale}`;
      }
      if (f.type === "array" && !Array.isArray(v))
        return `${f.label} must be a list`;
      if (f.type === "select" && f.options && !optionValues(f.options).includes(String(v)))
        return `${f.label} must be one of: ${optionValues(f.options).join(", ")}`;
      if (f.type === "multiselect" && !Array.isArray(v))
        return `${f.label} must be a list`;
      if (f.type === "money") {
        if (typeof v !== "object" || Array.isArray(v) || typeof v.amount !== "number" || Number.isNaN(v.amount))
          return `${f.label} must be shaped like { "amount": 12500, "code": "EUR" }`;
        if (v.code !== undefined && v.code !== "" && !/^[A-Za-z]{3}$/.test(String(v.code)))
          return `${f.label} code must be a 3-letter currency code`;
      }
      if (f.type === "emails") {
        if (!Array.isArray(v)) return `${f.label} must be a list`;
        for (const e of v) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e)))
          return `${f.label}: "${e}" is not a valid email address`;
      }
      if (f.type === "phones") {
        if (!Array.isArray(v)) return `${f.label} must be a list`;
        for (const p of v) if (!/^[0-9+()\-\s.]{3,}$/.test(String(p)))
          return `${f.label}: "${p}" is not a valid phone number`;
      }
      if (f.type === "links") {
        if (!Array.isArray(v)) return `${f.label} must be a list`;
        for (const u of v) if (!urlOk(String(u)))
          return `${f.label}: "${u}" is not a valid URL or domain`;
      }
      if (f.type === "address" || f.type === "fullName") {
        if (typeof v !== "object" || Array.isArray(v)) return `${f.label} must be an object`;
        for (const [part, pv] of Object.entries(v))
          if (pv !== null && pv !== undefined && typeof pv !== "string")
            return `${f.label} ${part} must be text`;
      }
    }
    return null;
  }

  create(objKey, body, meta = {}) {
    this.normalizeRelations(objKey, body);
    const row = { id: `${objKey.slice(0, 2)}_${++this.n}`, ...body };
    if (meta.createdBy) row._createdBy = meta.createdBy;
    if (meta.teamId) row._team = meta.teamId;
    (this.rows[objKey] ??= []).push(row);
    this._ev(objKey, row.id, "created", `Created`);
    return row;
  }

  patch(objKey, id, patch) {
    const row = this.get(objKey, id);
    if (!row) return null;
    this.normalizeRelations(objKey, patch);
    const cfg = this.config.objects.find((o) => o.key === objKey);
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id") continue;
      const old = row[k];
      row[k] = v;
      const kind = cfg?.stageField === k ? "stage" : "updated";
      const f = cfg?.fields.find((x) => x.key === k);
      // relation summaries log LABELS (ids are storage, not prose)
      const show = (val) => (f?.type === "relation" ? this._relDisplayText(f, val) || "—" : flatVal(val, f?.type));
      this._ev(objKey, id, kind, kind === "stage" ? `Stage: ${old ?? "—"} → ${v}` : `${k}: ${show(old)} → ${show(v)}`);
    }
    return row;
  }

  /* deletion is RECOVERABLE: a _deletedAt stamp hides the row everywhere while
     data + timeline survive; destroyRow is the separate, permanent operation */
  remove(objKey, id) {
    const row = this.get(objKey, id);
    if (!row) return false;
    row._deletedAt = this._now().toISOString();
    this._ev(objKey, id, "updated", "Moved to trash");
    return true;
  }

  restoreRow(objKey, id) {
    const row = this.getAny(objKey, id);
    if (!row || !row._deletedAt) return null;
    delete row._deletedAt;
    this._ev(objKey, id, "updated", "Restored from trash");
    return row;
  }

  destroyRow(objKey, id) {
    const rows = this.rows[objKey] ?? [];
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return false;
    // destroy SEVERS every inbound relation ref (the record ceases to exist, so
    // do its links — trash does NOT sever: a trashed target keeps projecting and
    // restore heals). Runs inside this already-logged op → replays deterministically.
    for (const o of this.config.objects) {
      for (const f of o.fields) {
        if (f.type !== "relation" || !this.relTargets(f).includes(objKey)) continue;
        let touched = false;
        for (const r of this.rows[o.key] ?? []) {
          const v = r[f.key];
          if (f.multiple && Array.isArray(v)) {
            const nx = v.filter((x) => (typeof x === "object" && x !== null ? !(x.object === objKey && x.id === id) : x !== id));
            if (nx.length !== v.length) { r[f.key] = nx; touched = true; }
          } else if (typeof v === "object" && v !== null) {
            if (v.object === objKey && v.id === id) { r[f.key] = null; touched = true; }
          } else if (v === id) { r[f.key] = null; touched = true; }
        }
        if (touched) this._bump(o.key);
      }
    }
    rows.splice(i, 1);
    delete (this.events[objKey] ?? {})[id];
    delete (this.files[objKey] ?? {})[id];
    this._bump(objKey);
    return true;
  }

  /* ---- duplicate detection: deterministic READS, never logged. Every rule is
     explainable in one sentence; unique fields are skipped (the server already
     makes live collisions impossible); trashed rows, self, and empty values
     never match. ---- */

  /* reason labels for ONE pair — the rules:
     1. same normalized primary (case/accents/spacing/punctuation ignored)
     2. one normalized primary begins the other at a word boundary, shorter ≥ 8 chars
     3. same email-type field value (lowercase-exact)
     4. same url-type field domain (scheme/www./path stripped) */
  _dupReasons(cfg, a, b) {
    const reasons = [];
    const primary = cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
    if (!primary.unique) {
      const na = dupNorm(a[primary.key], primary.type);
      const nb = dupNorm(b[primary.key], primary.type);
      if (na && nb) {
        if (na === nb) reasons.push(`Same ${primary.label.toLowerCase()} ignoring case, accents, spacing and punctuation`);
        else {
          const [s, l] = na.length <= nb.length ? [na, nb] : [nb, na];
          if (s.length >= 8 && l.startsWith(s + " ")) reasons.push(`One ${primary.label.toLowerCase()} begins with the other`);
        }
      }
    }
    for (const f of cfg.fields) {
      if (f.unique || f.isActive === false || f.primary) continue;
      if (f.type === "email") {
        const va = String(a[f.key] ?? "").toLowerCase().trim();
        const vb = String(b[f.key] ?? "").toLowerCase().trim();
        if (va && vb && va === vb) reasons.push(`Same ${f.label.toLowerCase()}`);
      }
      if (f.type === "url") {
        const va = dupHost(a[f.key]);
        const vb = dupHost(b[f.key]);
        if (va && vb && va === vb) reasons.push("Same web domain");
      }
    }
    return reasons;
  }

  /* candidates for ONE record — O(N) scan; rowsOverride lets team-scoped
     routes pass only the rows the caller may see */
  duplicatesFor(objKey, id, rowsOverride = null) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    const me = this.get(objKey, id);
    if (!cfg || !me) return [];
    const primary = cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
    const pool = rowsOverride ?? this.rows[objKey] ?? [];
    const out = [];
    for (const r of pool) {
      if (r.id === id || r._deletedAt) continue;
      const reasons = this._dupReasons(cfg, me, r);
      if (reasons.length) out.push({ id: r.id, name: flatVal(r[primary.key], primary.type), reasons });
    }
    return out;
  }

  /* whole-object sweep — per-rule value buckets (norm/email/host maps) plus a
     sorted-adjacent scan for the prefix rule, merged by union-find. Groups are
     deterministic: ids sorted within a group, groups sorted by first id. */
  duplicateGroups(objKey, rowsOverride = null) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    if (!cfg) return [];
    const rows = (rowsOverride ?? this.rows[objKey] ?? []).filter((r) => !r._deletedAt);
    const primary = cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
    const edges = []; // {a, b, label}
    const bucket = (map, key, id) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(id);
    };
    if (!primary.unique) {
      const byNorm = new Map();
      for (const r of rows) bucket(byNorm, dupNorm(r[primary.key], primary.type), r.id);
      for (const [, ids] of byNorm) {
        for (let i = 1; i < ids.length; i++) edges.push({ a: ids[0], b: ids[i], label: `Same ${primary.label.toLowerCase()} ignoring case, accents, spacing and punctuation` });
      }
      // prefix rule: sorted unique norms put every "s + word" right after s
      const norms = [...byNorm.keys()].sort();
      for (let i = 0; i < norms.length; i++) {
        if (norms[i].length < 8) continue;
        for (let j = i + 1; j < norms.length && norms[j].startsWith(norms[i] + " "); j++) {
          edges.push({ a: byNorm.get(norms[i])[0], b: byNorm.get(norms[j])[0], label: `One ${primary.label.toLowerCase()} begins with the other` });
        }
      }
    }
    for (const f of cfg.fields) {
      if (f.unique || f.isActive === false || f.primary) continue;
      if (f.type !== "email" && f.type !== "url") continue;
      const byVal = new Map();
      for (const r of rows) {
        const v = f.type === "email" ? String(r[f.key] ?? "").toLowerCase().trim() : dupHost(r[f.key]);
        bucket(byVal, v, r.id);
      }
      const label = f.type === "email" ? `Same ${f.label.toLowerCase()}` : "Same web domain";
      for (const [, ids] of byVal) {
        for (let i = 1; i < ids.length; i++) edges.push({ a: ids[0], b: ids[i], label });
      }
    }
    // union-find over the edges
    const parent = new Map();
    const find = (x) => {
      let p = parent.get(x) ?? x;
      if (p !== x) { p = find(p); parent.set(x, p); }
      return p;
    };
    for (const e of edges) {
      const ra = find(e.a); const rb = find(e.b);
      if (ra !== rb) parent.set(ra, rb);
    }
    const groups = new Map(); // root → {ids:Set, reasons:Set}
    for (const e of edges) {
      const root = find(e.a);
      if (!groups.has(root)) groups.set(root, { ids: new Set(), reasons: new Set() });
      const g = groups.get(root);
      g.ids.add(e.a); g.ids.add(e.b); g.reasons.add(e.label);
    }
    return [...groups.values()]
      .map((g) => ({ ids: [...g.ids].sort(), reasons: [...g.reasons] }))
      .sort((x, y) => (x.ids[0] < y.ids[0] ? -1 : 1));
  }

  /* live twin of uniqueResurrectMatch: an incoming unique value colliding with
     a LIVE row (batch import reports it as a skipped duplicate, not a failure) */
  uniqueLiveMatch(objKey, body) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    for (const f of cfg?.fields ?? []) {
      if (!f.unique) continue;
      const v = body[f.key];
      if (v === undefined || v === null || v === "") continue;
      const hit = (this.rows[objKey] ?? []).find((r) => !r._deletedAt && String(r[f.key] ?? "") === String(v));
      if (hit) return hit;
    }
    return null;
  }

  /* upsert semantic: an incoming value matching a TRASHED row's unique field
     RESURRECTS that row (import/re-sync friendly) instead of colliding */
  uniqueResurrectMatch(objKey, body) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    for (const f of cfg?.fields ?? []) {
      if (!f.unique) continue;
      const v = body[f.key];
      if (v === undefined || v === null || v === "") continue;
      const hit = (this.rows[objKey] ?? []).find((r) => r._deletedAt && String(r[f.key] ?? "") === String(v));
      if (hit) return hit;
    }
    return null;
  }

  /* merge plan: winner keeps its values on conflict, absorbs the losers'
     non-empty fields into its own empties. Pure — used by preview AND commit,
     so what the dialog shows is exactly what lands. */
  mergePlan(objKey, ids, winnerId) {
    const winner = this.get(objKey, winnerId);
    if (!winner) return null;
    const cfg = this.config.objects.find((o) => o.key === objKey);
    const primary = cfg.fields.find((f) => f.primary) ?? cfg.fields[0];
    const losers = ids.filter((x) => x !== winnerId).map((x) => this.get(objKey, x)).filter(Boolean);
    // shaped fields inherit like scalars: [] and an object whose values are all
    // empty count as EMPTY, so a loser's money/address/list can fill the winner's
    const empty = (v) =>
      v === undefined || v === null || v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => x === undefined || x === null || x === ""));
    const fields = [];
    const finalRow = { ...winner };
    for (const f of cfg.fields) {
      if (f.key === "id") continue;
      let value = winner[f.key];
      let source = "winner";
      if (empty(value)) {
        const donor = losers.find((l) => !empty(l[f.key]));
        if (donor) { value = donor[f.key]; source = this.relLabel(objKey, donor) || donor.id; }
      }
      finalRow[f.key] = value;
      // preview shows LABELS for relation values; finalRow (the commit) keeps ids
      if (!empty(value)) fields.push({ key: f.key, label: f.label, value: f.type === "relation" ? this._relDisplayText(f, value) || value : value, source });
    }
    return { winner, losers, fields, finalRow, primaryKey: primary.key };
  }

  /* merge: apply the plan — winner absorbs, inbound relation refs re-point from
     each loser's ID to the winner's (multi lists deduped, poly matched by
     object+id), timeline + watchers travel, losers land in the trash. ONE
     logged op — replays atomically. Dangling labels are not links and don't
     re-point. */
  mergeRows(objKey, ids, winnerId) {
    const plan = this.mergePlan(objKey, ids, winnerId);
    if (!plan) return null;
    const { winner, losers, finalRow } = plan;
    Object.assign(winner, finalRow);
    for (const loser of losers) {
      for (const o of this.config.objects) {
        for (const f of o.fields) {
          if (f.type !== "relation" || !this.relTargets(f).includes(objKey)) continue;
          let touched = false;
          for (const r of this.rows[o.key] ?? []) {
            const v = r[f.key];
            if (f.multiple && Array.isArray(v)) {
              if (!v.some((x) => (typeof x === "object" && x !== null ? x.object === objKey && x.id === loser.id : x === loser.id))) continue;
              const seen = new Set();
              r[f.key] = v
                .map((x) => {
                  if (typeof x === "object" && x !== null) return x.object === objKey && x.id === loser.id ? { object: objKey, id: winner.id } : x;
                  return x === loser.id ? winner.id : x;
                })
                .filter((x) => {
                  const key = typeof x === "object" && x !== null ? `${x.object}:${x.id}` : String(x);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              touched = true;
            } else if (typeof v === "object" && v !== null) {
              if (v.object === objKey && v.id === loser.id) { r[f.key] = { object: objKey, id: winner.id }; touched = true; }
            } else if (v === loser.id) { r[f.key] = winner.id; touched = true; }
          }
          if (touched) this._bump(o.key);
        }
      }
      const loserEvents = (this.events[objKey] ?? {})[loser.id] ?? [];
      ((this.events[objKey] ??= {})[winner.id] ??= []).push(...loserEvents);
      for (const email of this.watchers(objKey, loser.id)) this.watchToggle(objKey, winner.id, email, true);
      loser._deletedAt = this._now().toISOString();
      this._ev(objKey, winner.id, "updated", `Merged in ${this.relLabel(objKey, loser) || loser.id}`);
    }
    this._bump(objKey);
    return winner;
  }

  /* retention: permanently destroy trashed rows older than N days (jobs.mjs
     sweeps on an interval). Individual destroys are what gets logged — the
     sweep itself is not an op, so replay stays deterministic. */
  trashSweep(days) {
    const cutoff = Date.now() - days * 86_400_000;
    let n = 0;
    for (const o of this.config.objects) {
      for (const row of [...(this.rows[o.key] ?? [])]) {
        if (row._deletedAt && Date.parse(row._deletedAt) < cutoff) {
          if (this.destroyRow(o.key, row.id)) n++;
        }
      }
    }
    return n;
  }

  timeline(objKey, id) {
    return [...((this.events[objKey] ?? {})[id] ?? [])].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }

  addNote(objKey, id, text) {
    return this._ev(objKey, id, "note", text);
  }

  addActivity(objKey, id, kind, text) {
    return this._ev(objKey, id, "activity", text, kind);
  }

  fileAdd(objKey, id, { name, mime, data }) {
    const size = Math.floor((data.length * 3) / 4); // decoded bytes from base64 length
    const f = { id: `f_${++this.n}`, name, mime, size, ts: this._now().toISOString(), data };
    (((this.files[objKey] ??= {})[id] ??= [])).push(f);
    this._ev(objKey, id, "file", `Attached ${name}`);
    const { data: _, ...meta } = f;
    return meta;
  }

  fileList(objKey, id) {
    return ((this.files[objKey] ?? {})[id] ?? []).map(({ data: _, ...meta }) => meta);
  }

  fileGet(objKey, id, fileId) {
    return ((this.files[objKey] ?? {})[id] ?? []).find((f) => f.id === fileId) ?? null;
  }

  /* AI-enrichment seam: write a computed field value + a labeled timeline event.
     The VALUE comes from the caller (the /enrich route — mock today, a platform
     task/workflow call in prod); the store just persists both sides. */
  enrich(objKey, id, fieldKey, value, viaLabel) {
    const row = this.get(objKey, id);
    if (!row) return null;
    row[fieldKey] = value;
    const cfg = this.config.objects.find((o) => o.key === objKey);
    const f = cfg?.fields.find((x) => x.key === fieldKey);
    this._ev(objKey, id, "updated", `Enriched ${f?.label ?? fieldKey} via ${viaLabel}`);
    return row;
  }

  _ev(objKey, id, kind, summary, activity) {
    const ev = { id: `ev_${++this.n}`, ts: this._now().toISOString(), kind, summary, actor: "you", ...(activity ? { activity } : {}) };
    ((this.events[objKey] ??= {})[id] ??= []).push(ev);
    this._bump(objKey); // every event-producing mutation is a live-sync signal
    return ev;
  }

  stateLatest() {
    const latest = {};
    for (const e of this.state) latest[e.key] = e.value;
    return latest;
  }

  stateAppend(key, value) {
    const e = { key, value, ts: this._now().toISOString() };
    this.state.push(e);
    return e;
  }

  /* ---- runtime schema (config-as-data): the command log IS the delta store ----
     These LOGGED ops mutate the live config IN PLACE — the same object
     /api/config spreads and every route/validator/identity read shares — so a
     mutation is instantly the merged truth. The config FILE stays the
     immutable seed; boot = seed → replay, deltas re-applying at their original
     seq, strictly interleaved with the data writes that depend on them. Guard
     failures throw {status:400} and thrown ops are never logged. A replayed
     add colliding with a NEWER seed's key trips its duplicate-key guard and
     replay's skip-and-warn absorbs it: seed wins, deterministically. */

  _schemaThrow(msg) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }

  _slugOk(s) {
    return /^[a-z][a-zA-Z0-9]*$/.test(String(s ?? ""));
  }

  schemaObjectAdd(def) {
    const { key, label, labelOne, icon, primaryField } = def ?? {};
    if (!this._slugOk(key)) this._schemaThrow(`object key must be a slug like "invoices" (got "${key ?? ""}")`);
    if (this.config.objects.some((o) => o.key === key)) this._schemaThrow(`an object "${key}" already exists`);
    if (!label || !labelOne) this._schemaThrow("label and labelOne are required");
    const pf = primaryField ?? {};
    if (!this._slugOk(pf.key)) this._schemaThrow(`primary field key must be a slug (got "${pf.key ?? ""}")`);
    const obj = {
      key,
      label: String(label),
      labelOne: String(labelOne),
      ...(icon ? { icon: String(icon) } : {}),
      defaultView: "table",
      fields: [{ key: pf.key, label: String(pf.label || "Name"), type: "text", primary: true }],
    };
    this.config.objects.push(obj);
    this.rows[key] ??= [];
    this._bump(key);
    return obj;
  }

  schemaFieldAdd(objKey, fieldDef) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    if (!cfg) this._schemaThrow(`no object "${objKey}"`);
    const f = { ...(fieldDef ?? {}) };
    if (!this._slugOk(f.key)) this._schemaThrow(`field key must be a slug (got "${f.key ?? ""}")`);
    if (cfg.fields.some((x) => x.key === f.key)) this._schemaThrow(`${objKey} already has a field "${f.key}" — field keys are unique and immutable`);
    if (!f.label) this._schemaThrow("label is required");
    if (!SCHEMA_FIELD_TYPES.includes(f.type)) this._schemaThrow(`unsupported type "${f.type}" — one of: ${SCHEMA_FIELD_TYPES.join(", ")}`);
    if ((f.type === "select" || f.type === "multiselect") && !(Array.isArray(f.options) && f.options.length))
      this._schemaThrow(`${f.type} fields need at least one option`);
    if (f.type === "relation") {
      const targets = Array.isArray(f.relationTargets) && f.relationTargets.length ? f.relationTargets : f.relation ? [f.relation] : [];
      if (!targets.length) this._schemaThrow("relation fields need relation or relationTargets");
      for (const t of targets) if (!this.config.objects.some((o) => o.key === t)) this._schemaThrow(`relation target "${t}" does not exist`);
    }
    if (f.primary) this._schemaThrow("a new field cannot be primary — the object already has its display field");
    cfg.fields.push(f);
    this._bump(objKey);
    return f;
  }

  schemaFieldUpdate(objKey, fieldKey, patch) {
    const cfg = this.config.objects.find((o) => o.key === objKey);
    if (!cfg) this._schemaThrow(`no object "${objKey}"`);
    const f = cfg.fields.find((x) => x.key === fieldKey);
    if (!f) this._schemaThrow(`no field "${fieldKey}" on ${objKey}`);
    const p = { ...(patch ?? {}) };
    if ("key" in p && p.key !== fieldKey) this._schemaThrow("field keys are immutable after creation");
    delete p.key;
    const ALLOWED = ["label", "options", "isActive", "width", "scale", "inverseLabel", "unique", "type"];
    for (const k of Object.keys(p)) if (!ALLOWED.includes(k)) this._schemaThrow(`"${k}" cannot be edited (allowed: ${ALLOWED.join(", ")})`);
    const hasVal = (r) => {
      const v = r[fieldKey];
      return !(v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
    };
    const holders = (this.rows[objKey] ?? []).filter((r) => !r._deletedAt && hasVal(r));
    if ("type" in p && p.type !== f.type) {
      if (!SCHEMA_FIELD_TYPES.includes(p.type)) this._schemaThrow(`unsupported type "${p.type}"`);
      if (holders.length) this._schemaThrow(`cannot change ${f.label}'s type while ${holders.length} row(s) hold values — create a new field instead`);
    }
    if (p.isActive === false && f.primary) this._schemaThrow("the primary field cannot be retired — every surface renders it");
    if (p.unique === true && !f.unique) {
      const seen = new Map();
      for (const r of holders) {
        const v = String(r[fieldKey]);
        if (!seen.has(v)) seen.set(v, 0);
        seen.set(v, seen.get(v) + 1);
      }
      const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([v]) => `"${v}"`);
      if (dupes.length) this._schemaThrow(`cannot make ${f.label} unique — duplicate values exist: ${dupes.join(", ")}`);
    }
    if ("options" in p && (f.type === "select" || f.type === "multiselect")) {
      // BLOCK removing an option live rows still hold (a rename is remove+add,
      // so it inherits this rule); adding options or recoloring is always free
      const val = (o) => (typeof o === "string" ? o : o.value);
      const next = new Set((p.options ?? []).map(val));
      const removed = (f.options ?? []).map(val).filter((v) => !next.has(v));
      const held = removed.filter((v) =>
        (this.rows[objKey] ?? []).some((r) =>
          !r._deletedAt && (f.type === "multiselect" ? Array.isArray(r[fieldKey]) && r[fieldKey].includes(v) : String(r[fieldKey] ?? "") === v),
        ),
      );
      if (held.length) this._schemaThrow(`cannot remove option(s) still in use: ${held.join(", ")} — reassign those rows first`);
    }
    Object.assign(f, p);
    this._bump(objKey);
    return f;
  }
}

/* every type the runtime schema editor may add (the RECIPES list) */
const SCHEMA_FIELD_TYPES = [
  "text", "longText", "number", "boolean", "rating", "select", "multiselect", "array",
  "date", "dateTime", "currency", "email", "url", "json", "relation", "user",
  "money", "emails", "phones", "links", "address", "fullName",
];
