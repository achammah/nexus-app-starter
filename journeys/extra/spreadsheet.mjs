/* spreadsheet lane journeys — the full Univer workbook as a standalone nav page
   (#/p/spreadsheet, free-surface, persisted under the app_state key
   workbook:spreadsheet). Boots the DEFAULT config on the lane band (5910; the 10k
   fixture on 5911) and asserts VISIBLE outcomes by driving the REAL Univer UI —
   canvas cell clicks, the toolbar's data-u-command buttons, the column-header
   context menu — then reading the persisted snapshot's computed values through the
   store's /api/state KV (the facade caches every formula's `v` on save, so the
   snapshot is the assertion surface; the ACTION stays real clicking/typing):
     1 renders  — the nav item opens the page; workbook + toolbar + sheet tabs paint,
                  the seeded =SUM computes;
     2 formula  — type =SUM into an empty cell → it computes + persists across reload;
     3 add-col  — insert a column via the header context menu → data shifts + persists;
     4 format   — Bold a cell via the toolbar → the style lands + persists;
     5 theme    — flip data-theme live → Univer re-skins to dark (no reload);
     6 empty    — no saved workbook → the designed empty state, then Create seeds one;
     7 mobile   — 390x664 touch: tap a cell + type via the on-canvas editor + persist;
     8 10k-perf — a 10k-row workbook: first paint inside the budget.
   Canvas geometry is pinned by the seed (row-header 46, col-header 24, col A 130,
   others 100, row 24), so cell coordinates are deterministic. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { seedLargeWorkbook } from "../../src/ui/blocks/workbook/snapshot.ts";

const PORT = 5910;
const BASE = `http://localhost:${PORT}`;
const PORT_10K = 5911;
const BASE_10K = `http://localhost:${PORT_10K}`;
const SHEET = "sheet-budget";
const KEY = "workbook:spreadsheet";

async function boot(ROOT, port, base) {
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
    stdio: "ignore", env: { ...process.env, PORT: String(port) },
  });
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`${base}/api/healthz`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};

/* seed geometry (matches snapshot.ts) → deterministic cell coordinates */
const ROWHDR = 46, COLHDR = 24, COLW_A = 130, COLW = 100, ROWH = 24;
const colX = (c) => (c === 0 ? ROWHDR + COLW_A / 2 : ROWHDR + COLW_A + (c - 1) * COLW + COLW / 2);
const rowY = (r) => COLHDR + r * ROWH + ROWH / 2;

/* the main grid = the largest canvas inside the Univer host */
async function gridBox(p) {
  await p.waitForSelector('[data-testid="workbook-host"] canvas');
  const boxes = await p.locator('[data-testid="workbook-host"] canvas').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const g = boxes.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!g || g.w < 100) throw new Error("grid canvas not measurable");
  return g;
}

async function openSheet(page, base, viewport = { width: 1360, height: 900 }, extra = {}) {
  const ctx = await page.context().browser().newContext({ viewport, ...extra });
  const p = await ctx.newPage();
  await p.goto(`${base}/#/p/spreadsheet`);
  await p.waitForSelector('[data-testid="workbook-host"]', { timeout: 15000 });
  await gridBox(p);
  await p.waitForTimeout(2500); // Univer first paint + the seed's initial persist
  return { ctx, p };
}

/* poll the store's app_state KV until the workbook snapshot satisfies the predicate */
async function untilState(base, pred, label, tries = 36) {
  for (let i = 0; i < tries; i++) {
    const wb = (await (await fetch(`${base}/api/state`)).json())[KEY];
    if (wb && pred(wb)) return wb;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("state never satisfied: " + label);
}
const getWb = async (base) => (await (await fetch(`${base}/api/state`)).json())[KEY];
const setState = (base, value) =>
  fetch(`${base}/api/state`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: KEY, value }) });

const cellAt = (wb, sheet, r, c) => wb?.sheets?.[sheet]?.cellData?.[String(r)]?.[String(c)];
const styleOf = (wb, cel) => (cel && (typeof cel.s === "string" ? wb.styles?.[cel.s] : cel.s)) || {};

export default [
  {
    name: "spreadsheet-renders", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        // the standalone page is reachable from the nav (the customPages registry)
        await p.goto(`${BASE}/#/o/companies`);
        await p.waitForSelector('[data-testid="nav"]');
        await p.click('[data-testid="nav-p-spreadsheet"]');
        await p.waitForSelector('[data-testid="page-spreadsheet"]');
        await p.waitForSelector('[data-testid="workbook-host"] canvas');
        assert(true, "the Spreadsheet nav item opens the workbook page");
        // the vendor chrome painted: a themed toolbar command + both sheet tabs
        await p.waitForSelector('[data-u-command="sheet.command.set-range-bold"]');
        assert((await p.getByText("Budget", { exact: true }).count()) >= 1
          && (await p.getByText("Notes", { exact: true }).count()) >= 1, "both sheet tabs (Budget, Notes) render");
        // the seeded formulas computed (E3 = SUM(B3:D3) = 37000)
        const wb = await untilState(BASE, (w) => cellAt(w, SHEET, 2, 4)?.v === 37000, "seeded =SUM computed");
        assert(cellAt(wb, SHEET, 6, 4)?.v === 76900, `the seeded budget totals compute live (E7=${cellAt(wb, SHEET, 6, 4)?.v})`);
        await shot(p, ROOT, "spreadsheet-full");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-formula", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        const g = await gridBox(p);
        // type a fresh =SUM into the empty B10 and commit
        await p.mouse.click(g.x + colX(1), g.y + rowY(9));
        await p.keyboard.type("=SUM(B3:B6)");
        await p.keyboard.press("Enter");
        const wb = await untilState(BASE, (w) => cellAt(w, SHEET, 9, 1)?.v === 24000, "typed =SUM computed to 24000");
        assert(cellAt(wb, SHEET, 9, 1)?.f === "=SUM(B3:B6)", "the formula text is stored, not a literal");
        await shot(p, ROOT, "spreadsheet-formula");
        // it survives a reload (persisted through the app_state KV)
        await p.reload();
        await gridBox(p);
        const after = await getWb(BASE);
        assert(cellAt(after, SHEET, 9, 1)?.v === 24000, "the typed formula persists across reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-add-column", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        const g = await gridBox(p);
        // baseline: the "Mar" header sits in column D (index 3)
        await untilState(BASE, (w) => cellAt(w, SHEET, 1, 3)?.v === "Mar", "seed places Mar in col D");
        // select column C's header, right-click, insert one column to its right. The
        // menu item is a button with a count input in the middle — click its left Insert
        // icon (position), not the trailing label (which only focuses the row).
        await p.mouse.click(g.x + colX(2), g.y + COLHDR / 2);
        await p.waitForTimeout(300); // let the column selection settle before the menu
        await p.mouse.click(g.x + colX(2), g.y + COLHDR / 2, { button: "right" });
        const insertBtn = p.locator('button:has-text("cols right")').first();
        await insertBtn.waitFor();
        await insertBtn.click({ position: { x: 12, y: 16 } });
        // the new blank column pushes Mar from D(3) to E(4); D(3) is now empty
        const wb = await untilState(BASE,
          (w) => cellAt(w, SHEET, 1, 4)?.v === "Mar" && !cellAt(w, SHEET, 1, 3)?.v,
          "insert shifted Mar into col E and left col D blank");
        assert(cellAt(wb, SHEET, 1, 4)?.v === "Mar", "inserting a column shifted the data right by one");
        await shot(p, ROOT, "spreadsheet-add-column");
        await p.reload();
        await gridBox(p);
        const after = await getWb(BASE);
        assert(cellAt(after, SHEET, 1, 4)?.v === "Mar", "the inserted column persists across reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-format-cell", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        const g = await gridBox(p);
        // give B12 a value, reselect it, then Bold it via the real toolbar button
        await p.mouse.click(g.x + colX(1), g.y + rowY(11));
        await p.keyboard.type("bold me");
        await p.keyboard.press("Enter");
        await untilState(BASE, (w) => cellAt(w, SHEET, 11, 1)?.v === "bold me", "B12 took its value");
        await p.mouse.click(g.x + colX(1), g.y + rowY(11));
        await p.locator('[data-u-command="sheet.command.set-range-bold"]').first().click();
        const wb = await untilState(BASE,
          (w) => styleOf(w, cellAt(w, SHEET, 11, 1)).bl === 1, "B12 became bold");
        assert(styleOf(wb, cellAt(wb, SHEET, 11, 1)).bl === 1, "the Bold toolbar command set the cell style");
        await shot(p, ROOT, "spreadsheet-format");
        await p.reload();
        await gridBox(p);
        const after = await getWb(BASE);
        assert(styleOf(after, cellAt(after, SHEET, 11, 1)).bl === 1, "the bold style persists across reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-theme-flip", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        // no dark chrome to start
        assert((await p.locator('[data-testid="workbook-host"] .univer-dark').count()) === 0, "workbook starts in light");
        // flip the app theme live — the workbook re-skins with no reload
        await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await p.waitForSelector('[data-testid="workbook-host"] .univer-dark', { timeout: 5000 });
        assert(true, "flipping data-theme live re-skins Univer to dark (client-composable, no reload)");
        await shot(p, ROOT, "spreadsheet-dark");
        // and back
        await p.evaluate(() => { document.documentElement.dataset.theme = "light"; });
        await p.waitForFunction(() => !document.querySelector('[data-testid="workbook-host"] .univer-dark'), null, { timeout: 5000 });
        assert(true, "flipping back to light re-skins again");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-empty-state", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        // an explicit null workbook → the designed empty state (not a re-seed)
        await setState(BASE, null);
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/p/spreadsheet`);
        await p.waitForSelector('[data-testid="workbook-empty"]', { timeout: 10000 });
        assert(true, "no saved workbook renders the designed empty state");
        await shot(p, ROOT, "spreadsheet-empty");
        // Create seeds a workbook and mounts it
        await p.click('[data-testid="workbook-create"]');
        await p.waitForSelector('[data-testid="workbook-host"] canvas');
        await untilState(BASE, (w) => cellAt(w, SHEET, 2, 4)?.v === 37000, "Create seeded a computing workbook");
        assert(true, "Create builds a fresh workbook from the empty state");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-mobile", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE, { width: 390, height: 664 }, { hasTouch: true, isMobile: true });
        const g = await gridBox(p);
        assert(g.w > 100, "the workbook renders usefully at 390px");
        // tap a cell and edit it via the on-canvas editor (the declared mobile path)
        await p.touchscreen.tap(g.x + colX(1), g.y + rowY(9));
        await p.keyboard.type("42");
        await p.keyboard.press("Enter");
        const wb = await untilState(BASE, (w) => cellAt(w, SHEET, 9, 1)?.v === 42, "tap-edit committed at 390px");
        assert(cellAt(wb, SHEET, 9, 1)?.v === 42, "a tapped cell edits + persists on mobile");
        await shot(p, ROOT, "spreadsheet-mobile");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-10k-perf", feature: "Spreadsheet page (full Univer workbook)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT_10K, BASE_10K);
      try {
        // pre-seed a 10k-row workbook (a running-total formula on the hot path)
        await setState(BASE_10K, seedLargeWorkbook(10000));
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        // threshold ~4x a healthy local paint — a regression to sluggish fails, CI jitter does not
        const t0 = Date.now();
        await p.goto(`${BASE_10K}/#/p/spreadsheet`);
        await p.waitForSelector('[data-testid="workbook-host"] canvas', { timeout: 20000 });
        const paintMs = Date.now() - t0;
        assert(paintMs < 12000, `10k-row workbook first paint inside the budget (${paintMs}ms < 12000ms)`);
        // it really loaded the big sheet (the store holds 10k+ rows of data)
        const wb = await getWb(BASE_10K);
        const rows = Object.keys(wb?.sheets?.["sheet-rows"]?.cellData ?? {}).length;
        assert(rows >= 10000, `the workbook holds the full 10k rows (${rows})`);
        await shot(p, ROOT, "spreadsheet-10k");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
