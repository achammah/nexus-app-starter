/* grid-view lane journeys — the Sheet (spreadsheet) view over glide-data-grid.
   Boots its fixtures on the lane band (main suite pins 5850; these take
   5851/5852) and asserts VISIBLE outcomes through the grid's accessibility DOM,
   the store API, and the host chrome (toast, bulk bar):
     (a) the Sheet tab comes from the registry and the grid renders the rows;
     (b) KEYBOARD path: arrow-move + Enter opens the overlay editor, typing
         commits through the store and survives reload;
     (c) fill-handle drag fills 3 cells (one patch per row, persisted);
     (d) a 2x2 copy/paste lands the values in the target region;
     (e) the frozen primary column stays under horizontal scroll;
     (f) zero rows render the designed empty state;
     (g) mobile 390x664: a TAP on a row marker drives the host bulk bar;
     (h) 10k rows: first paint and a jump-to-end stay inside sane thresholds.
   Geometry is pinned by the fixture (marker 36 + widths 200/140/120/200,
   rowHeight 34, header 36), so canvas coordinates are deterministic. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 5851;
const BASE = `http://localhost:${PORT}`;
const PORT_10K = 5852;
const BASE_10K = `http://localhost:${PORT_10K}`;
const PORT_C = 5853;
const BASE_C = `http://localhost:${PORT_C}`;

async function boot(ROOT, cfg, port, base) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: `journeys/fixtures/${cfg}` };
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${base}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};

/* fixture geometry */
const MARKER = 36, HEADER = 36, ROW_H = 34;
const WIDTHS = [200, 140, 120, 200];
const colX = (c) => MARKER + WIDTHS.slice(0, c).reduce((a, b) => a + b, 0);
const cellCenter = (box, c, r) => ({
  x: box.x + colX(c) + WIDTHS[c] / 2,
  y: box.y + HEADER + r * ROW_H + ROW_H / 2,
});
const fillHandlePos = (box, c, r) => ({
  x: box.x + colX(c) + WIDTHS[c] - 3,
  y: box.y + HEADER + (r + 1) * ROW_H - 3,
});

const gridCanvas = async (p, key) => {
  await p.waitForSelector(`[data-testid="grid-${key}"] canvas`);
  const box = await p.locator(`[data-testid="grid-${key}"] canvas`).first().boundingBox();
  if (!box) throw new Error("grid canvas not measurable");
  return box;
};

/* poll the store API until the record satisfies the predicate */
async function untilApi(base, obj, pred, label, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const rows = (await (await fetch(`${base}/api/objects/${obj}`)).json()).rows;
    if (pred(rows)) return rows;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("API never satisfied: " + label);
}

export default [
  {
    name: "grid-renders-tabs", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        await p.waitForSelector('[data-testid="view-switch"]');
        const tabs = await p.locator('[data-testid="view-switch"] button').allTextContents();
        assert(tabs.join("|").includes("Sheet"), `the registry supplies the Sheet tab (${tabs.join("|")})`);
        await gridCanvas(p, "projects");
        const rowCount = await p.getAttribute('[data-testid="grid-projects"] [role="grid"]', "aria-rowcount");
        assert(rowCount === "7", `the a11y grid announces 6 data rows (+header) (aria-rowcount=${rowCount})`);
        await shot(p, ROOT, "grid-full");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-keyboard-edit", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        // select Budget of row 1, ARROW to Notes, Enter opens the overlay editor
        const c = cellCenter(box, 2, 0);
        await p.mouse.click(c.x, c.y);
        await p.keyboard.press("ArrowRight");
        // glide applies selection moves asynchronously off the keydown; wait until
        // the active cell is really Notes before opening. Without this, Enter races
        // the move and can open the still-selected Budget editor (a number cell →
        // "kb-edited" coerces to null), the source of the ~33% flake. glide's a11y
        // cell id is glide-cell-<sourceIndex>-<row>; the checkbox row-marker takes
        // sourceIndex 0, so Notes (4th data column) is sourceIndex 4.
        await p.waitForFunction(
          () => document.querySelector('[data-testid="grid-projects"] [data-testid="glide-cell-4-0"]')?.getAttribute("aria-selected") === "true",
          null, { timeout: 5000 },
        );
        await p.keyboard.press("Enter");
        await p.waitForSelector("#portal textarea, #portal input", { timeout: 5000 });
        assert(true, "arrow-move + Enter opens the cell editor (keyboard path)");
        await p.keyboard.press("ControlOrMeta+a"); // Enter-open preserves the value; replace it
        await p.keyboard.type("kb-edited");
        await p.keyboard.press("Enter");
        await untilApi(BASE, "projects", (rows) => rows.find((r) => r.id === "pr_1")?.notes === "kb-edited", "typed value stored");
        assert(true, "the typed value committed through the store");
        await p.reload();
        await gridCanvas(p, "projects");
        const rows = (await (await fetch(`${BASE}/api/objects/projects`)).json()).rows;
        assert(rows.find((r) => r.id === "pr_1")?.notes === "kb-edited", "the edit survives a reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-fill-handle", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        // select the Stage of "Atlas migration" (Building) and drag the fill
        // handle down over the next 3 rows
        const c = cellCenter(box, 1, 0);
        await p.mouse.click(c.x, c.y);
        const h = fillHandlePos(box, 1, 0);
        await p.mouse.move(h.x, h.y);
        await p.mouse.down();
        for (let i = 1; i <= 10; i++) await p.mouse.move(h.x, h.y + (3 * ROW_H * i) / 10);
        await shot(p, ROOT, "grid-fill-mid-drag");
        await p.mouse.up();
        await untilApi(
          BASE, "projects",
          (rows) => ["pr_2", "pr_3", "pr_4"].every((id) => rows.find((r) => r.id === id)?.stage === "Building"),
          "fill wrote Building into the 3 rows below",
        );
        assert(true, "the fill-handle drag filled 3 cells below the source");
        await p.reload();
        const rows = (await (await fetch(`${BASE}/api/objects/projects`)).json()).rows;
        assert(["pr_2", "pr_3", "pr_4"].every((id) => rows.find((r) => r.id === id)?.stage === "Building"), "the fill persisted");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-copy-paste", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({
          viewport: { width: 1360, height: 900 },
          permissions: ["clipboard-read", "clipboard-write"],
        });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        // select Budget+Notes of rows 1-2, copy, paste onto rows 4-5
        const a = cellCenter(box, 2, 0);
        const b = cellCenter(box, 3, 1);
        await p.mouse.click(a.x, a.y);
        await p.keyboard.down("Shift");
        await p.mouse.click(b.x, b.y);
        await p.keyboard.up("Shift");
        await p.keyboard.press("ControlOrMeta+c");
        const t = cellCenter(box, 2, 3);
        await p.mouse.click(t.x, t.y);
        await p.keyboard.press("ControlOrMeta+v");
        await untilApi(
          BASE, "projects",
          (rows) => {
            const r4 = rows.find((r) => r.id === "pr_4");
            const r5 = rows.find((r) => r.id === "pr_5");
            return r4?.budget === 12000 && r4?.notes === "phase one" && r5?.budget === 8000 && r5?.notes === "waiting";
          },
          "2x2 paste landed budget+notes onto rows 4-5",
        );
        assert(true, "copy/paste round-tripped a 2x2 region via cell contents");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-frozen-column", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        // 900px: desktop layout, but narrower than the column set → real hscroll
        const ctx = await page.context().browser().newContext({ viewport: { width: 900, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        const nameHeaderVisible = () =>
          p.waitForFunction(
            () => [...document.querySelectorAll('[data-testid="grid-projects"] [role="columnheader"]')]
              .some((h) => h.textContent?.includes("Name")),
            null, { timeout: 5000 },
          );
        await nameHeaderVisible();
        assert(true, "Name header present before scroll");
        await p.mouse.move(box.x + 300, box.y + 100);
        await p.mouse.wheel(400, 0);
        await p.waitForTimeout(400);
        await nameHeaderVisible();
        assert(true, "the frozen primary column holds under horizontal scroll");
        await shot(p, ROOT, "grid-frozen-scrolled");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-empty-state", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/empty_x`);
        await p.waitForSelector('[data-testid="grid-empty_x"]');
        await p.waitForFunction(() => document.querySelector('[data-testid="grid-empty_x"]')?.textContent?.includes("No empties yet"));
        assert(true, "zero rows render the designed empty state inside the grid card");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-mobile", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-view.config.json", PORT, BASE);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        // TAP a row marker → the host bulk bar appears (grid selection drives it)
        await p.touchscreen.tap(box.x + MARKER / 2, box.y + HEADER + ROW_H / 2);
        await p.waitForSelector('[data-testid="bulk-bar"]', { timeout: 5000 });
        assert(true, "at 390px a TAP on the row marker selects the row and raises the bulk bar");
        await shot(p, ROOT, "grid-mobile");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-10k-perf", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, "grid-10k.config.json", PORT_10K, BASE_10K);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        // thresholds are ~4x a healthy local baseline (paint ~1.5s, jump ~0.3s
        // measured on this suite's reference machine) — a regression to sluggish
        // still fails while CI jitter does not
        const t0 = Date.now();
        await p.goto(`${BASE_10K}/#/o/rows_10k`);
        await p.waitForSelector('[data-testid="grid-rows_10k"] canvas');
        const paintMs = Date.now() - t0;
        assert(paintMs < 8000, `10k rows first-paint inside the budget (${paintMs}ms < 8000ms)`);
        const rowCount = await p.getAttribute('[data-testid="grid-rows_10k"] [role="grid"]', "aria-rowcount");
        assert(rowCount === "10001", `the grid really holds 10k rows (aria-rowcount=${rowCount})`);
        const box = await gridCanvas(p, "rows_10k");
        await p.mouse.click(box.x + MARKER + 100, box.y + HEADER + ROW_H / 2);
        const t1 = Date.now();
        await p.keyboard.press("ControlOrMeta+End");
        await p.waitForFunction(
          () => {
            const rows = [...document.querySelectorAll('[data-testid="grid-rows_10k"] [role="row"]')];
            return rows.some((r) => Number(r.getAttribute("aria-rowindex")) > 9900);
          },
          null, { timeout: 6000 },
        );
        const jumpMs = Date.now() - t1;
        assert(jumpMs < 4000, `jump-to-end lands at the bottom responsively (${jumpMs}ms < 4000ms)`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-contrast", feature: "Sheet view (spreadsheet grid)",
    async run(page, { assert, ROOT }) {
      // a bold client skin drives the selection background to a wrong-way
      // luminance in each theme (dark in light mode, light in dark mode); the
      // selected-cell text must flip so it stays legible either way. We select a
      // text cell and pixel-sample its interior straight off glide's canvas.
      const proc = await boot(ROOT, "grid-contrast.config.json", PORT_C, BASE_C);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE_C}/#/o/projects`);
        const box = await gridCanvas(p, "projects");
        const notesX = box.x + colX(3) + WIDTHS[3] / 2;
        const notesY = box.y + HEADER + ROW_H / 2; // row 0 = "phase one"

        /* brightest + darkest OPAQUE pixel luminance in a data cell's interior;
           picks the grid canvas that actually holds paint at the sample (skips a
           transparent overlay canvas) */
        const sampleCell = (col, row) => {
          const inset = 12;
          const vx = box.x + colX(col) + inset;
          const vy = box.y + HEADER + row * ROW_H + 7;
          const vw = WIDTHS[col] - inset * 2;
          const vh = ROW_H - 14;
          return p.evaluate(({ vx, vy, vw, vh }) => {
            let best = null;
            for (const cvs of document.querySelectorAll('[data-testid="grid-projects"] canvas')) {
              const r = cvs.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              const dpr = window.devicePixelRatio || 1;
              const g = cvs.getContext("2d");
              if (!g) continue;
              const sx = Math.round((vx - r.left) * dpr);
              const sy = Math.round((vy - r.top) * dpr);
              const sw = Math.max(1, Math.round(vw * dpr));
              const sh = Math.max(1, Math.round(vh * dpr));
              if (sx < 0 || sy < 0 || sx + sw > cvs.width || sy + sh > cvs.height) continue;
              let d;
              try { d = g.getImageData(sx, sy, sw, sh).data; } catch { continue; }
              let maxL = 0, minL = 1, opaque = 0;
              for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] < 10) continue;
                opaque++;
                const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                if (L > maxL) maxL = L;
                if (L < minL) minL = L;
              }
              if (opaque > 0 && (best === null || opaque > best.opaque)) best = { maxL, minL, opaque };
            }
            return best ?? { maxL: 0, minL: 1, opaque: 0 };
          }, { vx, vy, vw, vh });
        };

        // LIGHT theme: selection bg is dark (#2e1065) → selected text flips WHITE
        await p.mouse.click(notesX, notesY);
        await p.waitForTimeout(250);
        const light = await sampleCell(3, 0);
        await shot(p, ROOT, "grid-contrast-light");
        assert(light.opaque > 0, "the selected cell's canvas region was sampled");
        assert(
          light.maxL > 0.6,
          `light theme: selected-cell text is light on the dark selection (peak luminance ${light.maxL.toFixed(2)} > 0.6)`,
        );

        // DARK theme: selection bg flips light (#e9d5ff) → selected text flips BLACK
        await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await p.waitForTimeout(300); // theme.ts re-derives on the data-theme mutation
        await p.mouse.click(notesX, notesY);
        await p.waitForTimeout(250);
        const dark = await sampleCell(3, 0);
        await shot(p, ROOT, "grid-contrast-dark");
        assert(
          dark.minL < 0.25,
          `dark theme: selected-cell text is dark on the light selection (min luminance ${dark.minL.toFixed(2)} < 0.25)`,
        );
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
