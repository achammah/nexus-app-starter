/* Mock Nexus platform for foundations journeys — intercepts the nexus() fetch
   boundary and returns canned JSON, so the async server helpers run end-to-end with
   NO real creds. Serves two seams:
     · POST /api/public/v1/skills/tasks/:id/execute  → a canned task output (runAiTask)
     · POST /api/public/v1/tools/:id/execute (BigQuery run-query) → a tiny in-memory
       event log so RemoteStore.sync()/warehouse loadSince behave against real SQL shapes
   Plus a control route:
     · POST /__inject { op, args }  → append an EXTERNAL writer's event (bumps seq)
   Envelopes mirror production: task → {success,data:{output}}, tool → {success,data:{result:[rows,{},meta]}}. */

import http from "node:http";

export const MOCK_ENRICH_VALUE = "MOCK_ENRICH_VALUE";

export function startMockNexus({ taskDelayMs = 400 } = {}) {
  const events = []; // { seq, ts, op, args(base64 json) }
  const nextSeq = () => (events.length ? Math.max(...events.map((e) => e.seq)) : 0) + 1;
  const sessions = new Map(); // sessionId → { messages: [{type, content}] }
  let sid = 0;

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    const url = new URL(req.url, "http://x");
    const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };

    // control — inject an external writer's event (as the generation webhook would)
    if (url.pathname === "/__inject" && req.method === "POST") {
      const seq = nextSeq();
      const argsFull = [new Date().toISOString(), ...(body.args ?? [])];
      events.push({ seq, ts: new Date().toISOString(), op: String(body.op), args: Buffer.from(JSON.stringify(argsFull), "utf8").toString("base64") });
      return json({ ok: true, seq });
    }

    // emulator session proxy (emulatorChat): create → send (appends an AI turn) → poll
    let m2;
    if ((m2 = url.pathname.match(/\/emulator\/[^/]+\/sessions$/)) && req.method === "POST") {
      const id = `sess_${++sid}`;
      sessions.set(id, { messages: [] });
      return json({ success: true, data: { id } });
    }
    if ((m2 = url.pathname.match(/\/emulator\/[^/]+\/sessions\/([^/]+)\/messages$/)) && req.method === "POST") {
      const sess = sessions.get(m2[1]);
      if (sess) { sess.messages.push({ type: "USER", content: body?.content ?? "" }); sess.messages.push({ type: "AI", content: `mock reply to: ${body?.content ?? ""}` }); }
      return json({ success: true, data: { debug: { toolsInvoked: ["mock_tool"] } } });
    }
    if ((m2 = url.pathname.match(/\/emulator\/[^/]+\/sessions\/([^/]+)$/)) && req.method === "GET") {
      const sess = sessions.get(m2[1]) ?? { messages: [] };
      return json({ success: true, data: { messages: sess.messages } });
    }

    // task execute → canned output (a small delay so the running indicator is observable)
    if (/\/skills\/tasks\/[^/]+\/execute$/.test(url.pathname)) {
      if (taskDelayMs) await new Promise((r) => setTimeout(r, taskDelayMs));
      return json({ success: true, data: { output: { value: MOCK_ENRICH_VALUE } } });
    }

    // tool execute → BigQuery run-query against the in-memory event log
    if (/\/tools\/[^/]+\/execute$/.test(url.pathname)) {
      const { action, input } = body;
      if (action === "google_cloud-run-query") {
        const q = String(input?.query ?? "");
        if (process.env.MOCK_DEBUG) console.error("[mock] Q:", q.replace(/\s+/g, " ").slice(0, 90), "| events:", events.length);
        let rows = [];
        if (/^\s*SELECT/i.test(q)) {
          const since = q.match(/seq\s*>\s*(\d+)/i);
          const n = since ? Number(since[1]) : -1;
          rows = events.filter((e) => e.seq > n).sort((a, b) => a.seq - b.seq).map((e) => ({ seq: e.seq, op: e.op, args: e.args }));
        } else if (/^\s*INSERT/i.test(q)) {
          const re = /\((\d+),\s*TIMESTAMP\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g;
          let m;
          while ((m = re.exec(q))) events.push({ seq: Number(m[1]), ts: m[2], op: m[3], args: m[4] });
        }
        // CREATE SCHEMA/TABLE and INSERT return no rows
        return json({ success: true, data: { result: [rows, {}, { jobComplete: true }] } });
      }
      return json({ success: true, data: { result: [[], {}, { jobComplete: true }] } });
    }

    json({ success: true, data: {} });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, events, close: () => server.close() }));
  });
}
