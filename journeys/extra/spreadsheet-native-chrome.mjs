/* spreadsheet native-chrome journeys — the Univer workbook must read as a native
   page, not an embedded widget. Boots the DEFAULT config on the lane band (5921 —
   NOT the suite's own PORT, which serves the shared dist) and asserts the VISIBLE
   integration contract:
     1 frame   — no card chrome: zero border, the workbook bleeds to the content
                 box, the ribbon tab strip is gone (single toolbar row), and the
                 host actions (save/reset/clear) sit INSIDE the toolbar band
                 without overlapping Univer's own commands;
     2 tokens  — the vendor chrome resolves OUR tokens, not stock Univer gray:
                 --univer-* values equal the live --nx-* resolutions in light AND
                 after a live dark flip; a skin landing re-derives both the CSS
                 chrome and Univer's injected theme (which stays light-anchored —
                 the canvas derives dark by inversion);
     3 actions — the toolbar-row cluster stays functional: reset reseeds the
                 stored workbook, the save pill reports the persisted state;
     4 mobile  — 390x664: the single toolbar row + cluster fit, nothing forces a
                 horizontal page scroll, the grid still paints. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 5921;
const BASE = `http://localhost:${PORT}`;
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

async function openSheet(page, base, viewport = { width: 1360, height: 900 }) {
  const ctx = await page.context().browser().newContext({ viewport });
  const p = await ctx.newPage();
  await p.goto(`${base}/#/p/spreadsheet`);
  await p.waitForSelector('[data-testid="workbook-host"] canvas', { timeout: 20000 });
  await p.waitForTimeout(2500); // Univer first paint + the seed's initial persist
  return { ctx, p };
}

/* resolve a css color expression to a canonical rgb string inside the page */
const RESOLVE = `(expr) => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = expr;
  document.body.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
}`;

export default [
  {
    name: "spreadsheet-native-frame", feature: "Spreadsheet native chrome",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        const g = await p.evaluate(() => {
          const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
          const wb = document.querySelector(".nxWorkbook");
          const content = document.querySelector(".content");
          const headerMenu = document.querySelector('[data-u-comp="ribbon-header-menu"]');
          const toolbar = document.querySelector('[data-u-comp="ribbon-toolbar"]');
          const actions = document.querySelector(".nxWorkbookActions");
          return {
            wbBorder: getComputedStyle(wb).borderTopWidth,
            wb: box(wb), content: box(content),
            headerMenuH: headerMenu ? headerMenu.getBoundingClientRect().height : -1,
            toolbar: toolbar ? box(toolbar) : null,
            actions: actions ? box(actions) : null,
            bar: document.querySelector(".nxWorkbookBar") ? true : false,
          };
        });
        assert(g.wbBorder === "0px", "the workbook has NO card border (the sheet is the page)");
        assert(!g.bar, "the extra page header strip is gone");
        assert(Math.abs(g.wb.x - g.content.x) <= 1 && Math.abs(g.wb.w - g.content.w) <= 1, "the workbook bleeds to the content box (full width)");
        assert(g.headerMenuH === 0, "the ribbon tab strip is collapsed (single toolbar row)");
        assert(g.toolbar && g.actions, "toolbar + host actions both render");
        const toolbarBand = g.actions.y < g.toolbar.y + g.toolbar.h && g.actions.y + g.actions.h > g.toolbar.y;
        assert(toolbarBand, "the host actions sit inside the vendor toolbar band");
        assert(g.actions.x >= g.toolbar.x + g.toolbar.w, "the reserved inset keeps Univer's commands clear of the action cluster");
        await shot(p, ROOT, "spreadsheet-native-frame");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-native-tokens", feature: "Spreadsheet native chrome",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE);
        const probe = (expr) => p.evaluate(`(${RESOLVE})(${JSON.stringify(expr)})`);
        const univerVar = (name) => p.evaluate(`(${RESOLVE})("var(${name})")`);

        // light: the vendor neutrals ARE our tokens
        assert(await univerVar("--univer-gray-50") === await probe("var(--nx-bg)"), "light: --univer-gray-50 resolves to --nx-bg");
        assert(await univerVar("--univer-gray-200") === await probe("var(--nx-border)"), "light: --univer-gray-200 resolves to --nx-border");
        assert(await univerVar("--univer-primary-500") === await probe("var(--nx-accent)"), "light: --univer-primary-500 resolves to --nx-accent");

        // live dark flip: role-mirrored values + the .univer-dark role swap land
        await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await p.waitForSelector('[data-testid="workbook-host"] .univer-dark', { timeout: 5000 });
        assert(await univerVar("--univer-gray-900") === await probe("var(--nx-bg)"), "dark: --univer-gray-900 resolves to the dark --nx-bg");
        assert(await univerVar("--univer-gray-50") === await probe("var(--nx-fg)"), "dark: --univer-gray-50 resolves to the dark --nx-fg (brightest text)");
        const lightAnchored = await p.evaluate(() =>
          /* the injected canvas theme stays LIGHT-anchored even in dark — Univer
             derives its dark canvas by inverting it */
          (document.getElementById("univer-theme-css-variables")?.textContent ?? "").includes("--univer-gray-900: rgb(28, 27, 25)"));
        assert(lightAnchored, "the injected canvas theme stays light-anchored in dark");
        await shot(p, ROOT, "spreadsheet-native-dark");

        // a skin landing re-derives chrome AND the injected theme, live
        await p.evaluate(() => { document.documentElement.dataset.theme = "light"; });
        await p.waitForFunction(() => !document.querySelector('[data-testid="workbook-host"] .univer-dark'), null, { timeout: 5000 });
        await p.evaluate(() => {
          // upsert like the app's applySkin does — the config may already ship a skin
          let s = document.getElementById("nx-skin");
          if (!s) { s = document.createElement("style"); s.id = "nx-skin"; document.head.appendChild(s); }
          s.textContent += "\n:root, :root[data-theme='light'] { --nx-accent: #0d9488; }";
        });
        // both layers settle async (observer → effect → setTheme → re-inject): poll
        await p.waitForFunction(() =>
          /13, 148, 136/.test(document.getElementById("univer-theme-css-variables")?.textContent ?? ""), null, { timeout: 8000 });
        assert(await univerVar("--univer-primary-500") === await probe("#0d9488"), "skin: the vendor accent re-derives from the new --nx-accent");
        assert(true, "skin: Univer's injected theme re-derives live (setTheme path)");
        await shot(p, ROOT, "spreadsheet-native-skin");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-native-actions", feature: "Spreadsheet native chrome",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        // corrupt the stored workbook so reset must genuinely reseed it
        await fetch(`${BASE}/api/state`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: KEY, value: { sheets: {} } }),
        });
        const { ctx, p } = await openSheet(page, BASE);
        await p.click('[data-testid="workbook-reset"]');
        let seeded = false;
        for (let i = 0; i < 40 && !seeded; i++) {
          const st = (await (await fetch(`${BASE}/api/state`)).json())[KEY];
          seeded = JSON.stringify(st?.sheets ?? {}).includes("37000");
          if (!seeded) await new Promise((r) => setTimeout(r, 250));
        }
        assert(seeded, "reset from the toolbar cluster reseeds the stored workbook");
        const pill = await p.evaluate(() => document.querySelector('[data-testid="workbook-save"]')?.textContent ?? "");
        assert(pill.includes("Saved"), "the save pill reports the persisted state from the toolbar row");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "spreadsheet-native-mobile", feature: "Spreadsheet native chrome",
    async run(page, { assert, ROOT }) {
      const proc = await boot(ROOT, PORT, BASE);
      try {
        const { ctx, p } = await openSheet(page, BASE, { width: 390, height: 664 });
        const m = await p.evaluate(() => {
          const toolbar = document.querySelector('[data-u-comp="ribbon-toolbar"]');
          const actions = document.querySelector(".nxWorkbookActions");
          return {
            noPageScrollX: document.documentElement.scrollWidth <= 391,
            toolbarVisible: !!toolbar && toolbar.getBoundingClientRect().height > 0,
            actionsInViewport: !!actions && actions.getBoundingClientRect().right <= 391,
            canvasPainted: [...document.querySelectorAll('[data-testid="workbook-host"] canvas')]
              .some((c) => c.getBoundingClientRect().width > 200),
          };
        });
        assert(m.noPageScrollX, "mobile: no horizontal page scroll");
        assert(m.toolbarVisible, "mobile: the single toolbar row renders");
        assert(m.actionsInViewport, "mobile: the compact action cluster fits the viewport");
        assert(m.canvasPainted, "mobile: the grid canvas paints");
        await shot(p, ROOT, "spreadsheet-native-mobile");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
