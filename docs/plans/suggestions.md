# suggestions lane — AI inline-edit suggestions (tracked changes) on richText records

Ports the Redline engine from `blog-studio-lambda` into reusable, entity-agnostic pieces.
De-branded: **suggestions / tracked changes / inline edits** (never "redline" as a product name).
Depends on editor (richText / NotionEditor inline-change props) + foundations (`runAiTask`) — both in main.

## nexus-ui (library) files
- `record-core/useSuggestions.ts` (NEW) — the engine hook, lifted from Redline's accept/reject/undo/all
  logic. `useSuggestions(blocks, onBlocksChange, changes, onChangesChange)` returns
  `{accept, reject, undo, acceptAll, rejectAll, pending, resolved}`. Pure Block[]/InlineChange[] logic —
  zero api/object coupling. Accept folds `original→replacement` into the doc (`onBlocksChange`) + flips
  status; reject/undo revert an accepted change back in the doc. Consumes NotionEditor's existing
  `InlineChange` type.
- `record-core/SuggestionPanel.tsx` (NEW) — the right-rail review panel (from Redline's `rl-panel`),
  pure presentational + tokenized. Props: `changes, hovered, onHover, onFocus, onAccept, onReject,
  onUndo, onAcceptAll, onRejectAll`. Renders per-change diff (del→ins), reason, accept/reject/undo,
  bulk bar, progress. 0 hex — all `var(--nx-*)` (accepted=accent, rejected/deleted=danger).
- `record-core/Pipeline.tsx` (NEW) — generic `Pipeline({states, current, inProgress?})` horizontal
  stage indicator + `Chip({label, tone})`. No hardcoded stages — states come from config.
- `record-core/RecordPage.tsx` — extend `RichTextField` to OPTIONALLY mount the suggestions surface
  (editor + panel + "Request suggestions" button + optional Pipeline) when the field carries
  `suggestTaskId` AND a `suggest` prop bundle is supplied. Backward-compatible: no suggest prop → today's
  editor byte-for-byte. ONE new optional RecordPage prop `suggest`.
- `record-core/types.ts` — `FieldDef.suggestTaskId?: string`; `ObjectConfig.pipelineField?: string`.
- `index.ts` — export `useSuggestions`, `SuggestionPanel`, `Pipeline`, `Chip` + their prop types.
- `record-core.css` — untouched (panel/pipeline CSS stays inline in their components, editor convention).

## starter (app) files — append-only
- `server/store.mjs` — new `suggest(objKey, id, field, changes)` op: sets `row[<field>__suggestions] =
  changes` (full replace), emits ONE clean timeline event. Deterministic (no clock/random; ids come from
  the task output).
- `server/store-remote.mjs` — register `"suggest"` in `LOGGED_OPS` (replay-safe).
- `server/server.mjs` — two routes, both `deny("edit", {own})` (reuse the existing `edit` action — no new
  action, no permission-table change): `POST /api/objects/:obj/:id/suggest/:field` runs the field's
  `suggestTaskId` via `runAiTask` (real) else a labeled MOCK (mirrors the enrich seam) → `store.suggest`;
  `PATCH /api/objects/:obj/:id/suggest/:field` persists resolved `{changes}` → `store.suggest`.
- `src/app/api.ts` — `requestSuggestions(obj,id,field)` + `persistSuggestions(obj,id,field,changes)`.
- `src/app/RecordView.tsx` — pass the `suggest` bundle (request → reload; persist statuses) to RecordPage.
- `journeys/fixtures/suggestions.config.json` — one object, a richText field with `suggestTaskId` +
  `pipelineField`, seeded `Block[]` with distinct paragraph openings.
- `journeys/extra/suggestions.mjs` — journey on **PORT 5650** (band 5650-5699), no creds → mock path.
- `docs/feature-manifest.md` (+ RECIPES / DATA-MODEL) — one `AI suggestions (tracked changes)` row.

## storage model
Suggestions live on the record under a derived sibling key `<field>__suggestions` (config-driven, from the
richText field key). Content edits persist via the editor's existing debounced content save; resolved
statuses persist via the suggest PATCH route — the two-channel model matches the source exactly.

## testids
`suggest-request`, `suggestions-panel`, `suggest-accept-<id>`, `suggest-reject-<id>`, `suggest-undo-<id>`,
`suggest-accept-all`, `suggest-reject-all`, `suggest-pipeline` · reuses editor `edit-<blockId>`, `ne-chg`.

## journeys (band 5650)
(1) open record → "Request suggestions" → inline tracked changes render in the editor + the rail panel
lists them; accept one → its `original→replacement` merges into the block text (visible), the inline widget
resolves; reject another → its original text stays, replacement gone. (2) pipeline renders the config states
with the record's current stage marked.
