# panel-pages — design note (T0)

## Stack-entry type + URL contract
- `type PanelPage = { kind:"record"; obj; id } | { kind:"search" } | { kind:"actions" }`; peek state becomes `{ stack: PanelPage[]; set: string[] }`. Record-only logic (pager, RecordView, `?peek=` writes) guards on `kind === "record"`.
- Only a record ROOT rides the URL (unchanged `?peek=`); search/actions never write it. The existing route-effect already rebuilds a root-only stack from the URL → reload lands on the record root or closed, no new URL code.
- Search text lives in App state (`panelQ`), not the page component → stepping back from a pushed record restores the query.

## `/` guard order (window keydown, bubble phase)
1 `e.defaultPrevented` (grid type-to-edit preventDefaults+stopPropagations any printable incl. `/` on an editable cell — verified in DataTable) → 2 meta/ctrl/alt → 3 target INPUT/TEXTAREA/SELECT/contentEditable → 4 any open Radix layer (`[data-slot="dialog-content"], [data-slot="sheet-content"], [role="dialog"]` — palette, create dialog, nav drawer) → 5 `td[data-cell-focus]` present → yield. Then: push search onto the open panel (no-op if top already search) or open the panel with search as root.
- ROW focus does NOT block: DataTable's row level ignores `/` (falls through un-prevented, verified), so `/` from row focus opens search — asserted in the guard journey.

## Actions page routes (both)
- Panel-header button `peek-actions` (journey's primary path) + Cmd/Ctrl+K when the panel is open. Coordination: `CommandPalette` gains ONE additive optional prop `intercept?: () => boolean` (4 lines) — App returns true when the panel is open; palette yields, App pushes actions (top already actions → pop = toggle). Declaring the CommandPalette.tsx touch here since no frozen list was issued.
- Actions page renders the SHARED `contextActions` array (one source, extracted in App, feeds palette + panel; curRec = deepest record page in the stack) + a "Search records" row pushing the search page.

## Search page
- Palette mechanics reused: 180ms debounce, `api.list(o.key, {q})` fan-out, 5/object cap, 12 total, names via `formatCell` on the primary field. Type labels (labelOne) render ONLY when hits span >1 object (spec). Always-focused input; ladder: Escape clears text → pops page → closes; Backspace on empty pops (spec). ↑↓ + Enter pushes the record on the SAME stack.
- New component file `src/app/PanelPages.tsx` (search + actions pages); App.tsx stays the shell. No server/store changes at all (reads only) → no LOGGED_OPS, no permission routes.

## Testids · i18n · journeys · docs
- `panel-search-input`, `panel-search-hit-<id>`, `peek-actions`, `panel-act-<id>`, `panel-act-search`; crumbs reuse `peek-crumbs` ("Search"/"Actions" chips).
- i18n: add `panel.*` keys (invariant 8; palette.* precedent) — i18n.ts is additive dict lines; flagging the cross-lane touch for arbitration vs schema-editor.
- Journeys `panel-search` · `panel-actions` · `panel-slash-guard` run on URLBASE only — zero spawned servers, band 5350–5399 untouched. panel-actions unfavorites at the end (shared localStorage hygiene). Docs: RECIPES "The panel: peek, search, actions"; 3 manifest rows, features exactly matching journey strings.
