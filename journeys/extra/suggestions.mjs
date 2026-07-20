/* suggestions lane journeys — AI inline-edit suggestions (tracked changes) on a
   richText record. Append-only (loaded by run.mjs from journeys/extra/*.mjs). Boots
   the suggestions fixture on the lane's port band (5650-5699) with NO platform creds,
   so the /suggest route serves a labeled MOCK derived from the document. Drives the
   review as a USER and asserts VISIBLE outcomes: inline changes render, accept merges
   the replacement into the text, reject leaves the original.
   Band note: 5650 avoids the reserved traps (5000/5060/5061/7000). */

import { spawn } from "node:child_process";
import path from "node:path";

// the full suite pins the MAIN app to 5650 (the lane's band root); the fixture takes
// a distinct in-band port so the two never collide
const PORT = 5651;
const BASE = `http://localhost:${PORT}`;

async function bootFixture(ROOT) {
  // no platform key → the /suggest route serves the labeled mock (an empty-string key
  // fails env validation, so the var is DELETED, not blanked)
  const env = { ...process.env, PORT: String(PORT), CONFIG_PATH: "journeys/fixtures/suggestions.config.json" };
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

async function openDoc(page, id) {
  const ctx = await page.context().browser().newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/#/o/docs/r/${id}`);
  await p.waitForSelector('[data-testid="record-name"]', { timeout: 8000 });
  return { ctx, p };
}

const blockText = (p, blockId) => p.locator(`[data-testid="edit-${blockId}"]`).textContent();

export default [
  {
    name: "suggestions-review", feature: "AI suggestions (tracked changes)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openDoc(page, "d_1");
        await p.waitForSelector('[data-testid="edit-ed1"]');
        // the config-declared state Pipeline renders with the record's current stage
        await p.waitForSelector('[data-testid="suggest-pipeline"]');
        assert(await p.locator('[data-testid="suggest-pipeline"] [title="In review"]').count() >= 1, "state Pipeline renders the config states with the current stage");

        // request suggestions → the AI task (mock) produces tracked changes
        await p.click('[data-testid="suggest-request"]');
        // inline tracked-change widgets appear in the editor (one per changed block)
        await p.waitForFunction(() => document.querySelectorAll(".ne-root .ne-chg").length >= 2, { timeout: 8000 });
        assert(true, "requesting suggestions renders inline tracked changes in the editor");
        // the review rail lists them
        await p.waitForSelector('[data-testid="suggestions-panel"]');
        assert(await p.locator('[data-testid="suggest-card-sg_mock_1"]').count() === 1, "the review rail lists the first suggestion");
        assert(await p.locator('[data-testid="suggest-card-sg_mock_2"]').count() === 1, "the review rail lists the second suggestion");

        // before accept the change is a PENDING inline widget (del original + ins
        // replacement), anchored in ed1 — not yet folded into the real text
        assert(await p.locator('[data-testid="edit-ed1"] .ne-chg[data-cid="sg_mock_1"]').count() === 1, "the pending change renders as an inline widget in its block");

        // ACCEPT the first → the widget RESOLVES (leaves the pending set) and its
        // replacement is folded into the block's real text. Both together prove a
        // merge (a bare resolve without merge would revert to the original).
        await p.click('[data-testid="suggest-accept-sg_mock_1"]');
        await p.waitForFunction(
          () => !document.querySelector('.ne-chg[data-cid="sg_mock_1"]'),
          { timeout: 4000 },
        );
        assert(await p.locator('.ne-chg[data-cid="sg_mock_1"]').count() === 0, "the accepted change's inline widget resolves");
        assert((await blockText(p, "ed1"))?.includes("(suggested)"), "accept merges the replacement into the document text");

        // REJECT the second → its original text stays, the replacement is discarded
        await p.click('[data-testid="suggest-reject-sg_mock_2"]');
        await p.waitForFunction(
          () => !document.querySelector('.ne-chg[data-cid="sg_mock_2"]'),
          { timeout: 4000 },
        );
        const ed2 = await blockText(p, "ed2");
        assert(!!ed2 && ed2.includes("Beta access opens"), `reject keeps the original text (${JSON.stringify(ed2)})`);
        assert(!ed2.includes("(suggested)"), "reject discards the replacement (no merge into ed2)");

        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    // BINDING: resolved statuses persist through the suggest PATCH route; a fresh load
    // shows the accepted change already folded in and the rail reflecting the verdicts.
    name: "suggestions-persist", feature: "AI suggestions persist across reload",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openDoc(page, "d_1");
        await p.waitForSelector('[data-testid="edit-ed1"]');
        await p.click('[data-testid="suggest-request"]');
        await p.waitForSelector('[data-testid="suggest-card-sg_mock_1"]');
        await p.click('[data-testid="suggest-accept-sg_mock_1"]');
        await p.waitForFunction(
          () => document.querySelector('[data-testid="edit-ed1"]')?.textContent?.includes("(suggested)"),
          { timeout: 4000 },
        );
        // give the background persist (content save + statuses) a beat, then reload
        await p.waitForTimeout(900);
        await p.reload();
        await p.waitForSelector('[data-testid="edit-ed1"]', { timeout: 8000 });
        assert((await blockText(p, "ed1"))?.includes("(suggested)"), "the accepted merge survives a reload");
        // the rail still lists the change, now with an accepted verdict + undo
        await p.waitForSelector('[data-testid="suggestions-panel"]');
        assert(await p.locator('[data-testid="suggest-undo-sg_mock_1"]').count() === 1, "the resolved change persists with an undo affordance");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
];
