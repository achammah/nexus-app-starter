/* record-layout lane journeys — the two config-selectable record layouts +
   the peek-collapse fix. Append-only (loaded by run.mjs from journeys/extra/*.mjs).
   Boots the record-layout fixture on the lane's port band (5760-5799) with NO
   platform creds, so the /suggest route serves a labeled MOCK. Drives the record
   pages as a USER and asserts VISIBLE outcomes:
     (a) a STANDARD record renders its richText field readable (editor block wide,
         text horizontal — never collapsed one-letter-per-line);
     (b) opening a company in the SIDE-PEEK renders the editor readable, and it stays
         readable even with the suggestions rail requested (the grid stacks, the doc
         column keeps its floor width — the bug that crushed it is gone);
     (c) a DOCUMENT-layout record renders the wide hero editor as the main column +
         its suggestions review surface works.
   Band note: 5761 sits inside 5760-5799 and avoids the reserved traps. */

import { spawn } from "node:child_process";
import path from "node:path";

// the full suite pins the MAIN app to 5760 (the lane's band root); the fixture takes
// a distinct in-band port so the two never collide
const PORT = 5761;
const BASE = `http://localhost:${PORT}`;

async function bootFixture(ROOT) {
  // no platform key → the /suggest route serves the labeled mock (an empty-string key
  // fails env validation, so the var is DELETED, not blanked)
  const env = { ...process.env, PORT: String(PORT), CONFIG_PATH: "journeys/fixtures/record-layout.config.json" };
  delete env.NEXUS_API_KEY;
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(`${BASE}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

// width of an editor block by testid (a collapsed one-letter-per-line editor is a few px wide)
const blockWidth = (p, sel) =>
  p.evaluate((s) => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().width) : -1; }, sel);

const FLOOR = 200; // an editor narrower than this in a normal viewport is the collapse bug

export default [
  {
    name: "record-layout-standard-field", feature: "Standard record layout (richText field full width)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/companies/r/co_1`);
        await p.waitForSelector('[data-testid="record-name"]');
        // the standard record is a "standard"-layout page
        assert(await p.locator('[data-record-layout="standard"]').count() === 1, "companies renders the standard record layout");
        await p.waitForSelector('[data-testid="edit-cb1b"]');
        const w = await blockWidth(p, '[data-testid="edit-cb1b"]');
        assert(w > FLOOR, `the richText editor block renders full width, not collapsed (${w}px > ${FLOOR})`);
        // text flows horizontally: the paragraph carries its full sentence on the line
        const txt = await p.textContent('[data-testid="edit-cb1b"]');
        assert((txt ?? "").includes("real-time analytics platform"), "the editor content renders as flowing text");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "record-layout-peek-readable", feature: "Side-peek richText readable (collapse fixed)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/companies`);
        await p.waitForSelector('.nxRowLink');
        await p.click('.nxRowLink:has-text("Brightline Analytics")');
        await p.waitForSelector('[data-testid="peek-panel"]');
        await p.waitForSelector('[data-testid="peek-panel"] [data-testid="edit-cb1b"]');
        const wBefore = await blockWidth(p, '[data-testid="peek-panel"] [data-testid="edit-cb1b"]');
        assert(wBefore > FLOOR, `the editor is readable in the narrow side-peek, not collapsed (${wBefore}px > ${FLOOR})`);
        // request suggestions IN the peek → the editor+rail grid must STACK (container
        // query), keeping the doc column above its floor rather than crushing it
        await p.click('[data-testid="peek-panel"] [data-testid="suggest-request"]');
        await p.waitForFunction(() => document.querySelectorAll('[data-testid="peek-panel"] .ne-root .ne-chg').length >= 1, { timeout: 10000 });
        const wAfter = await blockWidth(p, '[data-testid="peek-panel"] [data-testid="edit-cb1b"]');
        assert(wAfter > FLOOR, `with the suggestions rail active the editor still keeps its floor width (${wAfter}px > ${FLOOR})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "record-layout-document-hero", feature: "Document record layout (wide hero editor + suggestions)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/docs/r/doc_1`);
        await p.waitForSelector('[data-testid="record-name"]');
        assert(await p.locator('[data-record-layout="document"]').count() === 1, "docs renders the document record layout");
        await p.waitForSelector('[data-testid="hero-body"]');
        await p.waitForSelector('[data-testid="edit-db1b"]');
        const w = await blockWidth(p, '[data-testid="edit-db1b"]');
        assert(w > 500, `the hero editor occupies the wide main column (${w}px > 500)`);
        // the document's suggestions review surface works (mock tracked changes render)
        await p.click('[data-testid="suggest-request"]');
        await p.waitForFunction(() => document.querySelectorAll(".ne-root .ne-chg").length >= 1, { timeout: 10000 });
        await p.waitForSelector('[data-testid="suggestions-panel"]');
        assert(true, "requesting suggestions on the document renders tracked changes + the review rail");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
