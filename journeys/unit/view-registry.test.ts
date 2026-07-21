/* Unit tests for the view registry's pure core (src/ui/record-core/views/resolve.ts):
   glob-module folding, unknown-type lookup, and the legacy view derivation.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry, configuredViewsFor } from "../../src/ui/record-core/views/resolve.ts";

const def = (type: string) => ({ type, label: type, icon: null, component: () => null });

test("buildRegistry folds glob modules into a type-keyed map", () => {
  const defs = buildRegistry({
    "./table/definition.tsx": { default: def("table") },
    "./kanban/definition.tsx": { default: def("kanban") },
    "./broken/definition.tsx": {},
  });
  assert.deepEqual(Object.keys(defs).sort(), ["kanban", "table"]);
  assert.equal(defs.table.label, "table");
});

test("an unknown type resolves to undefined, never a throw", () => {
  const defs = buildRegistry({ "./table/definition.tsx": { default: def("table") } });
  assert.equal(defs.timeline, undefined);
});

test("configuredViewsFor honors declared views verbatim, order kept", () => {
  const object = {
    key: "o", label: "O", labelOne: "O", fields: [], defaultView: "table",
    views: [{ type: "kanban", groupField: "stage" }, { type: "table" }],
  };
  assert.deepEqual(configuredViewsFor(object, []), object.views);
});

test("without declared views the legacy set derives from groupables", () => {
  const object = { key: "o", label: "O", labelOne: "O", fields: [], defaultView: "table" };
  const stage = { key: "stage", label: "Stage", type: "select" };
  assert.deepEqual(configuredViewsFor(object, [stage]).map((v) => v.type), ["table", "kanban", "chart"]);
  assert.deepEqual(configuredViewsFor(object, []).map((v) => v.type), ["table"]);
});

test("an empty views array falls back to derivation", () => {
  const object = { key: "o", label: "O", labelOne: "O", fields: [], defaultView: "table", views: [] };
  assert.deepEqual(configuredViewsFor(object, []).map((v) => v.type), ["table"]);
});
