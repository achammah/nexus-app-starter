#!/usr/bin/env node
/* Journey runner — Bash-visible verification (`npm run journeys`).
   Drives the manifest's journeys as the USER against a live surface, asserting
   VISIBLE outcomes (a value changed, a card moved, busy cleared) — never bare 200s.
   Artifacts (the hook/gate contract):
     · journeys/.last-pass          — stamped ONLY when every journey passes
     · docs/COVERAGE.md             — one verdict row per journey per run
     · docs/feature-manifest.md     — `Last verified` column updated per feature
     · .playwright-mcp/journey-*.png — one screenshot per journey
   Exit 0 all green · 1 any FAIL · 3 BLOCKED (no browser/surface — never a silent pass).
   Env: JOURNEY_URL (default http://localhost:4000) · JOURNEY_SURFACE label (local|hosted). */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const URLBASE = process.env.JOURNEY_URL || "http://localhost:4000";
const SURFACE = process.env.JOURNEY_SURFACE || "local";
const SHOTS = path.join(ROOT, ".playwright-mcp");
mkdirSync(SHOTS, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("BLOCKED: playwright not installed (npm i)"); process.exit(3);
}

/* ---- boot a server if the target isn't up (local runs) ---- */
let serverProc = null;
async function up(u) {
  try { const r = await fetch(u + "/api/healthz", { signal: AbortSignal.timeout(2500) }); return r.ok; } catch { return false; }
}
if (!(await up(URLBASE))) {
  if (SURFACE !== "local") { console.error(`BLOCKED: ${URLBASE} unreachable`); process.exit(3); }
  serverProc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", detached: false });
  for (let i = 0; i < 20 && !(await up(URLBASE)); i++) await new Promise((r) => setTimeout(r, 400));
  if (!(await up(URLBASE))) { console.error("BLOCKED: server failed to boot"); process.exit(3); }
}

/* ---- journey definitions: name → feature (manifest row anchor) + steps ---- */
const journeys = [
  {
    name: "shell-loads", feature: "App shell + nav",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="nav"]', { timeout: 8000 });
      const title = await page.textContent(".pageTitle");
      assert(title?.includes("Companies"), `page title shows Companies (got "${title}")`);
      await page.click('[data-testid="nav-deals"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
      assert(true, "nav click switches the page title to Deals");
    },
  },
  {
    name: "table-renders-sorts", feature: "Companies table",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      const n = await page.locator('[data-testid="table-companies"] tbody tr').count();
      assert(n >= 8, `seeded rows render (${n} ≥ 8)`);
      const first = await page.textContent("tbody tr:first-child .nxRowLink");
      await page.click('th:has-text("Name")'); // asc (may equal the seed order's first row)
      await page.click('th:has-text("Name")'); // desc — MUST change the top row
      await page.waitForTimeout(200);
      const after = await page.textContent("tbody tr:first-child .nxRowLink");
      assert(first !== after || n === 1, `header sort (desc) reorders rows ("${first}" → "${after}")`);
    },
  },
  {
    name: "record-edit-persists", feature: "Record page + inline edit",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector(".nxRowLink");
      await page.click('.nxRowLink:has-text("Brightline Analytics")');
      await page.waitForSelector('[data-testid="record-name"]');
      const stamp = "Ghent-" + Date.now().toString().slice(-5);
      const city = page.locator('[data-testid="field-city"]');
      await city.fill(stamp);
      await city.blur();
      await page.waitForSelector('[data-testid="toast"]', { timeout: 6000 });
      await page.reload();
      await page.waitForSelector('[data-testid="field-city"]');
      const v = await page.inputValue('[data-testid="field-city"]');
      assert(v === stamp, `edited City survives reload (${v})`);
      const tl = await page.textContent('[data-testid="timeline"]');
      assert(tl?.includes("city:"), "timeline shows the update event");
    },
  },
  {
    name: "notes-add", feature: "Notes",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector(".nxRowLink");
      await page.click(".nxRowLink >> nth=0");
      await page.waitForSelector('[data-testid="record-name"]');
      await page.click('.nxTab:has-text("Notes")');
      const text = "Journey note " + Date.now().toString().slice(-5);
      await page.fill('[data-testid="note-input"]', text);
      await page.click('[data-testid="note-add"]');
      await page.waitForFunction((t) => document.querySelector('[data-testid="notes-list"]')?.textContent?.includes(t), text, { timeout: 6000 });
      assert(true, "added note appears in the list");
    },
  },
  {
    name: "stage-moves", feature: "Deals board (kanban)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="kanban-deals"]');
      const cols = await page.locator('[data-testid^="col-"]').count();
      assert(cols === 5, `5 stage columns render (${cols})`);
      // stage change via the record page select (deterministic; drag is pointer-fragile in CI)
      await page.click('[data-testid="card-de_2"]');
      await page.waitForSelector('[data-testid="field-stage"]');
      await page.selectOption('[data-testid="field-stage"]', "Qualified");
      await page.waitForSelector('[data-testid="toast"]');
      await page.goBack();
      await page.waitForSelector('[data-testid="kanban-deals"]');
      const inCol = await page.locator('[data-testid="col-Qualified"] [data-testid="card-de_2"]').count();
      assert(inCol === 1, "card visibly moved to the Qualified column");
    },
  },
  {
    name: "kanban-true-drag", feature: "Deals board (kanban)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="kanban-deals"]');
      const card = page.locator('[data-testid="card-de_4"]');
      const target = page.locator('[data-testid="col-Proposal"]');
      const cb = await card.boundingBox();
      const tb = await target.boundingBox();
      if (!cb || !tb) throw new Error("boxes not measurable");
      await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 14; i++) {
        await page.mouse.move(
          cb.x + cb.width / 2 + ((tb.x + tb.width / 2 - cb.x - cb.width / 2) * i) / 14,
          cb.y + cb.height / 2 + ((tb.y + 60 - cb.y - cb.height / 2) * i) / 14,
        );
      }
      await page.mouse.up();
      await page.waitForSelector('[data-testid="col-Proposal"] [data-testid="card-de_4"]', { timeout: 6000 });
      assert(true, "pointer drag visibly moves the card to Proposal");
      await page.reload();
      await page.waitForSelector('[data-testid="kanban-deals"]');
      const still = await page.locator('[data-testid="col-Proposal"] [data-testid="card-de_4"]').count();
      assert(still === 1, "drag result PERSISTED across reload");
    },
  },
  {
    name: "create-record", feature: "Create record",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-testid="row-count"]')?.textContent ?? ""));
      const before = Number(await page.textContent('[data-testid="row-count"]'));
      await page.click('[data-testid="new-record"]');
      await page.fill('[data-testid="new-name"]', "Journey Test Co");
      await page.click('[data-testid="create-confirm"]');
      await page.waitForSelector('[data-testid="record-name"]');
      const name = await page.textContent('[data-testid="record-name"]');
      assert(name === "Journey Test Co", "record page opens on the new record");
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForFunction((b) => Number(document.querySelector('[data-testid="row-count"]')?.textContent) === b + 1, before);
      assert(true, `count incremented (${before} → ${before + 1})`);
    },
  },
  {
    name: "cmdk-navigates", feature: "Command palette (⌘K)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="nav"]');
      await page.keyboard.press("Control+k");
      await page.waitForSelector('[data-testid="palette-input"]', { timeout: 5000 });
      await page.fill('[data-testid="palette-input"]', "cargolane dispatch");
      await page.waitForSelector('[data-testid="palette-hit-de_3"]', { timeout: 6000 });
      await page.click('[data-testid="palette-hit-de_3"]');
      await page.waitForSelector('[data-testid="record-name"]');
      const name = await page.textContent('[data-testid="record-name"]');
      assert(name?.includes("Cargolane"), `palette jump lands on the record (${name})`);
    },
  },
  {
    name: "views-persist", feature: "Saved view (filter+view persist)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector('[data-testid="list-search"]');
      await page.fill('[data-testid="list-search"]', "maya");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-people"] tbody tr').length === 1);
      await page.click('[data-testid="nav-deals"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
      await page.click('[data-testid="nav-people"]');
      // wait for the DESTINATION's committed value — the outgoing page's input matches
      // the same testid for one frame (measured: "" immediately, restored ~300ms later)
      await page.waitForFunction(
        () => document.querySelector('[data-testid="list-search"]')?.value === "maya",
        null,
        { timeout: 6000 },
      );
      assert(true, "filter survives navigation (restored to 'maya')");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-people"] tbody tr').length === 1);
      assert(true, "restored filter is APPLIED (1 row)");
      await page.fill('[data-testid="list-search"]', "");
    },
  },
  {
    name: "relation-link", feature: "Relation link cells",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Table")');
      await page.waitForSelector('[data-testid="rel-de_1-company"]');
      await page.click('[data-testid="rel-de_1-company"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Companies"));
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1, null, { timeout: 6000 });
      const nm = await page.textContent("tbody tr:first-child .nxRowLink");
      assert(nm?.includes("Brightline"), `relation click lands filtered on the target (${nm})`);
      await page.fill('[data-testid="list-search"]', "");
      await page.waitForTimeout(150);
    },
  },
  {
    name: "bulk-delete-csv", feature: "Bulk select · CSV export · reviewed delete",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="list-search"]');
      await page.fill('[data-testid="list-search"]', "Journey Test");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1);
      await page.click('tbody tr:first-child [role="checkbox"]');
      await page.waitForSelector('[data-testid="bulk-bar"]');
      const dl = page.waitForEvent("download", { timeout: 8000 });
      await page.click('[data-testid="bulk-export"]');
      const file = await dl;
      assert(file.suggestedFilename().endsWith(".csv"), `CSV downloads (${file.suggestedFilename()})`);
      await page.click('[data-testid="bulk-delete"]');
      await page.waitForSelector('[data-testid="bulk-confirm"]');
      const body = await page.textContent('[data-testid="bulk-confirm"]');
      assert(body?.includes("Journey Test Co"), "review surface names the exact records");
      await page.click('[data-testid="bulk-confirm-go"]');
      await page.waitForSelector('[data-testid="toast"]');
      await page.fill('[data-testid="list-search"]', "");
      await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-testid="row-count"]')?.textContent ?? "") && Number(document.querySelector('[data-testid="row-count"]')?.textContent) === 8, null, { timeout: 6000 });
      assert(true, "count returns to 8 after reviewed delete");
    },
  },
  {
    name: "kit-demo-page", feature: "Custom pages + kit demo",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="nav-p-kit"]');
      await page.click('[data-testid="nav-p-kit"]');
      await page.waitForSelector('[data-testid="kit-form"]');
      await page.click('[data-testid="kit-submit"]');
      await page.waitForFunction(() =>
        (document.querySelector('[data-testid="kit-name-error"]')?.textContent ?? "").length > 3);
      assert(true, "zod validation error renders on empty submit");
      const svg = await page.locator('[data-testid="kit-chart"] svg').count();
      assert(svg >= 1, "chart renders an svg on the token palette");
      await page.click('[data-testid="kit-sheet-open"]');
      await page.waitForSelector('[data-testid="kit-sheet"]');
      assert(true, "sheet opens as a side panel");
      await page.keyboard.press("Escape");
      await page.click('[data-testid="kit-acc-trigger"]');
      await page.waitForSelector('[data-testid="kit-acc-content"]');
      assert(true, "accordion expands");
    },
  },
  {
    name: "chat-dock-config", feature: "Embedded agent chat dock",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="nav"]');
      const fab = await page.locator('[data-testid="chat-fab"]').count();
      assert(fab === 0, "dock renders NOTHING while chat.embedUrl is unconfigured (deterministic)");
    },
  },
  {
    name: "search-filters", feature: "Global search",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="list-search"]');
      await page.fill('[data-testid="list-search"]', "bright");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1, null, { timeout: 6000 });
      const nm = await page.textContent("tbody tr:first-child .nxRowLink");
      assert(nm?.includes("Brightline"), `filter narrows to the matching row (${nm})`);
    },
  },
  {
    name: "theme-toggle", feature: "Theme toggle",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="theme-toggle"]');
      const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(150);
      const bg1 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert(bg0 !== bg1, `background flips (${bg0} → ${bg1})`);
      await page.reload();
      await page.waitForSelector('[data-testid="nav"]');
      const bg2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert(bg1 === bg2, "choice survives reload");
    },
  },
  {
    name: "state-kv", feature: "Data spine (app_state kv)",
    async run(page) {
      const key = "journey:" + Date.now();
      const w = await page.request.post(URLBASE + "/api/state", { data: { key, value: 42 } });
      assert(w.ok(), "state append accepted");
      const r = await (await page.request.get(URLBASE + "/api/state")).json();
      assert(r[key] === 42, "latest-per-key read returns the appended value");
    },
  },
  {
    name: "big-list-virtualized", feature: "Virtualized big lists",
    async run(page) {
      for (let i = 0; i < 120; i++) {
        const r = await page.request.post(URLBASE + "/api/objects/people", {
          data: { name: `Bulk Person ${i}`, email: `bulk${i}@example.test`, role: "Tester", company: "Cargolane" },
        });
        if (!r.ok()) throw new Error(`seed create failed at ${i}`);
      }
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="row-count"]')?.textContent) >= 128);
      const dom = await page.locator('[data-testid="table-people"] tbody tr:not([aria-hidden])').count();
      assert(dom < 110, `DOM renders a WINDOW, not all rows (${dom} < 110 of 128+)`);
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="table-people"]');
        if (el) el.scrollTop = el.scrollHeight;
      });
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="table-people"]')?.textContent?.includes("Bulk Person 119"));
      assert(true, "scrolling reaches the LAST row (window follows scroll)");
    },
  },
  {
    name: "auth-flow", feature: "Auth seam (login gate)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const authProc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env,
          PORT: "4600",
          AUTH_USERS: "maya@example.test:journey-pass-1",
          APP_SECRET: "journey-secret-0123456789",
        },
      });
      try {
        for (let i = 0; i < 20; i++) {
          try {
            const r = await fetch("http://localhost:4600/api/healthz", { signal: AbortSignal.timeout(1500) });
            if (r.ok) break;
          } catch { /* booting */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const bare = await page.request.get("http://localhost:4600/api/objects/companies");
        assert(bare.status() === 401, `API is GATED without a session (${bare.status()})`);
        const authed = await page.context().browser().newContext();
        const p2 = await authed.newPage();
        await p2.goto("http://localhost:4600/");
        await p2.waitForSelector('[data-testid="login-card"]', { timeout: 8000 });
        await p2.fill('[data-testid="login-email"]', "maya@example.test");
        await p2.fill('[data-testid="login-password"]', "wrong-pass");
        await p2.click('[data-testid="login-submit"]');
        await p2.waitForSelector('[data-testid="login-error"]');
        assert(true, "wrong password shows a visible error");
        await p2.fill('[data-testid="login-password"]', "journey-pass-1");
        await p2.click('[data-testid="login-submit"]');
        await p2.waitForSelector('[data-testid="nav"]', { timeout: 8000 });
        assert(true, "correct password enters the app shell");
        const gated = await p2.request.get("http://localhost:4600/api/objects/companies");
        assert(gated.ok(), "session cookie unlocks the API");
        await authed.close();
      } finally {
        authProc.kill();
      }
    },
  },
  {
    name: "mobile-390", feature: "App shell + nav",
    async run(page) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="nav"]');
      const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert(!hscroll, "no horizontal page scroll at 390px");
      await page.setViewportSize({ width: 1280, height: 800 });
    },
  },
];

/* ---- harness self-check: a bogus selector MUST fail (wrong-slug protection) ---- */
const selfCheck = {
  name: "harness-selfcheck", feature: null,
  async run(page) {
    await page.goto(URLBASE + "/#/o/companies");
    let threw = false;
    try { await page.waitForSelector('[data-testid="does-not-exist-xyz"]', { timeout: 1200 }); } catch { threw = true; }
    assert(threw, "a bogus selector fails (the harness can fail)");
  },
};

let curChecks = [];
function assert(cond, label) {
  curChecks.push({ ok: !!cond, label });
  if (!cond) throw new Error("assert failed: " + label);
}

const results = [];
const browser = await chromium.launch();
const consoleErrs = [];
for (const j of [selfCheck, ...journeys]) {
  const page = await browser.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrs.push(`${j.name}: ${m.text()}`));
  curChecks = [];
  const t0 = Date.now();
  let verdict = "PASS", detail = "";
  try {
    await j.run(page);
    detail = curChecks.map((c) => c.label).join("; ");
  } catch (e) {
    verdict = "FAIL";
    detail = String(e.message ?? e);
  }
  try { await page.screenshot({ path: path.join(SHOTS, `journey-${j.name}.png`), fullPage: true }); } catch {}
  await page.close();
  results.push({ ...j, verdict, detail, ms: Date.now() - t0 });
  console.log(`  ${verdict === "PASS" ? "ok  " : "FAIL"} ${j.name} (${Date.now() - t0}ms)${verdict === "FAIL" ? " — " + detail : ""}`);
}
await browser.close();
if (serverProc) serverProc.kill();

const failed = results.filter((r) => r.verdict === "FAIL");
const now = new Date().toISOString();

/* ---- COVERAGE.md rows ---- */
const covPath = path.join(ROOT, "docs", "COVERAGE.md");
const rows = results
  .filter((r) => r.feature !== null)
  .map((r) => `| ${r.name} | ${SURFACE} | ${r.verdict} | ${r.detail.replaceAll("|", "/").slice(0, 160)} | .playwright-mcp/journey-${r.name}.png | ${now} |`)
  .join("\n");
appendFileSync(covPath, rows + "\n");

/* ---- manifest Last verified ---- */
const manPath = path.join(ROOT, "docs", "feature-manifest.md");
if (existsSync(manPath)) {
  let man = readFileSync(manPath, "utf8");
  for (const r of results) {
    if (!r.feature || r.verdict !== "PASS") continue;
    man = man
      .split("\n")
      .map((ln) => {
        if (!ln.startsWith(`| ${r.feature} |`)) return ln;
        const cells = ln.split("|");
        if (cells.length < 7) return ln;
        cells[cells.length - 2] = ` ${SURFACE} ${now.slice(0, 16)} `;
        return cells.join("|");
      })
      .join("\n");
  }
  writeFileSync(manPath, man);
}

/* ---- .last-pass stamp (all green only) ---- */
if (failed.length === 0) {
  writeFileSync(path.join(ROOT, "journeys", ".last-pass"), `${now} ${SURFACE} ${results.length - 1} journeys green\n`);
}

if (consoleErrs.length) console.log(`  console errors: ${consoleErrs.length}\n    ` + consoleErrs.slice(0, 5).join("\n    "));
console.log(`\n${results.length - failed.length}/${results.length} journeys green (${SURFACE})`);
process.exit(failed.length ? 1 : 0);
