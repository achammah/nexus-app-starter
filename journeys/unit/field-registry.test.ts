/* Unit tests for the field-type registry's pure core (src/ui/record-core/fields/resolve.ts)
   and the whiteboard scene helpers (fields/whiteboard/scene.ts): glob-module folding,
   capability reads over unregistered types, scene guards/signatures/preview text.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFieldRegistry,
  registryBlocksKbEdit,
  registryClearValue,
  registryFilterable,
  registryIsBlock,
  registryPreviewText,
} from "../../src/ui/record-core/fields/resolve.ts";
import {
  elementCount,
  isScene,
  liveElements,
  previewLabel,
  sceneSignature,
} from "../../src/ui/record-core/fields/whiteboard/scene.ts";

const def = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra }) as never;

test("buildFieldRegistry folds glob modules into a type-keyed map", () => {
  const defs = buildFieldRegistry({
    "./whiteboard/definition.tsx": { default: def("whiteboard", { layout: "block" }) },
    "./other/definition.tsx": { default: def("other") },
    "./broken/definition.tsx": {},
  });
  assert.deepEqual(Object.keys(defs).sort(), ["other", "whiteboard"]);
  assert.equal(defs.whiteboard.layout, "block");
});

test("capability reads tolerate unregistered types", () => {
  const defs = buildFieldRegistry({
    "./wb/definition.tsx": {
      default: def("whiteboard", {
        layout: "block",
        filterable: false,
        keyboardEditable: false,
        clearValue: null,
        previewText: () => "canvas",
      }),
    },
  });
  // registered type
  assert.equal(registryIsBlock(defs, "whiteboard"), true);
  assert.equal(registryFilterable(defs, "whiteboard"), false);
  assert.equal(registryBlocksKbEdit(defs, "whiteboard"), true);
  assert.equal(registryClearValue(defs, "whiteboard"), null);
  assert.equal(registryPreviewText(defs, "whiteboard", {}), "canvas");
  // unregistered type keeps host defaults
  assert.equal(registryIsBlock(defs, "text"), false);
  assert.equal(registryFilterable(defs, "text"), true);
  assert.equal(registryBlocksKbEdit(defs, "text"), false);
  assert.equal(registryClearValue(defs, "text"), undefined);
  assert.equal(registryPreviewText(defs, "text", "x"), undefined);
});

test("explicit-false semantics: a registered type WITHOUT the flag keeps host rules", () => {
  const defs = buildFieldRegistry({ "./a/definition.tsx": { default: def("plain") } });
  assert.equal(registryBlocksKbEdit(defs, "plain"), false);
  assert.equal(registryFilterable(defs, "plain"), true);
});

test("isScene guards the persisted shape", () => {
  assert.equal(isScene({ elements: [] }), true);
  assert.equal(isScene({ elements: [{ id: "a" }] }), true);
  assert.equal(isScene(null), false);
  assert.equal(isScene([]), false);
  assert.equal(isScene({ elements: "nope" }), false);
  assert.equal(isScene("scribble"), false);
});

test("liveElements/elementCount skip tombstones", () => {
  const scene = { elements: [{ id: "a", version: 3 }, { id: "b", version: 1, isDeleted: true }, { id: "c" }] };
  assert.equal(elementCount(scene), 2);
  assert.deepEqual(liveElements(scene).map((e) => e.id), ["a", "c"]);
  assert.equal(elementCount(null), 0);
});

test("sceneSignature is content-stable and version-sensitive", () => {
  const a = { elements: [{ id: "a", version: 3 }, { id: "b", version: 1 }] };
  const same = { elements: [{ id: "a", version: 3 }, { id: "b", version: 1 }] };
  const edited = { elements: [{ id: "a", version: 4 }, { id: "b", version: 1 }] };
  assert.equal(sceneSignature(a), sceneSignature(same));
  assert.notEqual(sceneSignature(a), sceneSignature(edited));
  assert.equal(sceneSignature({ elements: [] }), "");
});

test("previewLabel: counts, empties, unreadable values", () => {
  assert.equal(previewLabel(null), "");
  assert.equal(previewLabel({ elements: [] }), "");
  assert.equal(previewLabel({ elements: [{ id: "a" }] }), "canvas · 1 element");
  assert.equal(previewLabel({ elements: [{ id: "a" }, { id: "b" }] }), "canvas · 2 elements");
  assert.equal(previewLabel("garbage"), "canvas (unreadable value)");
});
