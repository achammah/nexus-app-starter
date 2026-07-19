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
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
      const toastTxt = await page.textContent('[data-testid="toast"]');
      await page.fill('[data-testid="list-search"]', "");
      let count = -1;
      for (let i = 0; i < 40; i++) {
        const t = await page.textContent('[data-testid="row-count"]').catch(() => "");
        if (/^\d+$/.test(t ?? "")) count = Number(t);
        if (count === 8) break;
        await page.waitForTimeout(250);
      }
      const truth = await (await page.request.get(URLBASE + "/api/objects/companies")).json();
      assert(count === 8,
        `count returns to 8 after reviewed delete (ui=${count}, server=${truth.rows.length}, toast="${toastTxt}")`);
    },
  },
  {
    name: "select-filters", feature: "Select-field filter chips",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="filter-industry"]');
      await page.click('[data-testid="filter-industry"]');
      await page.waitForSelector('[data-testid="filter-industry-software"]');
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter"); // Software (first option)
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 2);
      assert(true, "Industry=Software narrows to the 2 software companies");
      await page.click('[data-testid="filters-clear"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length >= 8);
      assert(true, "clear-all restores the full list");
    },
  },
  {
    name: "relations-deep", feature: "Relation picker + related lists",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector(".nxRowLink");
      await page.click('.nxRowLink:has-text("Brightline Analytics")');
      await page.waitForSelector('[data-testid="related-people"]');
      const ppl = await page.textContent('[data-testid="related-people"]');
      assert(ppl?.includes("Maya Verstraete"), "related People lists the linked person");
      await page.waitForSelector('[data-testid="related-deals"]');
      const dls = await page.textContent('[data-testid="related-deals"]');
      assert(dls?.includes("Brightline platform rollout"), "related Deals lists the linked deal");
      await page.click('[data-testid="related-deals-de_1"]');
      await page.waitForSelector('[data-testid="field-company"]');
      assert(true, "clicking a related row opens ITS record");
      await page.click('[data-testid="field-company"]');
      await page.waitForSelector('[data-testid="field-company-search"]');
      await page.fill('[data-testid="field-company-search"]', "cargo");
      await page.waitForSelector('[data-testid="field-company-opt-cargolane"]');
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForSelector('[data-testid="toast"]');
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="field-company-value"]')?.textContent?.includes("Cargolane"));
      assert(true, "picker sets the relation (Cargolane) and saves");
      await page.click('[data-testid="field-company-jump"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Companies"));
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1);
      assert(true, "jump lands on Companies filtered to the picked target");
      await page.fill('[data-testid="list-search"]', "");
      // restore the seed relation for later journeys
      await page.request.patch(URLBASE + "/api/objects/deals/de_1", { data: { company: "Brightline Analytics" } });
    },
  },
  {
    // The LITMUS TEST (not a shipped product): can the building blocks assemble the
    // hardest known topology — two-sided relations, a staged pipeline, dates,
    // scores — from config alone? The fixture exists to FAIL when a block is
    // missing; it is a test artifact, never a template.
    name: "blocks-coverage-litmus", feature: "Building-blocks litmus (record-system class by config)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4700", CONFIG_PATH: "journeys/fixtures/coverage.config.json" },
      });
      try {
        for (let i = 0; i < 20; i++) {
          try {
            const r = await fetch("http://localhost:4700/api/healthz", { signal: AbortSignal.timeout(1500) });
            if (r.ok) break;
          } catch { /* booting */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto("http://localhost:4700/");
        await p2.waitForSelector('[data-testid="app-name"]');
        const nm = await p2.textContent('[data-testid="app-name"]');
        assert(nm === "Coverage Fixture", `the app IS the config (${nm})`);
        await p2.click('[data-testid="nav-candidates"]');
        await p2.waitForSelector('[data-testid="table-candidates"] tbody tr');
        const n = await p2.locator('[data-testid="table-candidates"] tbody tr').count();
        assert(n === 4, `candidates table renders from config sampleRows (${n})`);
        await p2.click('[data-testid="nav-applications"]');
        await p2.waitForSelector('[data-testid="kanban-applications"]');
        const interview = await p2.locator('[data-testid="col-Interview"] [data-testid="card-ap_1"]').count();
        assert(interview === 1, "applications kanban has the pipeline stages with the seeded card in Interview");
        await p2.click('[data-testid="card-ap_1"]');
        await p2.waitForSelector('[data-testid="related-"]', { timeout: 1500 }).catch(() => {});
        await p2.waitForSelector('[data-testid="field-candidate-value"]');
        const cand = await p2.textContent('[data-testid="field-candidate-value"]');
        assert(cand?.includes("Nadia"), "application record links its candidate via the relation picker");
        // new-block coverage on SIBLING types: group-by picker (stage+owner groupables),
        // enrich seam on a second object, files tab present on any record
        await p2.goto("http://localhost:4700/#/o/applications");
        await p2.waitForSelector('[data-testid="kanban-applications"]');
        assert((await p2.locator('[data-testid="group-by"]').count()) === 1, "fixture board offers group-by (stage + owner user field)");
        await p2.goto("http://localhost:4700/#/o/candidates");
        await p2.waitForSelector('[data-testid="table-candidates"] tbody tr');
        await p2.locator('[data-testid="table-candidates"] tbody tr .nxRowLink').first().click();
        await p2.waitForSelector('[data-testid="enrich-summary"]');
        assert(true, "fixture candidate record shows the enrich affordance from field.primitive");
        assert((await p2.locator('[role="tab"]:has-text("Files")').count()) === 1, "fixture record has the Files tab");
        await p2.screenshot({ path: path.join(SHOTS, "journey-blocks-coverage.png"), fullPage: true });
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "table-prefs-persist", feature: "Column visibility + sort persist",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('th:has-text("Domain")');
      // keyboard path — Radix portals can position off-viewport in headless; roving
      // focus + Enter is geometry-free (Domain = first non-primary item)
      await page.click('[data-testid="columns-menu"]');
      await page.waitForSelector('[data-testid="col-toggle-domain"]');
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => ![...document.querySelectorAll("th")].some((t) => t.textContent?.includes("Domain")));
      assert(true, "unchecking Domain removes the column");
      await page.click('th:has-text("Name")'); // asc
      await page.click('th:has-text("Name")'); // desc
      await page.waitForTimeout(150);
      const top = await page.textContent("tbody tr:first-child .nxRowLink");
      await page.click('[data-testid="nav-deals"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
      await page.click('[data-testid="nav-companies"]');
      await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Companies"));
      await page.waitForFunction(() => ![...document.querySelectorAll("th")].some((t) => t.textContent?.includes("Domain")));
      assert(true, "hidden column SURVIVES navigation");
      await page.waitForFunction((t) => document.querySelector("tbody tr:first-child .nxRowLink")?.textContent === t, top);
      assert(true, `sort survives navigation (top stays "${top}")`);
      await page.click('[data-testid="columns-menu"]');
      await page.waitForSelector('[data-testid="col-toggle-domain"]');
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await page.waitForSelector('th:has-text("Domain")');
      assert(true, "re-enabling restores the column");
    },
  },
  {
    name: "date-picker", feature: "Date fields (calendar)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Table")');
      await page.waitForSelector('[data-testid="cell-de_1-closeDate"]');
      const cell = await page.textContent('[data-testid="cell-de_1-closeDate"]');
      assert(cell?.includes("Aug"), `table renders the formatted date (${cell})`);
      await page.click('.nxRowLink:has-text("Brightline platform rollout")');
      await page.waitForSelector('[data-testid="field-closeDate"]');
      await page.click('[data-testid="field-closeDate"]');
      const day = page.locator('[data-radix-popper-content-wrapper] button:not([disabled])', { hasText: /^20$/ }).first();
      await day.click();
      await page.waitForSelector('[data-testid="toast"]');
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="field-closeDate-value"]')?.textContent?.includes("20"));
      assert(true, "picked day lands in the field");
      await page.reload();
      await page.waitForSelector('[data-testid="field-closeDate-value"]');
      const v = await page.textContent('[data-testid="field-closeDate-value"]');
      assert(v?.includes("20") && v?.includes("Aug"), `date persisted across reload (${v})`);
      const tl = await page.textContent('[data-testid="timeline"]');
      assert(tl?.includes("closeDate:"), "timeline records the date change");
    },
  },
  {
    name: "accounts-signup-verify", feature: "Accounts (signup + email verification)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4660", AUTH_MODE: "accounts", APP_SECRET: "journey-secret-16-chars-plus" },
      });
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch("http://localhost:4660/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto("http://localhost:4660/");
        await p2.waitForSelector('[data-testid="login-card"]');
        await p2.click('[data-testid="to-signup"]');
        await p2.fill('[data-testid="signup-name"]', "Ada Fixture");
        await p2.fill('[data-testid="login-email"]', "ada@fixture.example");
        await p2.fill('[data-testid="login-password"]', "correct-horse-9");
        await p2.click('[data-testid="login-submit"]');
        await p2.waitForSelector('[data-testid="nav"]');
        assert(true, "signup creates the account and enters the app");
        // the verification mail lands in the dev outbox; its deep link completes the flow
        const mail = (await (await p2.request.get("http://localhost:4660/api/outbox")).json()).mail
          .find((m) => m.kind === "verify" && m.to === "ada@fixture.example");
        assert(!!mail, "verification mail is in the outbox");
        const token = mail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        // a mail link opens as a fresh tab (same cookies, fresh load)
        const p3 = await ctx.newPage();
        await p3.goto(`http://localhost:4660/#/verify?token=${token}`);
        await p3.waitForFunction(() =>
          [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("Email verified")),
        );
        const me = await (await p3.request.get("http://localhost:4660/api/auth/me")).json();
        assert(me.verified === true, "the account is verified after following the mail link");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "reset-antienum-delete", feature: "Password reset (anti-enumeration) + delete-by-confirmation",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4670", AUTH_MODE: "accounts", APP_SECRET: "journey-secret-16-chars-plus" },
      });
      const B = "http://localhost:4670";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        // seed a user (request context keeps the session cookie)
        await p2.request.post(B + "/api/auth/signup", { data: { email: "maya@fixture.example", name: "Maya", password: "first-pass-123" } });
        // anti-enumeration: known + unknown addresses answer IDENTICALLY
        const known = await p2.request.post(B + "/api/auth/forgot", { data: { email: "maya@fixture.example" } });
        const ghost = await p2.request.post(B + "/api/auth/forgot", { data: { email: "ghost@fixture.example" } });
        assert(known.status() === 200 && ghost.status() === 200
          && JSON.stringify(await known.json()) === JSON.stringify(await ghost.json()),
          "forgot-password answers identically for known and unknown addresses");
        const mail = (await (await p2.request.get(B + "/api/outbox")).json()).mail;
        assert(mail.some((m) => m.kind === "reset" && m.to === "maya@fixture.example"), "known address got a reset mail");
        assert(mail.some((m) => m.kind === "reset-decoy" && m.to === "ghost@fixture.example"), "unknown address got a DECOY mail (timing parity)");
        // complete the reset via the UI deep link — from a SIGNED-OUT browser
        // (real flow: the person who forgot the password has no session)
        const token = mail.find((m) => m.kind === "reset").text.match(/token=([A-Za-z0-9_-]+)/)[1];
        const ctxReset = await page.context().browser().newContext();
        const pr = await ctxReset.newPage();
        await pr.goto(`${B}/#/reset?token=${token}`);
        await pr.waitForSelector('[data-testid="login-password"]');
        await pr.fill('[data-testid="login-password"]', "second-pass-456");
        await pr.click('[data-testid="login-submit"]');
        await pr.waitForSelector('[data-testid="login-note"]');
        await ctxReset.close();
        // old password dead, old SESSION dead (pwv bump), new password works
        const oldTry = await p2.request.post(B + "/api/auth/login", { data: { email: "maya@fixture.example", password: "first-pass-123" } });
        assert(oldTry.status() === 401, "old password is dead after reset");
        const meAfter = await (await p2.request.get(B + "/api/auth/me")).json();
        assert(meAfter.user === null, "pre-reset session cookie is invalidated (password-version bump)");
        const newTry = await p2.request.post(B + "/api/auth/login", { data: { email: "maya@fixture.example", password: "second-pass-456" } });
        assert(newTry.status() === 200, "new password signs in");
        // deletion: request → mail token → confirm → account gone
        await p2.request.post(B + "/api/auth/delete-request", { data: {} });
        const delMail = (await (await p2.request.get(B + "/api/outbox")).json()).mail.find((m) => m.kind === "delete-confirm");
        assert(!!delMail, "deletion asks for mail confirmation, never deletes on click");
        const delToken = delMail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        await p2.request.post(B + "/api/auth/delete-confirm", { data: { token: delToken } });
        const ghostLogin = await p2.request.post(B + "/api/auth/login", { data: { email: "maya@fixture.example", password: "second-pass-456" } });
        assert(ghostLogin.status() === 401, "deleted account cannot sign in");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "team-scoped-records", feature: "Team-scoped objects (per-team visibility + roles)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env, PORT: "4667", AUTH_MODE: "accounts",
          APP_SECRET: "journey-secret-16-chars-plus", CONFIG_PATH: "journeys/fixtures/access.config.json",
        },
      });
      const B = "http://localhost:4667";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctxE = await page.context().browser().newContext();
        const pe = await ctxE.newPage();
        await pe.request.post(B + "/api/auth/signup", { data: { email: "erin@fixture.example", name: "Erin", password: "alpha-pass-123" } });
        await pe.request.post(B + "/api/teams", { data: { name: "Alpha" } });
        // no team context → the API refuses; with it → the row lands in Alpha
        const noCtx = await pe.request.post(B + "/api/objects/projects", { data: { name: "Skunkworks" } });
        assert(noCtx.status() === 400, "team-scoped writes REQUIRE a team context");
        const created = await pe.request.post(B + "/api/objects/projects", {
          data: { name: "Skunkworks", status: "Active" }, headers: { "x-nx-team": "alpha" },
        });
        const row = await created.json();
        assert(created.status() === 201 && row._team, "the row is stamped with the team");
        // frank (team Beta) sees NOTHING of Alpha's data — list empty, direct id 404
        const ctxF = await page.context().browser().newContext();
        const pf = await ctxF.newPage();
        await pf.request.post(B + "/api/auth/signup", { data: { email: "frank@fixture.example", name: "Frank", password: "beta-pass-1234" } });
        await pf.request.post(B + "/api/teams", { data: { name: "Beta" } });
        const bList = await (await pf.request.get(B + "/api/objects/projects", { headers: { "x-nx-team": "beta" } })).json();
        assert(bList.rows.length === 0, "another team's list is EMPTY");
        const peek = await pf.request.get(B + `/api/objects/projects/${row.id}`, { headers: { "x-nx-team": "beta" } });
        assert(peek.status() === 404, "another team's record 404s even by direct id");
        const foreign = await pf.request.get(B + "/api/objects/projects", { headers: { "x-nx-team": "alpha" } });
        assert(foreign.status() === 403, "using a team you don't belong to is refused");
        // erin's UI: the switcher shows Alpha and the row renders
        await pe.goto(B + "/");
        await pe.evaluate(() => localStorage.setItem("nx-team", "alpha"));
        await pe.goto(B + "/#/o/projects");
        await pe.waitForSelector('[data-testid="team-switch"]');
        await pe.waitForFunction(() => document.querySelector('[data-testid="table-projects"]')?.textContent?.includes("Skunkworks"));
        assert(true, "the sidebar team switcher + the team's rows render");
        await ctxE.close(); await ctxF.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "own-records", feature: "Own-record grants (editOwn/deleteOwn)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env, PORT: "4668", AUTH_MODE: "accounts",
          APP_SECRET: "journey-secret-16-chars-plus", CONFIG_PATH: "journeys/fixtures/access.config.json",
        },
      });
      const B = "http://localhost:4668";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctxG = await page.context().browser().newContext();
        const pg = await ctxG.newPage();
        await pg.request.post(B + "/api/auth/signup", { data: { email: "gina@fixture.example", name: "Gina", password: "gina-pass-1234" } });
        const created = await (await pg.request.post(B + "/api/objects/contacts", { data: { name: "Nora Client", email: "nora@x.example" } })).json();
        assert(created._createdBy === "gina@fixture.example", "rows are stamped with their creator");
        const ownEdit = await pg.request.patch(B + `/api/objects/contacts/${created.id}`, { data: { name: "Nora C." } });
        assert(ownEdit.status() === 200, "the creator edits their own row (editOwn)");
        // hank (also just a member) cannot touch gina's row
        const ctxH = await page.context().browser().newContext();
        const ph = await ctxH.newPage();
        await ph.request.post(B + "/api/auth/signup", { data: { email: "hank@fixture.example", name: "Hank", password: "hank-pass-1234" } });
        const foreignEdit = await ph.request.patch(B + `/api/objects/contacts/${created.id}`, { data: { name: "Hijacked" } });
        assert(foreignEdit.status() === 403, "someone else's row 403s (no blanket edit grant)");
        const foreignDelete = await ph.request.fetch(B + `/api/objects/contacts/${created.id}`, { method: "DELETE" });
        assert(foreignDelete.status() === 403, "delete is refused too (no deleteOwn on contacts)");
        // hank's record PAGE renders read-only for gina's row; his own row is editable
        await ph.goto(B + `/#/o/contacts/r/${created.id}`);
        await ph.waitForSelector(`[data-testid="record-${created.id}"]`);
        assert((await ph.locator('[data-testid="field-name"]').evaluate((el) => el.tagName)) === "SPAN",
          "another creator's record renders read-only fields");
        const hankRow = await (await ph.request.post(B + "/api/objects/contacts", { data: { name: "Hank Lead", email: "lead@x.example" } })).json();
        await ph.goto(B + `/#/o/contacts/r/${hankRow.id}`);
        await ph.waitForSelector(`[data-testid="record-${hankRow.id}"]`);
        assert((await ph.locator('[data-testid="field-name"]').evaluate((el) => el.tagName)) === "INPUT",
          "his OWN record stays editable (own-aware UI)");
        await ctxG.close(); await ctxH.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "team-audit-revoke", feature: "Team activity log + invitation revocation",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4669", AUTH_MODE: "accounts", APP_SECRET: "journey-secret-16-chars-plus" },
      });
      const B = "http://localhost:4669";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const pa = await ctx.newPage();
        await pa.request.post(B + "/api/auth/signup", { data: { email: "ada@fixture.example", name: "Ada", password: "audit-pass-123" } });
        await pa.request.post(B + "/api/teams", { data: { name: "Crew" } });
        await pa.request.post(B + "/api/teams/crew/invites", { data: { email: "bob@fixture.example", role: "viewer" } });
        const token = (await (await pa.request.get(B + "/api/outbox")).json()).mail
          .find((m) => m.kind === "team-invite").text.match(/token=([A-Za-z0-9_-]+)/)[1];
        // revoke BEFORE bob accepts → the token must die with the pending membership
        await pa.request.fetch(B + "/api/teams/crew/members?email=bob@fixture.example", { method: "DELETE" });
        const ctxB = await page.context().browser().newContext();
        const pb = await ctxB.newPage();
        await pb.request.post(B + "/api/auth/signup", { data: { email: "bob@fixture.example", name: "Bob", password: "late-pass-1234" } });
        const attempt = await pb.request.post(B + "/api/teams/accept", { data: { token } });
        assert(attempt.status() === 400, "a revoked invitation's token is dead");
        // the audit trail shows the whole story in the UI
        await pa.goto(B + "/#/p/team");
        await pa.waitForSelector('[data-testid="team-activity"]');
        const log = await pa.textContent('[data-testid="team-activity"]');
        assert(log.includes("created the team") && log.includes("invited bob@fixture.example as viewer") && log.includes("revoked the invitation"),
          "the team activity log records create → invite → revoke");
        await ctx.close(); await ctxB.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "mcp-protocol", feature: "MCP server (AI assistant over the data model)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const mcp = spawn("node", [path.join(ROOT, "scripts", "mcp-server.mjs")], {
        env: { ...process.env, NX_APP_URL: URLBASE },
        stdio: ["pipe", "pipe", "inherit"],
      });
      const replies = [];
      let buf = "";
      mcp.stdout.on("data", (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.trim()) replies.push(JSON.parse(line));
        }
      });
      const ask = (id, method, params) => mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      const waitFor = async (id) => {
        for (let i = 0; i < 40; i++) {
          const hit = replies.find((r) => r.id === id);
          if (hit) return hit;
          await new Promise((r) => setTimeout(r, 200));
        }
        throw new Error(`no MCP reply for id ${id}`);
      };
      try {
        ask(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "journey", version: "1" } });
        const init = await waitFor(1);
        assert(init.result.serverInfo.name.endsWith("-mcp"), "MCP initialize handshake answers");
        ask(2, "tools/list", {});
        const tools = (await waitFor(2)).result.tools.map((t) => t.name);
        assert(["list_entities", "describe_entity", "query_records", "get_record", "get_timeline"].every((t) => tools.includes(t)),
          `all five read-only tools are exposed (${tools.join(", ")})`);
        ask(3, "tools/call", { name: "query_records", arguments: { entity: "companies", q: "bright" } });
        const rows = JSON.parse((await waitFor(3)).result.content[0].text);
        assert(rows.length === 1 && rows[0].name === "Brightline Analytics", "an assistant can query live records through MCP");
        ask(4, "tools/call", { name: "describe_entity", arguments: { entity: "deals" } });
        const schema = JSON.parse((await waitFor(4)).result.content[0].text);
        assert(schema.stageField === "stage" && schema.fields.some((f) => f.type === "user"),
          "the schema tool returns the real config shape");
      } finally {
        mcp.kill();
      }
    },
  },
  {
    name: "theme-editor-live", feature: "Theme editor (live, persisted)",
    async run(page) {
      await page.goto(URLBASE + "/#/p/theme");
      await page.waitForSelector('[data-testid="theme-brand-hex"]');
      await page.fill('[data-testid="theme-brand-hex"]', "#0B6E4F");
      await page.waitForFunction(
        () => getComputedStyle(document.documentElement).getPropertyValue("--nx-accent").trim().toLowerCase() === "#0b6e4f",
      );
      assert(true, "the brand edit applies LIVE (accent token flips)");
      await page.reload();
      await page.waitForSelector('[data-testid="theme-brand-hex"]');
      await page.waitForFunction(
        () => getComputedStyle(document.documentElement).getPropertyValue("--nx-accent").trim().toLowerCase() === "#0b6e4f",
      );
      assert(true, "the edited skin survives reload (app_state persistence)");
      // reset so later journeys see the config skin
      await page.click('[data-testid="theme-reset"]');
      await page.request.post(URLBASE + "/api/state", { data: { key: "theme:skin", value: null } });
    },
  },
  {
    name: "feature-flags", feature: "Feature flags (one flag: nav + page + API)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4770", FEATURE_WEBHOOKS: "0" },
      });
      const B = "http://localhost:4770";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/");
        await p2.waitForSelector('[data-testid="nav"]');
        assert((await p2.locator('[data-testid="nav-p-webhooks"]').count()) === 0, "nav hides the disabled feature");
        assert((await p2.locator('[data-testid="nav-p-team"]').count()) === 1, "other features stay");
        const apiTry = await p2.request.get(B + "/api/webhooks");
        assert(apiTry.status() === 404, "the API 404s the disabled feature (same single flag)");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "webhook-delivery", feature: "Webhooks (typed catalog, signed, logged)",
    async run(page) {
      const http = await import("node:http");
      const crypto = await import("node:crypto");
      const got = [];
      const recv = http.createServer((rq, rs) => {
        let b = "";
        rq.on("data", (c) => (b += c));
        rq.on("end", () => { got.push({ headers: rq.headers, body: b }); rs.end("ok"); });
      });
      await new Promise((r) => recv.listen(4795, r));
      try {
        await page.goto(URLBASE + "/#/p/webhooks");
        await page.waitForSelector('[data-testid="wh-url"]');
        await page.fill('[data-testid="wh-url"]', "http://localhost:4795/hook");
        await page.click('[data-testid="wh-ev-companies-created"]');
        await page.click('[data-testid="wh-create"]');
        await page.waitForSelector('[data-testid="wh-secret"]');
        const secret = (await page.textContent('[data-testid="wh-secret"]')).trim();
        assert(secret.length >= 32, "signing secret is shown exactly once at creation");
        // an out-of-band writer creates a company → the subscribed endpoint gets a signed POST
        await page.request.post(URLBASE + "/api/objects/companies", { data: { name: "Hooked Systems" } });
        for (let i = 0; i < 20 && got.length === 0; i++) await page.waitForTimeout(400);
        assert(got.length >= 1, "the endpoint received the delivery (job queue tick)");
        const hit = got[0];
        const sig = String(hit.headers["x-nx-signature"] ?? "").replace("sha256=", "");
        const expect = crypto.createHmac("sha256", secret).update(hit.body).digest("hex");
        assert(sig === expect, "HMAC signature verifies against the once-shown secret");
        assert(hit.headers["x-nx-event"] === "companies.created" && hit.body.includes("Hooked Systems"),
          "payload carries the typed event + the row");
        // the delivery log shows it in the UI
        const hookId = (await (await page.request.get(URLBASE + "/api/webhooks")).json()).webhooks[0].id;
        await page.click(`[data-testid="wh-deliveries-${hookId}"]`);
        await page.waitForSelector('[data-testid="wh-delivery-list"]');
        const logTxt = await page.textContent('[data-testid="wh-delivery-list"]');
        assert(logTxt.includes("delivered") && logTxt.includes("companies.created"), "delivery log row is visible");
        // cleanup: remove the hook + the created row so later journeys see baseline state
        await page.request.fetch(URLBASE + `/api/webhooks/${hookId}`, { method: "DELETE" });
        const rows = (await (await page.request.get(URLBASE + "/api/objects/companies")).json()).rows;
        const mine = rows.find((r) => r.name === "Hooked Systems");
        if (mine) await page.request.fetch(URLBASE + `/api/objects/companies/${mine.id}`, { method: "DELETE" });
      } finally {
        recv.close();
      }
    },
  },
  {
    name: "watch-notify-mention", feature: "Record subscriptions (@mentions notify watchers)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4685", AUTH_MODE: "accounts", APP_SECRET: "journey-secret-16-chars-plus" },
      });
      const B = "http://localhost:4685";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctxA = await page.context().browser().newContext();
        const pa = await ctxA.newPage();
        await pa.request.post(B + "/api/auth/signup", { data: { email: "ada@fixture.example", name: "Ada", password: "watcher-pass-1" } });
        // ada watches a record from the UI
        await pa.goto(B + "/#/o/companies/r/co_1");
        await pa.waitForSelector('[data-testid="watch-toggle"]');
        await pa.click('[data-testid="watch-toggle"]');
        await pa.waitForFunction(() => document.querySelector('[data-testid="watch-toggle"]')?.textContent?.includes("Watching"));
        assert(true, "watch toggle arms from the record header");
        // the @-autocomplete offers directory names while typing
        await pa.click('[role="tab"]:has-text("Notes")');
        await pa.fill('[data-testid="note-input"]', "Loop in @A");
        await pa.waitForSelector('[data-testid="mention-ada"]');
        await pa.click('[data-testid="mention-ada"]');
        const v = await pa.inputValue('[data-testid="note-input"]');
        assert(v.includes("@Ada"), `mention autocomplete inserts the name (${v})`);
        // bob posts a note mentioning Ada → the watcher gets mail, the actor doesn't
        const ctxB = await page.context().browser().newContext();
        const pb = await ctxB.newPage();
        await pb.request.post(B + "/api/auth/signup", { data: { email: "bob@fixture.example", name: "Bob", password: "author-pass-12" } });
        await pb.request.post(B + "/api/objects/companies/co_1/notes", { data: { text: "@Ada please review the contract" } });
        let mail = [];
        for (let i = 0; i < 15; i++) {
          mail = (await (await pb.request.get(B + "/api/outbox")).json()).mail.filter((m) => m.kind === "record-activity");
          if (mail.length) break;
          await new Promise((r) => setTimeout(r, 400));
        }
        assert(mail.some((m) => m.to === "ada@fixture.example" && m.text.includes("please review")),
          "the watcher gets the activity mail");
        assert(!mail.some((m) => m.to === "bob@fixture.example"), "the actor is not notified about their own note");
        await ctxA.close(); await ctxB.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "jobs-digest", feature: "Job seam (queue + recurring digest)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4695", DIGEST_EVERY_MS: "1200" },
      });
      const B = "http://localhost:4695";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        let digest = null;
        for (let i = 0; i < 20; i++) {
          const state = await (await fetch(B + "/api/state")).json();
          if (state["digest:latest"]) { digest = state["digest:latest"]; break; }
          await new Promise((r) => setTimeout(r, 500));
        }
        assert(digest && digest.counts && digest.counts.companies === 8,
          `the recurring digest job computed rollups into app_state (companies=${digest?.counts?.companies})`);
        const jobs = (await (await fetch(B + "/api/jobs")).json()).jobs;
        assert(jobs.some((j) => j.type === "digest" && j.status === "done"), "the job log shows the digest run as done");
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "teams-invite-join", feature: "Teams (invitations, join code, roles)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4680", AUTH_MODE: "accounts", APP_SECRET: "journey-secret-16-chars-plus" },
      });
      const B = "http://localhost:4680";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        // ada (owner) drives the UI
        const ctxA = await page.context().browser().newContext();
        const pa = await ctxA.newPage();
        await pa.request.post(B + "/api/auth/signup", { data: { email: "ada@fixture.example", name: "Ada", password: "owner-pass-123" } });
        await pa.goto(B + "/#/p/team");
        await pa.waitForSelector('[data-testid="team-create-name"]');
        await pa.fill('[data-testid="team-create-name"]', "Fixture Crew");
        await pa.click('[data-testid="team-create-go"]');
        await pa.waitForSelector('[data-testid="team-fixture-crew"]');
        await pa.fill('[data-testid="team-invite-email"]', "bob@fixture.example");
        await pa.click('[data-testid="team-invite-go"]');
        await pa.waitForSelector('[data-testid="member-row-bob@fixture.example"]');
        const pendingRow = await pa.textContent('[data-testid="member-row-bob@fixture.example"]');
        assert(pendingRow.includes("pending"), "invited member shows as PENDING before accepting");
        // bob signs up and follows the invite mail's deep link
        const invMail = (await (await pa.request.get(B + "/api/outbox")).json()).mail.find((m) => m.kind === "team-invite");
        assert(!!invMail, "invitation mail is in the outbox");
        const invToken = invMail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        const ctxB = await page.context().browser().newContext();
        const pb = await ctxB.newPage();
        await pb.request.post(B + "/api/auth/signup", { data: { email: "bob@fixture.example", name: "Bob", password: "member-pass-123" } });
        await pb.goto(`${B}/#/invite?token=${invToken}`);
        await pb.waitForFunction(() =>
          [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("Invitation accepted")),
        );
        const bobTeams = await (await pb.request.get(B + "/api/teams")).json();
        assert(bobTeams.teams.some((t) => t.slug === "fixture-crew"), "accepting activates bob's membership");
        // carol joins via the shareable code
        const code = (await (await pa.request.get(B + "/api/teams/fixture-crew/members")).json()).inviteCode;
        const ctxC = await page.context().browser().newContext();
        const pc = await ctxC.newPage();
        await pc.request.post(B + "/api/auth/signup", { data: { email: "carol@fixture.example", name: "Carol", password: "join-pass-1234" } });
        await pc.goto(B + "/#/p/team");
        await pc.waitForSelector('[data-testid="team-code-input"]');
        await pc.fill('[data-testid="team-code-input"]', code);
        await pc.click('[data-testid="team-join-go"]');
        await pc.waitForSelector('[data-testid="team-fixture-crew"]');
        assert(true, "join code adds carol as a member (UI)");
        // duplicate invite answers explicitly, never a silent no-op
        const dup = await pa.request.post(B + "/api/teams/fixture-crew/invites", { data: { email: "bob@fixture.example", role: "member" } });
        assert(dup.status() === 409, "re-inviting an existing member is an explicit 409");
        // owner promotes bob; the last owner cannot be demoted
        await pa.request.patch(B + "/api/teams/fixture-crew/members", { data: { email: "bob@fixture.example", role: "admin" } });
        const demote = await pa.request.patch(B + "/api/teams/fixture-crew/members", { data: { email: "ada@fixture.example", role: "member" } });
        assert(demote.status() === 409, "the last owner cannot be demoted");
        await ctxA.close(); await ctxB.close(); await ctxC.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "permissions-enforced", feature: "Permissions (config-declared, role-enforced)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env, PORT: "4690", AUTH_MODE: "accounts",
          APP_SECRET: "journey-secret-16-chars-plus", CONFIG_PATH: "journeys/fixtures/perms.config.json",
        },
      });
      const B = "http://localhost:4690";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        // dana has no team → role "member" → view-only on accounts
        await p2.request.post(B + "/api/auth/signup", { data: { email: "dana@fixture.example", name: "Dana", password: "viewer-pass-12" } });
        await p2.goto(B + "/#/o/accounts");
        await p2.waitForSelector('[data-testid="table-accounts"] tbody tr');
        assert((await p2.locator('[data-testid="new-record"]').count()) === 0, "member sees NO create button");
        assert((await p2.locator('[data-testid="table-accounts"] tbody input').count()) === 0, "cells render read-only (no inline editors)");
        const patchTry = await p2.request.patch(B + "/api/objects/accounts/ac_1", { data: { name: "Hacked" } });
        assert(patchTry.status() === 403, "the API itself 403s an edit (server is the gate)");
        const readTry = await p2.request.get(B + "/api/objects/accounts/ac_1");
        assert(readTry.status() === 200, "viewing stays allowed");
        // an owner (via a team) gets the full surface back
        const po = await ctx.newPage();
        await po.request.post(B + "/api/auth/signup", { data: { email: "erin@fixture.example", name: "Erin", password: "owner-pass-1234" } });
        await po.request.post(B + "/api/teams", { data: { name: "Ops" } });
        await po.goto(B + "/#/o/accounts");
        await po.waitForSelector('[data-testid="new-record"]');
        assert(true, "an owner sees the create button again");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "org-reskin", feature: "Skin system (org brand as data)",
    async run(page) {
      // default app carries the nexus skin
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="nav"]');
      const nxAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--nx-accent").trim());
      assert(nxAccent === "#4f46e5", `default skin holds the nexus accent (${nxAccent})`);
      // boot the SAME build with an org skin preset (dark chrome, sharp corners, own brand)
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4750", CONFIG_PATH: "journeys/fixtures/coverage.config.json" },
      });
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch("http://localhost:4750/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* booting */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto("http://localhost:4750/");
        await p2.waitForSelector('[data-testid="nav"]');
        const got = await p2.evaluate(() => ({
          accent: getComputedStyle(document.documentElement).getPropertyValue("--nx-accent").trim(),
          radius: getComputedStyle(document.documentElement).getPropertyValue("--nx-radius-m").trim(),
          chromeBg: getComputedStyle(document.querySelector(".side")).backgroundColor,
          font: getComputedStyle(document.body).fontFamily,
          markBg: getComputedStyle(document.querySelector('[data-testid="brand-mark"]')).backgroundColor,
        }));
        assert(got.accent === "#FF7900", `org brand applies (--nx-accent ${got.accent})`);
        assert(got.radius === "0px", `radius personality applies (${got.radius})`);
        assert(got.chromeBg === "rgb(0, 0, 0)", `dark chrome applies to the shell (${got.chromeBg})`);
        assert(got.font.includes("Helvetica Neue"), `org type applies (${got.font.slice(0, 40)})`);
        assert(got.markBg === "rgb(255, 121, 0)", `brand mark takes the logo colors (${got.markBg})`);
        // the vendored shadcn kit follows too: dialog corners go sharp
        await p2.click('[data-testid="nav-companies"]');
        await p2.waitForSelector('[data-testid="new-record"]');
        await p2.click('[data-testid="new-record"]');
        await p2.waitForSelector('[role="dialog"]');
        const dlgRadius = await p2.evaluate(() => getComputedStyle(document.querySelector('[role="dialog"]')).borderRadius);
        assert(dlgRadius === "0px", `vendored shadcn components follow the skin (dialog radius ${dlgRadius})`);
        await p2.keyboard.press("Escape");
        await p2.screenshot({ path: path.join(SHOTS, "journey-org-reskin-light.png") });
        // dark mode derives from the same brand
        await p2.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await p2.waitForTimeout(150);
        const darkAccent = await p2.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--nx-accent").trim());
        assert(darkAccent !== "" && darkAccent !== "#FF7900", `dark variant derives from the brand (${darkAccent.slice(0, 46)})`);
        await p2.screenshot({ path: path.join(SHOTS, "journey-org-reskin-dark.png") });
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "chart-view", feature: "Chart view (group + measure)",
    async run(page) {
      const pickMenu = async (trigger, item) => {
        await page.click(`[data-testid="${trigger}"]`);
        const it = page.locator(`[data-testid="${item}"]`);
        await it.waitFor();
        for (let i = 0; i < 8; i++) {
          if ((await it.getAttribute("data-highlighted")) !== null) break;
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(80);
        }
        await page.keyboard.press("Enter");
      };
      // companies: count per industry, no stageField needed
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Chart")');
      await page.waitForSelector('[data-testid="chart-companies"]');
      const soft = await page.getAttribute('[data-testid="bar-Software"]', "data-value");
      assert(Number(soft) >= 1, `companies chart bars by Industry (Software=${soft})`);
      // deals: switch measure to Σ Amount → New column sums 32000+21000
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="kanban-deals"]');
      await page.click('[data-testid="view-switch"] button:has-text("Chart")');
      await page.waitForSelector('[data-testid="chart-deals"]');
      await pickMenu("measure-by", "measure-amount");
      // order-independent: expected sums computed from the live API, not seed memory
      const deals = (await (await page.request.get(URLBASE + "/api/objects/deals")).json()).rows;
      const sums = {};
      for (const d of deals) sums[d.stage] = (sums[d.stage] ?? 0) + (d.amount ?? 0);
      const stage = Object.keys(sums).find((s) => sums[s] > 0);
      await page.waitForFunction(
        ([s, v]) => document.querySelector(`[data-testid="bar-${s}"]`)?.dataset.value === String(v),
        [stage, sums[stage]],
      );
      assert(true, `deals chart sums Amount per stage (${stage}=${sums[stage]})`);
      // RESTORE persisted state for later journeys
      await pickMenu("measure-by", "measure-count");
      await page.click('[data-testid="view-switch"] button:has-text("Board")');
      await page.waitForSelector('[data-testid="kanban-deals"]');
      await page.goto(URLBASE + "/#/o/companies");
      await page.click('[data-testid="view-switch"] button:has-text("Table")');
      await page.waitForSelector('[data-testid="table-companies"]');
    },
  },
  {
    name: "live-sync", feature: "Live sync (cross-viewer updates)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      const before = await (await page.request.get(URLBASE + "/api/objects/companies/co_5")).json();
      // an OUT-OF-BAND writer (another viewer / an agent) edits the row
      // (assert on the NAME cell — button text; input cells hold values, not textContent)
      await page.request.patch(URLBASE + "/api/objects/companies/co_5", { data: { name: "Meridian LIVE-SYNC" } });
      // NO reload — the rev poll must pick it up
      await page.waitForFunction(
        () => document.querySelector('[data-testid="table-companies"]')?.textContent?.includes("Meridian LIVE-SYNC"),
        undefined,
        { timeout: 10000 },
      );
      assert(true, "another writer's edit appears in the open table without a reload (rev poll)");
      await page.request.patch(URLBASE + "/api/objects/companies/co_5", { data: { name: before.name } });
      await page.waitForFunction(
        (nm) => document.querySelector('[data-testid="table-companies"]')?.textContent?.includes(nm),
        before.name,
        { timeout: 10000 },
      );
    },
  },
  {
    name: "generator-litmus", feature: "Generator CLI (object scaffolding)",
    async run(page) {
      const { execFileSync } = await import("node:child_process");
      const { mkdtempSync, copyFileSync } = await import("node:fs");
      const os = await import("node:os");
      const tmp = mkdtempSync(path.join(os.tmpdir(), "nx-gen-"));
      const cfgPath = path.join(tmp, "gen.config.json");
      copyFileSync(path.join(ROOT, "journeys", "fixtures", "coverage.config.json"), cfgPath);
      execFileSync("node", [
        path.join(ROOT, "scripts", "generate.mjs"), "object", "Gadget",
        "--key", "gadgets",
        "--fields", "name:text:primary,status:select:Prototype|Testing|Shipped,owner:user",
        "--seed", "4", "--config", cfgPath,
      ]);
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4800", CONFIG_PATH: cfgPath },
      });
      try {
        for (let i = 0; i < 20; i++) {
          try {
            const r = await fetch("http://localhost:4800/api/healthz", { signal: AbortSignal.timeout(1500) });
            if (r.ok) break;
          } catch { /* booting */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto("http://localhost:4800/");
        await p2.waitForSelector('[data-testid="nav-gadgets"]');
        await p2.click('[data-testid="nav-gadgets"]');
        await p2.waitForSelector('[data-testid="kanban-gadgets"]');
        const cards = await p2.locator('[data-testid="kanban-gadgets"] .nxKCard').count();
        assert(cards === 4, `generated object boots live: board + ${cards} seeded rows (config → app, one command)`);
        const proto = await p2.locator('[data-testid="col-Prototype"]').count();
        assert(proto === 1, "generated select options became board columns");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "field-validation", feature: "Field-type validation (config-implied)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people/r/pe_1");
      await page.waitForSelector('[data-testid="field-email"]');
      const before = await page.inputValue('[data-testid="field-email"]');
      await page.fill('[data-testid="field-email"]', "not-an-email");
      await page.locator('[data-testid="field-email"]').blur();
      await page.waitForFunction(
        () => [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("valid email")),
      );
      assert(true, "server rejects a bad email with a human message (toast)");
      await page.waitForFunction(
        (prev) => document.querySelector('[data-testid="field-email"]')?.value === prev, before,
      );
      assert(true, "the field reverts to the stored value after the rejection");
      const direct = await page.request.patch(URLBASE + "/api/objects/people/pe_1", { data: { email: "nope" } });
      assert(direct.status() === 400, "the API itself 400s (not just the UI)");
    },
  },
  {
    name: "demo-badge", feature: "Demo-data badge",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="demo-badge"]');
      const txt = await page.textContent('[data-testid="demo-badge"]');
      assert(txt.includes("Demo"), "seeded fictional rows surface as a visible Demo badge");
    },
  },
  {
    name: "image-upload-downscale", feature: "Image downscale on upload",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies/r/co_4");
      await page.waitForSelector('[data-testid="record-co_4"]');
      await page.click('[role="tab"]:has-text("Files")');
      await page.waitForSelector('[data-testid="file-input"]', { state: "attached" });
      // build a 2400×1500 PNG in-page and hand it to the hidden input
      await page.evaluate(async () => {
        const c = document.createElement("canvas");
        c.width = 2400; c.height = 1500;
        const g = c.getContext("2d");
        g.fillStyle = "#4455ff"; g.fillRect(0, 0, 2400, 1500);
        g.fillStyle = "#ffaa00"; g.fillRect(200, 200, 900, 700);
        const blob = await new Promise((r) => c.toBlob(r, "image/png"));
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "wide-photo.png", { type: "image/png" }));
        const input = document.querySelector('[data-testid="file-input"]');
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForSelector('[data-testid^="file-row-"]');
      const href = await page.getAttribute('[data-testid^="file-dl-"]', "href");
      const dl = await page.request.get(URLBASE + href);
      const buf = await dl.body();
      // PNG IHDR: width = bytes 16-19 big-endian
      const width = buf.readUInt32BE(16);
      assert(width <= 1600 && width > 0, `stored image is downscaled (width ${width} ≤ 1600 from 2400)`);
    },
  },
  {
    name: "attachments", feature: "Attachments (files on records)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies/r/co_2");
      await page.waitForSelector('[data-testid="record-co_2"]');
      await page.click('[role="tab"]:has-text("Files")');
      await page.setInputFiles('[data-testid="file-input"]', {
        name: "meeting-notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello attachments block"),
      });
      await page.waitForSelector('[data-testid^="file-row-"]');
      const rowText = await page.textContent('[data-testid^="file-row-"]');
      assert(rowText.includes("meeting-notes.txt") && rowText.includes("B"), "uploaded file lists with name + size");
      const href = await page.getAttribute('[data-testid^="file-dl-"]', "href");
      const dl = await page.request.get(URLBASE + href);
      assert(dl.ok() && (await dl.text()) === "hello attachments block", "download returns the exact uploaded bytes");
      await page.click('[role="tab"]:has-text("Timeline")');
      await page.waitForSelector('[data-testid="tl-ic-file"]');
      const tl = await page.textContent('[data-testid="timeline"]');
      assert(tl.includes("Attached meeting-notes.txt"), "timeline gains the attach event");
    },
  },
  {
    name: "activity-composer", feature: "Activity composer (call/email/meeting)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals/r/de_2");
      await page.waitForSelector('[data-testid="activity-composer"]');
      await page.click('[data-testid="act-kind-email"]');
      await page.fill('[data-testid="act-input"]', "Sent pricing recap to Maya");
      await page.click('[data-testid="act-log"]');
      await page.waitForSelector('[data-testid="tl-ic-email"]');
      const tl = await page.textContent('[data-testid="timeline"]');
      assert(tl.includes("Sent pricing recap to Maya"), "logged email appears in the timeline with its kind icon");
      await page.reload();
      await page.waitForSelector('[data-testid="tl-ic-email"]');
      assert(true, "activity survives reload");
    },
  },
  {
    name: "enrich-field", feature: "AI-enrichment seam (field.primitive)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies/r/co_3");
      await page.waitForSelector('[data-testid="enrich-about"]');
      await page.click('[data-testid="enrich-about"]');
      await page.waitForFunction(
        () => (document.querySelector('[data-testid="field-about"]')?.value ?? "").includes("(mock)"),
      );
      assert(true, "About fills from the enrich primitive (labeled mock)");
      await page.reload();
      await page.waitForFunction(
        () => (document.querySelector('[data-testid="field-about"]')?.value ?? "").includes("(mock)"),
      );
      const tl = await page.textContent('[data-testid="timeline"]');
      assert(tl.includes("Enriched About via Company research (mock)"), "timeline records the enrichment with its primitive label");
    },
  },
  {
    name: "board-group-by", feature: "Board group-by any field",
    async run(page) {
      // companies has NO stageField — the board now exists via its select field
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Board")');
      await page.waitForSelector('[data-testid="kanban-companies"]');
      const softCard = await page.locator('[data-testid="col-Software"] [data-testid="card-co_1"]').count();
      assert(softCard === 1, "companies board groups by Industry (Brightline in Software)");
      // deals has TWO groupables (stage + owner) → the group picker appears
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="kanban-deals"]');
      // keyboard-select a menu item deterministically: ArrowDown until IT is
      // highlighted (the first press can be swallowed during Radix focus transfer)
      const pickGroup = async (key) => {
        await page.click('[data-testid="group-by"]');
        const item = page.locator(`[data-testid="group-by-${key}"]`);
        await item.waitFor();
        for (let i = 0; i < 8; i++) {
          if ((await item.getAttribute("data-highlighted")) !== null) break;
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(80);
        }
        await page.keyboard.press("Enter");
      };
      await pickGroup("owner");
      await page.waitForSelector('[data-testid="col-you"]', { timeout: 6000 });
      const youCards = await page.locator('[data-testid="col-you"] .nxKCard').count();
      assert(youCards >= 1, `board regroups by Owner (user field; ${youCards} cards under 'you')`);
      // RESTORE persisted view state (other journeys depend on defaults)
      await pickGroup("stage");
      await page.waitForSelector('[data-testid="col-New"]');
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Table")');
      await page.waitForSelector('[data-testid="table-companies"]');
    },
  },
  {
    name: "user-field-picker", feature: "User (assignee) fields",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="view-switch"]');
      await page.click('[data-testid="view-switch"] button:has-text("Table")');
      await page.waitForSelector(".nxRowLink");
      await page.click('.nxRowLink:has-text("Nordwind store copilot")');
      await page.waitForSelector('[data-testid="field-owner"]');
      await page.click('[data-testid="field-owner"]');
      await page.waitForSelector('[data-testid="field-owner-opt-maya-verstraete"]');
      await page.fill('[data-testid="field-owner-search"]', "maya");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForSelector('[data-testid="toast"]');
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="field-owner-value"]')?.textContent?.includes("Maya"));
      assert(true, "owner picked from the app users directory");
      await page.goBack();
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="table-deals"]')?.textContent?.includes("Maya Verstraete"));
      assert(true, "table renders the user cell (avatar + name)");
      await page.request.patch(URLBASE + "/api/objects/deals/de_2", { data: { owner: "you" } });
    },
  },
  {
    name: "tags-multiselect", feature: "Multiselect (tags) fields",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector('[data-testid="table-people"]');
      const cell = await page.textContent('[data-testid="row-pe_1"]');
      assert(cell?.includes("Champion"), "tag chips render in the table");
      await page.click('[data-testid="filter-tags"]');
      await page.waitForSelector('[data-testid="filter-tags-champion"]');
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter"); // Champion (first option)
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-people"] tbody tr').length === 1);
      assert(true, "contains-any tag filter narrows to the tagged person");
      await page.click('[data-testid="filters-clear"]');
      await page.click(".nxRowLink >> nth=0");
      await page.waitForSelector('[data-testid="field-tags"]');
      await page.click('[data-testid="field-tags"]');
      await page.waitForSelector('[data-testid="field-tags-opt-finance"]');
      await page.click('[data-testid="field-tags-opt-finance"]');
      await page.keyboard.press("Escape");
      await page.waitForSelector('[data-testid="toast"]');
      await page.reload();
      await page.waitForSelector('[data-testid="field-tags-chip-finance"]');
      assert(true, "toggled tag persists across reload");
      await page.request.patch(URLBASE + "/api/objects/people/pe_1", { data: { tags: ["Champion", "Technical"] } });
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

/* ---- generated journeys (scripts/generate.mjs journey <name>) ----
   each journeys/extra/*.mjs default-exports [{name, feature, run(page, ctx)}] */
const extraDir = path.join(ROOT, "journeys", "extra");
if (existsSync(extraDir)) {
  for (const f of readdirSync(extraDir).filter((x) => x.endsWith(".mjs")).sort()) {
    const mod = await import(pathToFileURL(path.join(extraDir, f)).href);
    journeys.push(...(mod.default ?? []));
  }
}

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
    await j.run(page, { URLBASE, assert, ROOT }); // ctx arg: generated journeys use it; built-ins close over the same
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

/* ---- COVERAGE.md: latest run only (a growing history is noise; git has the past) ---- */
const covPath = path.join(ROOT, "docs", "COVERAGE.md");
const rows = results
  .filter((r) => r.feature !== null)
  .map((r) => `| ${r.name} | ${SURFACE} | ${r.verdict} | ${r.detail.replaceAll("|", "/").slice(0, 160)} | .playwright-mcp/journey-${r.name}.png | ${now} |`)
  .join("\n");
writeFileSync(
  covPath,
  `# Coverage — latest \`npm run journeys\` run\n\nWritten by the journey runner; one verdict row per journey, latest run only.\n\n| Journey | Surface | Verdict | Checks | Screenshot | At |\n|---|---|---|---|---|---|\n${rows}\n`,
);

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
