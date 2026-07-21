/* Unit tests for the grid's pure cell-mapping core
   (src/ui/record-core/views/grid/cells.ts): field type → cell kind, the
   editable set, and paste/fill text coercion. Runs under node's own test
   runner (`npm test`) — no browser, no glide, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cellDescFor, coerceFromText, isGridEditable, textForCopy } from "../../src/ui/record-core/views/grid/cells.ts";

const f = (type: string, extra: Record<string, unknown> = {}) => ({ key: "k", label: "K", type, ...extra });

test("kind mapping: native kinds, custom kinds, read-only fallbacks", () => {
  assert.deepEqual(cellDescFor(f("text")), { kind: "text", editable: true });
  assert.deepEqual(cellDescFor(f("longText")), { kind: "text", editable: true });
  assert.deepEqual(cellDescFor(f("url")), { kind: "uri", editable: true });
  assert.deepEqual(cellDescFor(f("email")), { kind: "uri", editable: true });
  assert.deepEqual(cellDescFor(f("number")), { kind: "number", editable: true });
  assert.deepEqual(cellDescFor(f("currency")), { kind: "number", editable: true });
  assert.deepEqual(cellDescFor(f("boolean")), { kind: "boolean", editable: true });
  assert.deepEqual(cellDescFor(f("select")), { kind: "select", editable: true });
  assert.deepEqual(cellDescFor(f("multiselect")), { kind: "multiselect", editable: true });
  assert.deepEqual(cellDescFor(f("user")), { kind: "user", editable: true });
  for (const t of ["date", "dateTime", "relation", "richText", "json", "array", "rating", "money", "emails", "phones", "links", "address", "fullName"]) {
    assert.deepEqual(cellDescFor(f(t)), { kind: "readonly" }, t);
    assert.equal(isGridEditable(f(t) as never), false, t);
  }
});

test("the primary field is the stable identity column: text, never editable", () => {
  assert.deepEqual(cellDescFor(f("text", { primary: true })), { kind: "text", editable: false });
});

test("number coercion tolerates separators, rejects garbage, empties to null", () => {
  assert.deepEqual(coerceFromText(f("number"), "12,500"), { ok: true, value: 12500 });
  assert.deepEqual(coerceFromText(f("currency"), " 42 "), { ok: true, value: 42 });
  assert.deepEqual(coerceFromText(f("number"), ""), { ok: true, value: null });
  assert.deepEqual(coerceFromText(f("number"), "not a number"), { ok: false });
});

test("boolean coercion accepts the usual spellings", () => {
  assert.deepEqual(coerceFromText(f("boolean"), "Yes"), { ok: true, value: true });
  assert.deepEqual(coerceFromText(f("boolean"), "0"), { ok: true, value: false });
  assert.deepEqual(coerceFromText(f("boolean"), "maybe"), { ok: false });
});

test("select coercion matches option values AND labels, rejects unknowns", () => {
  const sel = f("select", { options: ["New", { value: "won", label: "Won deal" }] });
  assert.deepEqual(coerceFromText(sel, "New"), { ok: true, value: "New" });
  assert.deepEqual(coerceFromText(sel, "Won deal"), { ok: true, value: "won" });
  assert.deepEqual(coerceFromText(sel, "won"), { ok: true, value: "won" });
  assert.deepEqual(coerceFromText(sel, "Lost"), { ok: false });
  assert.deepEqual(coerceFromText(sel, ""), { ok: true, value: "" });
});

test("multiselect coercion round-trips its own copy format; one bad entry rejects the cell", () => {
  const ms = f("multiselect", { options: ["A", "B", "C"] });
  const copied = textForCopy(ms, ["A", "C"]);
  assert.equal(copied, "A; C");
  assert.deepEqual(coerceFromText(ms, copied), { ok: true, value: ["A", "C"] });
  assert.deepEqual(coerceFromText(ms, "A, B"), { ok: true, value: ["A", "B"] });
  assert.deepEqual(coerceFromText(ms, "A; D"), { ok: false });
  assert.deepEqual(coerceFromText(ms, ""), { ok: true, value: [] });
});

test("user coercion matches the directory exactly", () => {
  const u = f("user");
  assert.deepEqual(coerceFromText(u, "Maya", ["Maya", "Jonas"]), { ok: true, value: "Maya" });
  assert.deepEqual(coerceFromText(u, "Nobody", ["Maya"]), { ok: false });
  assert.deepEqual(coerceFromText(u, "", ["Maya"]), { ok: true, value: "" });
});

test("copy text is raw, never display-formatted", () => {
  assert.equal(textForCopy(f("number"), 12500), "12500");
  assert.equal(textForCopy(f("text"), null), "");
});
