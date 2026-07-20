# Lane: record-layout

Two config-selectable record-page layouts, both rendering the rich-text editor cleanly, and a fix for the side-peek collapse (richText text stacking one letter per line).

## Config surface
- `ObjectConfig.recordLayout?: "standard" | "document"` (default `"standard"`) — nexus-ui `record-core/types.ts` (JSDoc) + `docs/RECIPES.md` + type manifest.
- `"document"` objects default `openIn` to `"page"` (App.tsx `onOpen`): `active.openIn ?? (recordLayout === "document" ? "page" : "peek")`.

## nexus-ui (library — PR #1)
- `record-core/RecordPage.tsx`: factor the field switch into `fieldEditor(f)` + `fieldRow(f)` + `detailsCard(fields)` + `tabsCard` (byte-identical testids). Branch on `layout`:
  - standard → today's `.nxRecord` (fields panel + tabs); richText rows carry `nxFieldRow--block` (full-width).
  - document → `.nxRecordDoc` grid: `.nxRecordDoc-hero` (first richText field, wide) + `.nxRecordDoc-side` (other fields + related + tabs).
- Collapse fix: `.nxSugSurface-host { container-type: inline-size }` + `@container (max-width:640px)` stacks the editor+rail; doc column floored at `minmax(260px,1fr)`. NotionEditor `.ne-block`: `word-break:normal; overflow-wrap:break-word` (kills per-character wrapping) + `min-width:0`.
- CSS: `record-core.css` (`.nxFieldRow--block`, `.nxRecordDoc*`).

## starter (demo — PR #2)
- `companies`: `recordLayout:"standard"` + a richText `brief` (`suggestTaskId:"company-brief"`), seeded blocks → clean STANDARD field.
- `docs` (new): `recordLayout:"document"`, `pipelineField:"status"`, fields title/status/`body` (richText, `suggestTaskId:"doc-suggest"`), 2 seeded docs → the NOTION-style hero editor. Appears in nav.

## Testids
`record-<id>` (+ `data-record-layout`), `hero-<field>`, existing `field-<key>` / `edit-<block>` unchanged.

## Journeys (`journeys/extra/record-layout.mjs`, fixture `record-layout.config.json`, band 5760-5799 → fixture 5761)
- `record-layout-standard-field` — standard record: brief editor block width > 200px, flowing text.
- `record-layout-peek-readable` — company in side-peek readable; still > 200px with suggestions rail active (collapse fixed).
- `record-layout-document-hero` — doc hero editor > 500px + suggestions review works.

Manifest: 3 rows. Generalization: pure `var(--nx-*)`, config-driven, no hardcoded object/field in the library.
