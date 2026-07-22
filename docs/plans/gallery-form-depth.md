# Plan — Gallery + Form full-fidelity depth

Brings the gallery and form VIEWS to Airtable/Notion-class fidelity: every capability config-declared, group/sort also runtime-controllable through the existing `ViewDefinition` Toolbar + `viewState` contract, styled in the app's own toolbar and motion vocabulary. No new dependencies; both views stay lazy chunks.

## Gallery
Config keys on the `gallery` views entry (all optional):
- `groupField` — group cards into collapsible sections (header + count). Reuses the shared group-by machinery (`views/group.ts` `resolveGroupBy`/`groupableFields`) and the shared `viewState.groupBy` key, so a group field chosen on the board carries into the gallery and back.
- `sortField` + `sortDir` (`"asc"|"desc"`) — order the cards. Backed by a new shared `views/sort.ts` (type-aware comparator).
- `cardFields` — the ordered list of field keys rendered on each card, each drawn through the field registry (`getFieldTypeDefinition(type).cell` / `fieldPreviewText`); select/multiselect keep their colored chips. Replaces the opaque `metaFields`, which stays honored as a back-compat alias (`cardFields` wins when both are set).
- `coverField` — a `url`, `links`, or `array` field; for list types the first image-like value is used. `coverFit` (`"cover"` default | `"contain"`). Attachment-sourced covers are a documented future option, not in this pass.
- `cardSize` (`"s"|"m"|"l"`, unchanged), `cardClick` (`"peek"` default | `"open"`).

Runtime controls (view Toolbar, `side:"trail"`, matching the board's look): `GroupByMenu` (reused) + a new `SortMenu` (sibling in `views/controls.tsx`, same DropdownMenu/Button primitives). Section collapse persists per group in `viewState.galleryCollapsed`.

Kept from v1: deterministic masonry packing, viewport windowing (smooth at 10k), single-column mobile reflow. Embed polish (§4 well-embedded): hover (`nx-hover-lift`), press (`nx-tap-scale`), focus-visible ring, a card selection affordance wired to the host `selection`/`onSelectionChange` (bulk-bar compatible); section headers on the app's type/spacing tokens so the grid reads as one frame with the toolbar. Before/after screenshots.

## Form
Config keys on the `form` views entry (all optional; defaults = current behavior):
- `sections` — `[{label, fields[]}]`: render fields in labeled groups. Default: one unlabeled section (unchanged).
- `requiredWhen` — `{fieldKey: {field, equals}}`: a field becomes required only when another field equals a value; evaluated client-side and folded into the required check.
- Richer treatment: a form-level error-summary banner (jump-to-field) above the existing inline errors; a designed success card naming the created record with View / Create-another.

The drag-and-drop form BUILDER remains a separate future lane.

## Reuse (improve-don't-add)
`views/group.ts` + `controls.GroupByMenu` + `fields/registry` are reused, not forked. One new shared util `views/sort.ts` + `controls.SortMenu`; the table view's internal sort is unified onto `views/sort.ts` only if trivially extractable without risking its journeys, otherwise `sort.ts` ships for gallery and table adoption is flagged as a follow-up.

## Data spine + Nexus
Views read post-filter rows and never hold record state; group/sort/collapse live in the persisted `viewState` bag (captured by saved views). The form submits through `ViewProps.onCreate` (the host store-create path) — a submit still lands as the `<object>.created` webhook event documented in the v1 recipe.

## Demo / journeys / gate
`demo_showcase` gains the gallery depth config; the form demo gains `sections` + one `requiredWhen`. Journeys (visible outcomes, band assigned at build): group-sections + collapse-persists · sort-reorders + persists · card-fields-in-order · cover-fit/source · card-select → bulk · embed-polish (before/after) · mobile single-column · 10k windowing · form-sections · form-conditional-required · form-success. Unit tests: sort comparator, group assignment + collapse, card-field + cover resolve, conditional-required eval. Gate = both bars (§4d.8 fidelity + §4 well-embedded) + build clean + band-pinned locked suite green + docs (RECIPES/DATA-MODEL/DEPENDENCIES/manifest) + LEDGER.
