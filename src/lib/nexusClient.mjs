/* Nexus platform client — SERVER-SIDE ONLY (the api key never reaches the browser).
   Auth header is `api-key` (not Bearer). Base URL + key from env:
     NEXUS_API_KEY=nxs_…   NEXUS_BASE_URL=…   (set via `nexus vibe env set` in prod) */

const BASE = process.env.NEXUS_BASE_URL || "http://localhost:3001";
const KEY = process.env.NEXUS_API_KEY || "";

export async function nexus(path, { method = "GET", body, timeoutMs = 20000 } = {}) {
  if (!KEY) throw new Error("NEXUS_API_KEY not set (nexus vibe env set …)");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/public/v1${path}`, {
      method,
      signal: ctrl.signal,
      headers: { "api-key": KEY, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 200)}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

/* Warehouse-backed app_state twin (the data-spine contract server/store.mjs mocks):
   append-only writes + latest-per-key reads against the org warehouse. Wire the two
   calls below to the org's warehouse tool/table at integration time; the /api/state
   surface (and the UI) is identical against mock and warehouse. */
export const appState = {
  async append(_key, _value) {
    throw new Error("appState.append: wire to the org warehouse (see starter-guide.md) — the mock lives in server/store.mjs");
  },
  async latest() {
    throw new Error("appState.latest: wire to the org warehouse (see starter-guide.md)");
  },
};
