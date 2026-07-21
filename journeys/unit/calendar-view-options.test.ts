/* Unit tests for the calendar view's pure config→FullCalendar option mapping
   (src/ui/record-core/views/calendar/viewOptions.ts): the enabled/default view
   resolution, the config-name→FC-view-type bridge (all-day vs timed), and the
   option bundle with its defaults and overrides. No browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_VIEWS,
  configEditable,
  configSelectable,
  defaultView,
  enabledViews,
  fcViewType,
  viewOptions,
} from "../../src/ui/record-core/views/calendar/viewOptions.ts";

test("enabledViews defaults to all six, filters junk, de-dupes, preserves order", () => {
  assert.deepEqual(enabledViews({}), ALL_VIEWS, "absent → all six");
  assert.deepEqual(enabledViews({ enabledViews: [] }), ALL_VIEWS, "empty → all six");
  assert.deepEqual(enabledViews({ enabledViews: "month" }), ALL_VIEWS, "a non-array → all six");
  assert.deepEqual(
    enabledViews({ enabledViews: ["year", "month", "bogus", "month"] }),
    ["year", "month"],
    "invalid names drop, duplicates collapse, the configured order holds",
  );
});

test("defaultView is the configured view when enabled, else the first enabled view", () => {
  assert.equal(defaultView({ defaultView: "week" }), "week");
  assert.equal(defaultView({}), "month", "no config → the first of all six");
  assert.equal(
    defaultView({ defaultView: "day", enabledViews: ["year", "month"] }),
    "year",
    "a defaultView the picker does not offer falls back to the first enabled",
  );
  assert.equal(defaultView({ defaultView: "nope" }), "month", "an unknown name falls back");
});

test("fcViewType bridges config names to FC view types, resolving week/day by all-day-ness", () => {
  assert.equal(fcViewType("month", true), "dayGridMonth");
  assert.equal(fcViewType("month", false), "dayGridMonth");
  assert.equal(fcViewType("week", true), "dayGridWeek", "an all-day object gets the day-grid week");
  assert.equal(fcViewType("week", false), "timeGridWeek", "a timed object gets the hourly week");
  assert.equal(fcViewType("day", true), "dayGridDay");
  assert.equal(fcViewType("day", false), "timeGridDay");
  assert.equal(fcViewType("listWeek", false), "listWeek");
  assert.equal(fcViewType("listMonth", false), "listMonth");
  assert.equal(fcViewType("year", false), "multiMonthYear");
});

test("viewOptions applies sane defaults", () => {
  const o = viewOptions({});
  assert.equal(o.firstDay, 1, "Monday by default");
  assert.equal(o.slotDuration, "00:30:00");
  assert.equal(o.slotMinTime, "00:00:00");
  assert.equal(o.slotMaxTime, "24:00:00");
  assert.equal(o.weekNumbers, false);
  assert.equal(o.businessHours, false);
  assert.equal(o.nowIndicator, true);
  assert.equal(o.eventOverlap, true);
});

test("viewOptions maps configured values (weekday name, slot size, times, toggles)", () => {
  const o = viewOptions({
    firstDay: "Sunday",
    slotDuration: "15m",
    slotMinTime: "8:00",
    slotMaxTime: "20:00",
    weekNumbers: true,
    businessHours: true,
    nowIndicator: false,
    eventOverlap: false,
  });
  assert.equal(o.firstDay, 0, "Sunday → 0");
  assert.equal(o.slotDuration, "00:15:00");
  assert.equal(o.slotMinTime, "08:00:00", "a single-digit hour pads");
  assert.equal(o.slotMaxTime, "20:00:00");
  assert.equal(o.weekNumbers, true);
  assert.deepEqual(o.businessHours, { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" });
  assert.equal(o.nowIndicator, false);
  assert.equal(o.eventOverlap, false);
});

test("viewOptions rejects malformed times and slot sizes, keeping the defaults", () => {
  const o = viewOptions({ firstDay: "Nonday", slotDuration: "45m", slotMinTime: "99:99", slotMaxTime: "noon" });
  assert.equal(o.firstDay, 1, "an unknown weekday name → Monday");
  assert.equal(o.slotDuration, "00:30:00", "an unlisted slot size → 30 min");
  assert.equal(o.slotMinTime, "00:00:00", "an out-of-range hour → the default");
  assert.equal(o.slotMaxTime, "24:00:00");
});

test("configEditable / configSelectable default to true and honour a false override", () => {
  assert.equal(configEditable({}), true);
  assert.equal(configEditable({ editable: false }), false);
  assert.equal(configSelectable({}), true);
  assert.equal(configSelectable({ selectable: false }), false);
});
