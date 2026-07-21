/* Unit tests for the workbook block's pure theme derivation
   (src/ui/blocks/workbook/workbook-theme.ts): the accent color scale and the
   theme merge. The browser-only pieces (resolveCssColor probe, useThemeNonce
   observer) are exercised by the journeys, not here. Injected `resolve` keeps the
   math deterministic under node's test runner — no browser, no Univer. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { accentScale, deriveWorkbookTheme, type ColorScale, type UniverTheme } from "../../src/ui/blocks/workbook/workbook-theme.ts";

test("accentScale maps 500 to the raw accent and fills the full 50..900 scale", () => {
  const resolve = (e: string) => (e === "var(--nx-accent)" ? "rgb(1, 2, 3)" : `MIX(${e})`);
  const scale = accentScale(resolve);
  assert.equal(scale["500"], "rgb(1, 2, 3)");
  for (const k of ["50", "100", "200", "300", "400", "600", "700", "800", "900"]) {
    assert.ok(scale[k].startsWith("MIX("), `${k} derived via color-mix`);
  }
  // light steps tint toward white, dark steps shade toward black
  assert.ok(scale["50"].includes("white"), "50 is a white tint");
  assert.ok(scale["900"].includes("black"), "900 is a black shade");
});

test("deriveWorkbookTheme overrides primary from the accent while preserving base scales", () => {
  const base: UniverTheme = { white: "#fff", black: "#000", primary: { "500": "OLD" }, gray: { "500": "g" } };
  const resolve = (e: string) => (e === "var(--nx-accent)" ? "ACCENT" : "mix");
  const theme = deriveWorkbookTheme(base, resolve);
  assert.equal(theme.white, "#fff"); // base value preserved
  assert.equal((theme.gray as ColorScale)["500"], "g"); // base scale preserved
  assert.equal((theme.primary as ColorScale)["500"], "ACCENT"); // primary overridden from --nx-accent
});
