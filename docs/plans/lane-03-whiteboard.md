# Lane 3 — whiteboard field type

Goal: a `whiteboard` field type (excalidraw canvas per record) registered through a new minimal field-type registry, with SVG thumbnails in list cells and scene JSON persisted through the normal record patch path.

File plan (nexus-ui `src/record-core/`): `fields/{types,resolve,registry}.ts` + `fields/glob.d.ts` (registry shell, mirrors `views/`; per-type entries carry render-side slots — `render`/`cell`/`previewText`/`layout`/`filterable`/`keyboardEditable`/`clearValue` — and editor-side slots — `Draft`/`coerce`/`validate` — filled by the form/editor unification) · `fields/whiteboard/{definition.tsx,WhiteboardField.tsx,Thumbnail.tsx,scene.ts}` · registry hooks in `RecordPage.tsx` (before the type switch + block breakout in both layouts), `DataTable.tsx` (cell branch, `formatCell`, `csvCell`, keyboard-grid lists), `KanbanBoard.tsx` (card meta), `Filters.tsx` (`filterableFields` skips `filterable:false`) · block styles in `record-core.css`.

Starter: `starter.config.json` — `sketch` field appended to `docs` + seeded scene on `doc_1` · `server/store.mjs` — whiteboard cases in `validate()` + `flatVal()` + q-search skip · `src/app/pages/Gallery.tsx` — whiteboard row in `FIELD_SAMPLES` · docs rows (manifest, RECIPES, DATA-MODEL hand note, DEPENDENCIES, CONTRIBUTING "Adding a field type", catalog restamp).

Dependency: `@excalidraw/excalidraw` 0.18.1 exact (MIT), lazy-only imports; `@excalidraw/utils` deliberately NOT used (published 0.1.2 predates the 0.18 scene format; the main package exports `exportToSvg`/`getSceneVersion`).

Value shape: `{ elements }` (elements only; every mount scrolls to content, a stored `appState` is tolerated and ignored); saves gated by `getSceneVersion` (viewport pans never write); image tool disabled in v1 (no base64 blobs in the command log).

Mobile: ≤768px the block rests as a static thumbnail + "Edit canvas"; tap opens a fullscreen overlay editor (excalidraw native touch inside); inline drag-draw is desktop-first by declaration. Page scroll is never trapped.

Testids: `field-<key>` block · `whiteboard-save-<key>` chip (`data-state`) · `cell-<rowId>-<key>` thumbnails · `wb-edit-<key>`/`wb-done-<key>` mobile overlay · `wb-invalid-<key>`/`wb-reset-<key>` invalid state.

Journeys (`journeys/extra/whiteboard-field.mjs`, band 5870-5879): canvas-mounts (+ live dark-flip) · draw-persists (WAREHOUSE=local) · table-thumbnail · poll-safety · mobile-tap-to-edit (390x664 touch) · keyboard-a11y · 10k-perf · invalid-value. Unit: `journeys/unit/field-registry.test.ts`.
