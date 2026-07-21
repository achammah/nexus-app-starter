# Lane plan — gallery + form views, unified field editors

Goal: `gallery` and `form` ship as registry view types; one field-editor registry (`src/ui/record-core/field-editors/`) backs the create dialog, RecordPage, DataTable's commit logic, the wizard-create coercion, and the new form — no behavior change on existing surfaces.

Files (nexus-ui): `record-core/field-editors/{coerce.ts,editors.tsx,index.ts}` · `views/gallery/{definition.tsx,pack.ts}` · `views/form/definition.tsx` · RecordPage/DataTable point at the shared pieces · `views/types.ts` gains optional `onCreate?: (body) => Promise<RecordRow>` (form submit; `onCreateDraft` is the calendar lane's separate seam).
Files (starter): ObjectView passes `onCreate` (create-permission-gated) and its create dialog renders registry editors · `starter.config.json` adds `demo_showcase` (hideInNav) and `people.views` · KitDemo links the demos · journeys + fixtures + unit tests + docs.

Gallery config: `coverField?` (url field; defaultConfig infers the first), `titleField?` (primary default), `metaFields?` (≤3, OptionChip colors), `cardSize?: s|m|l`. Column-packing masonry (adapted from usememos/memos ColumnGrid, MIT) over deterministic card heights (fixed 4/3 cover, clamped title) → windowed rendering; smooth at 10k rows. Missing cover → initials placeholder. Click/Enter opens the peek. One column at 390px.

Form config: `fields?` (default: all supported active fields, config order), `requiredOverrides?`, `submitLabel?`, `successMode?: another|view`. Centered single column at document width; registry editors; validation = required + the existing per-type validators, server `store.validate` messages mapped to field errors. Submit → `onCreate` → the store create path; success state offers Create another / View record. `json` and multi-relations are excluded (validateConfig names them).

Central fix shipped with the unification: number/currency drafts now coerce before create (the dialog previously sent raw strings, which the server rejects — journey-proven).

Testids: `gallery-<obj>` wrap · `gcard-<id>` (+`-cover`/`-ph`) · `form-<obj>` · `form-field-<key>` · `form-err-<key>` · `form-submit` · `form-success` · `form-again`.

Journeys (`journeys/extra/gallery-form.mjs`, ports 5901-5908): gallery-renders-covers · gallery-card-opens-peek · gallery-mobile (390 touch) · gallery-10k-perf · gallery-empty · form-renders-order-required (keyboard path) · form-submit-creates (WAREHOUSE=local; row visible in Table tab) · form-mobile · create-dialog-number-persists. Units: `field-editors.test.ts` (coerce/validate per type), `gallery-pack.test.ts` (packing math).
