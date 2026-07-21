/* wizard-app lane journeys — the config-driven guided create flow. An object that
   declares `createWizard` opens the library Wizard (guided-vs-blank landing) from its
   "New <object>" button instead of the plain dialog. Autoloaded by run.mjs
   (journeys/extra/*.mjs). Boots the wizard-app fixture on the lane's band (5820-5829)
   with the `notes` object (createWizard: title -> status -> body[richText], openIn:page).
   Two journeys, both asserting VISIBLE outcomes:
     (1) guided (5821): New -> landing -> Guided -> walk the questions (a required text
         step gates Next, a select step auto-advances) -> review -> Create -> the new
         record opens with the answered title + status and the body answer rendered as
         a prose paragraph (the long string was coerced to a richText block);
     (2) blank fallback (5822): New -> Blank -> the plain create dialog -> Create -> the
         record exists (the pre-wizard create path is preserved, unchanged).
   Band note: 5821/5822 sit inside 5820-5829 and avoid the reserved traps. Each journey
   boots its own throwaway fixture (killed in finally) so the created rows never touch
   the shared suite. */

import { spawn } from "node:child_process";
import path from "node:path";

async function bootFixture(ROOT, port) {
  // no platform key needed; the fixture is a pure local store seeded from the config
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: "journeys/fixtures/wizard-app.config.json" };
  delete env.NEXUS_API_KEY;
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

export default [
  {
    name: "wizard-guided-create",
    feature: "Guided create flow (config-driven wizard)",
    async run(page, { assert, ROOT }) {
      const PORT = 5821;
      const BASE = `http://localhost:${PORT}`;
      const proc = await bootFixture(ROOT, PORT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/notes`);
        await p.waitForSelector('[data-testid="new-record"]');

        // "New note" opens the guided-vs-blank landing (NOT the plain dialog)
        await p.click('[data-testid="new-record"]');
        await p.waitForSelector('[data-testid="create-wizard"]');
        await p.waitForSelector('[data-testid="wizard-landing"]');
        assert((await p.locator('[data-testid="wizard-choose-guided"]').count()) === 1, "the landing offers a Guided choice");
        assert((await p.locator('[data-testid="wizard-choose-blank"]').count()) === 1, "the landing offers a Blank choice");
        await p.click('[data-testid="wizard-choose-guided"]');

        // step 1 — title (text, required): Next is gated until the step has a value
        await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "1 / 3");
        assert((await p.getAttribute('[data-testid="wizard-next"]', "disabled")) !== null, "a required title gates Next while empty");
        await p.fill('[data-testid="wizard-input"]', "Launch retro");
        assert((await p.getAttribute('[data-testid="wizard-next"]', "disabled")) === null, "Next enables once the title is filled");
        await p.click('[data-testid="wizard-next"]');

        // step 2 — status (select): picking an option AUTO-ADVANCES to the next step
        await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "2 / 3");
        await p.waitForSelector('[data-testid="wizard-opt-In review"]');
        await p.click('[data-testid="wizard-opt-In review"]');
        await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "3 / 3");

        // step 3 — body (long): a plain-text opening paragraph
        await p.fill('[data-testid="wizard-input"]', "The rollout went smoothly and the team shipped on time.");
        await p.click('[data-testid="wizard-next"]');

        // the review lists the answers, then Create fires
        await p.waitForSelector('[data-testid="wizard-review"]');
        const review = await p.textContent('[data-testid="wizard-review"]');
        assert(review.includes("Launch retro") && review.includes("In review"), "the review screen lists the answered title + status");
        await p.click('[data-testid="wizard-complete"]');

        // the wizard closes and the NEW record opens (openIn:page -> full record page)
        await p.waitForSelector('[data-testid="create-wizard"]', { state: "detached" });
        await p.waitForSelector('[data-testid="record-name"]');
        const name = (await p.textContent('[data-testid="record-name"]'))?.trim();
        assert(name === "Launch retro", `the created record opens with the answered title (${JSON.stringify(name)})`);
        // field-status is a native <select>; read its VALUE (not textContent, which is every option)
        const status = await p.inputValue('[data-testid="field-status"]');
        assert(status === "In review", `the record carries the picked status (${JSON.stringify(status)})`);
        // the long answer became the record's richText body (coerced to a paragraph block)
        await p.waitForFunction(() => document.body.textContent?.includes("The rollout went smoothly"));
        assert(true, "the guided body answer is stored + rendered as the record's body paragraph");

        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "wizard-blank-fallback",
    feature: "Guided create flow (config-driven wizard)",
    async run(page, { assert, ROOT }) {
      const PORT = 5822;
      const BASE = `http://localhost:${PORT}`;
      const proc = await bootFixture(ROOT, PORT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1280, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/notes`);
        await p.waitForSelector('[data-testid="new-record"]');

        // Blank on the landing drops to the plain create dialog — the pre-wizard path, intact
        await p.click('[data-testid="new-record"]');
        await p.waitForSelector('[data-testid="wizard-choose-blank"]');
        await p.click('[data-testid="wizard-choose-blank"]');
        await p.waitForSelector('[data-testid="create-wizard"]', { state: "detached" });
        await p.waitForSelector('[data-testid="new-title"]');
        await p.fill('[data-testid="new-title"]', "Blank note");
        await p.click('[data-testid="create-confirm"]');

        // the record is created and opens (openIn:page)
        await p.waitForSelector('[data-testid="record-name"]');
        const name = (await p.textContent('[data-testid="record-name"]'))?.trim();
        assert(name === "Blank note", `the blank path still creates via the plain dialog (${JSON.stringify(name)})`);

        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
];
