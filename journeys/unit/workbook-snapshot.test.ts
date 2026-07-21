/* Unit tests for the workbook block's pure snapshot core
   (src/ui/blocks/workbook/snapshot.ts): store-key namespacing, snapshot
   validation, and the seed generators (demo + scale). Runs under node's own test
   runner (`npm test`) — no browser, no Univer, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORKBOOK_STORE_PREFIX,
  isWorkbookSnapshot,
  seedLargeWorkbook,
  seedWorkbook,
  workbookStoreKey,
} from "../../src/ui/blocks/workbook/snapshot.ts";

test("store key namespaces the page under the workbook prefix", () => {
  assert.equal(workbookStoreKey("spreadsheet"), "workbook:spreadsheet");
  assert.equal(workbookStoreKey("q1"), `${WORKBOOK_STORE_PREFIX}q1`);
});

test("isWorkbookSnapshot accepts the seed, rejects empty/foreign/corrupt blobs", () => {
  assert.equal(isWorkbookSnapshot(seedWorkbook()), true);
  assert.equal(isWorkbookSnapshot(null), false);
  assert.equal(isWorkbookSnapshot(undefined), false);
  assert.equal(isWorkbookSnapshot({}), false);
  assert.equal(isWorkbookSnapshot({ id: "x", sheetOrder: [], sheets: {} }), false); // empty order
  assert.equal(isWorkbookSnapshot({ theme: "skin" }), false); // a foreign app_state value
  assert.equal(isWorkbookSnapshot({ id: "x", sheetOrder: ["s"], sheets: null }), false);
});

test("seedWorkbook is a valid two-sheet workbook with live formulas + formatting", () => {
  const wb = seedWorkbook();
  assert.deepEqual(wb.sheetOrder, ["sheet-budget", "sheet-notes"]);
  const budget = wb.sheets["sheet-budget"] as { cellData: Record<number, Record<number, { v?: unknown; f?: string; s?: string }>>; freeze: { xSplit: number; ySplit: number }; mergeData: unknown[] };
  // per-row SUM in the Total column (E) and a column SUM + AVERAGE in the summary rows
  assert.equal(budget.cellData[2][4].f, "=SUM(B3:D3)");
  assert.equal(budget.cellData[6][1].f, "=SUM(B3:B6)");
  assert.equal(budget.cellData[7][1].f, "=AVERAGE(B3:B6)");
  // formatting carried by the seed: a bold merged title + a bold header + $ number format
  assert.equal(budget.cellData[0][0].s, "title");
  assert.equal(budget.cellData[1][0].s, "header");
  assert.equal(budget.cellData[2][1].s, "money");
  assert.deepEqual(budget.mergeData, [{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 4 }]);
  // frozen header rows + first column
  assert.equal(budget.freeze.ySplit, 2);
  assert.equal(budget.freeze.xSplit, 1);
  // the 2nd sheet references the first (cross-sheet formula = multi-sheet proof)
  const notes = wb.sheets["sheet-notes"] as { cellData: Record<number, Record<number, { f?: string }>> };
  assert.equal(notes.cellData[2][1].f, "=Budget!E7");
  assert.ok(wb.styles && Object.keys(wb.styles).length >= 3);
});

test("seedLargeWorkbook builds header + N data rows with a running-total formula", () => {
  const wb = seedLargeWorkbook(10000);
  const sheet = wb.sheets["sheet-rows"] as { cellData: Record<number, Record<number, { v?: unknown; f?: string }>>; rowCount: number };
  assert.equal(isWorkbookSnapshot(wb), true);
  assert.equal(sheet.cellData[0][1].v, "Name"); // header row
  assert.equal(sheet.cellData[1][0].v, 1); // first data row
  assert.equal(sheet.cellData[10000][0].v, 10000); // last data row present
  assert.ok(typeof sheet.cellData[2][3].f === "string" && sheet.cellData[2][3].f.startsWith("=")); // cumulative formula
  assert.ok(sheet.rowCount >= 10000);
});
