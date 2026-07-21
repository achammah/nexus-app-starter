# Lane plan: sheet-native (deep Univer integration pass)

Goal (one line): the Univer workbook stops reading as an embedded widget — one continuous chrome from app shell into the grid, every reachable piece of vendor chrome on `--nx-*` tokens in both themes and under skins, zero loss of spreadsheet capability.

## Verified file map (read, not assumed)

nexus-ui (write surface):
- `src/blocks/workbook/WorkbookSurface.tsx` — mount lifecycle, theme handoff, dark sync, status bar
- `src/blocks/workbook/workbook-theme.ts` — token→theme resolution, accent scale, theme nonce
- `src/blocks/workbook/workbook.css` — frame + `--univer-primary-*` overrides (grays currently stock)
- `src/blocks/workbook/snapshot.ts`, `index.ts` — untouched except exports if needed

starter (write surface):
- `src/app/pages/Spreadsheet.tsx` — the page (loads/persists snapshot, renders bar)
- `src/app/app.css` — one additive `.pageBleed` utility (full-bleed page treatment)
- `src/app/i18n.ts` — drop the now-unused demo title string
- `journeys/extra/spreadsheet-native-chrome.mjs` — new journey
- `journeys/extra/spreadsheet.mjs` — must stay green (canvas-relative geometry, `data-u-command` toolbar buttons, `.univer-dark` sync, `workbook-empty`/`workbook-create` testids all preserved)
- `src/app/gallery.catalog.json` — restamp after nexus-ui gen-docs

Univer internals verified from the installed 0.25.1 source:
- Theme values are injected as `--univer-*` CSS vars on `:root` via `ThemeSwitcherService.injectThemeToHead`; the workbench subscribes to `ThemeService.currentTheme$` and re-injects on every `setTheme` (live re-theme is reachable through `univer.__getInjector()`).
- `ThemeService.setDarkMode` re-emits through a BehaviorSubject; the render engine subscribes and force-dirties every canvas component (guaranteed repaint).
- Canvas dark mode = `CanvasColorService` matrix inversion of the light palette; theme-key colors resolve live. The JS theme object must therefore stay LIGHT-anchored; Univer derives dark itself.
- `.univer-dark` swaps Tailwind role classes, never values — one value-set per mode themes all chrome.
- Popups/menus portal to `#univer-popup-portal` at body level → overrides must live at root scope, not `.nxWorkbook` scope.
- `UniverSheetsCorePreset` accepts `ribbonType: "classic" | "simple" | "collapsed"`; `simple` merges every ribbon group into ONE toolbar row (overflow → "more" menu), removing the tab strip with no command loss.

## Element-by-element changes

1. **Single-row vendor chrome** — `ribbonType: "simple"`: kills the Start/Formulas/Data tab strip; all commands live in one toolbar row with overflow handling. Full fidelity kept (every command reachable).
2. **Frame collapse** — the page goes full-bleed (`.pageBleed` cancels `.content` padding with the same gap tokens, responsive); `.nxWorkbook` drops its card border/radius/background so the sheet fills shell-to-edge. Loading/empty/error states get the same full-page treatment.
3. **Actions into the vendor toolbar** — the block's `title` prop + `.nxWorkbookBar` strip are REMOVED. `actions` (save pill · reset · clear, same testids) render as an overlay cluster aligned into the Univer toolbar row's right end; CSS reserves right space in the toolbar so Univer's overflow math and the cluster never collide. Net: 3 stacked strips + card border → 1 toolbar row + formula bar.
4. **Full palette remap, JS side (canvas + injected vars)** — `deriveWorkbookTheme` grows from primary-only to: warm neutral `gray` ramp from our light tokens (bg/sunken/border/border-strong/fg-faint/fg-muted/fg with color-mix steps), `white` = light `--nx-bg-raised`, `red/green/yellow` = light semantic tokens, `primary` = accent scale (existing), `black`/`blue` stock. Values resolve LIGHT-anchored even when mounted in dark (guarded forced-light probe on `documentElement`), because Univer's canvas derives dark by inversion.
5. **Full palette remap, CSS side (exact per-mode DOM chrome incl. portals)** — root-level blocks (`:root[data-theme="light"]`, `:root[data-theme="dark"]`, plus `prefers-color-scheme` twins for unstamped hosts) remap `--univer-gray-50..900`, `--univer-white`, `--univer-primary-*`, `red/green/yellow` onto live `var(--nx-*)` per mirrored role tables (light: 50→subtle bg … 900→fg; dark: 900→bg … 50→brightest fg). Higher specificity than the injected `:root` style; re-derives instantly on skin flips.
6. **Live re-theme** — on the existing theme nonce (data-theme flip or `#nx-skin` land): re-resolve the light-anchored theme → `ThemeService.setTheme` (re-injects head vars + updates canvas source) → `setDarkMode(isDark)` (forces canvas repaint) → keep `univerAPI.toggleDarkMode` for the `.univer-dark` class swap.
7. **Seam polish** — sheet-tab bar, zoom slider, formula bar, name box, scrollbars, context menus all follow the value remap; spot-fix any element still at a foreign tone with scoped rules; density/typography already inherit our font.

## Improve-vs-add

All changes upgrade the existing workbook block + page in place. One additive generic utility (`.pageBleed`) in app.css. No new components, no new deps, no config schema changes. `title` prop removed (single consumer updated; catalog regenerated).

## Journey plan (visible outcomes)

- Existing `spreadsheet.mjs` suite stays green untouched.
- New `spreadsheet-native-chrome.mjs`:
  1. toolbar/chrome computed colors resolve to our token values (not stock Univer gray) in light AND after a live dark flip;
  2. the tab strip is gone (single-row chrome) and the actions cluster (save/reset/clear testids) sits inside the toolbar band, still functional (reset fires, state reseeds);
  3. the frame is continuous: no card border, workbook spans the full content width (bleed verified via bounding boxes);
  4. mobile 390: page renders, toolbar + cluster usable, core tap path works.
- Screenshots: after in light + dark + one skin + mobile; before = current merged look (shots archive).

## Risks / unknowns

- Toolbar-right reservation vs Univer's overflow measurement — verified empirically in the dev loop; fallback documented (cluster over the formula-bar right end).
- `simple` ribbon crowding at narrow widths — the built-in overflow "more" menu owns it; verified at 390.
- Live `setTheme` path is source-verified but must be confirmed in the browser; fallback = remount-on-flip carrying the latest snapshot.

## License

No imported code. Univer stays a pinned Apache-2.0 dependency driven through its public config + DI surface. All new code original.
