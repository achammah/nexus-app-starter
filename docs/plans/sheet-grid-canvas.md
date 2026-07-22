# Lane plan: sheet-grid-canvas (grid canvas integration pass)

Goal (one line): the sheet's CANVAS layer — gridlines, row/column headers, freeze divider, selection — stops reading as stock Excel gray and sits on our palette in both themes and under skins, softened to a modern-sheet feel.

## Reference product + Expectation List (contract v2 §4e.1)

Reference: a modern clean spreadsheet grid (Notion-database / Airtable grid feel) rendered in OUR palette. A user of those products expects:

1. Gridlines are FAINT — visible guides, never a drawn table.
2. Header cells (A/B/C + 1/2/3) sit on a subtle surface tone, not a distinct gray slab.
3. Header text is quiet (muted), smaller-than-content emphasis, in the app's own font.
4. Header borders are hairlines matching the app's border tone.
5. The active row/column header highlight ties to the app accent, softly.
6. The selection ring + fill are the app accent.
7. A frozen-pane divider is a subtle rule, not a heavy dark bar.
8. Cell text reads near-black (not pure black) on white in light; light-on-dark in dark.
9. Dark mode: the whole grid (cells, headers, lines) flips coherently with the app theme.
10. A brand re-skin recolors the grid's accents live with no reload.
11. Zoom/scroll keep line crispness (1px at scale).
12. Nothing about the grid says "embedded third-party spreadsheet."

## Verified mechanism map (from the installed 0.25.1 source)

- Gridlines: `_drawAuxiliary` stroke resolution = per-sheet `gridlinesColor` (data — rejected: pollutes snapshots) → `ctx.renderConfig.gridlinesColor` (an open hook on the sheet canvas's UniverRenderingContext, set by nobody) → hardcoded rgb(214,216,219). We set the renderConfig hook.
- Row/col headers: render components `__SpreadsheetRowHeader__` / `__SpreadsheetColumnHeader__` expose `setCustomHeader({ headerStyle }, sheetId?)` merging over DEFAULT_*_STYLE (backgroundColor rgb(248,249,250), borderColor rgb(217,217,217), fontColor #000, fontSize 13) — sheets-ui's own header-size commands use exactly this surface.
- Freeze divider: `HeaderFreezeRenderController._themeChange` re-reads `theme.gray.300` (bar) + alpha variant (main line) + `primary.600` (active) + `gray.500` (hover) on EVERY setTheme — softening = re-mapping the JS theme's `gray.300` (canvas-side only; the DOM chrome reads the independent CSS tables).
- Selection: `genNormalSelectionStyle` = `primary.600` + white — already our accent.
- Cell default text: module constant `COLOR_BLACK_RGB` with no hook — accepted (27-value delta from our fg is imperceptible; inverts correctly in dark). Flagged per the brief.
- Dark: all canvas colors stay LIGHT-anchored; Univer inverts (CanvasColorService); dark needs no second value set.
- Live skin: re-resolve + re-apply in the existing skin-signature path; `setCustomHeader` makeDirty()s, the freeze controller re-derives via setTheme, gridlines re-read renderConfig on the forced repaint.

## Changes

nexus-ui `src/blocks/workbook/`:
- `workbook-theme.ts`: `canvasGridTheme(resolve)` (faint gridline mix, header sunken/muted/border + the app font); `neutralScale` 300 remapped border-strong → border (freeze softening; JS-scale only, CSS tables unchanged).
- `WorkbookSurface.tsx`: `applyGridCanvasTheme` — render-unit lookup (bounded rAF retry at mount, the render unit is created on the Rendered lifecycle), sets renderConfig.gridlinesColor + both headers' `setCustomHeader`, re-applied on every skin re-derive.

starter:
- `journeys/extra/sheet-grid-canvas.mjs` (band 5924): PIXEL-sampled asserts — header bg ≈ resolved `--nx-bg-sunken`, gridline px ≈ the faint mix (tolerance compare), dark header pixels actually dark, selection ring ≈ accent; plus existing spreadsheet journeys stay green.
- `_shots/SELF-REVIEW.md` (v2 §4e.2): before/after light+dark+skin, per-Expectation verdicts, Toy/Widget test, DoD self-score.
- Docs: manifest row update, catalog WHEN update + restamp, plans file (this).

## Risks / unknowns

- Render-unit/ctx accessor paths verified from source but exercised empirically in the dev loop (pixel probes are the ground truth).
- `fontFamily` on canvas headers takes a CSS stack string — verified by pixel/visual check.
- The freeze-boundary translucent SHADOW (inverts light in dark) remains stock — flagged before, unchanged by this pass; the divider LINE tone is what this lane softens.

## License

No new code from external sources; Univer driven through public component/config surfaces. No new dependencies.
