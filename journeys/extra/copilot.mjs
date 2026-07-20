/* Copilot lane journey — the docked AI side-panel end to end. Boots the app on the
   copilot fixture (which carries the `copilot` config block) pointed at a tiny inline
   mock speaking the emulator session protocol, so the /api/copilot proxy → emulatorChat
   path runs with NO real creds. Asserts VISIBLE outcomes: the panel opens on the
   toggle, a sent message gets a Markdown-rendered agent reply with tool-use chips. */

import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = 5601; // inside the lane band (5600-5649); the suite pins the app to 5600

/* mock emulator API: create session → send (append a MARKDOWN AI turn + report tools)
   → poll returns the messages. Mirrors production envelopes ({success,data:{…}}). */
function startMockEmulator() {
  const sessions = new Map();
  let sid = 0;
  const REPLY = "## Summary\n\nThis is a **mock** copilot reply. It renders as Markdown.";
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {};
    const u = new URL(req.url, "http://x");
    const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    let m;
    if ((m = u.pathname.match(/\/emulator\/[^/]+\/sessions$/)) && req.method === "POST") {
      const id = `sess_${++sid}`; sessions.set(id, { messages: [] }); return json({ success: true, data: { id } });
    }
    if ((m = u.pathname.match(/\/emulator\/[^/]+\/sessions\/([^/]+)\/messages$/)) && req.method === "POST") {
      const s = sessions.get(m[1]);
      if (s) { s.messages.push({ type: "USER", content: body?.content ?? "" }); s.messages.push({ type: "AI", content: REPLY }); }
      return json({ success: true, data: { debug: { toolsInvoked: ["lookup_record"] } } });
    }
    if ((m = u.pathname.match(/\/emulator\/[^/]+\/sessions\/([^/]+)$/)) && req.method === "GET") {
      return json({ success: true, data: { messages: (sessions.get(m[1]) ?? { messages: [] }).messages } });
    }
    json({ success: true, data: {} });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, close: () => server.close() })));
}

async function bootApp(ROOT, mockPort) {
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
    stdio: "ignore",
    env: {
      ...process.env, PORT: String(PORT),
      CONFIG_PATH: "journeys/fixtures/copilot.config.json",
      NEXUS_API_KEY: "nxs_test", NEXUS_BASE_URL: `http://127.0.0.1:${mockPort}`,
      COPILOT_DEPLOYMENT_ID: "dep_mock",
    },
  });
  for (let i = 0; i < 24; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/api/healthz`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

export default [
  {
    name: "copilot-chat", feature: "AI copilot side-panel (docked, config-driven, Markdown replies)",
    async run(page, { ROOT, assert }) {
      const mock = await startMockEmulator();
      const proc = await bootApp(ROOT, mock.port);
      const B = `http://localhost:${PORT}`;
      try {
        const ctx = await page.context().browser().newContext();
        const p = await ctx.newPage();
        // open a RECORD so the copilot has per-object contextFields to send
        await p.goto(`${B}/#/o/records/r/rec_1`);
        await p.waitForSelector('[data-testid="record-name"]');

        // panel is docked but closed — the toggle is present, the input is not interactable yet
        await p.waitForSelector('[data-testid="copilot-toggle"]');
        const openBefore = await p.locator('[data-testid="copilot-dock"].is-open').count();
        assert(openBefore === 0, "copilot dock starts closed");

        // toggle opens the docked panel (VISIBLE: the dock slides in, the empty state shows)
        await p.click('[data-testid="copilot-toggle"]');
        await p.waitForSelector('[data-testid="copilot-dock"].is-open');
        await p.waitForSelector('[data-testid="copilot-suggestion-0"]');
        assert(true, "toggle opens the docked copilot panel with its suggestions");

        // send a message → a Markdown-rendered agent reply with tool chips comes back
        await p.fill('[data-testid="copilot-input"]', "What am I looking at?");
        await p.click('[data-testid="copilot-send"]');
        await p.waitForSelector('[data-testid="copilot-msg-agent"]', { timeout: 12000 });
        await p.waitForSelector('[data-testid="copilot-msg-agent"] .md-h', { timeout: 8000 });
        assert(true, "the agent reply renders a Markdown heading (## Summary)");
        const boldTxt = await p.textContent('[data-testid="copilot-msg-agent"] .nxCopilot-bubble b');
        assert(boldTxt?.includes("mock"), `Markdown bold renders inside the reply (${boldTxt})`);
        const tool = await p.textContent('[data-testid="copilot-tool"]');
        assert(tool?.includes("lookup_record"), `invoked tools render as chips (${tool})`);

        // the user turn is visible too
        const user = await p.textContent('[data-testid="copilot-msg-user"]');
        assert(user?.includes("What am I looking at?"), "the user message renders in the panel");

        // ⌘/Ctrl+I toggles it shut (keyboard path)
        await p.keyboard.press("Control+i");
        await p.waitForFunction(() => !document.querySelector('[data-testid="copilot-dock"].is-open'), null, { timeout: 4000 });
        assert(true, "Ctrl+I closes the panel");
        await ctx.close();
      } finally {
        proc.kill();
        mock.close();
      }
    },
  },
];
