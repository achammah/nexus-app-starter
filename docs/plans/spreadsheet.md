# Plan: Spreadsheet page (full Univer workbook)

## Goal
Ship a full Excel in the app: a Univer workbook (formula bar with 400+ functions, insert and delete
rows and columns, cell formatting, multiple sheets, freeze and merge) as a standalone **Spreadsheet**
nav page. Free surface (its own persisted workbook blob), token themed, lazy loaded, mobile usable,
reusing the existing `customPages` nav registry with zero `App.tsx` edits, and exposed as a reusable
nexus-ui block (`blocks/workbook`) the future config driven Pages primitive can host as
`kind:"spreadsheet"`.

## Primitive choice (why a real dependency, not ideas only)
The salvage index classes Univer as an architecture mining target: there is no seam to lift "just the
grid" next to the existing DataTable, because Univer's DI container owns lifecycle, its command bus
owns mutations, its scene graph owns rendering. That blocker is exactly what a standalone surface
WANTS: we adopt the whole substrate on purpose, on its own route, by mounting Univer's own published
preset (`@univerjs/presets` plus `preset-sheets-core`) as a self contained app shell. Clean room
reimplementation of a 400+ function formula engine and a canvas render engine is not feasible in a
lane. The only real cost is weight, contained as a lazy route (see Bundle).

## Architecture
- **Surface**: `src/ui/blocks/workbook/` (vendored from nexus-ui `src/blocks/workbook/`).
  - `WorkbookSurface.tsx`: mounts Univer's preset into a container ref inside a `useEffect`.
    StrictMode safe (create once ref guard plus `univer.dispose()` on cleanup). Persists on
    data changing commands only (`onCommandExecuted`, filtered to `CommandType.MUTATION`) via an
    `onChange(fWorkbook.save())` the host debounces. Free surface: the host owns the snapshot
    (`value` / `onChange`); this component owns the Univer lifecycle, the token theme, the dark sync,
    and the change stream.
  - `snapshot.ts`: the pure core (type only `@univerjs` imports, node testable). The app_state
    store key (`workbook:<page>`), `isWorkbookSnapshot` validation, and the demo plus 10k seed
    generators.
  - `workbook-theme.ts`: token to Univer theme derivation. The accent `primary` scale comes from
    `--nx-accent`; every resolved color is normalized to `rgb()` by painting it on a 1x1 canvas and
    reading the pixel back, because Univer's `CanvasColorService` rejects `oklab()` and `color(srgb …)`
    (the format `getComputedStyle` returns for a `color-mix`). Re derives on the two signals the grid
    view observes: the `data-theme` attribute and the `#nx-skin` style tag.
  - `workbook.css`: the surface chrome (states Univer does not own: loading, empty, error, save
    status) on pure `--nx-*` tokens, plus a `--univer-*` override block that themes Univer's OWN
    chrome (ribbon tabs, toolbar, formula bar, menus, buttons) to our accent scale. One mapping serves
    light and dark and re derives on a skin flip (pure CSS cascade).
  - `index.ts`: the light helpers and types eager, `LazyWorkbookSurface = React.lazy(...)` for the
    engine.
- **Host page**: `src/app/pages/Spreadsheet.tsx`. Loads the stored workbook from `api.state()`,
  mounts `LazyWorkbookSurface` under Suspense, autosaves via a debounced `api.setState`, and owns the
  designed loading, empty, and ready phases plus Reset demo and Clear affordances.
- **Nav**: one additive row in `src/app/pages.tsx` `customPages`, giving a real nav item at
  `#/p/spreadsheet` (testid `nav-p-spreadsheet`), no `App.tsx` edit. A KitDemo blurb links to it.

## Data binding and persistence
Free surface: the whole workbook persists as ONE snapshot (Univer's `IWorkbookData`, exactly what
`fWorkbook.save()` returns) under the app_state key `workbook:spreadsheet`. This is app state, not
record data, which is the correct home for a standalone workbook (the glide Sheet view already owns
per object record editing; a record bound Univer sheet would duplicate it). The record bound seam
(rows to records through the store's patch/create path) is designed and documented in RECIPES, not
built.

## Theming
- Accent: the JS theme object's `primary` scale (canvas selection and active cell) is set at mount
  from `--nx-accent`, rgb normalized. The chrome accent and surfaces follow the `--univer-*` overrides
  in `workbook.css` and re derive live on a skin or token flip.
- Dark: synced to the app's `data-theme` through `univerAPI.toggleDarkMode` on every theme or skin
  nonce.
- Univer's public facade exposes no post mount `setTheme`, so the canvas accent scale is mount time;
  the chrome (the visible skin surface) re derives live via CSS. Deep neutral gray chrome stays close
  to Univer's tuned defaults (its `.univer-dark` block redefines a subset of the gray scale).

## Mobile (390px): declared touch decisions
Univer renders and supports one finger scroll plus pinch zoom on its canvas; the formula bar and a
compact toolbar stay usable. Fill handle drag and multi range drag select are **desktop first** by
declaration; the mobile edit path is tap a cell, the on canvas editor, commit. The canvas does not
trap page scroll.

## Journeys (`journeys/extra/spreadsheet.mjs`, band 5910 and 5911)
Drive the REAL Univer UI (canvas cell clicks on pinned seed geometry, toolbar `data-u-command`
buttons, the column header context menu) and assert VISIBLE outcomes through the persisted snapshot's
computed `v` (the facade caches every formula's value on save):
1. `spreadsheet-renders`: the nav item opens the page; workbook plus toolbar plus both sheet tabs
   paint; the seeded `=SUM` computes.
2. `spreadsheet-formula`: type `=SUM(B3:B6)` into an empty cell, computes to 24000, persists.
3. `spreadsheet-add-column`: insert a column via the header context menu, data shifts right, persists.
4. `spreadsheet-format-cell`: Bold a cell via the toolbar, the style lands, persists.
5. `spreadsheet-theme-flip`: flip `data-theme` live, Univer re skins to dark, no reload.
6. `spreadsheet-empty-state`: an explicit null workbook shows the designed empty state; Create seeds one.
7. `spreadsheet-mobile`: 390x664 touch, tap a cell, edit via the on canvas editor, persist.
8. `spreadsheet-10k-perf`: a 10k row workbook, first paint inside the budget (Univer virtualizes).

Unit tests (`journeys/unit/workbook-{snapshot,theme}.test.ts`): store key namespacing, snapshot
validation, the seed generators, and the accent scale and theme merge math (injected resolver, no
browser).

## Bundle
The `@univerjs` engine is entirely inside the `WorkbookSurface` lazy chunk (React.lazy). The eager
bundle carries only the light block core (store key, validation, seed) plus the host page. The
workbook chunk is a documented exception to the 250 KB lazy cap (like excalidraw). Real numbers in
`docs/DEPENDENCIES.md`.

## Reuse seam (future Pages primitive)
When the sibling config driven `config.pages` / `kind:"spreadsheet"` lane lands, it hosts this exact
`WorkbookSurface` block as its `spreadsheet` body. This lane does NOT build the config driven pages
registry (it touches `App.tsx` nav and collides with that lane).
