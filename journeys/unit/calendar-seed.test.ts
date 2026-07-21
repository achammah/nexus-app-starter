/* Unit tests for the relative demo-date resolver (server/seed.mjs): the `@w..`
   tokens that let a demo (the calendar especially) always land on the CURRENT
   week instead of a stale fixed month. Anchored on a fixed `now` for determinism.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelDate } from "../../server/seed.mjs";

test("resolveRelDate anchors relative tokens on the current week's Monday", () => {
  const tue = new Date(2026, 6, 21); // Tue 2026-07-21 → this week's Monday is 2026-07-20
  assert.equal(resolveRelDate("@w0.1T09:00", tue), "2026-07-20T09:00:00", "this week Monday 09:00 (floating local, no Z)");
  assert.equal(resolveRelDate("@w0.2T10:30", tue), "2026-07-21T10:30:00", "this week Tuesday");
  assert.equal(resolveRelDate("@w0.5T16:00", tue), "2026-07-24T16:00:00", "this week Friday");
  assert.equal(resolveRelDate("@w0.3", tue), "2026-07-22", "no time → a bare day string (an all-day event)");
  assert.equal(resolveRelDate("@w1.1T10:00", tue), "2026-07-27T10:00:00", "next week Monday");
  assert.equal(resolveRelDate("@w-1.5", tue), "2026-07-17", "last week Friday");
});

test("resolveRelDate pads single-digit hours and covers a Sunday anchor (ISO week starts Monday)", () => {
  const sun = new Date(2026, 6, 26); // Sun 2026-07-26 → still the week starting Monday 2026-07-20
  assert.equal(resolveRelDate("@w0.1", sun), "2026-07-20", "Sunday belongs to the week that starts on Monday the 20th");
  assert.equal(resolveRelDate("@w0.7", sun), "2026-07-26", "@w0.7 is that Sunday itself");
  assert.equal(resolveRelDate("@w0.2T8:05", sun), "2026-07-21T08:05:00", "a single-digit hour pads to two digits");
});

test("resolveRelDate passes non-token values through untouched", () => {
  const now = new Date(2026, 6, 21);
  assert.equal(resolveRelDate("se_1", now), "se_1", "an id is not a date");
  assert.equal(resolveRelDate("Daily standup", now), "Daily standup", "a title is not a date");
  assert.equal(resolveRelDate("2026-08-03T09:00:00.000Z", now), "2026-08-03T09:00:00.000Z", "an absolute date is left alone");
  assert.equal(resolveRelDate("@bogus", now), "@bogus", "an @ that does not match the grammar is left alone");
  assert.equal(resolveRelDate("@w0.9", now), "@w0.9", "an out-of-range weekday does not match, left alone");
  assert.equal(resolveRelDate(42, now), 42, "a non-string passes through");
  assert.equal(resolveRelDate(null, now), null);
});
