/* Unit tests for the grid's pure selection-contrast core
   (src/ui/record-core/views/grid/contrast.ts): the selected-cell text ramp is
   left untouched when the base ink already reads against the selection
   background, and flipped to the higher-contrast pole (white/black) when it
   does not — in either theme direction. Inputs are rgb()/rgba() strings,
   exactly what getComputedStyle yields in the live hook. Runs under node's own
   test runner (`npm test`) — no browser, no glide, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contrastRatio,
  deriveSelectionText,
  parseColor,
  relLuminance,
} from "../../src/ui/record-core/views/grid/contrast.ts";

test("parseColor reads rgb, rgba and percentage alpha", () => {
  assert.deepEqual(parseColor("rgb(46, 16, 101)"), { rgb: [46, 16, 101], a: 1 });
  assert.deepEqual(parseColor("rgba(0, 0, 0, 0.1)"), { rgb: [0, 0, 0], a: 0.1 });
  assert.deepEqual(parseColor("rgb(255 255 255 / 50%)"), { rgb: [255, 255, 255], a: 0.5 });
  assert.deepEqual(parseColor("nonsense"), { rgb: [0, 0, 0], a: 1 });
});

test("relLuminance + contrastRatio anchor at the poles", () => {
  assert.equal(relLuminance([255, 255, 255]), 1);
  assert.equal(relLuminance([0, 0, 0]), 0);
  assert.equal(contrastRatio(1, 0), 21); // (1+0.05)/(0+0.05)
});

test("base LIGHT theme: pale selection, dark ink already reads → no override", () => {
  const out = deriveSelectionText({
    bgCell: "rgb(255,255,255)",
    accentLight: "rgb(238,241,254)", // #eef1fe
    textDark: "rgb(28,27,25)", // #1c1b19
  });
  assert.deepEqual(out, {});
});

test("base DARK theme: dark selection, light ink already reads → no override", () => {
  const out = deriveSelectionText({
    bgCell: "rgb(23,23,26)",
    accentLight: "rgb(35,36,56)", // #232438
    textDark: "rgb(236,234,230)", // #eceae6
  });
  assert.deepEqual(out, {});
});

test("bold skin, LIGHT theme: dark selection + dark ink → flip to WHITE ramp", () => {
  const out = deriveSelectionText({
    bgCell: "rgb(255,255,255)",
    accentLight: "rgb(46,16,101)", // #2e1065
    textDark: "rgb(28,27,25)",
  });
  assert.equal(out.textDark, "rgb(255,255,255)");
  assert.equal(out.textBubble, "rgb(255,255,255)");
  assert.equal(out.textMedium, "rgba(255,255,255,0.78)");
  assert.equal(out.textLight, "rgba(255,255,255,0.55)");
});

test("bold skin, DARK theme: light selection + light ink → flip to BLACK ramp", () => {
  const out = deriveSelectionText({
    bgCell: "rgb(23,23,26)",
    accentLight: "rgb(233,213,255)", // #e9d5ff
    textDark: "rgb(236,234,230)",
  });
  assert.equal(out.textDark, "rgb(0,0,0)");
  assert.equal(out.textMedium, "rgba(0,0,0,0.78)");
});

test("translucent selection is judged against the cell background it shows through", () => {
  // a 10% accent over white stays light → dark ink still reads → no flip
  const out = deriveSelectionText({
    bgCell: "rgb(255,255,255)",
    accentLight: "rgba(79,70,229,0.1)",
    textDark: "rgb(28,27,25)",
  });
  assert.deepEqual(out, {});
});

test("the flipped ramp actually clears AA against the selection it targets", () => {
  const selBg = "rgb(46,16,101)";
  const out = deriveSelectionText({ bgCell: "rgb(255,255,255)", accentLight: selBg, textDark: "rgb(28,27,25)" });
  const flippedLum = relLuminance(parseColor(out.textDark as string).rgb);
  const selLum = relLuminance(parseColor(selBg).rgb);
  assert.ok(contrastRatio(flippedLum, selLum) >= 4.5, "flipped ink clears AA on the selection background");
});
