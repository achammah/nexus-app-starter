# view-grid: T0 design note

Goal: a `grid` view type (label "Sheet"): Excel-grade bulk editing over any object's records as a
lazy, token-themed wrapper over @glideapps/glide-data-grid (pinned 6.0.3, MIT), self-registered
through the view registry; complements the table, replaces nothing.

Files (nexus-ui `src/record-core/views/grid/`): `definition.tsx` (eager metadata; `component:
React.lazy(SpreadsheetView)`) · `SpreadsheetView.tsx` (columns from fields, native + custom cells,
one merged onPatch per touched row, manual paste coercion, row markers ⇄ host bulk bar) ·
`cells.ts` (PURE node-tested core: kind mapping, editable set, paste/fill coercion, copy text) ·
`renderers.tsx` (select/multiselect/user canvas cells + DOM editors; colors from the chipStyle
formula via probe literals) · `editors.tsx` (replacement text/uri/number overlay editors: glide's
own commit chain drops values under React 18 StrictMode; these commit via onFinishedEditing from
local state, with guarded blur-commit) · `theme.ts` (token → glide Theme via probe resolution,
re-derived on data-theme mutation + #nx-skin arrival) · `grid.css`.
Starter: `starter.config.json` +`demo_sheet` (hideInNav, views [table, grid], 12 curated fictional
rows) · KitDemo section + i18n keys · `journeys/{fixtures/grid-view.config.json, fixtures/
grid-10k.config.json, extra/grid-view.mjs, unit/grid-cells.test.ts}` · docs rows · tsconfigs gain
`allowImportingTsExtensions` (node-testable pure modules import shared utils with .ts specifiers).

Editable in place: text · longText · url · email · number · currency · boolean · select ·
multiselect · user. Read-only formatted: dates, relation, rich/shaped types. Coercion rejects
impossible values (cell skipped); paste clips to existing rows. Fill-handle + range ops are
desktop-only by declaration; mobile = tap-select + the DOM overlay editor inline.

Journeys (band 5850; fixtures 5851/5852): grid-renders-tabs · grid-keyboard-edit (arrow + Enter,
a11y floor) · grid-fill-handle · grid-copy-paste · grid-frozen-column · grid-empty-state ·
grid-mobile (390x664 touch) · grid-10k-perf (thresholds stated in-file). Unit: 8 node:tests over
cells.ts. Bundle: eager +0.38%/+0.45% (definition + Kit-demo section); Sheet lazy chunk 103.55 kB gzip (≤250).
