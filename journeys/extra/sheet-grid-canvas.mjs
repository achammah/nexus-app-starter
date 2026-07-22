/* sheet-grid-canvas journeys — the sheet's CANVAS layer (gridlines, row/column
   headers, freeze divider, selection) must sit on our tokens, not stock Excel
   gray. Boots the DEFAULT config on the lane band (5925) and asserts PAINTED
   PIXELS read back from the canvas (the ground truth for canvas theming):
     1 light  — Notion-model chrome: the header band paints our ACHROMATIC sunken
                surface with our hairlines (clearly not stock-Excel gray), brand
                color lives in the STATES — the frozen divider stays a saturated
                ACCENT rule — and gridlines paint the whisper mix (clearly softer
                than the stock gray mesh); the toolbar row wears the app's chrome
                tone (--nx-bg-sunken);
     2 dark   — the same surfaces flip coherently dark; the freeze rule KEEPS its
                accent lean (never a neutral gray bar);
     3 skin   — a live skin upsert recolors the selection ring on the canvas with
                no reload (accent -> teal), proving the canvas re-derive path;
     4 legible — the SELECTED cell keeps WCAG-AA text: the selection wash is a
                7% accent tint, so ink-vs-fill contrast stays high in light AND
                dark (measured from real composited screenshot pixels). */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 5925;
const BASE = `http://localhost:${PORT}`;

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

async function openSheet(page, base, theme) {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } });
  if (theme) await ctx.addInitScript((t) => localStorage.setItem("nx-theme", t), theme);
  const p = await ctx.newPage();
  await p.goto(`${base}/#/p/spreadsheet`);
  await p.waitForSelector('[data-testid="workbook-host"] canvas', { timeout: 20000 });
  await p.waitForTimeout(2800); // engine paint + the mount-time canvas theme apply
  return { ctx, p };
}

/* in-page helpers, injected as strings: resolve a css expression to [r,g,b], and
   sample painted pixels from the sheet's canvas stack (topmost non-transparent) */
const HELPERS = `
  const resolveRgb = (expr) => {
    // color-mix resolves as color(srgb ...) — normalize through a 1x1 paint,
    // exactly like the block's own toRgb
    const s = document.createElement("span");
    s.style.display = "none"; s.style.color = expr;
    document.body.appendChild(s);
    const out = getComputedStyle(s).color; s.remove();
    const cc = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    cc.fillStyle = out; cc.fillRect(0, 0, 1, 1);
    return [...cc.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const canvases = [...document.querySelectorAll('[data-testid="workbook-host"] canvas')]
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 300 && r.height > 300)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  const at = (x, y) => {
    for (const { e } of canvases) {
      const c = e.getContext("2d", { willReadFrequently: true });
      const dpr = e.width / e.getBoundingClientRect().width;
      const d = [...c.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data];
      if (d[3] > 0) return d.slice(0, 3);
    }
    return null;
  };
  const scanDarkest = (x0, y0, dx, dy, n) => {
    let best = null, score = 1e9;
    for (let i = 0; i < n; i++) {
      const p = at(x0 + dx * i, y0 + dy * i);
      if (!p) continue;
      const lum = p[0] + p[1] + p[2];
      if (lum < score) { score = lum; best = p; }
    }
    return best;
  };
  const scanSaturated = (x0, y0, dx, dy, n) => {
    let best = null, sat = -1;
    for (let i = 0; i < n; i++) {
      const p = at(x0 + dx * i, y0 + dy * i);
      if (!p) continue;
      const s = Math.max(...p) - Math.min(...p);
      if (s > sat) { sat = s; best = p; }
    }
    return best;
  };
`;
const near = (a, b, tol = 4) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
/* resolve a css color to the exact computed rgb() string (for computed-style compares) */
const RESOLVE_BG = `(expr) => {
  const s = document.createElement("span");
  s.style.display = "none"; s.style.color = expr;
  document.body.appendChild(s);
  const out = getComputedStyle(s).color; s.remove();
  return out;
}`;

export default [
  {
    name: "grid-canvas-light-tokens", feature: "Sheet grid canvas (token-painted)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE, "light");
        const px = await p.evaluate(`(() => { ${HELPERS}
          return {
            headerBg: at(700, 12),                       // unselected column-header band
            rowHeaderBg: at(12, 300),                    // unselected row-header band
            headerBorder: scanDarkest(700, 20, 0, 0.5, 12),
            gridline: scanDarkest(300, 355, 0, 0.5, 16), // a horizontal gridline
            freezeDivider: scanDarkest(172, 300, 0.5, 0, 16), // the frozen col A boundary
            band: resolveRgb("var(--nx-bg-sunken)"),
            hairline: resolveRgb("var(--nx-border)"),
            whisper: resolveRgb("color-mix(in srgb, var(--nx-border) 32%, var(--nx-bg-raised))"),
            freezeRule: resolveRgb("color-mix(in srgb, var(--nx-accent) 25%, var(--nx-border))"),
          }; })()`);
        assert(near(px.headerBg, px.band), `the column-header band is our achromatic sunken surface (got ${px.headerBg})`);
        assert(near(px.rowHeaderBg, px.band), `the row-header band is our achromatic sunken surface (got ${px.rowHeaderBg})`);
        assert(near(px.headerBorder, px.hairline), `header hairlines are our border tone (got ${px.headerBorder})`);
        assert(near(px.gridline, px.whisper), `gridlines paint the whisper mix, clearly softer than stock (got ${px.gridline})`);
        assert(near(px.freezeDivider, px.freezeRule), `the frozen-pane divider stays a saturated ACCENT rule (got ${px.freezeDivider})`);
        const toolbarBg = await p.evaluate(() => {
          const row = document.querySelector('[data-u-comp="ribbon-toolbar"]')?.parentElement;
          return row ? getComputedStyle(row).backgroundColor : null;
        });
        const sunkenCss = await p.evaluate(`(${RESOLVE_BG})("var(--nx-bg-sunken)")`);
        assert(toolbarBg === sunkenCss, `the toolbar row wears the app's chrome tone (got ${toolbarBg}, want ${sunkenCss})`);
        await shot(p, ROOT, "grid-canvas-light");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-canvas-dark-coherent", feature: "Sheet grid canvas (token-painted)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE, "dark");
        const px = await p.evaluate(`(() => { ${HELPERS}
          return { headerBg: at(700, 12), gridline: scanDarkest(300, 355, 0, 0.5, 16), freeze: scanSaturated(168, 300, 0.5, 0, 28) }; })()`);
        const lum = (c) => (c[0] + c[1] + c[2]) / 3;
        assert(px.headerBg && lum(px.headerBg) < 40, `dark headers paint dark (got ${px.headerBg})`);
        assert(px.gridline && lum(px.gridline) < 60, `dark gridlines stay subtle (got ${px.gridline})`);
        const spread = px.freeze ? Math.max(...px.freeze) - Math.min(...px.freeze) : 0;
        assert(spread >= 5, `the dark freeze rule keeps its accent lean, never a neutral bar (spread ${spread}, got ${px.freeze})`);
        await shot(p, ROOT, "grid-canvas-dark");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-canvas-live-skin", feature: "Sheet grid canvas (token-painted)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE, "light");
        const grid = await p.evaluate(() => {
          const els = [...document.querySelectorAll('[data-testid="workbook-host"] canvas')];
          return els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })
            .sort((a, b) => b.w * b.h - a.w * a.h)[0];
        });
        // select a cell → the ring paints the CURRENT accent
        await p.mouse.click(grid.x + 326, grid.y + 252);
        await p.waitForTimeout(400);
        const ringScan = `(() => { ${HELPERS} return scanSaturated(326, 230, 0, 0.5, 80); })()`;
        const before = await p.evaluate(ringScan);
        assert(before && before[2] > before[1], `pre-skin selection ring is the indigo accent family (got ${before})`);
        // live skin upsert (the app's applySkin shape) → canvas re-derives, no reload
        await p.evaluate(() => {
          let s = document.getElementById("nx-skin");
          if (!s) { s = document.createElement("style"); s.id = "nx-skin"; document.head.appendChild(s); }
          s.textContent += "\\n:root, :root[data-theme='light'] { --nx-accent: #0d9488; }";
        });
        await p.waitForTimeout(1000);
        await p.mouse.click(grid.x + 326, grid.y + 252);
        await p.waitForTimeout(400);
        const after = await p.evaluate(ringScan);
        assert(after && after[1] > after[2] && after[1] > after[0], `post-skin ring re-derived to teal on the CANVAS, live (got ${after})`);
        await shot(p, ROOT, "grid-canvas-skin");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "grid-canvas-selected-text-legible", feature: "Sheet grid canvas (token-painted)",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        for (const theme of ["light", "dark"]) {
          const { ctx, p } = await openSheet(page, BASE, theme);
          const grid = await p.evaluate(() => {
            const els = [...document.querySelectorAll('[data-testid="workbook-host"] canvas')];
            return els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })
              .sort((a, b) => b.w * b.h - a.w * a.h)[0];
          });
          // drag-select B3:C4 so the wash covers C3's "$12,000" (the anchor cell is unwashed)
          const bx = grid.x + 46 + 130 + 50, by = grid.y + 24 + 24 * 2 + 12;
          await p.mouse.move(bx, by);
          await p.mouse.down();
          await p.mouse.move(bx + 100, by + 24, { steps: 4 });
          await p.mouse.up();
          await p.waitForTimeout(400);
          // real composited pixels: screenshot the washed C3 region, extremes = ink + fill
          const buf = await p.screenshot({ clip: { x: grid.x + 276, y: grid.y + 24 + 48, width: 100, height: 24 } });
          const m = await p.evaluate(`((b64) => new Promise((res) => {
            const img = new Image();
            img.onload = () => {
              const cc = document.createElement("canvas");
              cc.width = img.width; cc.height = img.height;
              const c = cc.getContext("2d", { willReadFrequently: true });
              c.drawImage(img, 0, 0);
              const d = c.getImageData(0, 0, cc.width, cc.height).data;
              let ink = null, wash = null, lo = 1e9, hi = -1;
              for (let i = 0; i < d.length; i += 4) {
                const l = d[i] + d[i + 1] + d[i + 2];
                if (l < lo) { lo = l; ink = [d[i], d[i + 1], d[i + 2]]; }
                if (l > hi) { hi = l; wash = [d[i], d[i + 1], d[i + 2]]; }
              }
              const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
              const lum = (cx) => 0.2126 * f(cx[0]) + 0.7152 * f(cx[1]) + 0.0722 * f(cx[2]);
              const l1 = Math.max(lum(ink), lum(wash)), l2 = Math.min(lum(ink), lum(wash));
              res({ ink, wash, ratio: (l1 + 0.05) / (l2 + 0.05) });
            };
            img.src = "data:image/png;base64," + b64;
          }))(${JSON.stringify(buf.toString("base64"))})`);
          assert(m.ratio >= 4.5, `${theme}: selected-cell text meets WCAG AA over the selection wash (got ${m.ratio.toFixed(2)}:1, ink ${m.ink}, fill ${m.wash})`);
          await shot(p, ROOT, `grid-canvas-selected-${theme}`);
          await ctx.close();
        }
      } finally { proc.kill(); }
    },
  },
];
