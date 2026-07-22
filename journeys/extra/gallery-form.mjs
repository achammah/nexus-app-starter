/* gallery-form lane journeys — the gallery view (cover-card masonry, windowed)
   and the form view (config-driven intake over the unified field editors), plus
   the create-dialog numeric-create fix the unification shipped. Autoloaded by
   run.mjs (journeys/extra/*.mjs). Band 5900-5909: the full suite pins the MAIN
   app to 5900; each journey here boots its OWN throwaway fixture server
   (journeys/fixtures/gallery-form.config.json) on 5901-5909 and kills it in
   finally, so the shared suite state is never touched. All outcomes are
   VISIBLE: cards render, a peek opens, an error names its field, a row appears. */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG = "journeys/fixtures/gallery-form.config.json";

async function bootFixture(ROOT, port, extraEnv = {}) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: CONFIG, ...extraEnv };
  delete env.NEXUS_API_KEY;
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 30; i++) {
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

async function open(page, base, hash, viewport = { width: 1360, height: 900 }, touch = false) {
  const ctx = await page.context().browser().newContext({ viewport, hasTouch: touch });
  const p = await ctx.newPage();
  await p.goto(`${base}/${hash}`);
  return { ctx, p };
}

export default [
  {
    name: "gallery-renders-covers", feature: "Gallery view (cover-card masonry)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5901);
      try {
        const { ctx, p } = await open(page, "http://localhost:5901", "#/o/shots");
        await p.waitForSelector('[data-testid="gallery-shots"] [data-testid^="gcard-"]', { timeout: 8000 });
        const cards = await p.locator('[data-testid="gallery-shots"] a[data-testid^="gcard-"]').count();
        assert(cards === 8, `all seeded shots render as cards (${cards})`);
        const covers = await p.locator('[data-testid="gallery-shots"] img[data-testid$="-cover"]').count();
        assert(covers === 6, `cover images render for every row with a cover url (${covers})`);
        await p.waitForSelector('[data-testid="gcard-sh_4-ph"]');
        // coverless → a neutral placeholder with a muted media icon, never title initials
        const ph = (await p.textContent('[data-testid="gcard-sh_4-ph"]'))?.trim();
        assert(ph === "", `the coverless placeholder shows no title initials (text=${JSON.stringify(ph)})`);
        assert((await p.locator('[data-testid="gcard-sh_4-ph"] svg.nxGCard-phIcon').count()) === 1, "the coverless placeholder shows a muted media icon");
        const chipColor = await p.getAttribute('[data-testid="gcard-sh_1"] .nxOptChip', "data-color");
        assert(chipColor === "blue", `the meta chip carries the configured option color (${chipColor})`);
        await shot(p, ROOT, "gallery-grid");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-card-opens-peek", feature: "Gallery view (cover-card masonry)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5902);
      try {
        const { ctx, p } = await open(page, "http://localhost:5902", "#/o/shots");
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        await p.click('[data-testid="gcard-sh_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 6000 });
        const name = (await p.textContent('[data-testid="record-name"]'))?.trim();
        assert(name === "Harbor at dusk", `the card click opens the record peek (${JSON.stringify(name)})`);
        assert(p.url().includes("peek=sh_1"), "the peek root rides the URL (?peek=) so reload restores it");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-mobile", feature: "Gallery view (cover-card masonry)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5903);
      try {
        const { ctx, p } = await open(page, "http://localhost:5903", "#/o/shots", { width: 390, height: 664 }, true);
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        const box = await p.locator('[data-testid="gcard-sh_1"]').boundingBox();
        assert(!!box && box.width > 300, `at 390px the masonry reflows to one full-width column (${Math.round(box?.width ?? 0)}px)`);
        await shot(p, ROOT, "gallery-mobile-390");
        // tap the card at the top of the wrap — a below-the-fold card's CENTER can sit
        // under the fixed bottom tab bar, which playwright's tap-point check refuses
        // (a human taps any visible part; the interaction itself is the same)
        await p.tap('[data-testid="gcard-sh_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 6000 });
        assert(true, "a TAP opens the record peek (no hover-only affordance)");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-10k-perf", feature: "Gallery view (cover-card masonry)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5904);
      try {
        const { ctx, p } = await open(page, "http://localhost:5904", "#/o/bulk");
        const t0 = Date.now();
        await p.waitForSelector('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]', { timeout: 15000 });
        const firstPaint = Date.now() - t0;
        assert(firstPaint < 8000, `10k rows: first cards paint fast (${firstPaint}ms < 8000)`);
        await p.waitForFunction(() => document.querySelector('[data-testid="row-count"]')?.textContent === "10000", null, { timeout: 8000 });
        const mounted = await p.locator('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]').count();
        assert(mounted < 400, `rendering is WINDOWED — the DOM holds a viewport slice, not 10k cards (${mounted})`);
        const firstBefore = await p.getAttribute('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]', "data-testid");
        await p.evaluate(() => { const el = document.querySelector('[data-testid="gallery-bulk"]'); if (el) el.scrollTop = 60000; });
        await p.waitForFunction(
          (before) => document.querySelector('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]')?.getAttribute("data-testid") !== before,
          firstBefore,
          { timeout: 5000 },
        );
        const mountedAfter = await p.locator('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]').count();
        assert(mountedAfter < 400, `deep scroll swaps the window, DOM stays bounded (${mountedAfter})`);
        const t1 = Date.now();
        await p.click('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 6000 });
        assert(Date.now() - t1 < 3000, `a card click opens the peek promptly at 10k rows (${Date.now() - t1}ms)`);
        await shot(p, ROOT, "gallery-10k");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-empty", feature: "Gallery view (cover-card masonry)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5905);
      try {
        const { ctx, p } = await open(page, "http://localhost:5905", "#/o/empty_shots");
        await p.waitForSelector('[data-testid="gallery-empty"]', { timeout: 8000 });
        const copy = await p.textContent('[data-testid="gallery-empty"]');
        assert(copy?.includes("No empty shots yet"), "the designed empty state renders (copy names the object)");
        await p.click('[data-testid="gallery-empty-new"]');
        await p.waitForSelector('[data-testid="new-title"]', { timeout: 6000 });
        assert(true, "the empty-state CTA opens the create dialog");
        await p.keyboard.press("Escape");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "form-renders-order-required", feature: "Form view (config-driven intake)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5906);
      try {
        const { ctx, p } = await open(page, "http://localhost:5906", "#/o/leads");
        await p.waitForSelector('[data-testid="form-leads"]', { timeout: 8000 });
        const order = await p.$$eval('[data-testid="form-leads"] [data-testid^="field-form-"]', (els) =>
          els.map((e) => e.getAttribute("data-testid")).filter((t) => /^field-form-[a-z]+$/i.test(t ?? "")));
        assert(JSON.stringify(order) === JSON.stringify(["field-form-name", "field-form-email", "field-form-company", "field-form-size", "field-form-channel"]),
          `the configured fields render in configured order (${order.join(", ")})`);
        // keyboard path: type the name, tab onward, submit with Enter — the
        // required email error must render inline AND take focus
        await p.focus('[data-testid="field-form-name"]');
        await p.keyboard.type("Ada Journey");
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="form-err-email"]', { timeout: 5000 });
        const err = await p.textContent('[data-testid="form-err-email"]');
        assert(err?.includes("Email is required"), `the missing required field error NAMES the field (${JSON.stringify(err)})`);
        const focused = await p.evaluate(() => document.activeElement?.getAttribute("data-testid"));
        assert(focused === "field-form-email", `submit moves focus to the first invalid field (${focused})`);
        const rows = await p.evaluate(() => fetch("/api/objects/leads").then((r) => r.json()).then((b) => b.rows.length));
        assert(rows === 0, "an invalid submit creates NOTHING");
        await shot(p, ROOT, "form-required-error");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "form-submit-creates", feature: "Form view (config-driven intake)",
    async run(page, { assert, ROOT }) {
      // WAREHOUSE=local: the submit rides the full command-log store path
      const whFile = path.join(os.tmpdir(), `nx-gallery-form-${Date.now()}.jsonl`);
      const proc = await bootFixture(ROOT, 5907, { WAREHOUSE: "local", WAREHOUSE_LOCAL_PATH: whFile });
      try {
        const { ctx, p } = await open(page, "http://localhost:5907", "#/o/leads");
        await p.waitForSelector('[data-testid="form-leads"]');
        await p.fill('[data-testid="field-form-name"]', "Nora Fixture");
        await p.fill('[data-testid="field-form-email"]', "nora@fixture.test");
        await p.fill('[data-testid="field-form-size"]', "120");
        await p.selectOption('[data-testid="field-form-channel"]', "Referral");
        await p.click('[data-testid="form-submit"]');
        await p.waitForSelector('[data-testid="form-success"]', { timeout: 8000 });
        const success = await p.textContent('[data-testid="form-success"]');
        assert(success?.includes("Nora Fixture created"), "the success state names the created record");
        await p.click('[data-testid="form-again"]');
        await p.waitForSelector('[data-testid="form-leads"]');
        const cleared = await p.inputValue('[data-testid="field-form-name"]');
        assert(cleared === "", "Create another resets the form");
        await p.click('[data-testid="view-switch"] button:has-text("Table")');
        await p.waitForSelector('[data-testid="table-leads"] tbody tr', { timeout: 6000 });
        const rowText = await p.textContent('[data-testid="table-leads"] tbody tr:first-child');
        assert(!!rowText && rowText.includes("Nora Fixture") && rowText.includes("120"),
          "the created record is visible in the Table view with its NUMERIC size (the store path persisted typed values)");
        await shot(p, ROOT, "form-created-row");
        await ctx.close();
      } finally { proc.kill(); rmSync(whFile, { force: true }); }
    },
  },
  {
    name: "form-mobile", feature: "Form view (config-driven intake)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5908);
      try {
        const { ctx, p } = await open(page, "http://localhost:5908", "#/o/leads", { width: 390, height: 664 }, true);
        await p.waitForSelector('[data-testid="form-leads"]');
        const form = await p.locator('[data-testid="form-leads"]').boundingBox();
        assert(!!form && form.width <= 390, `the form reflows single-column inside the viewport (${Math.round(form?.width ?? 0)}px)`);
        await p.tap('[data-testid="field-form-name"]');
        await p.keyboard.type("Tap Lead");
        await p.tap('[data-testid="form-submit"]');
        await p.waitForSelector('[data-testid="form-err-email"]', { timeout: 5000 });
        assert(true, "touch submit works and the inline error renders at 390px");
        await shot(p, ROOT, "form-mobile-390");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "create-dialog-number-persists", feature: "Unified field editors (draft coercion)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5909);
      try {
        const { ctx, p } = await open(page, "http://localhost:5909", "#/o/leads");
        // the plain create dialog: a TYPED number used to reach the server as a
        // string and 400 ("Size must be a number") — the shared draft coercion
        // fixed it centrally; this journey pins the fix
        await p.waitForSelector('[data-testid="new-record"]');
        await p.click('[data-testid="new-record"]');
        await p.waitForSelector('[data-testid="new-name"]');
        await p.fill('[data-testid="new-name"]', "Numeric Probe");
        await p.fill('[data-testid="new-size"]', "42");
        await p.click('[data-testid="create-confirm"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 6000 });
        const name = (await p.textContent('[data-testid="record-name"]'))?.trim();
        assert(name === "Numeric Probe", `the create succeeds with a typed number (${JSON.stringify(name)})`);
        const size = await p.inputValue('[data-testid="peek-panel"] [data-testid="field-size"]');
        assert(size === "42", `the numeric value persisted as a number (${JSON.stringify(size)})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
