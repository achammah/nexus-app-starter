/* calendar depth-lane journeys — the full-fidelity `calendar` view end to end, on
   the lane band: the calendar fixture (5891) and the 10k scale fixture (5892).
   Fixture dates sit in 2026-08; each journey anchors the view there by writing the
   app's OWN persisted view state (localStorage nx-view-<object>, the same surface
   saved views restore through), so the suite stays green whatever today's date is.
   Visible outcomes only: events render colored, the picker switches + persists the
   view, a drag-select creates a prefilled range, a click opens the edit dialog and
   Save/Delete write through the store, an all-day toggle moves the event to the
   all-day lane, a recurring row expands, the timed-view options (week numbers, now
   line, business hours, slots) render, 390px gets the agenda + edit drawer. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const FEATURE = "Calendar view (full fidelity)";
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
   init script BEFORE the app boots and MERGES into the existing blob, so the app
   INITIALIZES from the anchor — a post-boot evaluate+reload write races the
   persistence effect and loses nondeterministically. A NEW anchored page per
   object: an in-page goto is a hash-only navigation (no document load), so a
   later-added init-script preset would never run. */
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

/* drag-select an inclusive day range in month/dayGrid — mousedown on the first
   day, move across, mouseup on the last; bounded retries, assertion never weakened */
async function dragSelectDays(p, startDate, endDate) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const sb = await p.locator(`td[data-date="${startDate}"]`).first().boundingBox();
    const eb = await p.locator(`td[data-date="${endDate}"]`).first().boundingBox();
    if (!sb || !eb) { await p.waitForTimeout(400); continue; }
    await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await p.mouse.down();
    await p.mouse.move(sb.x + sb.width / 2 + 8, sb.y + sb.height / 2, { steps: 3 });
    await p.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 12 });
    await p.waitForTimeout(120);
    await p.mouse.up();
    try {
      await p.waitForSelector('[data-testid="new-from"]', { timeout: 2500 });
      return true;
    } catch { /* selection didn't take — retry */ }
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
        const p2 = await anchoredPage(ctx, BASE, "stays");
        await p2.waitForSelector('[data-testid="calendar-stays"]');
        await p2.waitForSelector('[data-testid="calendar-event-st_1"]');
        assert(true, "a from/to span object renders its multi-day event");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-view-switch", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="month"]');
        // the picker offers every enabled view; each one renders its FC view type
        const views = [
          ["week", "fc-dayGridWeek-view"],
          ["day", "fc-dayGridDay-view"],
          ["listWeek", "fc-listWeek-view"],
          ["listMonth", "fc-listMonth-view"],
          ["year", "fc-multiMonthYear-view"],
          ["month", "fc-dayGridMonth-view"],
        ];
        for (const [v, cls] of views) {
          await p.click(`[data-testid="cal-view-${v}"]`);
          await p.waitForSelector(`[data-testid="calendar-events"][data-cal-view="${v}"]`);
          assert((await p.locator(`.${cls}`).count()) === 1, `picking "${v}" renders the ${cls} grid`);
        }
        // the choice persists across a reload
        await p.click('[data-testid="cal-view-year"]');
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="year"]');
        await shot(p, ROOT, "calendar-year");
        await p.reload();
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="year"]');
        assert(true, "the picked view survives a reload");
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
    name: "calendar-range-create", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        // stays has a from/to span → a drag-select prefills BOTH ends
        const p = await anchoredPage(ctx, BASE, "stays");
        await p.waitForSelector('[data-testid="calendar-stays"]');
        const selected = await dragSelectDays(p, "2026-08-18", "2026-08-20");
        assert(selected, "a 3-day drag-select opens the create dialog");
        assert((await p.inputValue('[data-testid="new-from"]')) === "2026-08-18", "the range start prefills the from field");
        assert((await p.inputValue('[data-testid="new-to"]')) === "2026-08-20", "the exclusive range end prefills the INCLUSIVE last day (the 20th, not the 21st)");
        await shot(p, ROOT, "calendar-range-create");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-edit-save", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-event-ev_3"]');
        await p.click('[data-testid="calendar-event-ev_3"]');
        await p.waitForSelector('[data-testid="calendar-edit"]');
        assert((await p.inputValue('[data-testid="edit-title"]')) === "Quarterly review", "the edit dialog opens prefilled with the event's title");
        await shot(p, ROOT, "calendar-edit-dialog");
        await p.fill('[data-testid="edit-title"]', "Quarterly review v2");
        await p.click('[data-testid="edit-save"]');
        await p.waitForSelector('[data-testid="calendar-edit"]', { state: "detached" });
        assert(true, "Save closes the dialog");
        const rec = await fetch(`${BASE}/api/objects/events/ev_3`).then((r) => r.json());
        assert(rec.title === "Quarterly review v2", `the record's title changed through the store (${rec.title})`);
        await p.waitForSelector('[data-testid="calendar-event-ev_3"]');
        // Open full record → the peek
        await p.click('[data-testid="calendar-event-ev_3"]');
        await p.waitForSelector('[data-testid="edit-open-record"]');
        await p.click('[data-testid="edit-open-record"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        assert(true, "Open full record opens the side peek");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-edit-delete", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-event-ev_5"]');
        await p.click('[data-testid="calendar-event-ev_5"]');
        await p.waitForSelector('[data-testid="edit-delete"]');
        await p.click('[data-testid="edit-delete"]');
        // the inline confirm is the review surface (no bare fire-button)
        await p.waitForSelector('[data-testid="edit-delete-confirm"]');
        await p.click('[data-testid="edit-delete-go"]');
        await p.waitForSelector('[data-testid="calendar-event-ev_5"]', { state: "detached", timeout: 6000 });
        assert(true, "the deleted event disappears from the grid");
        const rows = await fetch(`${BASE}/api/objects/events`).then((r) => r.json()).then((r) => r.rows);
        assert(!rows.some((row) => String(row.id) === "ev_5"), "the record is gone from the live list (soft-deleted to trash)");
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
        await p.click('td[data-date="2026-08-19"]');
        await p.waitForSelector('[data-testid="new-when"]');
        assert((await p.inputValue('[data-testid="new-when"]')) === "2026-08-19", "a single-day click opens the create dialog PREFILLED with the clicked day");
        await p.fill('[data-testid="new-title"]', "Journey created event");
        await p.click('[data-testid="create-confirm"]');
        await p.waitForSelector('[data-testid="toast"]');
        await p.keyboard.press("Escape");
        await p.waitForSelector('td[data-date="2026-08-19"] [data-testid^="calendar-event-"]', { timeout: 6000 });
        assert(true, "the created record appears as an event on that day");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-allday-toggle", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        // meetings is a dateTime object → the edit dialog shows an all-day toggle;
        // flipping it stores a date-only value → the event moves to the all-day lane
        const p = await anchoredPage(ctx, BASE, "meetings", { calView: "week", calDate: "2026-08-03" });
        await p.waitForSelector('[data-testid="calendar-meetings"][data-cal-view="week"]');
        await p.waitForSelector('[data-testid="calendar-event-me_1"]');
        await p.click('[data-testid="calendar-event-me_1"]');
        await p.waitForSelector('[data-testid="edit-allday"]');
        await p.check('[data-testid="edit-allday"]');
        await p.click('[data-testid="edit-save"]');
        await p.waitForSelector('[data-testid="calendar-edit"]', { state: "detached" });
        // in a timeGrid view the all-day lane is a mini day-grid: an all-day event
        // renders as a .fc-daygrid-event (a timed one is a .fc-timegrid-event), so the
        // class flip proves it moved out of the slots into the all-day lane
        await p.waitForSelector('[data-testid="calendar-event-me_1"].fc-daygrid-event', { timeout: 6000 });
        assert(true, "the toggled event moves from the time slots into the all-day lane");
        const rec = await fetch(`${BASE}/api/objects/meetings/me_1`).then((r) => r.json());
        assert(/^\d{4}-\d{2}-\d{2}$/.test(String(rec.at)), `the stored value became date-only (${rec.at})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-recurring", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        // me_r has FREQ=WEEKLY;BYDAY=MO from 2026-08-03 → a Monday every week
        const p = await anchoredPage(ctx, BASE, "meetings", { calView: "month", calDate: "2026-08-03" });
        await p.waitForSelector('[data-testid="calendar-meetings"][data-cal-view="month"]');
        await p.waitForSelector('[data-testid="calendar-event-me_r"]');
        const monthN = await p.locator('[data-testid="calendar-event-me_r"]').count();
        assert(monthN >= 4, `the recurring row expands to its weekly occurrences in month view (${monthN} ≥ 4)`);
        await shot(p, ROOT, "calendar-recurring-month");
        const p2 = await anchoredPage(ctx, BASE, "meetings", { calView: "week", calDate: "2026-08-03" });
        await p2.waitForSelector('[data-testid="calendar-meetings"][data-cal-view="week"]');
        await p2.waitForSelector('[data-testid="calendar-event-me_r"]');
        assert((await p2.locator('[data-testid="calendar-event-me_r"]').count()) >= 1, "the recurring occurrence also renders in week view");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-timed-options", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        // anchor at TODAY's week so the now line is in range; firstDay/slots/business
        // hours render regardless of events
        const today = new Date().toISOString().slice(0, 10);
        const p = await anchoredPage(ctx, BASE, "meetings", { calView: "week", calDate: today });
        await p.waitForSelector('[data-testid="calendar-meetings"][data-cal-view="week"]');
        await p.waitForSelector(".fc-timegrid-slots");
        const firstCol = await p.locator(".fc-col-header-cell").first().textContent();
        assert(!!firstCol && /Mon/i.test(firstCol), `firstDay=Monday puts Monday first (${firstCol?.trim()})`);
        const slotRows = await p.locator(".fc-timegrid-slots tr").count();
        assert(slotRows >= 40, `slotDuration=30m renders sub-hour slots (${slotRows} rows over the day)`);
        assert((await p.locator(".fc-non-business").count()) > 0, "business hours shade the non-business time");
        assert((await p.locator(".fc-timegrid-now-indicator-line").count()) >= 1, "the now indicator line renders for today");
        await shot(p, ROOT, "calendar-timed-options");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-week-numbers", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events");
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="month"]');
        assert((await p.locator(".fc-daygrid-week-number").count()) > 0, "weekNumbers renders the ISO week column in month view");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-list-view", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events", { calView: "listMonth" });
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="listMonth"]');
        await p.waitForSelector(".fc-listMonth-view");
        assert((await p.locator(".fc-list-day").count()) > 0, "the list groups events under day headers");
        const rows = await p.locator(".fc-list-event").count();
        assert(rows >= 5, `the month's events list as rows (${rows} ≥ 5)`);
        await shot(p, ROOT, "calendar-list");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "calendar-year-view", feature: FEATURE,
    async run(page, { assert, ROOT }) {
      const proc = await bootMain(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await anchoredPage(ctx, BASE, "events", { calView: "year" });
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="year"]');
        assert((await p.locator(".fc-multimonth-month").count()) === 12, "the year view renders twelve month grids");
        // a day-number nav link jumps to that day's view
        await p.locator('td[data-date="2026-08-14"] .fc-daygrid-day-number').first().click();
        await p.waitForSelector('[data-testid="calendar-events"][data-cal-view="day"]');
        assert(true, "clicking a day in the year view opens that day's view");
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
        await p.waitForSelector('[data-testid="calendar-edit"]');
        assert(true, "Enter on a focused event opens the edit dialog — the keyboard path works");
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
        await shot(p, ROOT, "calendar-mobile-agenda");
        // tap an agenda event → the edit surface as a bottom sheet
        await p.tap('[data-testid="calendar-event-ev_1"]');
        await p.waitForSelector('[data-testid="calendar-edit-sheet"]');
        assert((await p.inputValue('[data-testid="edit-title"]')) === "Site walkthrough", "TAP on an agenda event opens the edit sheet prefilled");
        await shot(p, ROOT, "calendar-mobile-edit");
        // dismiss the sheet, then tap a day row → the prefilled create
        await p.keyboard.press("Escape");
        await p.waitForSelector('[data-testid="calendar-edit-sheet"]', { state: "detached" });
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
