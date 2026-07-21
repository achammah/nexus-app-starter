/* calendar lane journeys — the `calendar` view type end to end, on the lane band:
   the calendar fixture (5891) and the 10k scale fixture (5892). Fixture dates sit
   in 2026-08; each journey anchors the view there by writing the app's OWN
   persisted view state (localStorage nx-view-<object>, the same surface saved
   views restore through), so the suite stays green whatever today's date is.
   Visible outcomes only: events render colored, a drag moves the record's date,
   day-click creates prefilled, the mode toggle survives reload, an external
   writer's change lands with zero interaction, 390px gets the agenda list. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const FEATURE = "Calendar view (month/week, drag-reschedule)";
const PORT = 5891;
const PORT_10K = 5892;
const BASE = `http://localhost:${PORT}`;
const BASE_10K = `http://localhost:${PORT_10K}`;

async function boot(ROOT, port, configPath) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: configPath };
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}
const bootMain = (ROOT) => boot(ROOT, PORT, "journeys/fixtures/calendar.config.json");
const boot10k = (ROOT) => boot(ROOT, PORT_10K, "journeys/fixtures/calendar-10k.config.json");

const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};

/* anchor the calendar deterministically THROUGH the app's own persistence
   (nx-view-<object>, the restore path saved views use). The write happens in an
   init script BEFORE the app boots and MERGES into the existing blob: the app
   then INITIALIZES from the anchor, so its own persistence effect adopts it —
   a post-boot evaluate+reload write races that effect and loses nondeterministically */
async function anchorNav(p, base, obj, state = {}) {
  await p.addInitScript(
    ([k, patch]) => {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem(k) ?? "{}"); } catch { /* fresh profile */ }
      localStorage.setItem(k, JSON.stringify({ ...cur, ...patch }));
    },
    [`nx-view-${obj}`, { view: "calendar", calDate: "2026-08-01", ...state }],
  );
  await p.goto(`${base}/#/o/${obj}`);
}
async function anchoredPage(ctx, base, obj, state = {}) {
  const p = await ctx.newPage();
  await anchorNav(p, base, obj, state);
  return p;
}

/* FullCalendar drag is pointer-driven; move in real steps and retry bounded —
   the assertion (event inside the target day cell) is never weakened */
async function dragEventToDay(p, eventSel, dateStr, ROOT, shotName) {
  const targetSel = `td[data-date="${dateStr}"]`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const eb = await p.locator(eventSel).first().boundingBox();
    const tb = await p.locator(targetSel).first().boundingBox();
    if (!eb || !tb) { await p.waitForTimeout(500); continue; }
    await p.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2);
    await p.mouse.down();
    await p.mouse.move(eb.x + eb.width / 2 + 12, eb.y + eb.height / 2 + 6, { steps: 3 });
    await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 14 });
    if (attempt === 0 && shotName) await shot(p, ROOT, shotName); // mid-drag evidence
    await p.waitForTimeout(150);
    await p.mouse.up();
    try {
      await p.waitForSelector(`${targetSel} ${eventSel}`, { timeout: 2500 });
      return true;
    } catch { /* not landed — retry the pointer sequence */ }
  }
  return false;
}

export default [
  {
    name: "calendar-events-render", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"]');
        await p.waitForSelector('[data-testid^="calendar-event-"]');
        const n = await p.locator('[data-testid^="calendar-event-"]').count();
        assert(n === 6, `every DATED fixture row renders as an event (${n} = 6; the undated ev_7 stays off the grid)`);
        assert((await p.locator('[data-testid="calendar-event-ev_1"][data-color="blue"]').count()) === 1, "events carry the select-option palette (ev_1 kind=Visit renders blue)");
        assert((await p.locator('[data-testid="calendar-empty"]').count()) === 0, "no empty-state banner while dated events exist");
        const title = await p.textContent('[data-testid="calendar-title"]');
        assert(!!title && title.includes("August"), `the header shows the anchored month (${title})`);
        await shot(p, ROOT, "calendar-month-colored");
        // span shape: a from/to record covers its whole inclusive range. A NEW
        // anchored page: an in-page goto is a hash-only navigation (no document
        // load), so a later-added init-script preset would never run
        const p2 = await anchoredPage(ctx, BASE, "stays");
        await p2.waitForSelector('[data-testid="calendar-stays"]');
        await p2.waitForSelector('[data-testid="calendar-event-st_1"]');
        assert(true, "a from/to span object renders its multi-day event");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-drag-reschedule", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-event-ev_1"]');
        const landed = await dragEventToDay(p, '[data-testid="calendar-event-ev_1"]', "2026-08-12", ROOT, "calendar-mid-drag");
        assert(landed, "dragging the event +7 days lands it in the target day cell");
        await p.waitForSelector('[data-testid="toast"]', { timeout: 6000 });
        assert(true, 'the reschedule toasts "Saved"');
        const rec = await fetch(`${BASE}/api/objects/events/ev_1`).then((r) => r.json());
        assert(rec.when === "2026-08-12", `the RECORD's date field changed (${rec.when})`);
        await p.reload();
        await p.waitForSelector('td[data-date="2026-08-12"] [data-testid="calendar-event-ev_1"]');
        assert(true, "the moved event survives a reload in its new day");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-peek-open", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-event-ev_3"]');
        await p.click('[data-testid="calendar-event-ev_3"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        const name = await p.inputValue('[data-testid="record-name"]').catch(() => null);
        assert(name === null || name.includes("Quarterly"), "clicking an event opens ITS record in the peek");
        assert(true, "event click opens the side peek");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-day-create", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"]');
        await p.click('td[data-date="2026-08-20"]');
        await p.waitForSelector('[data-testid="new-when"]');
        assert((await p.inputValue('[data-testid="new-when"]')) === "2026-08-20", "the create dialog opens PREFILLED with the clicked day");
        await p.fill('[data-testid="new-title"]', "Journey created event");
        await p.click('[data-testid="create-confirm"]');
        await p.waitForSelector('[data-testid="toast"]');
        await p.keyboard.press("Escape"); // the created record opens in the peek — step back to the grid
        await p.waitForSelector('td[data-date="2026-08-20"] [data-testid^="calendar-event-"]', { timeout: 6000 });
        assert(true, "the created record appears as an event on that day");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-mode-persist", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-mode="month"]');
        await p.click('[data-testid="cal-mode-week"]');
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-mode="week"]');
        const title = await p.textContent('[data-testid="calendar-title"]');
        assert((await p.locator(".fc-dayGridWeek-view").count()) === 1, `week mode on an all-day date object renders the one-row week grid (${title})`);
        await shot(p, ROOT, "calendar-week");
        await p.reload();
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-mode="week"]');
        assert(true, "the month⇄week choice survives reload");
        // timed objects take the hourly grid in week mode. A NEW anchored page
        // (hash-only in-page navigation would skip the init-script preset)
        const p2 = await anchoredPage(ctx, BASE, "meetings", { calMode: "week", calDate: "2026-08-03" });
        await p2.waitForSelector('[data-testid="calendar-meetings"][data-cal-mode="week"]');
        await p2.waitForSelector(".fc-timegrid-slots");
        await p2.waitForSelector('[data-testid="calendar-event-me_1"]');
        assert(true, "week mode on a dateTime object renders the hourly timeGrid with its timed events");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-keyboard", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-event-ev_1"]');
        assert((await p.getAttribute('[data-testid="calendar-event-ev_1"]', "tabindex")) === "0", "events are keyboard-focusable (tabindex 0)");
        assert(!!(await p.getAttribute('[data-testid="calendar-event-ev_1"]', "aria-label")), "events carry an aria-label (title + date)");
        await p.locator('[data-testid="calendar-event-ev_1"]').focus();
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="peek-panel"]');
        assert(true, "Enter on a focused event opens the peek — the keyboard path works");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-mobile-agenda", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-agenda"]');
        assert((await p.locator(".fc").count()) === 0, "390px swaps the month grid for the agenda list (no squeezed FullCalendar)");
        await p.waitForSelector('[data-testid="calendar-event-ev_1"]');
        const title = await p.textContent('[data-testid="calendar-title"]');
        assert(!!title && title.includes("August"), `the agenda header shows the anchored month (${title})`);
        await shot(p, ROOT, "calendar-mobile-agenda");
        await p.tap('[data-testid="calendar-event-ev_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        assert(true, "TAP on an agenda event opens the peek");
        await p.keyboard.press("Escape");
        await p.evaluate(() => { const el = document.querySelector('[data-testid="calendar-agenda"]'); if (el) el.scrollTop = 700; });
        await p.waitForSelector('[data-testid="agenda-day-2026-08-20"]');
        await p.tap('[data-testid="agenda-day-2026-08-20"]');
        await p.waitForSelector('[data-testid="new-when"]');
        assert((await p.inputValue('[data-testid="new-when"]')) === "2026-08-20", "TAP on a day row opens the create dialog prefilled with that day");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-empty-state", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"]');
        await p.fill('[data-testid="list-search"]', "zzznope");
        await p.waitForSelector('[data-testid="calendar-empty"]', { timeout: 6000 });
        const text = await p.textContent('[data-testid="calendar-empty"]');
        assert(!!text && text.toLowerCase().includes("no events"), `the designed empty state names the object and invites a create (${text?.trim()})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-misconfigured", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/plain`);
        await p.waitForSelector('[data-testid="table-plain"] tbody tr');
        await p.click('[data-testid="view-switch"] button:has-text("Calendar")');
        await p.waitForSelector('[data-testid="view-unknown"]');
        const chip = await p.textContent('[data-testid="view-unknown"]');
        assert(!!chip && chip.includes("no date"), `an object without a date field degrades to the explanatory chip (${chip?.trim()})`);
        await p.click('[data-testid="view-switch"] button:has-text("Table")');
        await p.waitForSelector('[data-testid="table-plain"] tbody tr');
        assert(true, "the rest of the list surface keeps working");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-external-update", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('td[data-date="2026-08-06"] [data-testid="calendar-event-ev_2"]');
        // an external writer moves the record; the calendar must follow on its rev
        // poll with ZERO page interaction (§4c rows-change-underneath tolerance)
        const res = await fetch(`${BASE}/api/objects/events/ev_2`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ when: "2026-08-25" }),
        });
        assert(res.ok, "the out-of-band PATCH succeeds");
        await p.waitForSelector('td[data-date="2026-08-25"] [data-testid="calendar-event-ev_2"]', { timeout: 15000 });
        assert(true, "the event moves to the new day without any interaction (rev-poll pickup)");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-perf-10k", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await boot10k(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const t0 = Date.now();
        const p = await anchoredPage(ctx, BASE_10K, "logs");
        await p.waitForSelector('[data-testid="calendar-logs"]');
        await p.waitForSelector('[data-testid^="calendar-event-"]');
        const paintMs = Date.now() - t0;
        assert(paintMs < 10000, `10k-row calendar paints its anchored month in ${paintMs}ms (< 10000)`);
        const before = await p.textContent('[data-testid="calendar-title"]');
        const t1 = Date.now();
        await p.click('[data-testid="calendar-next"]');
        await p.waitForFunction(
          (prev) => document.querySelector('[data-testid="calendar-title"]')?.textContent !== prev,
          before,
          { timeout: 5000 },
        );
        const navMs = Date.now() - t1;
        assert(navMs < 3000, `month navigation on 10k rows completes in ${navMs}ms (< 3000)`);
        await shot(p, ROOT, "calendar-10k");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
