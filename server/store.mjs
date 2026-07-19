/* In-memory record store + app_state kv (the data-spine SHAPE, mock edition).
   Contract mirrored by prod: swap this module for a warehouse-backed client and the
   /api surface (and therefore the UI + journeys) does not change.
   app_state: APPEND-ONLY history + latest-per-key reads — append-only is what makes
   a clobber recoverable; keep that property in any production twin. */

import { seed } from "./seed.mjs";

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
      rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(t)));
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
      if (f.type === "url") {
        // bare domains ("acme.example") are fine — probe with a scheme prefixed
        const s = String(v);
        const ok = [s, `https://${s}`].some((u) => { try { new URL(u); return u.includes("."); } catch { return false; } });
        if (!ok) return `${f.label} must be a valid URL or domain`;
      }
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
    }
    return null;
  }

  create(objKey, body, meta = {}) {
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
    const cfg = this.config.objects.find((o) => o.key === objKey);
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id") continue;
      const old = row[k];
      row[k] = v;
      const kind = cfg?.stageField === k ? "stage" : "updated";
      this._ev(objKey, id, kind, kind === "stage" ? `Stage: ${old ?? "—"} → ${v}` : `${k}: ${old ?? "—"} → ${v}`);
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
    rows.splice(i, 1);
    delete (this.events[objKey] ?? {})[id];
    delete (this.files[objKey] ?? {})[id];
    this._bump(objKey);
    return true;
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
    const empty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    const fields = [];
    const finalRow = { ...winner };
    for (const f of cfg.fields) {
      if (f.key === "id") continue;
      let value = winner[f.key];
      let source = "winner";
      if (empty(value)) {
        const donor = losers.find((l) => !empty(l[f.key]));
        if (donor) { value = donor[f.key]; source = String(donor[primary.key] ?? donor.id); }
      }
      finalRow[f.key] = value;
      if (!empty(value)) fields.push({ key: f.key, label: f.label, value, source });
    }
    return { winner, losers, fields, finalRow, primaryKey: primary.key };
  }

  /* merge: apply the plan — winner absorbs, relations elsewhere re-point from each
     loser's primary value to the winner's, timeline + watchers travel, losers land
     in the trash with a pointer note. ONE logged op — replays atomically. */
  mergeRows(objKey, ids, winnerId) {
    const plan = this.mergePlan(objKey, ids, winnerId);
    if (!plan) return null;
    const { winner, losers, finalRow, primaryKey } = plan;
    Object.assign(winner, finalRow);
    const winnerRef = String(winner[primaryKey] ?? "");
    for (const loser of losers) {
      const loserRef = String(loser[primaryKey] ?? "");
      if (loserRef && loserRef !== winnerRef) {
        for (const o of this.config.objects) {
          for (const f of o.fields) {
            if (f.type !== "relation" || f.relation !== objKey) continue;
            for (const r of this.rows[o.key] ?? []) {
              if (String(r[f.key] ?? "") === loserRef) r[f.key] = winnerRef;
            }
          }
        }
      }
      const loserEvents = (this.events[objKey] ?? {})[loser.id] ?? [];
      ((this.events[objKey] ??= {})[winner.id] ??= []).push(...loserEvents);
      for (const email of this.watchers(objKey, loser.id)) this.watchToggle(objKey, winner.id, email, true);
      loser._deletedAt = this._now().toISOString();
      this._ev(objKey, winner.id, "updated", `Merged in ${loserRef || loser.id}`);
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
}
