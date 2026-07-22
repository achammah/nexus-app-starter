/* Unit tests for the gallery depth pure logic: the shared type-aware row sort
   (views/sort.ts) and the gallery cover/group helpers (views/gallery/data.ts).
   Runs under node's own test runner (`npm test`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRows, compareByField } from "../../src/ui/record-core/views/sort.ts";
import { coverUrlOf, buildGroups } from "../../src/ui/record-core/views/gallery/data.ts";

// minimal FieldDef-shaped helper for the pure functions under test
const F = (key: string, type: string, extra: Record<string, unknown> = {}) => ({ key, label: key, type, ...extra }) as any;

test("sortRows orders numbers, blanks LAST regardless of direction, stable", () => {
  const rows = [{ id: "a", n: 3 }, { id: "b", n: 1 }, { id: "c", n: null }, { id: "d", n: 2 }] as any[];
  assert.deepEqual(sortRows(rows, F("n", "number"), "asc").map((r) => r.id), ["b", "d", "a", "c"]);
  assert.deepEqual(sortRows(rows, F("n", "number"), "desc").map((r) => r.id), ["a", "d", "b", "c"]);
});

test("sortRows text is case-insensitive + numeric-aware; no field = unchanged", () => {
  const rows = [{ id: "1", t: "item10" }, { id: "2", t: "Item2" }, { id: "3", t: "item1" }] as any[];
  assert.deepEqual(sortRows(rows, F("t", "text"), "asc").map((r) => r.id), ["3", "2", "1"]);
  assert.deepEqual(sortRows(rows, undefined, "asc").map((r) => r.id), ["1", "2", "3"]);
});

test("compareByField handles money shape + booleans", () => {
  assert.ok(compareByField({ id: "1", m: { amount: 100 } } as any, { id: "2", m: { amount: 250 } } as any, F("m", "money")) < 0);
  assert.ok(compareByField({ id: "1", b: false } as any, { id: "2", b: true } as any, F("b", "boolean")) < 0);
});

test("coverUrlOf: url direct, links/array first non-empty, https-prefixed, absent = ''", () => {
  assert.equal(coverUrlOf({ id: "1", c: "https://x/y.png" } as any, F("c", "url")), "https://x/y.png");
  assert.equal(coverUrlOf({ id: "1", c: "x.example/y.png" } as any, F("c", "url")), "https://x.example/y.png");
  assert.equal(coverUrlOf({ id: "1", c: ["", "data:image/png;a"] } as any, F("c", "links")), "data:image/png;a");
  assert.equal(coverUrlOf({ id: "1" } as any, F("c", "url")), "");
  assert.equal(coverUrlOf({ id: "1", c: "x" } as any, undefined), "");
});

test("buildGroups partitions in option order, (Empty) last, drops empty groups", () => {
  const gf = F("k", "select", { options: [{ value: "A" }, { value: "B" }, { value: "C" }] });
  const rows = [{ id: "1", k: "B" }, { id: "2", k: "A" }, { id: "3", k: "B" }, { id: "4" }, { id: "5", k: "Z" }] as any[];
  const groups = buildGroups(rows, gf, []);
  assert.deepEqual(groups.map((g) => g.value), ["A", "B", ""]); // C dropped; unknown Z + missing → (Empty)
  assert.deepEqual(groups.find((g) => g.value === "B")!.rows.map((r) => r.id), ["1", "3"]);
  assert.equal(groups.find((g) => g.value === "")!.rows.length, 2);
});

test("buildGroups user field uses the directory order", () => {
  const gf = F("owner", "user");
  const rows = [{ id: "1", owner: "Maya" }, { id: "2", owner: "Jonas" }, { id: "3", owner: "Maya" }] as any[];
  assert.deepEqual(buildGroups(rows, gf, ["Jonas", "Maya"]).map((g) => g.value), ["Jonas", "Maya"]);
});
