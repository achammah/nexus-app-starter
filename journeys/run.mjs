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
      await page.keyboard.press("Escape"); // closes the select's focus
      await page.keyboard.press("Escape"); // closes the peek — the board is behind it
      await page.waitForSelector('[data-testid="kanban-deals"]');
      // live sync: the board behind the peek refreshes on the next rev poll
      await page.waitForFunction(() =>
        document.querySelector('[data-testid="col-Qualified"]')?.querySelector('[data-testid="card-de_2"]'), null, { timeout: 8000 });
      assert(true, "card visibly moved to the Qualified column");
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
      let healed = false;
      for (let i = 0; i < 40; i++) {
        const t = await page.textContent('[data-testid="row-count"]').catch(() => "");
        if (/^\d+$/.test(t ?? "")) count = Number(t);
        if (count === 8) break;
        if (i === 20 && !healed) {
          // diagnostic self-heal: if the first clear was swallowed, a second one
          // pinpoints WHERE the flake lives (input vs load pipeline)
          healed = true;
          await page.fill('[data-testid="list-search"]', "x");
          await page.fill('[data-testid="list-search"]', "");
        }
        await page.waitForTimeout(250);
      }
      const liveQ = await page.inputValue('[data-testid="list-search"]').catch(() => "?");
      const truth = await (await page.request.get(URLBASE + "/api/objects/companies")).json();
      assert(count === 8,
        `count returns to 8 after reviewed delete (ui=${count}, server=${truth.rows.length}, q="${liveQ}", healed=${healed}, toast="${toastTxt}")`);
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
    name: "saved-views", feature: "Saved views (named, shareable, per-object)",
    async run(page) {
      const pickItem = async (trigger, locator) => {
        await page.click(trigger);
        await locator.waitFor();
        for (let i = 0; i < 12; i++) {
          if ((await locator.getAttribute("data-highlighted")) !== null) break;
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(70);
        }
        await page.keyboard.press("Enter");
      };
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      // shape a state: industry=Software + Board layout
      await pickItem('[data-testid="filter-industry"]', page.locator('[data-testid="filter-industry-software"]'));
      await page.keyboard.press("Escape");
      await page.click('[data-testid="view-switch"] button:has-text("Board")');
      await page.waitForSelector('[data-testid="kanban-companies"]');
      // save it as a named view
      await pickItem('[data-testid="views-menu"]', page.locator('[data-testid="view-save"]'));
      await page.waitForSelector('[data-testid="view-name"]');
      await page.fill('[data-testid="view-name"]', "SW Board");
      await page.click('[data-testid="view-save-go"]');
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("saved")),
      );
      // reset to the default state
      await pickItem('[data-testid="views-menu"]', page.locator('[data-testid="view-all"]'));
      await page.waitForSelector('[data-testid="table-companies"]');
      // the view is server-persisted + workspace-visible
      const list = (await (await page.request.get(URLBASE + "/api/views?object=companies")).json()).views;
      const mine = list.find((v) => v.name === "SW Board");
      assert(!!mine, "the view is server-persisted (another browser/user would see it)");
      // applying it brings the WHOLE state back: board + active filter
      await pickItem('[data-testid="views-menu"]', page.locator(`[data-testid="view-${mine.id}"]`));
      await page.waitForSelector('[data-testid="kanban-companies"]');
      const chip = await page.textContent('[data-testid="filter-industry"]');
      assert(chip.includes("1"), "applying the saved view restores layout AND filters");
      // cleanup
      await page.request.fetch(URLBASE + `/api/views/${mine.id}`, { method: "DELETE" });
      await pickItem('[data-testid="views-menu"]', page.locator('[data-testid="view-all"]'));
      await page.waitForSelector('[data-testid="table-companies"]');
    },
  },
  {
    name: "kanban-rollups", feature: "Kanban per-column rollups (sum/avg/min/max)",
    async run(page) {
      const pickItem = async (trigger, locator) => {
        await page.click(trigger);
        await locator.waitFor();
        for (let i = 0; i < 12; i++) {
          if ((await locator.getAttribute("data-highlighted")) !== null) break;
          await page.keyboard.press("ArrowDown");
          await page.waitForTimeout(70);
        }
        await page.keyboard.press("Enter");
      };
      await page.goto(URLBASE + "/#/o/deals");
      await page.waitForSelector('[data-testid="kanban-deals"]');
      await pickItem('[data-testid="agg-by"]', page.locator('[data-testid="agg-sum-amount"]'));
      await page.keyboard.press("Escape");
      // expected sums straight from the API (order-independent)
      const deals = (await (await page.request.get(URLBASE + "/api/objects/deals")).json()).rows;
      const sums = {};
      for (const d of deals) sums[d.stage] = (sums[d.stage] ?? 0) + (d.amount ?? 0);
      const stage = Object.keys(sums).find((s) => sums[s] > 0);
      await page.waitForFunction(
        ([s, v]) => document.querySelector(`[data-testid="agg-${s}"]`)?.dataset.value === String(v),
        [stage, sums[stage]],
      );
      assert(true, `every column heads shows its Σ (${stage}=${sums[stage]})`);
      await page.reload();
      await page.waitForSelector(`[data-testid="agg-${stage}"]`);
      assert(true, "the rollup choice persists");
      await pickItem('[data-testid="agg-by"]', page.locator('[data-testid="agg-none"]'));
      await page.keyboard.press("Escape");
      await page.waitForFunction((s) => !document.querySelector(`[data-testid="agg-${s}"]`), stage);
    },
  },
  {
    name: "bulk-edit", feature: "Bulk edit (batched, live progress)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector('[data-testid="table-people"] tbody tr');
      const before = (await (await page.request.get(URLBASE + "/api/objects/people")).json()).rows;
      await page.click('tbody tr:nth-child(1) [role="checkbox"]');
      await page.click('tbody tr:nth-child(2) [role="checkbox"]');
      await page.waitForSelector('[data-testid="bulk-edit"]');
      await page.click('[data-testid="bulk-edit"]');
      await page.waitForSelector('[data-testid="bulk-edit-field"]');
      await page.selectOption('[data-testid="bulk-edit-field"]', "role");
      await page.fill('[data-testid="bulk-edit-value"]', "Advisor");
      await page.click('[data-testid="bulk-edit-go"]');
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("Updated 2")),
      );
      const after = (await (await page.request.get(URLBASE + "/api/objects/people")).json()).rows;
      const changed = after.filter((r) => r.role === "Advisor");
      assert(changed.length === 2, "both selected rows took the new value");
      // restore originals
      for (const r of changed) {
        const orig = before.find((b) => b.id === r.id);
        await page.request.patch(URLBASE + `/api/objects/people/${r.id}`, { data: { role: orig.role } });
      }
    },
  },
  {
    name: "multi-sort", feature: "Multi-level sort (shift-click tie-breaker)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      await page.click('th:has-text("Industry")');
      await page.keyboard.down("Shift");
      await page.click('th:has-text("Employees")');
      await page.keyboard.up("Shift");
      await page.waitForFunction(() => {
        try { return (JSON.parse(localStorage.getItem("nx-view-companies") ?? "{}").sort ?? []).length === 2; }
        catch { return false; }
      });
      assert(true, "shift-click stacks a second sort level (persisted)");
      // reset via the views menu default
      await page.click('[data-testid="views-menu"]');
      const all = page.locator('[data-testid="view-all"]');
      await all.waitFor();
      for (let i = 0; i < 8; i++) {
        if ((await all.getAttribute("data-highlighted")) !== null) break;
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(70);
      }
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => {
        try { return (JSON.parse(localStorage.getItem("nx-view-companies") ?? "{}").sort ?? []).length === 0; }
        catch { return false; }
      });
    },
  },
  {
    name: "field-depth", feature: "Field-type depth (boolean/rating/dateTime/array/longText/json, colored options, unique, deactivation)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4790", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:4790";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/#/o/vendors");
        await p2.waitForSelector('[data-testid="table-vendors"] tbody tr');
        // colored option chip carries its configured color
        const chipColor = await p2.getAttribute('[data-testid="table-vendors"] .nxOptChip[data-color="purple"]', "data-color");
        assert(chipColor === "purple", "select options render as COLORED chips (Strategic=purple)");
        // deactivated field is gone from the table
        const headers = await p2.locator('[data-testid="table-vendors"] th').allTextContents();
        assert(!headers.some((h) => h.includes("Legacy ref")), "deactivated fields disappear from surfaces (data preserved)");
        const rowStill = await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        assert(rowStill.legacyRef === "OLD-77", "…while the stored value survives underneath");
        // boolean toggles inline and persists
        await p2.click('[data-testid="cell-ve_2-active"]');
        await p2.waitForFunction(() =>
          [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("Saved")),
        );
        const v2 = await (await p2.request.get(B + "/api/objects/vendors/ve_2")).json();
        assert(v2.active === true, "boolean cell toggles + persists");
        // rating stars set from the table
        await p2.click('[data-testid="rate-ve_2-score-4"]');
        await p2.waitForFunction(async () => true);
        for (let i = 0; i < 20; i++) {
          const r = await (await p2.request.get(B + "/api/objects/vendors/ve_2")).json();
          if (r.score === 4) break;
          await new Promise((r2) => setTimeout(r2, 200));
        }
        const v2b = await (await p2.request.get(B + "/api/objects/vendors/ve_2")).json();
        assert(v2b.score === 4, "rating stars set + persist (2 → 4)");
        // unique constraint: duplicate vendor code 409s with a human message
        const dup = await p2.request.post(B + "/api/objects/vendors", { data: { name: "Clone Co", code: "V-001" } });
        assert(dup.status() === 400, "unique field rejects duplicates");
        assert((await dup.json()).error.includes("unique"), "…with a message naming the constraint");
        // record page: array chips add/remove + dateTime + json render
        await p2.goto(B + "/#/o/vendors/r/ve_3");
        await p2.waitForSelector('[data-testid="field-labels-input"]');
        await p2.fill('[data-testid="field-labels-input"]', "expansion");
        await p2.keyboard.press("Enter");
        for (let i = 0; i < 20; i++) {
          const r = await (await p2.request.get(B + "/api/objects/vendors/ve_3")).json();
          if ((r.labels ?? []).includes("expansion")) break;
          await new Promise((r2) => setTimeout(r2, 200));
        }
        const v3 = await (await p2.request.get(B + "/api/objects/vendors/ve_3")).json();
        assert(v3.labels.includes("expansion") && v3.labels.includes("renewal"), "array field adds free-form tags");
        // writes to a deactivated field are rejected
        const inactivePatch = await p2.request.patch(B + "/api/objects/vendors/ve_1", { data: { legacyRef: "NEW" } });
        assert(inactivePatch.status() === 400, "writes to deactivated fields are rejected");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "warehouse-persistence", feature: "Native warehouse spine (restart-survivable)",
    async run() {
      const http = await import("node:http");
      const { spawn } = await import("node:child_process");
      // mock Nexus API speaking the REAL connector contract: POST /tools/:id/execute,
      // run-query answers the [[rows],{},{meta}] envelope with INT64 as STRINGS,
      // insert-rows takes {datasetId, tableId, rows:[jsonString]}
      const table = [];
      const mock = http.createServer((rq, rs) => {
        let b = "";
        rq.on("data", (c) => (b += c));
        rq.on("end", () => {
          const m = rq.url.match(/^\/api\/public\/v1\/tools\/[^/]+\/execute$/);
          if (!m || rq.method !== "POST") { rs.statusCode = 404; return rs.end("{}"); }
          const { action, input } = JSON.parse(b);
          let result;
          if (action === "google_cloud-run-query") {
            const q = String(input.query);
            if (/^\s*INSERT\s/i.test(q)) {
              // the driver writes INSERT DML: (seq, TIMESTAMP 'iso', 'op', 'base64')
              for (const m of q.matchAll(/\((\d+), TIMESTAMP '([^']+)', '([^']+)', '([^']+)'\)/g)) {
                table.push({ seq: Number(m[1]), ts: m[2], op: m[3], args: m[4] });
              }
              result = [[], {}, {}];
            } else if (/^\s*CREATE\s/i.test(q)) {
              result = [[], {}, {}];
            } else {
              result = [table.slice().sort((a, z) => a.seq - z.seq).map((r) => ({ seq: String(r.seq), op: r.op, args: r.args, ts: r.ts })), {}, {}];
            }
          } else {
            rs.statusCode = 400;
            return rs.end(JSON.stringify({ error: `unknown action ${action}` }));
          }
          rs.setHeader("content-type", "application/json");
          rs.end(JSON.stringify({ success: true, result }));
        });
      });
      await new Promise((r) => mock.listen(4881, r));
      const B = "http://localhost:4880";
      const bootEnv = {
        ...process.env, PORT: "4880", WAREHOUSE: "bigquery",
        NEXUS_BASE_URL: "http://localhost:4881", NEXUS_API_KEY: "nxs_mock_key",
        WAREHOUSE_CREDENTIAL_ID: "mock-cred",
      };
      const boot = async () => {
        const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env: bootEnv });
        for (let i = 0; i < 25; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        return proc;
      };
      let proc = await boot();
      try {
        const post = (p, body) => fetch(B + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const created = await (await post("/api/objects/companies", { name: "Persistent Systems", industry: "Software" })).json();
        await post(`/api/objects/companies/${created.id}/notes`, { text: "does this survive restarts?" });
        await new Promise((r) => setTimeout(r, 1300)); // beyond the flush interval
        assert(table.length >= 2, `events flushed to the warehouse (${table.length})`);
        proc.kill();
        await new Promise((r) => setTimeout(r, 400));
        proc = await boot(); // fresh process, fresh memory — only the log remains
        const rows = (await (await fetch(B + "/api/objects/companies")).json()).rows;
        const hit = rows.find((r) => r.name === "Persistent Systems");
        assert(!!hit && hit.id === created.id, `the record SURVIVES restart with the SAME id (${created.id})`);
        assert(rows.length === 9, `seed + replayed log compose (${rows.length} rows)`);
        const tl = (await (await fetch(B + `/api/objects/companies/${created.id}/timeline`)).json()).events;
        assert(tl.some((e) => e.summary.includes("does this survive restarts?")), "the note + timeline replay too");
      } finally {
        proc.kill();
        mock.close();
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
      await page.keyboard.press("Escape"); // close the peek — the table is behind it
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
  {
    name: "side-peek-stack", feature: "Side peek (stacked record panel over the list)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector(".nxRowLink");
      await page.click('.nxRowLink:has-text("Brightline Analytics")');
      await page.waitForSelector('[data-testid="peek-panel"]');
      assert((await page.locator('[data-testid="table-companies"]').count()) === 1, "the LIST stays visible behind the panel");
      assert(page.url().includes("peek="), "the peek root rides the URL (shareable, reload-safe)");
      // walk one hop deeper: a related record PUSHES onto the same panel
      await page.waitForSelector('[data-testid="related-people"]');
      await page.click('[data-testid^="related-people-"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="peek-crumbs"] .peekCrumb').length === 2);
      assert(true, "opening a related record stacks a second level (crumbs show the path)");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="peek-crumbs"] .peekCrumb').length === 1);
      assert(true, "Escape steps BACK a level, not straight to close");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector('[data-testid="peek-panel"]'));
      assert(true, "Escape at the root closes the panel");
      // promote: the same record, its own full page
      await page.click('.nxRowLink:has-text("Brightline Analytics")');
      await page.waitForSelector('[data-testid="peek-promote"]');
      await page.click('[data-testid="peek-promote"]');
      await page.waitForFunction(() => /#\/o\/companies\/r\//.test(window.location.hash));
      await page.waitForFunction(() => !document.querySelector('[data-testid="peek-panel"]'));
      assert(true, "promote escapes the peek into the full record page");
    },
  },
  {
    name: "record-pagination", feature: "Record-to-record pagination (N of M through the open set)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector(".nxRowLink");
      await page.click("tbody tr:first-child .nxRowLink");
      await page.waitForSelector('[data-testid="peek-pos"]');
      const pos0 = await page.textContent('[data-testid="peek-pos"]');
      assert(/1 of \d+/.test(pos0 ?? ""), `panel shows the position in the originating set (${pos0})`);
      const name0 = await page.textContent('[data-testid="record-name"]');
      await page.click('[data-testid="peek-next"]');
      await page.waitForFunction((n) => document.querySelector('[data-testid="record-name"]')?.textContent !== n, name0);
      const pos1 = await page.textContent('[data-testid="peek-pos"]');
      assert(/2 of \d+/.test(pos1 ?? ""), `next steps through the SAME set (${pos1})`);
      await page.click('[data-testid="peek-prev"]');
      await page.click('[data-testid="peek-prev"]');
      const posWrap = await page.textContent('[data-testid="peek-pos"]');
      assert(/of \d+$/.test(posWrap ?? "") && !posWrap?.startsWith("0"), `prev wraps around the set (${posWrap})`);
      await page.keyboard.press("Escape");
    },
  },
  {
    name: "keyboard-grid", feature: "Spreadsheet keyboard model (row → cell → edit, type-to-edit)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      await page.focus('[data-testid="table-companies"]');
      await page.keyboard.press("ArrowDown"); // no focus → row 0
      await page.waitForSelector("tr[data-row-focus]");
      const r0 = await page.getAttribute("tr[data-row-focus]", "data-testid");
      await page.keyboard.press("j");
      await page.waitForFunction((prev) => document.querySelector("tr[data-row-focus]")?.getAttribute("data-testid") !== prev, r0);
      assert(true, "j moves row focus down (vim alternate works)");
      await page.keyboard.press("x");
      await page.waitForSelector('[data-testid="bulk-bar"]');
      assert(true, "x selects the focused row (bulk bar appears)");
      await page.keyboard.press("Enter");
      await page.waitForSelector("td[data-cell-focus]");
      assert(true, "Enter drops from row focus into cell focus");
      await page.keyboard.press("ArrowRight"); // → domain (a text column)
      // type-to-edit: the keystroke itself opens AND seeds the editor
      await page.keyboard.press("Z");
      await page.waitForSelector("td[data-cell-focus] input, td input.nxCellEdit");
      const seeded = await page.inputValue("td[data-cell-focus] input").catch(() => page.inputValue("td input.nxCellEdit"));
      assert(seeded === "Z", `typing seeds the editor with the keystroke (${seeded})`);
      await page.keyboard.type("ulu");
      const preCancel = await (await page.request.get(URLBASE + "/api/objects/companies")).json();
      await page.keyboard.press("Escape"); // cancel — no save
      await page.waitForFunction(() => !document.querySelector("td[data-cell-focus] input"));
      await page.waitForTimeout(250);
      const postCancel = await (await page.request.get(URLBASE + "/api/objects/companies")).json();
      assert(JSON.stringify(preCancel.rows) === JSON.stringify(postCancel.rows),
        "Escape-cancel writes NOTHING server-side (no race-commit through blur)");
      await page.keyboard.press("Escape"); // cell → row
      await page.waitForSelector("tr[data-row-focus]");
      await page.keyboard.press("Escape"); // selection clears first
      await page.waitForFunction(() => !document.querySelector('[data-testid="bulk-bar"]'));
      assert(true, "Escape is a ladder: edit → cell → row → selection");
      // cmd/ctrl-Enter on a focused row opens the peek
      await page.keyboard.press("ArrowDown");
      await page.waitForSelector("tr[data-row-focus]");
      await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
      await page.waitForSelector('[data-testid="peek-panel"]');
      assert(true, "Cmd/Ctrl+Enter opens the focused record in the peek");
      await page.keyboard.press("Escape");
    },
  },
  {
    name: "picker-inline-create", feature: "Inline create inside the relation picker (no-match → create & attach)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/deals/r/de_2");
      await page.waitForSelector('[data-testid="field-company"]');
      const before = (await (await page.request.get(URLBASE + "/api/objects/companies")).json()).rows.length;
      await page.click('[data-testid="field-company"]');
      await page.waitForSelector('[data-testid="field-company-search"]');
      await page.fill('[data-testid="field-company-search"]', "Zebra Dynamics");
      await page.waitForSelector('[data-testid="field-company-create"]');
      await page.click('[data-testid="field-company-create"]');
      // progressive completion: the fresh record opens (title only, rest fills later)
      await page.waitForFunction(() => document.querySelector('[data-testid="record-name"]')?.textContent?.includes("Zebra Dynamics"));
      assert(true, "the new record opens immediately for field-by-field completion");
      const deal = await (await page.request.get(URLBASE + "/api/objects/deals/de_2")).json();
      assert(deal.company === "Zebra Dynamics", "created record is attached to the relation in the same step");
      const rows = (await (await page.request.get(URLBASE + "/api/objects/companies")).json()).rows;
      assert(rows.length === before + 1, "the record really exists");
      const z = rows.find((r) => r.name === "Zebra Dynamics");
      await page.request.patch(URLBASE + "/api/objects/deals/de_2", { data: { company: "Cargolane" } });
      await page.request.delete(URLBASE + `/api/objects/companies/${z.id}`);
      await page.request.delete(URLBASE + `/api/objects/companies/${z.id}/destroy`);
    },
  },
  {
    name: "palette-actions", feature: "Context actions in the command palette",
    async run(page) {
      // list context: create + trash actions
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
      await page.waitForSelector('[data-testid="palette-act-new"]');
      await page.click('[data-testid="palette-act-new"]');
      await page.waitForSelector('[role="dialog"]:has-text("New company")', { timeout: 6000 });
      assert(true, "palette 'New company' opens the create dialog");
      await page.keyboard.press("Escape");
      await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 6000 });
      // record context: favorite toggle
      await page.click('.nxRowLink:has-text("Brightline Analytics")');
      await page.waitForSelector('[data-testid="peek-panel"]');
      await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
      await page.waitForSelector('[data-testid="palette-act-fav"]');
      await page.click('[data-testid="palette-act-fav"]');
      await page.waitForSelector('[data-testid="fav-shelf"]');
      const shelf = await page.textContent('[data-testid="fav-shelf"]');
      assert(shelf?.includes("Brightline"), "palette favorite pins the record in view");
      // unpin round trip via the record's own star (palette add is already proven)
      await page.click('[data-testid="fav-toggle"]');
      await page.waitForFunction(() => !document.querySelector('[data-testid="fav-shelf"]'));
      await page.keyboard.press("Escape");
    },
  },
  {
    name: "trash-restore-destroy", feature: "Trash (soft delete, restore, permanent destroy)",
    async run(page) {
      const mk = await page.request.post(URLBASE + "/api/objects/companies", {
        data: { name: "Trashable Co", industry: "Software" },
      });
      const row = await mk.json();
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="list-search"]');
      await page.fill('[data-testid="list-search"]', "Trashable");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1);
      await page.click('tbody tr:first-child [role="checkbox"]');
      await page.click('[data-testid="bulk-delete"]');
      await page.waitForSelector('[data-testid="bulk-confirm"]');
      await page.click('[data-testid="bulk-confirm-go"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 0);
      assert(true, "deleted row leaves the live list");
      // trash dialog: the row is RECOVERABLE
      await page.click('[data-testid="trash-open"]');
      await page.waitForSelector(`[data-testid="trash-row-${row.id}"]`);
      assert(true, "trash lists the deleted record");
      await page.click(`[data-testid="trash-restore-${row.id}"]`);
      await page.waitForFunction((rid) => !document.querySelector(`[data-testid="trash-row-${rid}"]`), row.id);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1);
      const name = await page.textContent("tbody tr:first-child .nxRowLink");
      assert(name?.includes("Trashable Co"), "restore brings the record back intact");
      // destroy: gone from trash AND from the world
      await page.request.delete(URLBASE + `/api/objects/companies/${row.id}`);
      await page.click('[data-testid="trash-open"]');
      await page.waitForSelector(`[data-testid="trash-destroy-${row.id}"]`);
      await page.click(`[data-testid="trash-destroy-${row.id}"]`);
      await page.waitForSelector('[data-testid="trash-empty-state"]', { timeout: 6000 }).catch(() => {});
      const gone = await page.locator(`[data-testid="trash-row-${row.id}"]`).count();
      assert(gone === 0, "destroy removes the record from the trash permanently");
      await page.keyboard.press("Escape");
      const after = await (await page.request.get(URLBASE + `/api/objects/companies/${row.id}`)).status();
      assert(after === 404, "destroyed record 404s");
      await page.fill('[data-testid="list-search"]', "");
    },
  },
  {
    name: "unique-resurrect", feature: "Unique collision restores the trashed twin (upsert semantic)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "4905", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:4905";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        // live collision still rejects
        const dup = await page.request.post(B + "/api/objects/vendors", { data: { name: "Copycat", code: "V-001" } });
        assert(dup.status() === 400, "unique collision with a LIVE row still 400s");
        // trash V-001, then re-create the same code → the trashed row comes back with the new data
        const trash = await page.request.delete(B + "/api/objects/vendors/ve_1");
        assert(trash.ok(), "trash the unique holder");
        const re = await page.request.post(B + "/api/objects/vendors", { data: { name: "Brightline Reborn", code: "V-001" } });
        assert(re.status() === 200, `resurrect answers 200, not 201 (${re.status()})`);
        const body = await re.json();
        assert(body.id === "ve_1" && body._resurrected === true, "SAME record id returns, flagged _resurrected");
        assert(body.name === "Brightline Reborn", "incoming data lands on the resurrected row");
        const trashLeft = await (await page.request.get(B + "/api/objects/vendors/trash")).json();
        assert(!trashLeft.rows.some((r) => r.id === "ve_1"), "resurrected row left the trash");
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "merge-records", feature: "Merge duplicates (winner priority, relations re-pointed)",
    async run(page) {
      const a = await (await page.request.post(URLBASE + "/api/objects/companies", { data: { name: "Mergeling A", industry: "Software" } })).json();
      const b = await (await page.request.post(URLBASE + "/api/objects/companies", { data: { name: "Mergeling B", industry: "Software", domain: "mergeling-b.example" } })).json();
      const pat = await (await page.request.post(URLBASE + "/api/objects/people", { data: { name: "Merge Pat", email: "pat@merge.test", role: "Tester", company: "Mergeling B" } })).json();
      try {
        await page.goto(URLBASE + "/#/o/companies");
        await page.waitForSelector('[data-testid="list-search"]');
        await page.fill('[data-testid="list-search"]', "Mergeling");
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 2);
        await page.click('tbody tr:nth-child(1) [role="checkbox"]');
        await page.click('tbody tr:nth-child(2) [role="checkbox"]');
        await page.waitForSelector('[data-testid="bulk-merge"]');
        await page.click('[data-testid="bulk-merge"]');
        await page.waitForSelector('[data-testid="merge-dialog"]');
        // pick A as the winner; the preview must show B's website flowing in
        await page.click(`[data-testid="merge-winner-${a.id}"]`);
        await page.waitForSelector('[data-testid="merge-final-domain"]');
        const site = await page.textContent('[data-testid="merge-final-domain"]');
        assert(site?.includes("mergeling-b.example"), "preview: winner's empty domain fills from the loser");
        const badge = await page.textContent('[data-testid="merge-preview"]');
        assert(badge?.includes("from Mergeling B"), "preview labels WHERE each inherited value comes from");
        await page.click('[data-testid="merge-go"]');
        await page.waitForSelector('[data-testid="toast"]');
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 1);
        assert(true, "one survivor remains in the live list");
        const survivor = await (await page.request.get(URLBASE + `/api/objects/companies/${a.id}`)).json();
        assert(survivor.domain === "mergeling-b.example", "winner absorbed the loser's field");
        const patAfter = await (await page.request.get(URLBASE + `/api/objects/people/${pat.id}`)).json();
        assert(patAfter.company === "Mergeling A", `relations re-point to the winner (${patAfter.company})`);
        const trashRows = await (await page.request.get(URLBASE + "/api/objects/companies/trash")).json();
        assert(trashRows.rows.some((r) => r.id === b.id), "loser lands in the trash, not the void");
      } finally {
        await page.request.delete(URLBASE + `/api/objects/people/${pat.id}`);
        await page.request.delete(URLBASE + `/api/objects/people/${pat.id}/destroy`);
        await page.request.delete(URLBASE + `/api/objects/companies/${a.id}`);
        await page.request.delete(URLBASE + `/api/objects/companies/${a.id}/destroy`);
        await page.request.delete(URLBASE + `/api/objects/companies/${b.id}/destroy`);
        await page.fill('[data-testid="list-search"]', "").catch(() => {});
      }
    },
  },
  {
    name: "favorites-shelf", feature: "Favorites (personal pin shelf)",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="table-companies"] tbody tr');
      await page.click("tbody tr:first-child .nxRowLink");
      await page.waitForSelector('[data-testid="fav-toggle"]');
      const title = (await page.textContent('[data-testid="record-name"]'))?.trim();
      await page.click('[data-testid="fav-toggle"]');
      await page.waitForSelector('[data-testid="fav-shelf"]');
      const shelf = await page.textContent('[data-testid="fav-shelf"]');
      assert(shelf?.includes(title ?? "∅"), `sidebar shelf lists the pinned record (${title})`);
      // jump from anywhere back to the record via the shelf
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector('[data-testid="fav-shelf"] button');
      await page.click('[data-testid="fav-shelf"] button');
      await page.waitForSelector('[data-testid="fav-toggle"]');
      const back = (await page.textContent('[data-testid="record-name"]'))?.trim();
      assert(back === title, "shelf link deep-links back to the record");
      await page.click('[data-testid="fav-toggle"]');
      await page.waitForFunction(() => !document.querySelector('[data-testid="fav-shelf"]'));
      assert(true, "unpinning clears the shelf");
    },
  },
  {
    name: "trash-permission-split", feature: "Destroy is a separate grant (delete ≠ destroy)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env, PORT: "4910", AUTH_MODE: "accounts",
          APP_SECRET: "journey-secret-16-chars-plus", CONFIG_PATH: "journeys/fixtures/perms.config.json",
        },
      });
      const B = "http://localhost:4910";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        // separate CONTEXTS — sessions are cookies; two pages in one context share them
        const ctxE = await page.context().browser().newContext();
        const ctxD = await page.context().browser().newContext();
        // erin: owner (creates a team) — full lifecycle
        const pe = await ctxE.newPage();
        await pe.request.post(B + "/api/auth/signup", { data: { email: "erin@fixture.example", name: "Erin", password: "owner-pass-1234" } });
        await pe.request.post(B + "/api/teams", { data: { name: "Ops" } });
        // dana: invited as ADMIN → delete yes, destroy NO (not granted to admin)
        const pd = await ctxD.newPage();
        await pd.request.post(B + "/api/auth/signup", { data: { email: "dana@fixture.example", name: "Dana", password: "admin-pass-1234" } });
        await pe.request.post(B + "/api/teams/ops/invites", { data: { email: "dana@fixture.example", role: "admin" } });
        const outbox = await (await pe.request.get(B + "/api/outbox")).json();
        const invite = outbox.mail.find((m) => m.to === "dana@fixture.example" && m.kind === "team-invite");
        const token = invite.text.match(/Token:\n([^\n]+)/)?.[1];
        const acc = await pd.request.post(B + "/api/teams/accept", { data: { token } });
        assert(acc.ok(), "dana accepts the admin invite");
        // erin trashes a seeded row
        const del = await pe.request.delete(B + "/api/objects/accounts/ac_1");
        assert(del.ok(), "owner trashes a record");
        // dana (admin): restore allowed (rides delete), destroy DENIED
        const destroyTry = await pd.request.delete(B + "/api/objects/accounts/ac_1/destroy");
        assert(destroyTry.status() === 403, `admin cannot destroy (${destroyTry.status()})`);
        await pd.goto(B + "/#/o/accounts");
        await pd.waitForSelector('[data-testid="trash-open"]');
        await pd.click('[data-testid="trash-open"]');
        await pd.waitForSelector('[data-testid="trash-restore-ac_1"]');
        assert((await pd.locator('[data-testid="trash-destroy-ac_1"]').count()) === 0, "admin UI hides the destroy button");
        // owner: destroy visible AND effective
        await pe.goto(B + "/#/o/accounts");
        await pe.waitForSelector('[data-testid="trash-open"]');
        await pe.click('[data-testid="trash-open"]');
        await pe.waitForSelector('[data-testid="trash-destroy-ac_1"]');
        await pe.click('[data-testid="trash-destroy-ac_1"]');
        await pe.waitForFunction(() => !document.querySelector('[data-testid="trash-row-ac_1"]'));
        assert(true, "owner destroys permanently");
        await ctxE.close();
        await ctxD.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "trash-retention", feature: "Trash retention sweep (TRASH_RETENTION_DAYS)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        // ~1.7s retention, sweep cadence clamps to 1s — journey-fast, same code path as 30 days
        env: { ...process.env, PORT: "4915", CONFIG_PATH: "journeys/fixtures/coverage.config.json", TRASH_RETENTION_DAYS: "0.00002" },
      });
      const B = "http://localhost:4915";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const row = await (await page.request.post(B + "/api/objects/companies", { data: { name: "Expiring Co" } })).json();
        await page.request.delete(B + "/api/objects/companies/" + row.id);
        const t0 = await (await page.request.get(B + "/api/objects/companies/trash")).json();
        assert(t0.rows.some((r) => r.id === row.id), "trashed row sits in the trash");
        let sweptAway = false;
        for (let i = 0; i < 30; i++) {
          const t = await (await page.request.get(B + "/api/objects/companies/trash")).json();
          if (!t.rows.some((r) => r.id === row.id)) { sweptAway = true; break; }
          await new Promise((r) => setTimeout(r, 500));
        }
        assert(sweptAway, "retention sweep destroys expired trash on its own");
        const jobs = await (await page.request.get(B + "/api/jobs")).json();
        assert(jobs.jobs.some((j) => j.type === "trash-sweep" && j.status === "done"), "the sweep ran as a visible job");
      } finally {
        proc.kill();
      }
    },
  },
  // --- lane: import-apikeys
  {
    name: "import-wizard", feature: "CSV import wizard",
    async run(page) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForFunction(() => /^\d+$/.test(document.querySelector('[data-testid="row-count"]')?.textContent ?? ""));
      const before = Number(await page.textContent('[data-testid="row-count"]'));
      await page.click('[data-testid="import-open"]');
      await page.waitForSelector('[data-testid="import-text"]');
      // "Company Title" deliberately matches no field → exercises manual mapping;
      // the quoted first value exercises commas inside quotes
      const csv = [
        "Company Title,domain,industry,city",
        '"Import Alpha, Inc",alpha.example,Software,Ghent',
        "Import Beta,beta.example,Logistics,Liège",
        "Import Gamma,gamma.example,Software,Namur",
        "Import Delta,delta.example,Retail,Bruges",
        "Import Epsilon,eps.example,Software,Leuven",
      ].join("\n");
      await page.fill('[data-testid="import-text"]', csv);
      await page.click('[data-testid="import-next"]');
      await page.waitForSelector('[data-testid="import-map-0"]');
      const autoMapped = await page.inputValue('[data-testid="import-map-1"]');
      assert(autoMapped === "domain", `matching headers auto-map (domain → ${autoMapped})`);
      assert(await page.locator('[data-testid="import-next"]').isDisabled(),
        "Next is blocked while the primary field is unmapped");
      await page.selectOption('[data-testid="import-map-0"]', "name");
      await page.click('[data-testid="import-next"]');
      await page.waitForSelector('[data-testid="import-preview"]');
      const prev = await page.textContent('[data-testid="import-preview"]');
      assert((prev?.match(/created/g) ?? []).length === 5, "preview verdicts all 5 rows as created");
      await page.click('[data-testid="import-run"]');
      await page.waitForSelector('[data-testid="import-summary"]');
      const sum = await page.textContent('[data-testid="import-summary"]');
      assert(sum?.includes("5 created"), `summary shows 5 created (${sum})`);
      await page.click('[data-testid="import-close"]');
      await page.waitForFunction((b) => Number(document.querySelector('[data-testid="row-count"]')?.textContent) === b + 5, before);
      assert(true, `list count rose by 5 (${before} → ${before + 5})`);
      // CLEAN UP: destroy the five imported companies
      const rows = (await (await page.request.get(URLBASE + "/api/objects/companies")).json()).rows;
      for (const nm of ["Import Alpha, Inc", "Import Beta", "Import Gamma", "Import Delta", "Import Epsilon"]) {
        const r = rows.find((x) => x.name === nm);
        assert(!!r, `imported row exists server-side (${nm})`);
        await page.request.delete(URLBASE + `/api/objects/companies/${r.id}`);
        await page.request.delete(URLBASE + `/api/objects/companies/${r.id}/destroy`);
      }
      const after = (await (await page.request.get(URLBASE + "/api/objects/companies")).json()).rows.length;
      assert(after === before, `seed state restored (${after} rows)`);
    },
  },
  {
    name: "import-dedupe-restore", feature: "CSV import wizard",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "5100", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:5100";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        // trash the seeded unique holder (code V-001), then import that code + a fresh one
        await p2.request.delete(B + "/api/objects/vendors/ve_1");
        await p2.goto(B + "/#/o/vendors");
        await p2.click('[data-testid="import-open"]');
        await p2.waitForSelector('[data-testid="import-text"]');
        await p2.fill('[data-testid="import-text"]',
          "name,Vendor code\nBrightline Reborn Import,V-001\nImport Fresh Vendor,V-999\nImport Dup Vendor,V-999");
        await p2.click('[data-testid="import-next"]');
        await p2.waitForSelector('[data-testid="import-map-0"]');
        const codeMap = await p2.inputValue('[data-testid="import-map-1"]');
        assert(codeMap === "code", `label-based auto-map works ("Vendor code" → ${codeMap})`);
        await p2.click('[data-testid="import-next"]');
        await p2.waitForSelector('[data-testid="import-preview"]');
        const prev = await p2.textContent('[data-testid="import-preview"]');
        assert(prev?.includes("restored") && prev?.includes("created"),
          "preview already shows the restore-vs-create split");
        assert(prev?.includes("duplicate within this file"),
          "preview flags the in-file duplicate WITHOUT mutating (same verdict as the run)");
        await p2.click('[data-testid="import-run"]');
        await p2.waitForSelector('[data-testid="import-summary"]');
        const sum = await p2.textContent('[data-testid="import-summary"]');
        assert(sum?.includes("1 created") && sum?.includes("1 restored") && sum?.includes("1 skipped"),
          `summary shows 1 restored, 1 created, 1 skipped (${sum})`);
        // the restored row carries the CSV's data under its ORIGINAL id
        const v1 = await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        assert(v1.name === "Brightline Reborn Import" && v1.code === "V-001",
          "restored row keeps id ve_1 and carries the CSV's data");
        const rows = (await (await p2.request.get(B + "/api/objects/vendors")).json()).rows;
        const v999 = rows.filter((r) => r.code === "V-999");
        assert(v999.length === 1 && v999[0].id !== "ve_1", `fresh code created exactly ONE new row (${v999[0]?.id})`);
        const trashLeft = await (await p2.request.get(B + "/api/objects/vendors/trash")).json();
        assert(!trashLeft.rows.some((r) => r.id === "ve_1"), "restored row left the trash");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "import-errors", feature: "CSV import wizard",
    async run(page) {
      await page.goto(URLBASE + "/#/o/people");
      await page.waitForSelector('[data-testid="import-open"]');
      await page.click('[data-testid="import-open"]');
      await page.waitForSelector('[data-testid="import-text"]');
      await page.fill('[data-testid="import-text"]', [
        "name,email,role",
        "Import Valid Person,valid@import.test,Tester",
        "Import Broken Person,not-an-email,Tester",
        ",missing@import.test,Tester",
      ].join("\n"));
      await page.click('[data-testid="import-next"]');
      await page.waitForSelector('[data-testid="import-map-0"]');
      await page.click('[data-testid="import-next"]'); // headers all auto-map
      await page.waitForSelector('[data-testid="import-preview"]');
      const prev = await page.textContent('[data-testid="import-preview"]');
      assert(prev?.includes("valid email"), "preview surfaces the validator's reason on the bad row");
      await page.click('[data-testid="import-run"]');
      await page.waitForSelector('[data-testid="import-summary"]');
      const sum = await page.textContent('[data-testid="import-summary"]');
      assert(sum?.includes("1 created") && sum?.includes("2 failed"), `summary shows 1 created · 2 failed (${sum})`);
      // failed rows download as a CSV carrying the reason per row
      const dl = page.waitForEvent("download", { timeout: 8000 });
      await page.click('[data-testid="import-failed-csv"]');
      const file = await dl;
      const text = readFileSync(await file.path(), "utf8");
      assert(text.split("\n")[0].includes("reason"), "failed-rows CSV has a reason column");
      assert(text.includes("valid email"), "…and carries the per-row failure reason");
      assert(text.includes("not-an-email"), "…next to the original row data");
      await page.click('[data-testid="import-close"]');
      // CLEAN UP: destroy the one created person
      const rows = (await (await page.request.get(URLBASE + "/api/objects/people")).json()).rows;
      const mine = rows.find((r) => r.name === "Import Valid Person");
      assert(!!mine, "created person exists server-side");
      await page.request.delete(URLBASE + `/api/objects/people/${mine.id}`);
      await page.request.delete(URLBASE + `/api/objects/people/${mine.id}/destroy`);
    },
  },
  {
    name: "apikey-scoping", feature: "API keys (role-scoped access)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: {
          ...process.env, PORT: "5110", AUTH_MODE: "accounts",
          APP_SECRET: "journey-secret-16-chars-plus", CONFIG_PATH: "journeys/fixtures/apikeys.config.json",
        },
      });
      const B = "http://localhost:5110";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        // owner drives the UI (signup + team → role owner)
        const ctxO = await page.context().browser().newContext();
        const pO = await ctxO.newPage();
        await pO.request.post(B + "/api/auth/signup", { data: { email: "odette@fixture.example", name: "Odette", password: "owner-pass-1234" } });
        await pO.request.post(B + "/api/teams", { data: { name: "Ops" } });
        await pO.goto(B + "/#/p/apikeys");
        await pO.waitForSelector('[data-testid="apikey-name"]');
        await pO.fill('[data-testid="apikey-name"]', "Reporting bot");
        await pO.selectOption('[data-testid="apikey-role"]', "viewer");
        await pO.click('[data-testid="apikey-create"]');
        await pO.waitForSelector('[data-testid="apikey-secret"]');
        const secret = (await pO.textContent('[data-testid="apikey-secret"]')).trim();
        assert(secret.startsWith("nak_") && secret.length === 36, "full key is shown once at creation");
        // key calls come from a COOKIE-LESS context — the key alone authenticates
        const ctxK = await page.context().browser().newContext();
        const pk = await ctxK.newPage();
        const bare = await pk.request.get(B + "/api/objects/records");
        assert(bare.status() === 401, "no session + no key → 401");
        const read = await pk.request.get(B + "/api/objects/records", { headers: { "x-api-key": secret } });
        assert(read.status() === 200 && (await read.json()).rows.length === 2, "viewer key reads the rows");
        const bearer = await pk.request.get(B + "/api/objects/records", { headers: { authorization: `Bearer ${secret}` } });
        assert(bearer.status() === 200, "Authorization: Bearer form resolves too");
        const patchTry = await pk.request.patch(B + "/api/objects/records/rc_1", {
          headers: { "x-api-key": secret }, data: { name: "Hacked" },
        });
        assert(patchTry.status() === 403, "the same key cannot PATCH (role scoping)");
        // team-scoped objects refuse key callers — keys carry no membership
        const scopedTry = await pk.request.get(B + "/api/objects/projects", {
          headers: { "x-api-key": secret, "x-nx-team": "ops" },
        });
        assert(scopedTry.status() === 403, "team-scoped objects refuse api-key callers");
        // revoke in the UI (confirm dialog) → the same read dies with 401
        const keyId = (await (await pO.request.get(B + "/api/apikeys")).json()).keys[0].id;
        await pO.click(`[data-testid="apikey-revoke-${keyId}"]`);
        await pO.waitForSelector('[data-testid="apikey-revoke-confirm"]');
        await pO.click('[data-testid="apikey-revoke-confirm"]');
        await pO.waitForFunction((id) =>
          document.querySelector(`[data-testid="apikey-row-${id}"]`)?.textContent?.includes("revoked"), keyId);
        assert(true, "the key row flips to revoked in the list");
        const dead = await pk.request.get(B + "/api/objects/records", { headers: { "x-api-key": secret } });
        assert(dead.status() === 401, "the revoked key answers 401");
        await ctxO.close();
        await ctxK.close();
      } finally {
        proc.kill();
      }
    },
  },
  // --- lane: field-composites
  {
    name: "composite-render", feature: "Composite fields render (money/emails/phones/links/address/fullName)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "5050", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:5050";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/#/o/vendors");
        await p2.waitForSelector('[data-testid="table-vendors"] tbody tr');
        const money = await p2.textContent('[data-testid="cell-ve_1-contract"]');
        assert(money === "€12,500", `money cell renders Intl currency (${money})`);
        const mails = await p2.textContent('[data-testid="cell-ve_1-contacts"]');
        assert(mails?.includes("ada.reyes@brightline.example") && mails?.includes("+1"), `emails cell shows first chip + overflow (${mails})`);
        const phones = await p2.textContent('[data-testid="cell-ve_2-phoneNumbers"]');
        assert(phones?.includes("+1 415 555 0199") && phones?.includes("+1"), `phones cell shows first chip + overflow (${phones})`);
        const linkText = await p2.textContent('[data-testid="cell-ve_1-sites-link-0"]');
        assert(linkText === "brightline.example", `link anchor labels with the bare host (${linkText})`);
        const linkHref = await p2.getAttribute('[data-testid="cell-ve_1-sites-link-0"]', "href");
        const linkTarget = await p2.getAttribute('[data-testid="cell-ve_1-sites-link-0"]', "target");
        assert(linkHref === "https://brightline.example/pricing?plans=gold,silver" && linkTarget === "_blank", "anchor keeps the full URL and opens a new tab");
        const addr = await p2.textContent('[data-testid="cell-ve_1-hq"]');
        assert(addr === "Rue de la Loi 12, Brussels", `address cell one-lines street, city (${addr})`);
        const fn = await p2.textContent('[data-testid="cell-ve_1-accountManager"]');
        assert(fn === "Nora Lindqvist", `fullName cell joins first + last (${fn})`);
        // fullName as PRIMARY: table link, record title, kanban card all render the joined name
        await p2.goto(B + "/#/o/reps");
        await p2.waitForSelector('[data-testid="table-reps"] tbody tr');
        const repLink = await p2.textContent('[data-testid="row-re_1"] .nxRowLink');
        assert(repLink === "Nora Lindqvist", `fullName-primary renders as the row link (${repLink})`);
        await p2.click('[data-testid="row-re_1"] .nxRowLink');
        await p2.waitForSelector('[data-testid="record-name"]');
        const title = (await p2.textContent('[data-testid="record-name"]'))?.trim();
        assert(title === "Nora Lindqvist", `record title joins the name (${title})`);
        // the record opened as a side-peek OVER the list — Escape closes it (laddered model)
        await p2.keyboard.press("Escape");
        await p2.waitForFunction(() => !document.querySelector('[data-testid="peek-panel"]'));
        await p2.waitForSelector('[data-testid="view-switch"]');
        await p2.click('[data-testid="view-switch"] button:has-text("Board")');
        await p2.waitForSelector('[data-testid="kanban-reps"]');
        const card = await p2.textContent('[data-testid="card-re_1"]');
        assert(card?.includes("Nora Lindqvist"), "kanban card titles the joined name");
        assert(card?.includes("€250,000"), `kanban card meta formats money (${card})`);
        // money is MEASURABLE: sum rollup over a money field aggregates its .amount
        const pickItem = async (trigger, locator) => {
          await p2.click(trigger);
          await locator.waitFor();
          for (let i = 0; i < 12; i++) {
            if ((await locator.getAttribute("data-highlighted")) !== null) break;
            await p2.keyboard.press("ArrowDown");
            await p2.waitForTimeout(70);
          }
          await p2.keyboard.press("Enter");
        };
        await pickItem('[data-testid="agg-by"]', p2.locator('[data-testid="agg-sum-quota"]'));
        await p2.keyboard.press("Escape");
        await p2.waitForFunction(() => document.querySelector('[data-testid="agg-EMEA"]')?.dataset.value === "250000");
        assert(true, "money field sums per column (EMEA Σ=250000 from {amount:250000})");
        await p2.screenshot({ path: path.join(SHOTS, "journey-composite-cells.png"), fullPage: true });
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "composite-edit", feature: "Composite field editors (one-patch shaped saves)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "5055", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:5055";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        const api = async () => await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        const until = async (pred, label) => {
          for (let i = 0; i < 25; i++) {
            if (pred(await api())) return;
            await new Promise((r) => setTimeout(r, 200));
          }
          assert(false, label);
        };
        await p2.goto(B + "/#/o/vendors/r/ve_1");
        await p2.waitForSelector('[data-testid="field-contacts-input"]');
        // add an email entry
        await p2.fill('[data-testid="field-contacts-input"]', "nora.lindqvist@brightline.example");
        await p2.keyboard.press("Enter");
        await p2.waitForFunction(() =>
          [...document.querySelectorAll('[data-testid="toast"]')].some((t) => t.textContent?.includes("Saved")),
        );
        assert(true, "adding an email saves (toast)");
        await until((r) => (r.contacts ?? []).includes("nora.lindqvist@brightline.example"), "new email persisted to the list");
        // change the money amount (code rides along in the SAME patch)
        await p2.fill('[data-testid="field-contract-amount"]', "13750");
        await p2.locator('[data-testid="field-contract-amount"]').blur();
        await until((r) => r.contract?.amount === 13750 && r.contract?.code === "EUR", "money amount updated, code preserved (one patch)");
        // set the address city (street survives — whole object in one patch)
        await p2.fill('[data-testid="field-hq-city"]', "Ghent");
        await p2.locator('[data-testid="field-hq-city"]').blur();
        await until((r) => r.hq?.city === "Ghent" && r.hq?.street === "Rue de la Loi 12", "address city updated, street preserved");
        // change the last name
        await p2.fill('[data-testid="field-accountManager-last"]', "Nyberg");
        await p2.locator('[data-testid="field-accountManager-last"]').blur();
        await until((r) => r.accountManager?.first === "Nora" && r.accountManager?.last === "Nyberg", "last name updated, first preserved");
        // edits survive reload — the editors re-seed from the stored shapes
        await p2.reload();
        await p2.waitForSelector('[data-testid="field-contract-amount"]');
        assert((await p2.inputValue('[data-testid="field-contract-amount"]')) === "13750", "amount survives reload");
        assert((await p2.inputValue('[data-testid="field-hq-city"]')) === "Ghent", "city survives reload");
        assert((await p2.inputValue('[data-testid="field-accountManager-last"]')) === "Nyberg", "last name survives reload");
        const rows3 = await p2.textContent('[data-testid="field-contacts"]');
        assert(rows3?.includes("nora.lindqvist@brightline.example"), "added email row survives reload");
        // timeline logs READABLE shaped values, never [object Object]
        const tl = await p2.textContent('[data-testid="timeline"]');
        assert(tl?.includes("13750 EUR"), "timeline logs the money change readably");
        assert(tl?.includes("Ghent"), "timeline logs the address change readably");
        assert(tl?.includes("Nora Nyberg"), "timeline logs the name change readably");
        assert(!tl?.includes("[object Object]"), "no [object Object] anywhere in the timeline");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "composite-validate", feature: "Composite validation (per-entry, field-named)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        // 5060/5061 are Chromium-restricted (SIP) — ERR_UNSAFE_PORT — so this lane skips to 5070
        env: { ...process.env, PORT: "5070", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:5070";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/#/o/vendors/r/ve_1");
        await p2.waitForSelector('[data-testid="field-contacts-input"]');
        // bad email: VISIBLE inline error naming the field; value not saved
        await p2.fill('[data-testid="field-contacts-input"]', "not-an-email");
        await p2.keyboard.press("Enter");
        await p2.waitForSelector('[data-testid="field-contacts-err"]');
        const emailErr = await p2.textContent('[data-testid="field-contacts-err"]');
        assert(emailErr?.includes("Contact emails") && emailErr?.includes("not-an-email"), `error names the field and the entry (${emailErr})`);
        let live = await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        assert((live.contacts ?? []).length === 2 && !live.contacts.includes("not-an-email"), "record keeps its old email list");
        // bad URL in the links editor
        await p2.fill('[data-testid="field-sites-input"]', "not a url");
        await p2.keyboard.press("Enter");
        await p2.waitForSelector('[data-testid="field-sites-err"]');
        const urlErr = await p2.textContent('[data-testid="field-sites-err"]');
        assert(urlErr?.includes("Web presence"), `URL error names the field (${urlErr})`);
        live = await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        assert((live.sites ?? []).length === 2, "record keeps its old links");
        // bad currency code in the money editor
        await p2.fill('[data-testid="field-contract-code"]', "E1");
        await p2.locator('[data-testid="field-contract-code"]').blur();
        await p2.waitForSelector('[data-testid="field-contract-err"]');
        live = await (await p2.request.get(B + "/api/objects/vendors/ve_1")).json();
        assert(live.contract?.code === "EUR", "record keeps its old currency code");
        // the server is the real gate: wrong-shaped payloads 400 NAMING the field
        const badMoney = await p2.request.patch(B + "/api/objects/vendors/ve_1", { data: { contract: { amount: "12" } } });
        assert(badMoney.status() === 400 && (await badMoney.json()).error.includes("Contract value"), "server 400 names the money field on a wrong shape");
        const badMail = await p2.request.patch(B + "/api/objects/vendors/ve_1", { data: { contacts: ["nodot@nowhere"] } });
        assert(badMail.status() === 400 && (await badMail.json()).error.includes("Contact emails"), "server 400 names the emails field per entry");
        const badLink = await p2.request.patch(B + "/api/objects/vendors/ve_1", { data: { sites: ["not a url"] } });
        assert(badLink.status() === 400 && (await badLink.json()).error.includes("Web presence"), "server 400 names the links field per entry");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "composite-export", feature: "Composite CSV flatten (shaped values in exports)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "5065", CONFIG_PATH: "journeys/fixtures/depth.config.json" },
      });
      const B = "http://localhost:5065";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/#/o/vendors");
        await p2.waitForSelector('[data-testid="table-vendors"] tbody tr');
        await p2.click('[data-testid="row-ve_1"] [role="checkbox"]');
        await p2.click('[data-testid="row-ve_2"] [role="checkbox"]');
        await p2.waitForSelector('[data-testid="bulk-export"]');
        const dl = p2.waitForEvent("download", { timeout: 8000 });
        await p2.click('[data-testid="bulk-export"]');
        const file = await dl;
        const csv = readFileSync(await file.path(), "utf8");
        const lines = csv.split("\n");
        const header = lines[0].split(",");
        for (const k of ["contract", "contacts", "phoneNumbers", "sites", "hq", "accountManager"]) {
          assert(header.includes(k), `CSV header carries ${k}`);
        }
        assert(!header.includes("legacyRef"), "deactivated fields stay out of the export");
        assert(csv.includes('"12500 EUR"') && csv.includes('"4800 USD"'), "money flattens to amount + code");
        assert(csv.includes('"ada.reyes@brightline.example; billing@brightline.example"'), 'lists join with "; "');
        assert(csv.includes('"Rue de la Loi 12, Brussels, 1000, BE"'), "address flattens to all four parts");
        assert(csv.includes('"Nora Lindqvist"') && csv.includes('"Jules Okafor"'), "fullName flattens to the joined name");
        // a comma INSIDE a link must not split columns — quoted-cell count matches the header
        const ve1 = lines.find((l) => l.includes("Brightline Analytics"));
        assert(ve1?.includes("plans=gold,silver"), "comma-carrying URL is present in the row");
        const cells = ve1?.match(/"(?:[^"]|"")*"/g) ?? [];
        assert(cells.length === header.length, `quoted cells align with the header (${cells.length}/${header.length})`);
        const shapedIdx = ["contract", "contacts", "phoneNumbers", "sites", "hq", "accountManager"].map((k) => header.indexOf(k));
        assert(shapedIdx.every((i) => cells[i] && !cells[i].includes("[object Object]")), "every shaped column flattens cleanly");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  // --- lane: nav-mobile
  {
    name: "nav-top", feature: "Nav placement (config app.nav: top)",
    async run(page) {
      const { spawn } = await import("node:child_process");
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
        stdio: "ignore",
        env: { ...process.env, PORT: "5010", CONFIG_PATH: "journeys/fixtures/navtop.config.json" },
      });
      const B = "http://localhost:5010";
      try {
        for (let i = 0; i < 20; i++) {
          try { if ((await fetch(B + "/api/healthz", { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* boot */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext();
        const p2 = await ctx.newPage();
        await p2.goto(B + "/");
        await p2.waitForSelector('[data-testid="nav-top"]', { timeout: 8000 });
        assert(true, "app.nav: top renders the horizontal top-nav bar");
        assert((await p2.locator('[data-testid="nav"]').count()) === 0, "no sidebar renders in top mode");
        await p2.waitForFunction(() => /\d/.test(document.querySelector('[data-testid="nav-companies"]')?.textContent ?? ""));
        assert(true, "record counts are visible on the top-nav items");
        await p2.click('[data-testid="nav-deals"]');
        await p2.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
        assert(true, "clicking a top-nav item switches the list (page title changes)");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "mobile-drawer", feature: "Mobile nav drawer + full-screen peek",
    async run(page) {
      const noHScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await page.goto(URLBASE + "/#/o/companies");
        await page.waitForSelector('[data-testid="nav-burger"]');
        assert(await noHScroll(), "no horizontal page scroll on the table at 390px");
        await page.click('[data-testid="nav-burger"]');
        await page.waitForSelector('[data-testid="nav-drawer"]');
        assert(true, "burger opens the nav drawer");
        await page.click('[data-testid="drawer-nav-deals"]');
        await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
        await page.waitForSelector('[data-testid="nav-drawer"]', { state: "detached" });
        assert(true, "picking Deals in the drawer navigates and closes it");
        assert(await noHScroll(), "no horizontal page scroll on the kanban at 390px");
        await page.click('[data-testid="nav-burger"]');
        await page.waitForSelector('[data-testid="drawer-nav-companies"]');
        await page.click('[data-testid="drawer-nav-companies"]');
        await page.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Companies"));
        await page.waitForSelector('[data-testid="nav-drawer"]', { state: "detached" });
        await page.waitForSelector(".nxRowLink");
        await page.click("tbody tr:first-child .nxRowLink");
        await page.waitForSelector('[data-testid="peek-panel"]');
        // the panel slides in (peekIn, ~160ms) — wait for SETTLED geometry, then judge
        await page.waitForFunction(() => {
          const r = document.querySelector('[data-testid="peek-panel"]')?.getBoundingClientRect();
          return !!r && r.width >= window.innerWidth - 1 && r.left <= 1;
        });
        assert(true, "the peek covers the full viewport width at 390px");
        assert(await noHScroll(), "no horizontal page scroll with the peek open");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector('[data-testid="peek-panel"]'));
        assert(true, "Escape closes the full-screen peek");
        assert(await noHScroll(), "no horizontal page scroll after closing the peek");
      } finally {
        await page.setViewportSize({ width: 1280, height: 800 });
      }
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
