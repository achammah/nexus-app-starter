/* plumbing lane journeys — dormant Nexus plumbing made VISIBLE, driven as a USER against a
   WAREHOUSE=local fixture (the file-backed command-log twin, node fs only, no platform creds),
   so sync() and the async-generation writeback run fully live offline. Three visible outcomes:
     (1) live-sync — the topbar affordance pulls an externally-appended row into the running list;
     (2) async generation — a placeholder row drops NOW and settles into the finished record;
     (3) rich-text save-state — typing surfaces Saving… → Saved.
   Each journey boots its own fresh fixture (unique warehouse file, deleted after) so the suite
   leaves the seed state it found. Band 5830-5839 (avoids the reserved traps 5000/5060/5061/7000). */

import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

async function bootLocalWarehouse(ROOT, port, whFile) {
  // WAREHOUSE=local wires RemoteStore over the file-backed command log; no creds needed.
  // An empty NEXUS_API_KEY fails env validation, so the var is DELETED, not blanked.
  const env = { ...process.env, PORT: String(port), WAREHOUSE: "local", WAREHOUSE_LOCAL_PATH: whFile };
  delete env.NEXUS_API_KEY;
  delete env.CONFIG_PATH; // the shipped starter.config.json carries the reports object
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 24; i++) {
    try { const r = await fetch(`${base}/api/healthz`, { signal: AbortSignal.timeout(1500) }); if (r.ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

async function shot(p, ROOT, name) {
  try {
    const dir = path.join(ROOT, "_shots");
    mkdirSync(dir, { recursive: true });
    await p.screenshot({ path: path.join(dir, `${name}.png`) });
  } catch { /* screenshots are best-effort evidence, never a gate */ }
}

async function freshPage(page, base, hash) {
  const ctx = await page.context().browser().newContext();
  const p = await ctx.newPage();
  await p.goto(`${base}/${hash}`);
  return { ctx, p };
}

export default [
  {
    name: "plumbing-live-sync", feature: "Live-sync pulls external writes",
    async run(page, { assert, ROOT }) {
      const port = 5831;
      const whFile = path.join(os.tmpdir(), `nx-plumbing-sync-${Date.now()}.jsonl`);
      const proc = await bootLocalWarehouse(ROOT, port, whFile);
      const base = `http://localhost:${port}`;
      try {
        const { ctx, p } = await freshPage(page, base, "#/o/reports");
        await p.waitForSelector('[data-testid="table-reports"] tbody tr', { timeout: 8000 });
        const before = await p.locator('[data-testid="table-reports"] tbody tr').count();
        assert((await p.locator('[data-testid="table-reports"] tbody tr:has-text("External briefing")').count()) === 0,
          "the external row is not visible before a sync");

        // an out-of-process writer appends a finished record straight to the warehouse (a
        // create event at a seq beyond ours; loadSince surfaces it on the next sync)
        const iso = new Date().toISOString();
        const ext = { seq: 1000000, ts: iso, op: "create",
          args: [iso, "reports", { title: "External briefing", status: "Ready",
            body: [{ id: "extb1", type: "p", text: "Landed via an out-of-process warehouse write." }] }] };
        appendFileSync(whFile, JSON.stringify(ext) + "\n");

        // the topbar live-sync affordance pulls it in
        await p.click('[data-testid="sync-now"]');
        await p.waitForSelector('[data-testid="sync-status"]', { timeout: 6000 });
        const status = await p.textContent('[data-testid="sync-status"]');
        assert(!!status && /1/.test(status), `the sync affordance reports the applied count ("${status}")`);
        await shot(p, ROOT, "sync-indicator");

        // and the externally-appended row now appears in the list (the rev poll picks it up)
        await p.waitForSelector('[data-testid="table-reports"] tbody tr:has-text("External briefing")', { timeout: 8000 });
        const after = await p.locator('[data-testid="table-reports"] tbody tr').count();
        assert(after === before + 1, `the external row is pulled into the running list (${before} → ${after})`);

        await ctx.close();
      } finally {
        proc.kill();
        rmSync(whFile, { force: true });
      }
    },
  },
  {
    name: "plumbing-async-generation", feature: "Async generation placeholder settles",
    async run(page, { assert, ROOT }) {
      const port = 5832;
      const whFile = path.join(os.tmpdir(), `nx-plumbing-gen-${Date.now()}.jsonl`);
      const proc = await bootLocalWarehouse(ROOT, port, whFile);
      const base = `http://localhost:${port}`;
      try {
        const { ctx, p } = await freshPage(page, base, "#/o/reports");
        await p.waitForSelector('[data-testid="table-reports"] tbody tr', { timeout: 8000 });
        const before = await p.locator('[data-testid="table-reports"] tbody tr').count();
        // count rows whose SELECTED status is `val` — reads the real cell value, not the
        // <option> DOM (each status select carries every option as text, so a text match
        // on "Generating" would hit every row)
        const statusCount = (val) => p.evaluate((v) => [...document.querySelectorAll('[data-testid="table-reports"] tbody tr')]
          .filter((r) => r.querySelector("select.nxCellEdit")?.value === v).length, val);

        // fire the async generation → a placeholder row drops NOW (status Generating) and the
        // in-flight affordance (ThinkingDots + "Generating…") shows next to the action
        await p.click('[data-testid="generate-record"]');
        await p.waitForSelector('[data-testid="generate-status"]', { timeout: 4000 });
        assert(true, "the generate action shows an in-flight indicator");
        await p.waitForFunction((n) => document.querySelectorAll('[data-testid="table-reports"] tbody tr').length === n, before + 1, { timeout: 6000 });
        assert((await statusCount("Generating")) === 1, "a placeholder row is added with status Generating");
        await shot(p, ROOT, "async-gen-generating");

        // it settles: the finished record lands from the warehouse (the mock writeback) and the
        // poll syncs it in → the placeholder becomes the finished record (Ready), affordance clears
        await p.waitForSelector('[data-testid="table-reports"] tbody tr:has-text("Generated report")', { timeout: 15000 });
        await p.waitForSelector('[data-testid="generate-status"]', { state: "detached", timeout: 15000 });
        assert((await statusCount("Generating")) === 0, "no row is left generating — the placeholder settled");
        assert((await statusCount("Ready")) === before + 1, "the finished record shows status Ready");
        const after = await p.locator('[data-testid="table-reports"] tbody tr').count();
        assert(after === before + 1, `the placeholder became the finished record — no duplicate row (${before} → ${after})`);
        await shot(p, ROOT, "async-gen-settled");

        await ctx.close();
      } finally {
        proc.kill();
        rmSync(whFile, { force: true });
      }
    },
  },
  {
    name: "plumbing-save-state", feature: "Rich-text save-state shows Saving then Saved",
    async run(page, { assert, ROOT }) {
      const port = 5833;
      const whFile = path.join(os.tmpdir(), `nx-plumbing-save-${Date.now()}.jsonl`);
      const proc = await bootLocalWarehouse(ROOT, port, whFile);
      const base = `http://localhost:${port}`;
      try {
        const { ctx, p } = await freshPage(page, base, "#/o/reports/r/rep_1");
        await p.waitForSelector('[data-testid="record-name"]', { timeout: 8000 });
        await p.waitForSelector('[data-testid="edit-rb1b"]', { timeout: 6000 });
        assert((await p.locator('[data-testid="richtext-save-body"]').count()) === 0, "no save-state chip at rest");

        // type into the body → the debounced save-state surfaces (idle → saving → saved)
        await p.click('[data-testid="edit-rb1b"]');
        await p.keyboard.type(" — reviewed");
        await p.waitForSelector('[data-testid="richtext-save-body"]', { timeout: 4000 });
        await shot(p, ROOT, "save-state-saving");
        await p.waitForFunction(
          () => document.querySelector('[data-testid="richtext-save-body"]')?.getAttribute("data-state") === "saved",
          null, { timeout: 5000 },
        );
        assert(true, "the rich-text save-state resolves to Saved after the debounce");
        await shot(p, ROOT, "save-state-saved");

        await ctx.close();
      } finally {
        proc.kill();
        rmSync(whFile, { force: true });
      }
    },
  },
];
