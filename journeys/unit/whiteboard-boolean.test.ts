/* Unit tests for the whiteboard depth engines — the boolean/shape-combination
   geometry (src/ui/record-core/fields/whiteboard/geometry.ts, a real polygon-clipping
   layer over the closed shapes excalidraw can represent — excalidraw has NO native
   boolean) and the arrange operations (z-order + group/ungroup). Both are pure, so
   they run under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBoolean, splitElement, isBooleanEligible, isSplittable, elementToRing,
} from "../../src/ui/record-core/fields/whiteboard/geometry.ts";
import {
  bringToFront, sendToBack, bringForward, sendBackward, groupSelected, ungroupSelected, hasSharedGroup,
} from "../../src/ui/record-core/fields/whiteboard/arrange.ts";

const rect = (id: string, x: number, y: number, w: number, h: number, extra = {}) =>
  ({ id, type: "rectangle", x, y, width: w, height: h, angle: 0, strokeColor: "#1e1e1e", backgroundColor: "#a5d8ff", fillStyle: "solid", strokeWidth: 2, ...extra }) as never;

test("union of two overlapping rectangles → one closed filled polygon", () => {
  const A = rect("A", 0, 0, 100, 100), B = rect("B", 50, 50, 100, 100);
  const r = applyBoolean("union", [A, B]);
  assert.ok(!("error" in r), "union succeeds");
  if ("error" in r) return;
  assert.equal(r.skeletons.length, 1, "one output polygon");
  const s = r.skeletons[0] as { type: string; points: number[][]; width: number; height: number; backgroundColor: string };
  assert.equal(s.type, "line", "output is a line (excalidraw's fillable polygon)");
  assert.ok(s.points.length >= 8, "the union outline has the L-shape points");
  assert.ok(s.width > 0 && s.height > 0, "the polygon has real dimensions (renders)");
  assert.equal(s.backgroundColor, "#a5d8ff", "inherits the source fill");
  assert.deepEqual(r.removeIds.sort(), ["A", "B"], "removes both sources");
});

test("intersect keeps only the overlap; non-overlap is a graceful error", () => {
  const ok = applyBoolean("intersect", [rect("A", 0, 0, 100, 100), rect("B", 50, 50, 100, 100)]);
  assert.ok(!("error" in ok) && ok.skeletons.length === 1, "overlap intersects");
  const bad = applyBoolean("intersect", [rect("C", 0, 0, 10, 10), rect("D", 500, 500, 10, 10)]);
  assert.ok("error" in bad, "non-overlapping shapes return an error, never a bad shape");
});

test("subtract and exclude produce polygons", () => {
  const A = rect("A", 0, 0, 120, 120), B = rect("B", 60, 60, 120, 120);
  assert.ok(!("error" in applyBoolean("subtract", [A, B])), "subtract succeeds");
  assert.ok(!("error" in applyBoolean("exclude", [A, B])), "exclude (xor) succeeds");
});

test("eligibility: closed shapes yes, arrows/text/open no; <2 → error", () => {
  assert.equal(isBooleanEligible(rect("A", 0, 0, 10, 10)), true);
  assert.equal(isBooleanEligible({ id: "x", type: "arrow", points: [[0, 0], [10, 10]] } as never), false);
  assert.equal(isBooleanEligible({ id: "t", type: "text", text: "hi" } as never), false);
  const one = applyBoolean("union", [rect("A", 0, 0, 10, 10)]);
  assert.ok("error" in one, "one shape cannot be combined");
});

test("disjoint union stays splittable; split recovers the pieces", () => {
  const r = applyBoolean("union", [rect("E", 0, 0, 20, 20), rect("F", 100, 100, 20, 20)]);
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.equal(r.skeletons.length, 2, "two disjoint pieces");
  const joined = { id: "J", type: "line", strokeColor: "#1e1e1e", backgroundColor: "#a5d8ff", customData: (r.skeletons[0] as { customData: unknown }).customData } as never;
  assert.equal(isSplittable(joined), true, "a combined element is splittable");
  const sp = splitElement(joined);
  assert.ok(!("error" in sp) && sp.skeletons.length === 2, "split emits one element per ring");
});

test("ellipse is polygonised (approximation) and combinable", () => {
  const ring = elementToRing({ id: "el", type: "ellipse", x: 0, y: 0, width: 80, height: 80, angle: 0 } as never);
  assert.ok(ring && ring.length > 8, "an ellipse becomes a fine polygon ring");
  assert.ok(!("error" in applyBoolean("union", [rect("A", 0, 0, 100, 100), { id: "el", type: "ellipse", x: 0, y: 0, width: 80, height: 80, angle: 0, strokeColor: "#000", backgroundColor: "#fff", fillStyle: "solid" } as never])));
});

test("z-order: bring-to-front / send-to-back reorder the array", () => {
  const els = [rect("a", 0, 0, 1, 1), rect("b", 0, 0, 1, 1), rect("c", 0, 0, 1, 1)];
  assert.deepEqual(bringToFront(els, ["a"]).map((e) => e.id), ["b", "c", "a"]);
  assert.deepEqual(sendToBack(els, ["c"]).map((e) => e.id), ["c", "a", "b"]);
  assert.deepEqual(bringForward(els, ["a"]).map((e) => e.id), ["b", "a", "c"]);
  assert.deepEqual(sendBackward(els, ["c"]).map((e) => e.id), ["a", "c", "b"]);
});

test("group binds a shared id; ungroup removes it", () => {
  const els = [rect("a", 0, 0, 1, 1), rect("b", 0, 0, 1, 1)];
  const grouped = groupSelected(els, ["a", "b"]);
  const gids = grouped.map((e) => (e.groupIds as string[])[0]);
  assert.ok(gids[0] && gids[0] === gids[1], "both share one group id");
  assert.equal(hasSharedGroup(grouped, ["a", "b"]), true);
  const ungrouped = ungroupSelected(grouped, ["a", "b"]);
  assert.equal(hasSharedGroup(ungrouped, ["a", "b"]), false, "ungroup clears the shared group");
});
