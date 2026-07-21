/* Unit tests for the gallery masonry math (src/ui/record-core/views/gallery/pack.ts):
   deterministic shortest-column packing, windowing, and the exact card-height
   model. Runs under node's own test runner (`npm test`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardHeight,
  columnCountForWidth,
  columnWidthFor,
  packColumns,
  visibleIndices,
} from "../../src/ui/record-core/views/gallery/pack.ts";

test("columnCountForWidth fits one column per min width and never returns 0", () => {
  assert.equal(columnCountForWidth(1000, 260, 12), 3);
  assert.equal(columnCountForWidth(390, 260, 12), 1);
  assert.equal(columnCountForWidth(0, 260, 12), 1);
});

test("packColumns assigns each card to the shortest column, in order", () => {
  const { cols, tops, height } = packColumns([100, 200, 100, 100], 2, 10);
  // card0 → col0, card1 → col1, card2 → col0 (shorter), card3 → col0 again (110+100+10=220 > 210? no: col0 total 220, col1 210 → col1)
  assert.deepEqual(cols, [0, 1, 0, 1]);
  assert.deepEqual(tops, [0, 0, 110, 210]);
  assert.equal(height, 310);
});

test("packing is append-stable: earlier cards never move when rows append", () => {
  const a = packColumns([120, 80, 90], 3, 12);
  const b = packColumns([120, 80, 90, 200, 60], 3, 12);
  assert.deepEqual(b.cols.slice(0, 3), a.cols);
  assert.deepEqual(b.tops.slice(0, 3), a.tops);
});

test("one column stacks everything in order", () => {
  const { cols, tops } = packColumns([50, 50, 50], 1, 10);
  assert.deepEqual(cols, [0, 0, 0]);
  assert.deepEqual(tops, [0, 60, 120]);
});

test("visibleIndices windows to the viewport plus overscan", () => {
  const heights = new Array(100).fill(100);
  const layout = packColumns(heights, 1, 0);
  const vis = visibleIndices(layout, heights, 1000, 500, 0);
  assert.deepEqual(vis, [10, 11, 12, 13, 14]);
  const withOverscan = visibleIndices(layout, heights, 1000, 500, 200);
  assert.equal(withOverscan[0], 8);
  assert.equal(withOverscan[withOverscan.length - 1], 16);
});

test("cardHeight is exact by construction and varies by cover + card-field count", () => {
  const covered = cardHeight({ colWidth: 260, coverConfigured: true, hasCover: true, fieldRows: 2 });
  const coverless = cardHeight({ colWidth: 260, coverConfigured: true, hasCover: false, fieldRows: 2 });
  const oneField = cardHeight({ colWidth: 260, coverConfigured: true, hasCover: true, fieldRows: 1 });
  const noFields = cardHeight({ colWidth: 260, coverConfigured: true, hasCover: true, fieldRows: 0 });
  assert.equal(covered, Math.round(260 * 0.75) + 10 + 38 + 2 * 22 + 10);
  assert.ok(coverless < covered);
  assert.equal(covered - oneField, 22); // one line per card field
  assert.equal(oneField - noFields, 22);
});
