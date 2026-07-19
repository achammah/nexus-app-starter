/* UI data client — RELATIVE /api only (dev: vite proxy; prod: same origin), one code
   path across surfaces (dev-loop rule). Every fetch: timeout + non-2xx throw. */

import type { ObjectConfig, RecordRow, TimelineEvent } from "../ui/record-core/types";

export interface AppConfig {
  app: { name: string; slug: string };
  theme: { accent: string };
  objects: ObjectConfig[];
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
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
  timeline: (obj: string, id: string) =>
    j<{ events: TimelineEvent[] }>(`/api/objects/${obj}/${id}/timeline`).then((r) => r.events),
  addNote: (obj: string, id: string, text: string) =>
    j<TimelineEvent>(`/api/objects/${obj}/${id}/notes`, { method: "POST", body: JSON.stringify({ text }) }),
  state: () => j<Record<string, unknown>>("/api/state"),
  setState: (key: string, value: unknown) =>
    j<{ key: string }>("/api/state", { method: "POST", body: JSON.stringify({ key, value }) }),
};
