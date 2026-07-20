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

/* emulatorChat — one turn of native agent chat through the emulator API: create a
   session (or reuse sessionId), send the message (the send BLOCKS until the agent
   finishes → long timeout, no abort), then poll the session until a NEW AI turn
   appears. Returns { reply, sessionId, tools }. Generalizes the copilot proxy — the
   ONLY app-specific bit is the context label, so it's a param (default "Context").

   context  — optional string folded in front of the message so the agent can act on
              what the user is looking at; contextLabel names that block. */
export async function emulatorChat(deploymentId, { message, sessionId, context, contextLabel = "Context" }) {
  const unwrap = (r) => r?.data ?? r;
  const content = context ? `[${contextLabel} — what the user is looking at right now]\n${context}\n\n[User]\n${message}` : message;
  let sid = sessionId;
  if (!sid) sid = unwrap(await nexus(`/emulator/${deploymentId}/sessions`, { method: "POST", body: {} }))?.id;
  const aiCount = (s) => (unwrap(s)?.messages ?? []).filter((m) => m.type === "AI").length;
  const before = aiCount(await nexus(`/emulator/${deploymentId}/sessions/${sid}`, { timeoutMs: 25000 }));
  // the emulator send blocks until the agent finishes → long timeout, no abort
  const sent = unwrap(await nexus(`/emulator/${deploymentId}/sessions/${sid}/messages`, { method: "POST", body: { content }, timeoutMs: 180000 }));
  const tools = sent?.debug?.toolsInvoked ?? [];
  for (let i = 0; i < 20; i++) {
    const s = unwrap(await nexus(`/emulator/${deploymentId}/sessions/${sid}`, { timeoutMs: 25000 }).catch(() => null));
    const ai = (s?.messages ?? []).filter((m) => m.type === "AI");
    if (ai.length > before) return { reply: ai[ai.length - 1].content, sessionId: sid, tools };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("the agent took too long to respond");
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
