# editor lane — Notion-grade richText field type

**Field-type name: `richText`** (not `document`). It names the VALUE SHAPE, matching the
existing convention (`longText`/`fullName`/`money`). `document` collides with record-core's
Files/`FileMeta` vocab and Nexus DOCUMENT_TEMPLATE/`document upload`. Value = `Block[]`
(the editor's own type), stored as JSON in the record store exactly like blog's `content`.

## nexus-ui files
- `record-core/NotionEditor.tsx` (NEW) — lift `~/blog-studio-lambda/.../NotionEditor.tsx` near-verbatim
  (React + lucide only, self-contained `NE_CSS`). Exports `NotionEditor`, `Block`, `InlineChange`,
  `textToBlocks`, `blocksToMarkdown`, `bid`. Keeps `changes`/`hoveredChange`/`onHoverChange` props
  in the contract (consumed by the SEPARATE suggestions lane) + inline-change rendering
  (`buildBlockHtml`/`serializeBlock`) — I build NO accept/reject UI.
- `types.ts` — add `"richText"` to `FieldType`; `export type { Block } from "./NotionEditor"` (one-way, no cycle).
- `RecordPage.tsx` — new branch (parallel to `longText`) mounting a small `RichTextField`:
  local `blocks` state seeded ONCE from `row[f.key]` (keyed by row id → polls don't clobber live
  edits, mirroring blog's seed-once), `onChange` updates local state + **debounces one `onPatch`** of
  the whole `Block[]`. Same local-state-commit idiom as MoneyField/ListField — NOT a bespoke save
  path; reuses `onPatch`. Empty/non-array value seeds `[{p,""}]` so there's a line to type in.
- `DataTable.tsx` — `richTextPreview(blocks)` helper (join text blocks → plain, truncate 80 like
  longText); `formatCell` + read-only cell branch use it; add `richText` to `SPECIAL` (grid editing
  stays on the record page); clear-value → `[]`.
- `record-core.md` — richText row (type table) + editor contract; suggestion props documented as
  "consumed by a suggestions layer (separate lane)".
- `record-core.css` — untouched unless needed (NE_CSS stays inline in the component).

## starter files (append-only)
- `journeys/fixtures/editor.config.json` — one object w/ a `richText` field + seeded `Block[]`.
- `journeys/run.mjs` — append journeys, fixture server on **PORT 5550** (band 5550-5599; avoids 5000/5060/5061/7000).
- `docs/feature-manifest.md` — one `Rich-text editor` row. RecordView: NO change (richText flows through the generic field loop).

## testids (reused from source): `edit-<blockId>`, `block-<blockId>`, `slash-menu`, `slash-<cmd>`, `field-<key>` · DataTable `cell-<id>-<key>`
## journeys (band 5550): (1) open record → blocks render → type → "/" opens menu → p→h1 → persists + survives reload; (2) drag-reorder two blocks via handle → order persists; (3) DataTable cell shows truncated preview.
