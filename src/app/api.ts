/* UI data client — RELATIVE /api only (dev: vite proxy; prod: same origin), one code
   path across surfaces. Every fetch: timeout + non-2xx throw. */

import type { FileMeta, ObjectConfig, RecordRow, TimelineEvent } from "../ui/record-core/types";
import type { Suggestion } from "../ui/record-core/useSuggestions";
import type { Q } from "../ui/blocks/wizard";
import type { WhiteboardConfig } from "../ui/record-core/fields/whiteboard/config";

import type { Skin } from "../ui/skins/skin";

/* A config-declared top-level page (config.pages[]) — the generalized customPages
   extension point: a nav surface hosting a full-fidelity view/field component with
   ZERO app code. `kind` picks the host; free-surface kinds own STORED content (a
   per-page document in app_state), aggregate kinds pull records ACROSS `source`.
   Everything else is a sensible default (works out of the box) + overridable.

     FREE-SURFACE (own content, no records):
       whiteboard  — a full excalidraw canvas (Miro/Paint), `whiteboard` config-composable
       flow        — a free node graph (nodes are stored content, drawn/linked by hand)
       spreadsheet — a full Univer workbook (the SpreadsheetPage precedent)
     AGGREGATE (all records across `source` object(s) on one surface):
       map         — every record with coordinates on one map (`view` = map view config)
       calendar    — every record with a date on one calendar (`view` = calendar view config)

   `source` is required for aggregate kinds (a string, or an array to MERGE objects —
   every deal AND every session on one calendar). `view` carries any of the underlying
   view's config keys (basemaps, clustering, enabledViews…) so a client tailors it.
   See docs/RECIPES.md "Add a config-driven page (config.pages[])". */
export type PageKind = "whiteboard" | "flow" | "spreadsheet" | "map" | "calendar";
export interface PageConfig {
  key: string;
  label: string;
  icon?: string;              // a lucide icon name (kebab or Pascal); falls back to the kind's icon
  kind: PageKind;
  /* AGGREGATE kinds: the object key(s) whose records feed the surface */
  source?: string | string[];
  /* AGGREGATE kinds: view-config overrides (map/calendar configSchema keys) */
  view?: Record<string, unknown>;
  /* FREE-SURFACE whiteboard: the canvas option set (tools/palette/templates/ops…) */
  whiteboard?: WhiteboardConfig;
  /* FREE-SURFACE kinds only: seed this page with rich EXAMPLE content on first load
     (the starter's showcase pages set it). Omitted (the default) → the page starts
     EMPTY — a genuinely new page a client adds is a blank surface, never a clone of a
     demo page's content. */
  demoSeed?: boolean;
}

/* An object as the app shell sees it: the record-core ObjectConfig plus shell-only knobs.
   `hideInNav` omits it from every nav surface (sidebar · drawer · bottom tab bar) while it
   stays fully routable via deep links and search.
   `createWizard` turns "New <object>" into a guided flow (the library Wizard's guided-vs-blank
   landing): each question's `key` names the field its answer fills, in order. Absent → the plain
   create dialog, unchanged. A text/long answer to a `richText` field becomes a one-paragraph value.
   `generate` declares an async-generation action: a "Generate" toolbar button drops a placeholder
   row (statusField=`generating`) and the finished record lands via the warehouse + syncStore()
   (statusField=`ready`, resultField filled). `delayMs` is the mock writeback delay; `stallAfterMs`
   the "taking longer than usual" threshold. Absent → no Generate action. */
export type AppObject = ObjectConfig & {
  hideInNav?: boolean;
  createWizard?: { questions: Q[] };
  generate?: {
    label?: string;
    statusField: string;
    resultField?: string;
    generating?: string;
    ready?: string;
    titlePlaceholder?: string;
    delayMs?: number;
    stallAfterMs?: number;
  };
};

export interface AppConfig {
  /* nav: "side" (default) = left sidebar · "top" = one horizontal bar, no sidebar.
     goChords: config-driven go-to map — press `g` then a key to jump to a hash route
     (e.g. { "c": "#/o/companies" }); absent = no go-to chords. */
  app: { name: string; slug: string; nav?: "side" | "top"; goChords?: Record<string, string> };
  /* skinPreset names a built-in (nexus, ember); skin is a full inline Skin object
     (an org's brand as data); accent alone is the one-knob shortcut */
  theme: { accent?: string; skinPreset?: string; skin?: Skin };
  chat?: { embedUrl?: string };
  /* copilot side-panel: present → the panel renders; absent → nothing. The
     deploymentId is a server secret (COPILOT_DEPLOYMENT_ID) and stays out of this
     browser-visible config; the rest is presentation. Per-object context comes from
     each object's `contextFields`. */
  copilot?: { title?: string; mark?: string; emptyStateCopy?: string; suggestions?: string[] };
  /* the app's people directory — `user`-type fields pick from this list */
  users?: string[];
  /* server-set: seeded fictional rows are present (drives the Demo badge) */
  demo?: boolean;
  /* server-set: feature flags (one env flag gates nav + page + API). Config-declared
     pages honour the same gate (features[page.key] === false hides one). */
  features?: { teams?: boolean; webhooks?: boolean; theme?: boolean; apikeys?: boolean; tasks?: boolean; schema?: boolean; gallery?: boolean } & Record<string, boolean | undefined>;
  /* config-driven top-level pages — nav surfaces hosting a full view/field with no
     app code (the generalized customPages point). See PageConfig. */
  pages?: PageConfig[];
  objects: AppObject[];
}

async function j<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  // the ACTIVE TEAM context rides every call — team-scoped objects resolve
  // visibility + the caller's per-team role from it
  const team = localStorage.getItem("nx-team");
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...(team ? { "x-nx-team": team } : {}), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      // surface the server's own message ("email must be a valid address"),
      // not just a bare status code
      const detail = await res.json().then((b) => (b as { error?: string }).error).catch(() => undefined);
      throw new Error(detail ?? `${init?.method ?? "GET"} ${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  config: () => j<AppConfig>("/api/config"),
  list: (obj: string, q: Record<string, string> = {}) =>
    j<{ rows: RecordRow[] }>(`/api/objects/${obj}?` + new URLSearchParams(q)).then((r) => r.rows),
  get: (obj: string, id: string) => j<RecordRow>(`/api/objects/${obj}/${id}`),
  patch: (obj: string, id: string, patch: Record<string, unknown>) =>
    j<RecordRow>(`/api/objects/${obj}/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  create: (obj: string, body: Record<string, unknown>) =>
    j<RecordRow>(`/api/objects/${obj}`, { method: "POST", body: JSON.stringify(body) }),
  remove: (obj: string, id: string) =>
    j<{ ok: boolean }>(`/api/objects/${obj}/${id}`, { method: "DELETE" }),
  trash: (obj: string) => j<{ rows: RecordRow[] }>(`/api/objects/${obj}/trash`).then((r) => r.rows),
  restore: (obj: string, id: string) =>
    j<RecordRow>(`/api/objects/${obj}/${id}/restore`, { method: "POST", body: "{}" }),
  destroy: (obj: string, id: string) =>
    j<{ ok: boolean }>(`/api/objects/${obj}/${id}/destroy`, { method: "DELETE" }),
  mergePreview: (obj: string, ids: string[], winnerId: string) =>
    j<{ fields: { key: string; label: string; value: unknown; source: string }[] }>(`/api/objects/${obj}/merge`, {
      method: "POST", body: JSON.stringify({ ids, winnerId, preview: true }),
    }),
  merge: (obj: string, ids: string[], winnerId: string) =>
    j<{ row: RecordRow; merged: number }>(`/api/objects/${obj}/merge`, {
      method: "POST", body: JSON.stringify({ ids, winnerId }),
    }),
  rev: (obj: string) => j<{ rev: number }>(`/api/objects/${obj}/rev`),
  teams: () => j<{ teams: { slug: string; name: string; role: string }[]; role: string }>("/api/teams"),
  teamCreate: (name: string) => j<{ slug: string; name: string }>("/api/teams", { method: "POST", body: JSON.stringify({ name }) }),
  teamMembers: (slug: string) =>
    j<{ members: { email: string; role: string; status: string }[]; inviteCode?: string }>(`/api/teams/${slug}/members`),
  teamInvite: (slug: string, email: string, role: string) =>
    j<{ ok: boolean }>(`/api/teams/${slug}/invites`, { method: "POST", body: JSON.stringify({ email, role }) }),
  teamJoin: (code: string) => j<{ ok: boolean; team: { slug: string; name: string } }>("/api/teams/join", { method: "POST", body: JSON.stringify({ code }) }),
  teamActivity: (slug: string) =>
    j<{ events: { id: string; kind: string; summary: string; ts: string }[] }>(`/api/teams/${slug}/activity`),
  teamSetRole: (slug: string, email: string, role: string) =>
    j<{ ok: boolean }>(`/api/teams/${slug}/members`, { method: "PATCH", body: JSON.stringify({ email, role }) }),
  usersDirectory: () => j<{ users: string[] }>("/api/users").then((r) => r.users),
  watchers: (obj: string, id: string) => j<{ count: number; me: boolean }>(`/api/objects/${obj}/${id}/watchers`),
  watch: (obj: string, id: string, on: boolean) =>
    j<{ ok: boolean; watchers: number; me: boolean }>(`/api/objects/${obj}/${id}/watch`, { method: "POST", body: JSON.stringify({ on }) }),
  webhooks: () => j<{ webhooks: { id: string; url: string; events: string[]; active: boolean; secret: string }[] }>("/api/webhooks"),
  webhookCatalog: () => j<{ events: string[] }>("/api/webhooks/catalog").then((r) => r.events),
  webhookCreate: (url: string, events: string[]) =>
    j<{ id: string; secret: string }>("/api/webhooks", { method: "POST", body: JSON.stringify({ url, events }) }),
  webhookPatch: (id: string, body: { active?: boolean }) =>
    j<{ id: string }>(`/api/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  webhookTest: (id: string) => j<{ ok: boolean }>(`/api/webhooks/${id}/test`, { method: "POST", body: "{}" }),
  webhookDeliveries: (id: string) =>
    j<{ deliveries: { id: string; event: string; status: string; code: number; ts: string }[] }>(`/api/webhooks/${id}/deliveries`),
  jobs: () => j<{ jobs: { id: string; type: string; status: string }[] }>("/api/jobs"),
  views: (objectKey: string) =>
    j<{ views: { id: string; name: string; layout: string; visibility: string; state: Record<string, unknown> }[] }>(`/api/views?object=${encodeURIComponent(objectKey)}`).then((r) => r.views),
  viewCreate: (body: { objectKey: string; name: string; layout: string; state: Record<string, unknown>; visibility?: string }) =>
    j<{ id: string; name: string }>("/api/views", { method: "POST", body: JSON.stringify(body) }),
  viewDelete: (id: string) => j<{ ok: boolean }>(`/api/views/${id}`, { method: "DELETE" }),
  teamRemove: (slug: string, email: string) =>
    j<{ ok: boolean }>(`/api/teams/${slug}/members?email=${encodeURIComponent(email)}`, { method: "DELETE" }),
  timeline: (obj: string, id: string) =>
    j<{ events: TimelineEvent[] }>(`/api/objects/${obj}/${id}/timeline`).then((r) => r.events),
  addNote: (obj: string, id: string, text: string) =>
    j<TimelineEvent>(`/api/objects/${obj}/${id}/notes`, { method: "POST", body: JSON.stringify({ text }) }),
  addActivity: (obj: string, id: string, kind: string, text: string) =>
    j<TimelineEvent>(`/api/objects/${obj}/${id}/activities`, { method: "POST", body: JSON.stringify({ kind, text }) }),
  files: (obj: string, id: string) =>
    j<{ files: FileMeta[] }>(`/api/objects/${obj}/${id}/files`).then((r) => r.files),
  uploadFile: (obj: string, id: string, f: { name: string; mime: string; data: string }) =>
    j<FileMeta>(`/api/objects/${obj}/${id}/files`, { method: "POST", body: JSON.stringify(f) }),
  fileHref: (obj: string, id: string, fileId: string) => `/api/objects/${obj}/${id}/files/${fileId}`,
  enrich: (obj: string, id: string, field: string) =>
    j<RecordRow>(`/api/objects/${obj}/${id}/enrich`, { method: "POST", body: JSON.stringify({ field }) }),
  /* AI inline-suggestions: request generates tracked changes for a richText field;
     persist stores the resolved accept/reject set. Both return the projected row. */
  requestSuggestions: (obj: string, id: string, field: string) =>
    j<RecordRow>(`/api/objects/${obj}/${id}/suggest/${field}`, { method: "POST", body: "{}" }),
  persistSuggestions: (obj: string, id: string, field: string, changes: Suggestion[]) =>
    j<RecordRow>(`/api/objects/${obj}/${id}/suggest/${field}`, { method: "PATCH", body: JSON.stringify({ changes }) }),
  /* pull external warehouse writes (an async generation's finished record) into the live store */
  syncStore: () => j<{ applied: number }>("/api/sync", { method: "POST", body: "{}" }),
  /* fire an async generation for an object that declares a `generate` config: drops a
     placeholder row NOW and returns it; the finished record lands out-of-band (the
     warehouse writeback) and surfaces via syncStore(). See docs/RECIPES.md. */
  generate: (obj: string) =>
    j<RecordRow>(`/api/objects/${obj}/generate`, { method: "POST", body: "{}" }),
  /* one turn of native agent chat via the server copilot proxy (emulatorChat) — long poll */
  copilot: (message: string, sessionId?: string, context?: string) =>
    j<{ reply: string; sessionId: string; tools?: string[] }>("/api/copilot", { method: "POST", body: JSON.stringify({ message, sessionId, context }) }, 200000),
  state: () => j<Record<string, unknown>>("/api/state"),
  setState: (key: string, value: unknown) =>
    j<{ key: string }>("/api/state", { method: "POST", body: JSON.stringify({ key, value }) }),
  me: () =>
    j<{ enabled: boolean; accounts?: boolean; user: string | null; role?: "owner" | "admin" | "member" | "viewer" }>("/api/auth/me"),
  importRows: (obj: string, rows: Record<string, unknown>[], preview = false) =>
    j<{ results: ImportResult[]; totals: ImportTotals }>(`/api/objects/${obj}/import`, {
      method: "POST", body: JSON.stringify({ rows, preview }),
    }),
  tasks: (q: Record<string, string> = {}) =>
    j<{ tasks: TaskItem[]; me: string | null }>(`/api/tasks?` + new URLSearchParams(q)),
  taskCreate: (body: { title: string; status?: string; due?: string | null; assignee?: string | null; links?: { obj: string; id: string }[] }) =>
    j<TaskItem>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  taskPatch: (id: string, patch: Record<string, unknown>) =>
    j<TaskItem>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  taskDelete: (id: string) => j<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
  apiKeys: () => j<{ keys: ApiKeyMeta[] }>("/api/apikeys").then((r) => r.keys),
  apiKeyCreate: (name: string, role: string) =>
    j<ApiKeyMeta & { secret: string }>("/api/apikeys", { method: "POST", body: JSON.stringify({ name, role }) }),
  apiKeyRevoke: (id: string) =>
    j<{ ok: boolean }>(`/api/apikeys/${id}/revoke`, { method: "POST", body: "{}" }),
  duplicatesFor: (obj: string, id: string) =>
    j<{ candidates: DupCandidate[] }>(`/api/objects/${obj}/${id}/duplicates`).then((r) => r.candidates),
  duplicateGroups: (obj: string) =>
    j<{ groups: DupGroup[] }>(`/api/objects/${obj}/duplicates`).then((r) => r.groups),
  schemaState: () => j<{ enabled: boolean; role: string; objects: ObjectConfig[] }>("/api/schema"),
  schemaAddObject: (body: Record<string, unknown>) =>
    j<ObjectConfig>("/api/schema/objects", { method: "POST", body: JSON.stringify(body) }),
  schemaAddField: (obj: string, body: Record<string, unknown>) =>
    j<Record<string, unknown>>(`/api/schema/objects/${obj}/fields`, { method: "POST", body: JSON.stringify(body) }),
  schemaUpdateField: (obj: string, fieldKey: string, patch: Record<string, unknown>) =>
    j<Record<string, unknown>>(`/api/schema/objects/${obj}/fields/${fieldKey}`, { method: "PATCH", body: JSON.stringify(patch) }),
};

export interface DupCandidate { id: string; name: string; reasons: string[] }
export interface DupGroup { ids: string[]; reasons: string[] }

/* a link's label resolves LIVE server-side; null = the record no longer exists
   (destroyed/trashed) — render degraded, never navigate */
export interface TaskLink { obj: string; id: string; label: string | null; objLabel: string }
export interface TaskItem {
  id: string; title: string; status: "todo" | "doing" | "done";
  due: string | null; assignee: string | null; links: TaskLink[];
  createdBy: string | null; createdAt: string; doneAt: string | null;
}
export interface ImportResult { index: number; verdict: "created" | "restored" | "skipped" | "failed"; id?: string; reason?: string }
export interface ImportTotals { created: number; restored: number; skipped: number; failed: number }
export interface ApiKeyMeta {
  id: string; name: string; role: string; prefix: string; last4: string;
  createdAt: string; revokedAt: string | null;
}
