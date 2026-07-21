/* Unit tests for the workbook block's pure theme derivation
   (src/ui/blocks/workbook/workbook-theme.ts): the accent + neutral + semantic
   scales and the theme merge. The browser-only pieces (resolveCssColor probe,
   withLightTokens flip, themeSignature, useThemeNonce observer) are exercised by
   the journeys, not here. Injected `resolve` keeps the math deterministic under
   node's test runner — no browser, no Univer. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { accentScale, neutralScale, deriveWorkbookTheme, type ColorScale, type UniverTheme } from "../../src/ui/blocks/workbook/workbook-theme.ts";

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

test("neutralScale spans the warm token ramp: surfaces low, borders mid, text high", () => {
  const resolve = (e: string) => e;
  const scale = neutralScale(resolve);
  assert.ok(scale["50"].includes("--nx-bg"), "50 is the page surface");
  assert.ok(scale["100"].includes("--nx-bg-sunken"), "100 is the sunken surface");
  assert.ok(scale["200"].includes("--nx-border"), "200 is the border");
  assert.ok(scale["300"].includes("--nx-border-strong"), "300 is the strong border");
  assert.ok(scale["400"].includes("--nx-fg-faint"), "400 is faint text");
  assert.ok(scale["500"].includes("--nx-fg-muted"), "500 is muted text");
  assert.ok(scale["900"].includes("--nx-fg"), "900 is full text");
  // the 600..800 steps interpolate muted -> full text
  for (const k of ["600", "700", "800"]) {
    assert.ok(scale[k].includes("color-mix") && scale[k].includes("--nx-fg"), `${k} mixes toward --nx-fg`);
  }
});

test("deriveWorkbookTheme rebuilds the palette from tokens while preserving black + blue", () => {
  const base: UniverTheme = {
    white: "#fff", black: "#000",
    primary: { "500": "OLD" }, gray: { "500": "g" },
    blue: { "500": "b" }, red: { "50": "keep", "500": "r" }, green: { "500": "gr" }, yellow: { "500": "y" },
  };
  const resolve = (e: string) => `R(${e})`;
  const theme = deriveWorkbookTheme(base, resolve);
  assert.equal(theme.black, "#000"); // shadows/scrims stay stock
  assert.equal((theme.blue as ColorScale)["500"], "b"); // link tone stays stock
  assert.equal((theme.primary as ColorScale)["500"], "R(var(--nx-accent))"); // accent
  assert.equal((theme.gray as ColorScale)["500"], "R(var(--nx-fg-muted))"); // neutrals from tokens
  assert.equal(theme.white, "R(var(--nx-bg-raised))"); // the cell/panel surface
  assert.equal((theme.red as ColorScale)["500"], "R(var(--nx-danger))"); // semantic
  assert.equal((theme.red as ColorScale)["50"], "keep"); // unmapped steps of a base scale survive
  assert.equal((theme.green as ColorScale)["500"], "R(var(--nx-ok))");
  assert.equal((theme.yellow as ColorScale)["500"], "R(var(--nx-warn))");
});
