/* UI data client — RELATIVE /api only (dev: vite proxy; prod: same origin), one code
   path across surfaces. Every fetch: timeout + non-2xx throw. */

import type { FileMeta, ObjectConfig, RecordRow, TimelineEvent } from "../ui/record-core/types";

import type { Skin } from "../ui/skins/skin";

export interface AppConfig {
  app: { name: string; slug: string };
  /* skinPreset names a built-in (nexus, ember); skin is a full inline Skin object
     (an org's brand as data); accent alone is the one-knob shortcut */
  theme: { accent?: string; skinPreset?: string; skin?: Skin };
  chat?: { embedUrl?: string };
  /* the app's people directory — `user`-type fields pick from this list */
  users?: string[];
  /* server-set: seeded fictional rows are present (drives the Demo badge) */
  demo?: boolean;
  /* server-set: feature flags (one env flag gates nav + page + API) */
  features?: { teams?: boolean; webhooks?: boolean; theme?: boolean };
  objects: ObjectConfig[];
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
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
  state: () => j<Record<string, unknown>>("/api/state"),
  setState: (key: string, value: unknown) =>
    j<{ key: string }>("/api/state", { method: "POST", body: JSON.stringify({ key, value }) }),
};
