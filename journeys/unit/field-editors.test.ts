/* Unit tests for the draft pure core (src/ui/record-core/fields/draft.ts):
   draft coercion (the typed-number fix), stage defaulting, required resolution,
   the config-implied validation mirror, and the registry-slot consultation
   (custom field types plugging coerce/validate into the same pipeline). Runs
   under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coerceDraft,
  coerceScalar,
  formSupported,
  isEmptyValue,
  requiredKeys,
  validateDraft,
  withStageDefault,
} from "../../src/ui/record-core/fields/draft.ts";

const F = (key: string, type: string, extra: Record<string, unknown> = {}) =>
  ({ key, label: key[0].toUpperCase() + key.slice(1), type, ...extra }) as never;

const fields = [
  F("name", "text", { primary: true }),
  F("employees", "number"),
  F("amount", "currency"),
  F("industry", "select", { options: ["Software", "Retail"] }),
  F("brief", "richText"),
  F("emails", "emails"),
  F("score", "rating", { scale: 5 }),
];

test("coerceDraft turns typed number/currency strings into numbers (the dialog 400 fix)", () => {
  const out = coerceDraft(fields, { name: "Acme", employees: "50", amount: "1200.5" });
  assert.deepEqual(out, { name: "Acme", employees: 50, amount: 1200.5 });
});

test("a non-numeric number string stays verbatim so the server validator names the field", () => {
  assert.deepEqual(coerceDraft(fields, { employees: "many" }), { employees: "many" });
});

test("coerceDraft drops unset values (undefined, blank strings, empty lists)", () => {
  assert.deepEqual(coerceDraft(fields, { name: "", employees: undefined, emails: [] }), {});
});

test("a richText string becomes blocks via the injected converter", () => {
  const out = coerceDraft(fields, { brief: "hello" }, { richText: (s) => [{ type: "p", text: s }] });
  assert.deepEqual(out.brief, [{ type: "p", text: "hello" }]);
});

test("coerceScalar is the one cell-commit coercion", () => {
  assert.equal(coerceScalar("number", "7"), 7);
  assert.equal(coerceScalar("currency", "12.5"), 12.5);
  assert.equal(coerceScalar("text", "7"), "7");
});

test("withStageDefault fills the first option VALUE, colored object options included", () => {
  const cfg = { stageField: "stage", fields: [F("stage", "select", { options: [{ value: "New", color: "blue" }, "Won"] })] };
  assert.deepEqual(withStageDefault(cfg as never, {}), { stage: "New" });
  assert.deepEqual(withStageDefault(cfg as never, { stage: "Won" }), { stage: "Won" });
});

test("requiredKeys = primary plus overrides, overrides can also un-require", () => {
  assert.deepEqual(requiredKeys(fields), ["name"]);
  assert.deepEqual(requiredKeys(fields, { employees: true }).sort(), ["employees", "name"]);
  assert.deepEqual(requiredKeys(fields, { name: false }), []);
});

test("validateDraft mirrors the server's config-implied rules", () => {
  const errs = validateDraft(fields, { employees: "many", industry: "Nope", emails: ["bad"] }, ["name"]);
  assert.equal(errs.name, "Name is required");
  assert.equal(errs.employees, "Employees must be a number");
  assert.match(errs.industry, /must be one of/);
  assert.match(errs.emails, /not a valid email address/);
  assert.deepEqual(validateDraft(fields, { name: "Acme", employees: 3, industry: "Retail" }, ["name"]), {});
});

test("rating validates as a whole number inside the scale", () => {
  assert.match(validateDraft(fields, { score: 9 }, []).score, /between 0 and 5/);
  assert.deepEqual(validateDraft(fields, { score: 4 }, []), {});
});

test("isEmptyValue covers strings, lists and shaped objects", () => {
  assert.equal(isEmptyValue("  "), true);
  assert.equal(isEmptyValue([]), true);
  assert.equal(isEmptyValue({ first: "", last: " " }), true);
  assert.equal(isEmptyValue({ first: "Ada" }), false);
  assert.equal(isEmptyValue(0), false);
});

test("a registered type's coerce/validate slots run first (custom types share the pipeline)", () => {
  const custom = [F("board", "whiteboard")];
  const defs = {
    whiteboard: {
      type: "whiteboard",
      coerce: (raw: unknown) => ({ scene: raw }),
      validate: (v: unknown) => (typeof v === "object" ? null : "Board must be a scene"),
    },
  } as never;
  assert.deepEqual(coerceDraft(custom, { board: "el1" }, { defs }), { board: { scene: "el1" } });
  assert.deepEqual(validateDraft(custom, { board: { scene: "el1" } }, [], defs), {});
  assert.equal(validateDraft(custom, { board: "raw" }, [], defs).board, "Board must be a scene");
});

test("a registered validate slot overrides the built-in rule for its type", () => {
  const defs = { number: { type: "number", validate: () => "nope" } } as never;
  assert.equal(validateDraft(fields, { employees: 5 }, [], defs).employees, "nope");
});

test("formSupported = has a Draft slot, minus many-relations and inactive fields", () => {
  const defs = {
    text: { type: "text", Draft: () => null },
    relation: { type: "relation", Draft: () => null },
  } as never;
  assert.equal(formSupported(F("name", "text"), defs), true);
  assert.equal(formSupported(F("tags", "json"), defs), false);
  assert.equal(formSupported(F("links", "relation", { multiple: true }), defs), false);
  assert.equal(formSupported(F("owner", "relation"), defs), true);
  assert.equal(formSupported(F("name", "text", { isActive: false }), defs), false);
});
