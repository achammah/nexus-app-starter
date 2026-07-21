/* Unit tests for the calendar view's pure core
   (src/ui/record-core/views/calendar/events.ts): record→event mapping,
   inclusive⇄exclusive span-end conversion, malformed-data normalization,
   drop/resize patch math, and the agenda day grouping.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  createPrefill,
  eventsByDay,
  firstDateField,
  isDateOnly,
  localDay,
  monthDays,
  parseDay,
  patchForDrop,
  patchForResize,
  rangePrefill,
  recurrenceInput,
  rowsToEvents,
} from "../../src/ui/record-core/views/calendar/events.ts";

const f = (key: string, type: string) => ({ key, label: key, type }) as never;
const noFmt = { formatTitle: (v: unknown) => String(v ?? "") };

test("date-field rows map to all-day events; undated/malformed rows are excluded and counted out", () => {
  const fields = { start: f("when", "date"), title: f("title", "text") };
  const { events, dated } = rowsToEvents(
    [
      { id: "a", title: "A", when: "2026-08-05" },
      { id: "b", title: "B", when: "" },
      { id: "c", title: "C", when: "not a date" },
      { id: "d", title: "", when: "2026-08-06T10:00:00.000Z" }, // day slice of a datetime string still parses
    ],
    fields,
    noFmt,
  );
  assert.equal(dated, 2);
  assert.deepEqual(events[0], { id: "a", title: "A", start: "2026-08-05", allDay: true });
  assert.equal(events[1].start, "2026-08-06");
  assert.equal(events[1].title, "d", "an empty title falls back to the row id");
});

test("dateTime-field rows map to timed events with the full instant", () => {
  const fields = { start: f("at", "dateTime"), title: f("t", "text") };
  const { events } = rowsToEvents([{ id: "m", t: "Sync", at: "2026-08-06T09:30:00.000Z" }], fields, noFmt);
  assert.deepEqual(events[0], { id: "m", title: "Sync", start: "2026-08-06T09:30:00.000Z", allDay: false });
});

test("an inclusive record span renders with an exclusive event end; an end before its start is dropped", () => {
  const fields = { start: f("from", "date"), end: f("to", "date"), title: f("n", "text") };
  const { events } = rowsToEvents(
    [
      { id: "s1", n: "Offsite", from: "2026-08-10", to: "2026-08-12" },
      { id: "s2", n: "One day", from: "2026-08-24", to: "2026-08-24" },
      { id: "s3", n: "Garbage", from: "2026-08-20", to: "2026-08-01" },
    ],
    fields,
    noFmt,
  );
  assert.equal(events[0].end, "2026-08-13", "to 2026-08-12 inclusive = exclusive end on the 13th");
  assert.equal(events[1].end, "2026-08-25", "a same-day span still renders as one full day");
  assert.equal(events[2].end, undefined, "end<start is normalized away, the event stays at its start");
});

test("a timed end is kept only when it does not precede its start", () => {
  const fields = { start: f("at", "dateTime"), end: f("until", "dateTime"), title: f("t", "text") };
  const { events } = rowsToEvents(
    [
      { id: "ok", t: "A", at: "2026-08-06T09:00:00.000Z", until: "2026-08-06T10:00:00.000Z" },
      { id: "bad", t: "B", at: "2026-08-06T09:00:00.000Z", until: "2026-08-06T08:00:00.000Z" },
    ],
    fields,
    noFmt,
  );
  assert.equal(events[0].end, "2026-08-06T10:00:00.000Z");
  assert.equal(events[1].end, undefined);
});

test("the color resolver runs against the color field's own value", () => {
  const kind = f("kind", "select");
  const fields = { start: f("when", "date"), title: f("t", "text"), color: kind };
  const { events } = rowsToEvents([{ id: "e", t: "E", when: "2026-08-05", kind: "Visit" }], fields, {
    ...noFmt,
    colorOf: (field, v) => (field === kind && v === "Visit" ? "blue" : undefined),
  });
  assert.equal(events[0].color, "blue");
});

test("patchForDrop writes the start (day-sliced for all-day) and converts a carried end back to inclusive", () => {
  const fields = { start: f("when", "date"), end: f("to", "date"), title: f("t", "text") };
  assert.deepEqual(
    patchForDrop({ startStr: "2026-08-12", endStr: "2026-08-15", allDay: true }, fields),
    { when: "2026-08-12", to: "2026-08-14" },
  );
  assert.deepEqual(
    patchForDrop({ startStr: "2026-08-12", endStr: null, allDay: true }, fields),
    { when: "2026-08-12" },
    "no end on the dropped event → the end field is left untouched",
  );
  const timed = { start: f("at", "dateTime"), title: f("t", "text") };
  assert.deepEqual(
    patchForDrop({ startStr: "2026-08-12T09:30:00+02:00", endStr: null, allDay: false }, timed),
    { at: "2026-08-12T09:30:00+02:00" },
  );
});

test("patchForResize writes only the end field and clamps a span that would end before it starts", () => {
  const fields = { start: f("from", "date"), end: f("to", "date"), title: f("t", "text") };
  assert.deepEqual(
    patchForResize({ startStr: "2026-08-10", endStr: "2026-08-14", allDay: true }, fields),
    { to: "2026-08-13" },
  );
  assert.deepEqual(
    patchForResize({ startStr: "2026-08-10", endStr: "2026-08-09", allDay: true }, fields),
    { to: "2026-08-10" },
    "a degenerate resize clamps to the start day",
  );
  assert.deepEqual(patchForResize({ startStr: "x", endStr: "y", allDay: true }, { start: f("a", "date"), title: f("t", "text") }), {});
});

test("createPrefill seeds the start field, day-only for date fields", () => {
  assert.deepEqual(createPrefill("2026-08-20", f("when", "date")), { when: "2026-08-20" });
  assert.deepEqual(createPrefill("2026-08-20T10:00:00+02:00", f("at", "dateTime")), { at: "2026-08-20T10:00:00+02:00" });
});

test("firstDateField picks the first date/dateTime field only", () => {
  assert.equal(firstDateField([f("name", "text"), f("at", "dateTime"), f("when", "date")] as never[])?.key, "at");
  assert.equal(firstDateField([f("name", "text")] as never[]), undefined);
});

test("day math: parse, add, month arithmetic, local day", () => {
  assert.equal(parseDay("2026-08-14"), "2026-08-14");
  assert.equal(parseDay("2026-08-14T10:00:00Z"), "2026-08-14");
  assert.equal(parseDay("nope"), null);
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-01", "addMonths lands on the target month's first day");
  assert.equal(addMonths("2026-08-31", -1), "2026-07-01");
  assert.equal(localDay(new Date(2026, 7, 5)), "2026-08-05");
});

test("monthDays spans the whole month, leap Februaries included", () => {
  assert.equal(monthDays("2026-08-01").length, 31);
  assert.equal(monthDays("2028-02-10").length, 29);
  assert.equal(monthDays("2026-08-15")[0], "2026-08-01");
});

test("eventsByDay covers every day of an all-day span and orders a day's timed events by time", () => {
  const days = monthDays("2026-08-01");
  const map = eventsByDay(
    [
      { id: "s", title: "Span", start: "2026-08-10", end: "2026-08-13", allDay: true },
      { id: "late", title: "Late", start: "2026-08-10T15:00:00.000Z", allDay: false },
      { id: "early", title: "Early", start: "2026-08-10T08:00:00.000Z", allDay: false },
    ],
    days,
  );
  assert.deepEqual(["2026-08-10", "2026-08-11", "2026-08-12"].map((d) => map.get(d)?.some((e) => e.id === "s")), [true, true, true]);
  assert.equal(map.get("2026-08-13")?.some((e) => e.id === "s") ?? false, false, "the exclusive event end is not covered");
  const aug10 = map.get("2026-08-10") ?? [];
  assert.deepEqual(aug10.map((e) => e.id), ["s", "early", "late"], "all-day first, then timed by start");
});

test("isDateOnly distinguishes a bare day from an instant", () => {
  assert.equal(isDateOnly("2026-08-14"), true);
  assert.equal(isDateOnly("2026-08-14T10:00:00Z"), false);
  assert.equal(isDateOnly(" 2026-08-14 "), true, "surrounding whitespace is tolerated");
  assert.equal(isDateOnly(""), false);
  assert.equal(isDateOnly(42), false);
});

test("a dateTime field holding a date-only value renders as an all-day event (mixed all-day + timed)", () => {
  const fields = { start: f("at", "dateTime"), title: f("t", "text") };
  const { events } = rowsToEvents(
    [
      { id: "allday", t: "Holiday", at: "2026-08-14" },
      { id: "timed", t: "Sync", at: "2026-08-14T09:30:00.000Z" },
    ],
    fields,
    noFmt,
  );
  assert.equal(events[0].allDay, true, "a date-only value on a dateTime field is all-day");
  assert.equal(events[0].start, "2026-08-14");
  assert.equal(events[1].allDay, false, "an instant on the same field stays timed");
});

test("patchForDrop flips a dateTime event into the all-day lane as a date-only value, and back", () => {
  const timed = { start: f("at", "dateTime"), title: f("t", "text") };
  assert.deepEqual(
    patchForDrop({ startStr: "2026-08-20", endStr: null, allDay: true }, timed),
    { at: "2026-08-20" },
    "dropped into the all-day lane → a date-only value (renders all-day on read-back)",
  );
  assert.deepEqual(
    patchForDrop({ startStr: "2026-08-20T14:00:00.000Z", endStr: null, allDay: false }, timed),
    { at: "2026-08-20T14:00:00.000Z" },
    "dropped back into a slot → the ISO instant",
  );
});

test("rangePrefill seeds start + end for a drag-select, converting an all-day range end to inclusive", () => {
  const allDay = { start: f("from", "date"), end: f("to", "date"), title: f("n", "text") };
  assert.deepEqual(
    rangePrefill("2026-08-10", "2026-08-13", allDay, true),
    { from: "2026-08-10", to: "2026-08-12" },
    "FC's exclusive 3-day range end (the 13th) stores as the inclusive last day (the 12th)",
  );
  const noEnd = { start: f("when", "date"), title: f("t", "text") };
  assert.deepEqual(rangePrefill("2026-08-10", "2026-08-11", noEnd, true), { when: "2026-08-10" });
  const timed = { start: f("at", "dateTime"), end: f("until", "dateTime"), title: f("t", "text") };
  assert.deepEqual(
    rangePrefill("2026-08-10T09:00:00.000Z", "2026-08-10T10:30:00.000Z", timed, false),
    { at: "2026-08-10T09:00:00.000Z", until: "2026-08-10T10:30:00.000Z" },
  );
});

test("recurrenceInput injects a DTSTART and preserves the rule; a value with no FREQ returns null", () => {
  const allDay = recurrenceInput("2026-08-14", true, "FREQ=WEEKLY;BYDAY=MO");
  assert.equal(allDay?.rrule, "DTSTART;VALUE=DATE:20260814\nRRULE:FREQ=WEEKLY;BYDAY=MO");
  assert.equal(allDay?.duration, undefined, "all-day occurrences carry no duration");
  const timed = recurrenceInput("2026-08-03T10:00:00.000Z", false, "FREQ=DAILY", "2026-08-03T11:30:00.000Z");
  assert.equal(timed?.rrule, "DTSTART:20260803T100000Z\nRRULE:FREQ=DAILY");
  assert.equal(timed?.duration, "01:30", "a timed occurrence's length comes from start→end");
  const prefixed = recurrenceInput("2026-08-03", true, "RRULE:FREQ=MONTHLY");
  assert.equal(prefixed?.rrule, "DTSTART;VALUE=DATE:20260803\nRRULE:FREQ=MONTHLY", "an existing RRULE: prefix is stripped, our DTSTART wins");
  assert.equal(recurrenceInput("2026-08-03", true, "not a rule"), null);
  assert.equal(recurrenceInput("2026-08-03", true, undefined), null);
});

test("rowsToEvents emits an rrule for a row carrying a recurrence value, a plain event otherwise", () => {
  const fields = { start: f("at", "dateTime"), title: f("t", "text"), recurrence: f("rule", "text") };
  const { events } = rowsToEvents(
    [
      { id: "r", t: "Standup", at: "2026-08-03T09:00:00.000Z", rule: "FREQ=WEEKLY;BYDAY=MO" },
      { id: "once", t: "One-off", at: "2026-08-04T09:00:00.000Z", rule: "" },
    ],
    fields,
    noFmt,
  );
  assert.equal(events[0].rrule, "DTSTART:20260803T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO");
  assert.equal(events[1].rrule, undefined, "an empty rule leaves the row a single event");
});
