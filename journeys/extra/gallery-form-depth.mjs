/* gallery + form DEPTH journeys — group-by sections + collapse, sort, ordered
   card fields, cover fit/source, card selection, mobile, 10k windowing; form
   sections + conditional-required. Each boots its own fixture on 5941-5949 and
   kills it in finally. Autoloaded by run.mjs. */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const CONFIG = "journeys/fixtures/gallery-form-depth.config.json";

async function bootFixture(ROOT, port) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: CONFIG };
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
  try { const dir = path.join(ROOT, "_shots"); mkdirSync(dir, { recursive: true }); await p.screenshot({ path: path.join(dir, `${name}.png`) }); } catch { /* best-effort */ }
}

async function open(page, base, hash, viewport = { width: 1360, height: 900 }, touch = false) {
  const ctx = await page.context().browser().newContext({ viewport, hasTouch: touch });
  const p = await ctx.newPage();
  await p.goto(`${base}/${hash}`);
  return { ctx, p };
}

export default [
  {
    name: "gallery-depth-groups", feature: "Gallery depth (group/sort/card fields)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5941);
      try {
        const { ctx, p } = await open(page, "http://localhost:5941", "#/o/shots");
        await p.waitForSelector('[data-testid="gsection-Photo"]', { timeout: 8000 });
        for (const [k, n] of [["Photo", "4"], ["Sketch", "2"], ["Chart", "2"]]) {
          const c = (await p.textContent(`[data-testid="gsection-${k}-count"]`))?.trim();
          assert(c === n, `${k} section shows its count (${c} === ${n})`);
        }
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        await shot(p, ROOT, "gallery-depth-groups");
        // item 2: grouping renders ALL groups, not just the first — scroll to reveal
        // groups 2 & 3, whose cards are windowed until they enter the viewport
        await p.locator('[data-testid="gsection-Sketch"]').scrollIntoViewIfNeeded();
        await p.waitForSelector('[data-testid="gcard-sh_2"]', { timeout: 4000 });
        assert(true, "scrolling to group 2 (Sketch) renders its cards");
        await p.locator('[data-testid="gsection-Chart"]').scrollIntoViewIfNeeded();
        await p.waitForSelector('[data-testid="gcard-sh_3"]', { timeout: 4000 });
        assert(true, "scrolling to group 3 (Chart) renders its cards");
        // back to the top so the Photo cards are in view for the collapse test
        await p.locator('[data-testid="gallery-shots"]').evaluate((el) => el.scrollTo(0, 0));
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        // collapse Photo → its cards leave the DOM
        await p.click('[data-testid="gsection-Photo"]');
        await p.waitForSelector('[data-testid="gcard-sh_1"]', { state: "detached", timeout: 4000 });
        assert(true, "collapsing a section hides its cards");
        // persists across reload (server-persisted view state)
        await p.reload();
        await p.waitForSelector('[data-testid="gsection-Photo"]');
        assert(await p.locator('[data-testid="gcard-sh_1"]').count() === 0, "collapse persists after reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-sort", feature: "Gallery depth (group/sort/card fields)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5942);
      try {
        const { ctx, p } = await open(page, "http://localhost:5942", "#/o/shots");
        await p.waitForSelector('a[data-testid^="gcard-"]');
        // config sorts by title asc; Photo section is first → first card = "Harbor" (sh_1)
        const first = await p.locator('a[data-testid^="gcard-"]').first().getAttribute("data-testid");
        assert(first === "gcard-sh_1", `config sort orders cards by title asc (first=${first})`);
        // flip direction via the toolbar → first Photo card becomes "Winter" (sh_6).
        // Radix menu items portal off-viewport in headless, so drive the menu by
        // keyboard (type-ahead) like the base group-by/rollup journeys do.
        await p.click('[data-testid="sort-by"]');
        await p.waitForSelector('[data-testid="sort-desc"]', { state: "attached", timeout: 4000 });
        await p.keyboard.press("ArrowUp"); // roving focus wraps to the last item = Descending
        await p.keyboard.press("Enter");
        await p.keyboard.press("Escape");
        await p.waitForFunction(() => document.querySelector('a[data-testid^="gcard-"]')?.getAttribute("data-testid") === "gcard-sh_6", null, { timeout: 4000 });
        assert(true, "toolbar sort direction reorders the cards");
        await p.reload();
        await p.waitForSelector('a[data-testid^="gcard-"]');
        const afterReload = await p.locator('a[data-testid^="gcard-"]').first().getAttribute("data-testid");
        assert(afterReload === "gcard-sh_6", "sort direction persists after reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-card-fields", feature: "Gallery depth (group/sort/card fields)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5943);
      try {
        const { ctx, p } = await open(page, "http://localhost:5943", "#/o/shots");
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        // shots is grouped by kind AND lists kind in cardFields → the group field is
        // HIDDEN on the cards (no redundant chip inside its own section, like Airtable)
        assert((await p.locator('[data-testid="gcard-sh_1"] .nxOptChip').count()) === 0,
          "the group field (kind) is hidden on cards inside its own section");
        const grouped = (await p.textContent('[data-testid="gcard-sh_1"] .nxGCard-body'))?.trim();
        assert(!!grouped && grouped.includes("Golden hour"), "the non-group card field (note) still renders");
        assert(!!grouped && !grouped.includes("Photo"), "the redundant group value is not reprinted on the card");
        await ctx.close();
        // registry rendering + configured order on a NON-grouped gallery (cards):
        // the select cardField shows as its colored chip, before the note field
        const { ctx: ctx2, p: p2 } = await open(page, "http://localhost:5943", "#/o/cards");
        await p2.waitForSelector('[data-testid="gcard-cd_1"]');
        const chip = await p2.getAttribute('[data-testid="gcard-cd_1"] .nxOptChip', "data-color");
        assert(chip === "blue", `an ungrouped gallery renders the kind cardField as its colored chip (${chip})`);
        const body = (await p2.textContent('[data-testid="gcard-cd_1"] .nxGCard-body'))?.trim();
        assert(!!body && body.includes("Golden hour"), "the note cardField value renders");
        assert(!!body && body.indexOf("Photo") < body.indexOf("Golden hour"), "card fields render in configured order (kind before note)");
        await ctx2.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-cover", feature: "Gallery depth (cover fit/source)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5944);
      try {
        const { ctx, p } = await open(page, "http://localhost:5944", "#/o/moods");
        // cover source = a links field → the FIRST url is the cover
        await p.waitForSelector('[data-testid="gcard-m_1-cover"]');
        const fit = await p.$eval('[data-testid="gcard-m_1-cover"]', (el) => getComputedStyle(el).objectFit);
        assert(fit === "contain", `coverFit "contain" applies to the cover image (${fit})`);
        const src = await p.getAttribute('[data-testid="gcard-m_1-cover"]', "src");
        assert(!!src && src.includes("f97316"), "the links cover uses the FIRST image in the field");
        await shot(p, ROOT, "gallery-depth-cover");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-select", feature: "Gallery depth (card selection)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5945);
      try {
        const { ctx, p } = await open(page, "http://localhost:5945", "#/o/shots");
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        await p.click('[data-testid="gcard-sh_1-select"]');
        await p.waitForSelector('[data-testid="gcard-sh_1"][data-selected="true"]', { timeout: 4000 });
        assert(true, "clicking a card's checkbox selects it (bulk-bar compatible)");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-mobile", feature: "Gallery depth (group/sort/card fields)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5946);
      try {
        const { ctx, p } = await open(page, "http://localhost:5946", "#/o/shots", { width: 390, height: 664 }, true);
        await p.waitForSelector('[data-testid="gsection-Photo"]');
        await p.waitForSelector('[data-testid="gcard-sh_1"]');
        const box = await p.locator('[data-testid="gcard-sh_1"]').boundingBox();
        assert(!!box && box.width > 300, `at 390px cards reflow to one full-width column (${Math.round(box?.width ?? 0)}px)`);
        await shot(p, ROOT, "gallery-depth-mobile-390");
        await p.tap('[data-testid="gcard-sh_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 6000 });
        assert(true, "a TAP opens the record peek");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "gallery-depth-10k", feature: "Gallery depth (group/sort/card fields)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5947);
      try {
        const { ctx, p } = await open(page, "http://localhost:5947", "#/o/bulk");
        const t0 = Date.now();
        await p.waitForSelector('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]', { timeout: 15000 });
        assert(Date.now() - t0 < 8000, "10k rows: first cards paint fast");
        const mounted = await p.locator('[data-testid="gallery-bulk"] a[data-testid^="gcard-"]').count();
        assert(mounted < 400, `rendering is WINDOWED — the DOM holds a slice, not 10k (${mounted})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "form-depth-sections", feature: "Form depth (sections + conditional required)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5948);
      try {
        const { ctx, p } = await open(page, "http://localhost:5948", "#/o/leads");
        await p.waitForSelector('[data-testid="form-leads"]');
        assert(await p.locator('[data-testid="form-section-Contact"]').count() === 1, "the Contact section renders");
        assert(await p.locator('[data-testid="form-section-Company"]').count() === 1, "the Company section renders");
        await shot(p, ROOT, "form-depth-sections");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "form-depth-conditional", feature: "Form depth (sections + conditional required)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, 5949);
      try {
        const { ctx, p } = await open(page, "http://localhost:5949", "#/o/leads");
        await p.waitForSelector('[data-testid="form-leads"]');
        // size is not required until channel = Event
        assert(await p.locator('[data-testid="form-req-size"]').count() === 0, "size is not required by default");
        await p.fill('[data-testid="field-form-name"]', "Acme Co");
        await p.fill('[data-testid="field-form-email"]', "ops@acme.example");
        await p.selectOption('[data-testid="field-form-channel"]', "Event");
        await p.waitForSelector('[data-testid="form-req-size"]', { timeout: 3000 });
        assert(true, "choosing the trigger value makes the conditional field required");
        await p.click('[data-testid="form-submit"]');
        await p.waitForSelector('[data-testid="form-err-size"]', { timeout: 3000 });
        assert(await p.locator('[data-testid="form-summary"]').count() === 1, "a failed submit shows the error summary");
        await p.fill('[data-testid="field-form-size"]', "40");
        await p.click('[data-testid="form-submit"]');
        await p.waitForSelector('[data-testid="form-success"]', { timeout: 6000 });
        assert(true, "filling the now-required field lets the submit through");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
