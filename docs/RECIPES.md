# RECIPES — exact files, exact order

Task cookbook. Each recipe names the files touched and the order of operations. If a recipe and the code disagree, the code won; fix the recipe in the same commit.

## Add an entity
Fastest: `npm run generate object Invoice -- --fields "name:text:primary,amount:currency,stage:select:Draft|Sent|Paid,owner:user"` — writes the config entry (board on the first select, seeded rows, `npm run model` refresh). By hand:
1. `starter.config.json` → append to `objects[]`: `key/label/labelOne/icon`, `fields[]`, optional `stageField` (a select field's key → enables the board), `defaultView`, and demo data (`sampleRows` with stable ids, or `seedCount`). Relation targets must be listed BEFORE the objects that point at them.
2. Nothing else — tables/board/chart/record page/pickers/filters/nav derive from config.
3. `docs/feature-manifest.md` → one row. A journey asserting a VISIBLE outcome (`npm run generate journey <name> -- --feature "<row>"` scaffolds one under `journeys/extra/`).
4. `npm run journeys`.

## Scaffold a page or journey
- `npm run generate page Reports` → `src/app/pages/Reports.tsx` from `scripts/templates/page.tsx.tpl` (edit the template once — every later generate uses your version) + auto-registered at the `// generate:pages` marker.
- `npm run generate journey invoice-flow -- --feature "Invoices board"` → `journeys/extra/invoice-flow.mjs` skeleton, auto-loaded by the runner.
- All subcommands are flag-driven (no prompts) so an agent can run them headlessly; `--dry` on `object` prints the JSON without writing.

## Add a field to an existing entity
1. `starter.config.json` → append to that object's `fields[]`. Types: `text · longText · number · boolean · rating · select · multiselect · array · date · dateTime · currency · email · url · json · relation · user · money · emails · phones · links · address · fullName`. Select/multiselect options may be strings or `{value, label, color}` (colored chips everywhere). Field flags: `unique: true` (duplicates 409), `isActive: false` (hidden + write-protected, data preserved), `scale` for ratings.
2. `email/url/number/date/select` values are validated server-side FROM the type — no separate validation block (`server/store.mjs` `validate()`). Shaped types validate too: `money` wants `{ "amount": 12500, "code": "EUR" }`, `emails`/`links` check every entry, `phones` is lenient (digits/+/spaces).
3. `user` fields read the top-level `users[]` directory; `multiselect` needs `options`.
4. Shaped values: `money {amount, code}` (renders “€12,500”, sums by `amount` in rollups/charts) · `emails/phones/links` are `string[]` (chips in cells, list editor on the record page; links anchor with the bare host) · `address {street, city, postcode, country}` (cells show “street, city”) · `fullName {first, last}` (cells show “First Last”; may be `primary` — the row link and record title render the joined name). CSV export flattens them (`12500 EUR` · `a; b` · joined).

## Edit the schema at runtime (config-as-data)

`starter.config.json` is the immutable SEED; the Schema page (`#/p/schema`, gated by `FEATURE_SCHEMA`, owner/admin — the server 403s everyone else) edits the LIVE schema through three command-logged store ops: add an object (born with its primary text field), add a field (any supported type, select options with colors, `unique`), edit a field (label · options · isActive · unique). Changes persist through the command log and replay on boot in strict order with the data writes that depend on them; the config FILE is never written. A successful commit reloads the app so `/api/config` re-serves the merged schema to every surface (tables, record pages, pickers, import mapping, relations). Retire (`isActive: false`) is the lifecycle lever — data stays, re-activation restores it. Guard rails, each a 400 naming its reason: field/object keys are immutable and unique; a field's type cannot change while rows hold values; the primary field cannot be retired; `unique` is refused while duplicate values exist (they are named); removing a select option still in use is refused (a rename is remove+add, so it inherits the rule); object delete and field hard-delete do not exist in v1. Seed evolution: if the seed later gains a key an old log also added, the seed wins (the replayed delta is skipped with a warning).

## Relations (identity model: store ids, read labels)

Relation fields persist target row IDS — single: `"co_1"` · many (`multiple: true`): `["ce_1", …]` · polymorphic (`relationTargets: ["a","b"]` instead of `relation`): `{ "object": "a", "id": "a_1" }`. Every read projects the target's PRIMARY label into the field itself (the API returns label strings, exactly as before) and adds `_refs` — the raw ids per relation field — for identity-aware UI. Writes accept an id, an `{object?, id}` ref, or a primary-label string: a label resolving to ONE live target normalizes to its id; two candidates → 400 naming them; no match → the string stays verbatim (a dangling label). Because links are ids: renaming a target updates every inbound cell with no sweep; merging re-points losers' ids to the winner; a TRASHED target keeps projecting (restore heals); DESTROYING a target severs its inbound links. `inverseLabel` on a relation field names the reverse related-list section on the target object. Seed rows may use labels — they normalize to ids once at boot. The create dialog authors single relations by id (poly selects grouped per type); `multiple` relations attach on the record page via the checkbox picker, which commits ONE write when it closes.

## Make a field AI-enrichable
1. On the field: `"primitive": { "kind": "task", "taskId": "<AI task id>", "label": "Company research" }`.
2. The record page shows a sparkle Run button → `POST /api/objects/:o/:id/enrich`; while it runs the button becomes a ThinkingDots indicator.
3. Ship real: set `NEXUS_API_KEY` (+ `NEXUS_BASE_URL`). With a `taskId` on the field the route runs the AI task via `runAiTask` (`server/aiTaskRunner.mjs`) and writes the result — the UI and config don't change. Without a `taskId` (or without the key) it returns the labeled mock value, byte-unchanged.

## Add AI inline suggestions (tracked changes) to a richText field
1. On a `richText` field: `"suggestTaskId": "<AI task id>"`. Optional on the object: `"pipelineField": "<select field key>"` renders a generic state Pipeline over that field's options above the editor.
2. The record page mounts the review surface for that field — the editor with a "Request suggestions" button. Clicking it calls `POST /api/objects/:o/:id/suggest/:field`, which stores tracked changes on the derived sibling key `<field>__suggestions`. Each change is an inline widget in the text (del original → ins replacement) plus a card in the right-rail panel.
3. Accept folds a change's `original → replacement` into the document (through the editor's debounced save); reject/undo revert it. Resolved statuses persist via `PATCH /api/objects/:o/:id/suggest/:field` (`{changes}`) — the content and the review state persist on their own channels.
4. Ship real: set `NEXUS_API_KEY`. With a `suggestTaskId` on the field the route runs the AI task via `runAiTask` and normalizes its output (`{changes:[{original,replacement,reason?,kind?}]}` or a bare array) into tracked changes. Without a `suggestTaskId` (or without the key) it serves a labeled mock derived from the document — the UI and config don't change.
5. Library pieces (nexus-ui): `useSuggestions(blocks, onBlocksChange, changes, onChangesChange)` (the accept/reject/undo engine), `SuggestionPanel` (the rail), `Pipeline`/`Chip` (the state indicator) — all entity-agnostic.

## Add a whiteboard (canvas) field to an object

1. `starter.config.json` → append to the object's `fields[]`:
```jsonc
{ "key": "sketch", "label": "Sketch", "type": "whiteboard", "width": 150 }
```
2. The record page mounts an excalidraw canvas as a full-width block — after the hero in the `document` layout, below the details in `standard` (side peek included). The editor lazy-loads only when a record with the field is open; list pages stay light.
3. The value is plain scene JSON through the normal patch path: `{ "elements": [...], "files"?: {...} }` — elements always, plus an image `files` map (excalidraw's base64 blobs) only when an image is on the board, so lean drawings stay lean (every mount scrolls to content; a stored `appState` key is tolerated and ignored). Saves debounce behind a Saving…/Saved chip and only fire when ELEMENTS or the referenced FILES change — pans, zooms, selections and remote cursors never write. The server validates the shape (`elements` must be an array) and the timeline logs `canvas · N elements`, never raw JSON.
4. Cells (table + kanban card) render a memoized SVG thumbnail from the stored scene (cached by content + theme, re-derived on a live dark-flip); an empty scene shows a subtle canvas glyph and loads nothing. Free-text search skips whiteboard values (geometry is not prose), and the field is excluded from the FilterBar.
5. The excalidraw chrome (toolbar, tool buttons, popovers, panels, menus) is themed to the app tokens automatically: a scoped binding layer in `record-core.css` derives excalidraw's own CSS variables from `--nx-*`, so the canvas matches your brand and re-derives on any theme or skin change with zero configuration. Foreign excalidraw UI (the library, the keyboard-hint banner, the help dialog) is trimmed. Alongside excalidraw's own toolbar and properties panel (fill, stroke, palette, width, roughness, opacity, z-order), a token-styled **ops rail** floats top-right with the controls excalidraw has no toolbar for: a config palette, insertable templates, boolean/shape ops, arrange (z-order + group/ungroup), and live-presence avatars. This is the standard pattern for any embedded vendor surface; the flow view binds `--xy-*` the same way.
6. Full "collaborative MS Paint" depth, all surfaced: freehand + shapes (rect/ellipse/diamond/line/arrow) + text + images (drop/paste/place) natively; boolean/shape ops (add/subtract/intersect/exclude, and split) as a real polygon-clipping layer over closed shapes — excalidraw has NO native boolean, so curved shapes are polygonised and the result is a filled polygon (a hole is drawn as an outline; flagged); select/move/resize/rotate + z-order + group/ungroup; and a presence seam (opt-in — a same-origin BroadcastChannel provider today, swappable for a yjs foundation, behind the same interface).
7. Mobile (≤768px): the field rests as a static preview + an "Edit canvas" button; the tap opens a fullscreen overlay editor with native touch draw/pan/pinch and a compact ops rail. Inline drag-draw is a desktop interaction by design — the page never traps touch scroll.

**Config surface (client-composable).** Every capability is config-declared with a sensible default (works out of the box) AND overridable — add a `whiteboard` object to the field. Omit it for full depth; narrow it to tailor the canvas:
```jsonc
{ "key": "sketch", "label": "Sketch", "type": "whiteboard", "whiteboard": {
  "tools": "all",                 // or an allowlist: ["selection","rectangle","ellipse","text",…]; un-listed tools are hidden (selection + hand always kept)
  "palette": ["#1e1e1e","#1971c2","#2f9e44","#e03131"],  // quick fill/stroke swatches ([] → no palette cluster)
  "templates": "all",             // or ["kanban","matrix2x2","flow","timeline","mindmap"] or inline {key,label,elements[]}; false → off
  "booleanOps": true,             // add/subtract/intersect/exclude + split
  "arrange": true,                // z-order + group/ungroup
  "recordDrag": true,             // drop a record onto the canvas → a linked card
  "presence": false,              // live remote cursors (opt-in)
  "grid": false, "zenMode": false, "snap": true,
  "saveAsImage": true, "clearCanvas": true
} }
```
Defaults are full depth (every tool + palette + all templates + boolean/arrange/record-drag on, presence off). Styling stays `--nx-*` token + skin composable — a re-skin re-derives the whole surface (chrome + ops rail) with zero JS. Each surfaced control persists through the same one-patch save path (boolean/template/arrange changes are undoable and saved like a hand draw). Record-drag accepts a drag payload `application/x-nexus-record` (`{object,id,label}`) or a JSON `text/plain`; wiring draggable record sources is host-level.

**Wiring to Nexus.** The scene is an ordinary JSON field on the records API (`PATCH /api/objects/:key/:id` with `{ "<field>": { "elements": [...], "files"?: {...} } }`), so a workflow or agent can read or write canvases like any other field — e.g. an AI task that generates a diagram writes its scene into the field and the thumbnail + canvas render it on the next poll. Elements follow excalidraw's serialized-element shape.

## Extend a field type's editors (field-type registry)

Every field type's editors live in ONE registry — `src/ui/record-core/fields/`, one folder per type. A folder's `definition.ts` registers the render-side slots (record-page `render`, list `cell`, `previewText`) AND the draft-side slots the create dialog, form view and guided wizard all share: `Draft` (the controlled editor), `coerce` (raw input → typed value), and `validate` (client-side shape check). The whiteboard field above is one such entry; every built-in type (text, number, currency, select, date, user, money, address, fullName, …) is another.

1. Add a NEW field type: drop `src/ui/record-core/fields/<type>/definition.ts` exporting a `FieldTypeDefinition` with the slots your type needs. It self-registers (the registry globs the folder) — no switch statement to edit anywhere. Its `Draft`/`coerce`/`validate` then ride the SAME create dialog, guided wizard and form-view pipeline as every other type.
2. The pure draft core `fields/draft.ts` (`coerceDraft` · `validateDraft` · `withStageDefault` · `requiredKeys`, node-tested) drives all three create surfaces; it consults each type's registered `coerce`/`validate` first, so a custom type gets typed create + client validation for free by filling its entry.
3. One registry, every surface: the create dialog, the record page, the form view and the guided wizard read the same slots, so a field renders and validates identically wherever it appears — the drift that used to exist (three select renderings, number coercion missing from the dialog) can't come back.

## Async Nexus building blocks (server)
- **`runAiTask(store, emitEvent, {taskId, objectKey, recordId, buildInput, applyOutput, onFail?})`** (`server/aiTaskRunner.mjs`) — run one AI task against a record in the background, write the result, revert on failure. Powers `/enrich`.
- **`fireAsyncGeneration(store, {objectKey, placeholder, webhookUrl, payload, emitEvent?})`** (`server/asyncGeneration.mjs`) — create a placeholder record now, make it durable, fire an off-machine generation webhook; the finished record lands back via the warehouse.
- **`emulatorChat(deploymentId, {message, sessionId?, context?, contextLabel?})`** (`src/lib/nexusClient.mjs`) — one turn of native agent chat through the emulator session API.
- **`RemoteStore.sync()` → `POST /api/sync`** pulls an external writer's warehouse events into the running app (no restart); `api.syncStore()` on the client. Pointer env vars follow the `<FEATURE>_TASK_ID`/`_DEPLOYMENT_ID`/`_WEBHOOK_URL` convention — optional, no live defaults (see `.env.example`).
- **`WAREHOUSE=local` (`server/warehouse-local.mjs`)** — a file-backed command-log warehouse (node `fs` only, zero-dep, `WAREHOUSE_LOCAL_PATH` for the file) so `sync()` + the async-generation writeback run with NO platform creds. The demo + journeys set `WAREHOUSE=local`; the default app (no `WAREHOUSE`) stays in-memory and the Sync button reads "up to date".
- **Live-sync affordance (topbar)** — a Sync button (`api.syncStore()`, ThinkingDots while working, then "synced N" / "up to date"). App-level, always present; on the in-memory app there is nothing external to pull.
- **Rich-text save-state** — the `richText` field editor coalesces keystrokes through nexus-ui's `useDebouncedSave` and shows a "Saving… / Saved" chip. Automatic on every `richText` field; no config.

## Add an async-generation action to an object
1. `starter.config.json` → on the object add `generate` (see DATA-MODEL "App-object options"): name the `statusField` (a `select` with a generating value + a ready value) and optionally a `resultField` (the `richText`/text field the finished record fills). Demo: the `reports` object.
2. Boot with a warehouse so the external-writer catch-up is live: `WAREHOUSE=local` (offline, file-backed) or `WAREHOUSE=bigquery`.
3. The list gains a "Generate" button: it drops a placeholder row (status = the generating value) with an in-flight indicator, fires `/api/_mock/generate`, and the finished record lands via the warehouse + the poll's `syncStore()` — the SAME row settles to the ready value (a stall hint shows past `stallAfterMs`).
4. Swap the labeled `/api/_mock/generate` writeback in `server/server.mjs` for a real generation workflow — a `fireAsyncGeneration` `webhookUrl` pointing at a Nexus workflow that writes the finished record back to the warehouse.
5. Journey + manifest row.

## Add a custom page (non-record surface)
1. Component under `src/app/pages/YourPage.tsx`.
2. Register in `src/app/pages.tsx` (`key/label/icon/component`) → nav + `#/p/<key>` route appear.
3. Journey + manifest row.

## Add a Spreadsheet (full Univer workbook) page
The built-in Spreadsheet page (`#/p/spreadsheet`) is the reference. For ANOTHER, independently-persisted workbook page:
1. Component under `src/app/pages/YourSheet.tsx`: load/save an `IWorkbookData` blob through `api.state()` / `api.setState(workbookStoreKey("<key>"), snap)` (own key = own workbook), and mount `LazyWorkbookSurface` from `../../ui/blocks/workbook` under Suspense (`value` in, `onChange` out, host debounces).
2. Register in `src/app/pages.tsx` → nav + `#/p/<key>` appear. Journey + manifest row.
3. Free surface (the host owns the snapshot); the `@univerjs` engine is a lazy chunk (zero eager cost). The surface renders as a native page: a single-row toolbar (all ribbon commands, overflow-managed), no card frame — wrap the page root in `.pageBleed` to fill the content area, and pass page controls (save state, reset) as `actions`; they render inside the toolbar row's reserved right end. Every piece of Univer chrome (toolbar, formula bar, sheet tabs, menus, popups) resolves `--nx-*` tokens in both themes, re-derives on skin changes, and the canvas follows `data-theme` automatically. Copy the loading/empty/error/save states from `src/app/pages/Spreadsheet.tsx`.

Reuse: the block (nexus-ui `src/blocks/workbook`; barrel exports `WorkbookSurface` / `LazyWorkbookSurface` / `workbookStoreKey` / `isWorkbookSnapshot` / `seedWorkbook`) is what a future config-driven pages host renders as `kind:"spreadsheet"`. The record-bound variant (rows to records via the store patch path) is a documented seam, not built. A workflow or agent can produce a workbook by writing the same app_state key (`POST /api/state {key,value}`) with Univer's `IWorkbookData` shape.

## Add an activity kind (beyond call/email/meeting)
1. `server/server.mjs` → extend the allowed-kind list in the `/activities` route.
2. `src/ui/record-core/RecordPage.tsx` is the library copy — add the kind + icon in nexus-ui (`ACTIVITY_KINDS` + `evIcon`), then `npm run sync-ui`. Never edit `src/ui/` directly.

## Track work with tasks

Tasks are cross-record to-dos — title, status (`todo`/`doing`/`done`), optional due date and assignee (a users-directory name), and links to any number of records. They are a system entity like teams or webhooks: no config object, on by default, disabled entirely (nav + page + API) with `FEATURE_TASKS=0`.

- **Tasks page** (`/#/p/tasks`): create inline, filter by status/assignee/overdue, grouped into Overdue / Today / This week / Later / Done buckets; your own tasks sort first when you're signed in.
- **On a record**: the Tasks card lists the record's linked tasks; adding one there links it automatically. Completing a task stamps `Task done: …` on every linked record's timeline (creating a linked one stamps `Task added: …`). Unlinking removes it from the record but keeps the task.
- **Assignment mail**: with accounts on, assigning a task to a signed-up user drops a `task-assigned` mail in the outbox (real mail once SMTP is wired) — self-assignment stays silent.
- **API**: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` (filters: `status`, `assignee`, `record=<obj>:<id>`, `due=overdue|today|week`). Viewers read; every other role manages.
- Destroying a record leaves its tasks intact: the dead link renders as an inert "(deleted)" chip and stops navigating.

## Boot as a different product
`CONFIG_PATH=path/to/other.config.json npm run serve` — the config IS the app. Fullest reference shape: `journeys/fixtures/coverage.config.json` (a test fixture, not a template).

## Preview your brand against the kit

`/p/gallery` (hide with `FEATURE_GALLERY=0`) shows the whole component surface on one page — primitives, a live vendored subset, the full library inventory, record-core in miniature, and every field type's read + edit states — with a skin bar that repaints it all instantly. Previews persist NOTHING: they compile through `skinToCss()` into a separate `#nx-skin-preview` style tag, so the app's own skin, the Theme page's saved state, and the `nx-skin-css` boot cache are never touched; reset (or just leaving the page) restores everything. Section headers carry copyable `src/ui/...` import paths, and the inventory footer compares its snapshot stamp against `src/ui/.ui-version` — it turns into a visible warning when someone runs `sync-ui` without refreshing `src/app/gallery.catalog.json`. The record-core minis run on local fictional rows, so the page works even on an empty app.

## Re-brand for an organisation (skins)
1. `starter.config.json` → `theme.skin` = the org's brand as JSON (or `theme.skinPreset` for a built-in; `theme.accent` for the one-knob shortcut). Full knob set → `src/ui/docs/THEMING.md`: brand ramp, dark/brand chrome shell, radius personality (0 = squared, reaches the vendored shadcn kit), fonts, labels, semantic palette, logo mark/wordmark, raw token overrides.
2. Reload — the whole app re-brands, dark mode derives from the same brand. Reference example: the `ember` preset (dark chrome + sharp corners + own palette).

## Put the nav on top

`starter.config.json` → `"app": { …, "nav": "top" }` — the left sidebar is replaced by one horizontal bar: brand, object/page items (with live counts), and search/theme/sign-out on the right; favorites and the team switcher become compact controls in the bar. Omit the field (or set `"side"`) for the default sidebar. Both modes are mobile-responsive out of the box: at ≤768px the nav collapses to a burger that opens a drawer (objects, pages, favorites, team switcher, search, sign-out), and the side peek becomes a full-screen sheet.

## Mobile: the bottom tab bar, shortcuts, and go-to chords
At ≤768px a bottom tab bar renders one tab per `config.objects` — plus a Copilot tab when `copilot` is set — for one-tap navigation; a bounded bar beats a crowded one, so custom/utility pages stay in the burger/drawer (which also keeps favorites, the team switcher, and sign-out). Flag an object `"hideInNav": true` to keep it fully routable (deep links, search, relations) while omitting it from every nav surface (sidebar, drawer, tab bar). `app.goChords` is a config-driven go-to map — `{ "c": "#/o/companies" }` means `g` then `c` jumps there; `?` opens a shortcuts overlay that lists the shell's Core keys beside these App chords (and `n` starts a new record). The reusable overlay + review banner live in nexus-ui (`src/ui/blocks/mobile`); the tab bar is app-shell chrome in `src/app`. The mobile peek gains a bottom review banner that steps the record set you opened (the phone twin of the desktop N-of-M pager).

## Change the base theme
`src/ui/tokens/tokens.css` holds the `--nx-*` canvas (light + dark) — the static layer skins write over. Fix tokens in nexus-ui, re-sync.

## Give an object multiple views
1. `starter.config.json` → on the object, declare the view tabs in order:
```jsonc
"views": [
  { "type": "table" },
  { "type": "kanban", "groupField": "stage" },
  { "type": "chart", "groupField": "stage", "measure": "amount" }
]
```
2. `type` names an installed view definition (`table` | `kanban` | `chart` built in; new types register themselves via a dropped folder, see CONTRIBUTING-AGENTS "Adding a view type"). The other keys are that type's config: `groupField` (kanban/chart) is a select/user field key, `measure` (chart) is `"count"` or a number/currency/money field key. `defaultView` still names the initially-active tab.
3. Omit `views` and the object derives the pre-registry set: the table, plus Board + Chart when a select/user field exists. Runtime precedence: a user's pick in the Columns/group-by/measure/rollup menus (persisted per object, captured by saved views) wins over the `views` entry, which wins over the definition's defaults.
4. A `type` with no installed definition, or a config its definition rejects (a `groupField` that is not a select/user field), renders an inline "not installed" chip in place of the view; the other tabs keep working.

## Give an object a Sheet view (spreadsheet bulk editing)
1. `starter.config.json` → add `{ "type": "grid" }` to the object's `views`:
```jsonc
"views": [
  { "type": "table" },
  { "type": "grid" }
]
```
2. The Sheet tab renders an Excel-grade grid over the object's records: fill-handle drag, range selection, TSV copy/paste that round-trips with Excel/Sheets, full keyboard cell navigation, a frozen primary column, and row markers wired to the same bulk bar the table uses. The grid loads as its own lazy chunk on first switch.
3. What edits in place: text, longText, url, email, number, currency, boolean, select, multiselect and user fields. Everything else renders formatted read-only (dates edit on the record page, relation identity in the picker, rich and shaped values in their own editors). A pasted or filled value the target field cannot hold (an unknown select option, a non-number) is SKIPPED, never written; paste clips to existing rows and never creates records.
4. Table or Sheet: the table is the browse-and-manage surface (side peek, relation links, per-row navigation, the Columns menu); the Sheet is the bulk data-entry and cleanup surface (fill series of cells, move blocks of values, paste from a spreadsheet). Objects that need both declare both, as `demo_sheet` does (hidden from the nav, linked from the Kit demo page).
5. Wiring to Nexus: every grid commit goes through the SAME record patch path as the table (one merged PATCH per touched row), so warehouse logging, live rev-poll sync and permissions all apply unchanged; a record generated or updated by an external writer lands in the open grid on the next sync like any other view.
6. Theming, native feel and skins: the grid paints on a canvas, so its colors resolve from the live `--nx-*` tokens at mount and re-derive when the theme flips or a client skin lands, restyling it with zero code. It is themed to read as a native part of the app, not an embedded widget: its header and row-marker gutter sit on the sunken tone, its cells on the raised surface and its scrollbars are token-colored, all matching the DataTable inside the same bordered card. The selected cell stays legible on any skin: when the selection background (the skin's accent-soft) is too close to the base ink to read, the selected-cell text flips to the higher-contrast pole (white or black), so a bold or dark selection color reads in both light and dark.

## Add a flow (node-graph) view to an object

Records render as draggable cards on a pan/zoom canvas (minimap + zoom controls), connected by ONE relation field's links. Two graph shapes, decided by where the relation points:

- **Self-relation** (`relation` = the object's own key) → record→child edges: org charts (`manager`), dependency maps (`dependsOn` with `multiple: true`).
- **Cross-object relation** (demo: People's `company`) → each distinct target renders as a compact labeled hub with edges to its records: account webs, ownership maps. Hubs come from the relation's identity refs, so they work without the target object being on screen; clicking a hub selects it (records open the peek, hubs don't).

```jsonc
// self-relation dependency map
{ "key": "tasks", "label": "Tasks", "labelOne": "Task", "defaultView": "flow",
  "views": [ { "type": "table" }, { "type": "flow", "relationField": "dependsOn" } ],
  "fields": [
    { "key": "name", "label": "Name", "type": "text", "primary": true },
    { "key": "status", "label": "Status", "type": "select", "options": ["Planned", "Active", "Done"] },
    { "key": "dependsOn", "label": "Depends on", "type": "relation", "relation": "tasks", "multiple": true }
  ] }
```

Config keys on the `views` entry: `relationField` (which relation draws the edges; default = the object's first relation field) · `labelField` (the card title; default = the primary field). A missing/invalid relation renders a plain-language chip in place of the view. The card's meta line shows the first 2 non-primary fields (selects as colored chips), excluding the active relation.

Runtime behavior: with 2+ relation fields a "via" picker appears beside the view switcher and re-draws the graph per relation (persisted per object, captured by saved views). Dragging arranges nodes; only dragged positions persist (per relation), un-dragged nodes re-run the auto layout — dagre ranks up to 2,000 nodes, an O(V+E) BFS-rank grid beyond that, and the canvas windows its DOM (`onlyRenderVisibleElements`), so 10k-row objects stay usable. Rows arriving from filters, searches, or external writers re-derive the graph live.

Scope note: the flow view is records-as-graph. A workflow-builder canvas (node palettes, per-node config drawers, executable runs, edge drawing) is future work and deliberately out of this view's scope — the canvas never mutates records, draws connections, or deletes nodes.

## Add a full-fidelity calendar to an object

Any object with a `date` or `dateTime` field can render a `calendar` view. Add a view entry to the object's `views` array in `starter.config.json`. The minimum is a start field:

```jsonc
{ "type": "calendar", "startDateField": "closeDate" }
```

The full option set (every key optional but `startDateField`, resolved through the pure `viewOptions` mapping so config is the single source):

```jsonc
{
  "type": "calendar",
  "startDateField": "start",
  "endDateField": "end",
  "titleField": "title",
  "colorField": "track",
  "recurrenceField": "repeat",
  "defaultView": "week",
  "enabledViews": ["month", "week", "day", "listWeek", "listMonth", "year"],
  "editable": true,
  "selectable": true,
  "firstDay": "Monday",
  "slotDuration": "30m",
  "snapDuration": "15m",
  "slotMinTime": "00:00",
  "slotMaxTime": "24:00",
  "scrollTime": "08:00",
  "allDaySlot": true,
  "weekNumbers": true,
  "businessHours": true,
  "nowIndicator": true,
  "eventOverlap": true
}
```

| Key | Values | Drives |
|---|---|---|
| `startDateField` | a `date`/`dateTime` field key (required) | which field places the event |
| `endDateField` | a `date`/`dateTime` field key | events become spans, resizable |
| `titleField` | any field key (defaults to the primary) | the event label |
| `colorField` | a `select` field key | events take the field's own option palette |
| `recurrenceField` | a `text` field key holding an RRULE string | rows render as a recurring series (render-only) |
| `defaultView` | `month`·`week`·`day`·`listWeek`·`listMonth`·`year` (default `month`) | the initial view |
| `enabledViews` | a subset of the six above (default all) | which views the picker offers |
| `editable` | boolean (default true) | drag-move, resize, and edit-dialog saves |
| `selectable` | boolean (default true) | drag-select a range to create |
| `firstDay` | a weekday name `Sunday`…`Saturday` (default `Monday`) | the week start |
| `slotDuration` | `15m`·`30m`·`60m` (default `30m`) | the time-grid slot line spacing |
| `snapDuration` | `5m`·`10m`·`15m`·`30m` (default `15m`) | the increment a drag/create/resize snaps to (finer than the slot, for precise-hour placement) |
| `slotMinTime` / `slotMaxTime` | `HH:MM` (default `00:00` / `24:00`) | the reachable time window — keep the full day so early/late events stay reachable |
| `scrollTime` | `HH:MM` (default `08:00`) | the hour a time-grid view opens scrolled to (the rest scrolls into view) |
| `allDaySlot` | boolean (default true) | the all-day lane at the top of week/day |
| `weekNumbers` | boolean (default false) | the ISO week column |
| `businessHours` | boolean (default false) | shade Mon to Fri, 9 to 5 |
| `nowIndicator` | boolean (default true) | the current-time line |
| `eventOverlap` | boolean (default true) | allow events to overlap |

**Views**: a `date` object renders all-day; a `dateTime` object renders timed (with an all-day lane). `week` and `day` pick the day-grid form for all-day objects and the hourly time-grid for timed ones. An event on a `dateTime` field whose value is date-only (`2026-08-14`, no time) renders in the all-day lane, so one object can hold both all-day and timed events.

**Time-grid precision (day/week on a `dateTime` object)**: the hourly grid opens scrolled to `scrollTime` (default 08:00) with the whole 24h reachable by scroll; every hour is labelled and the half/quarter-hour lines are minor. Dragging, creating, and resizing snap to `snapDuration` (default 15m), so events land on precise times. Events resize from EITHER edge — drag the top to move the start, the bottom to move the end. Concurrent events lay out side by side, and the red now-indicator line marks the current time on today's column.

**Demo dates that stay current**: a `sampleRows` string value of the form `@w<weekOffset>.<isoWeekday>[T<HH:MM>]` is resolved at seed time relative to today (`@w0.2T09:00` = this week's Tuesday 09:00; `@w1.1` = next Monday; a value with no time seeds an all-day date). A demo calendar seeded this way always lands on the current week instead of a fixed month. Only `@`-prefixed strings are transformed — absolute dates and every other value pass through. See `server/seed.mjs`.

**Event CRUD**: click (or Enter on a focused event) opens a quick edit dialog (title, dates, an all-day toggle on timed objects, the color field, and the object's other simple fields). Save writes through the store; "Open full record" opens the side peek; Delete asks for an inline confirm, then soft-deletes to trash. Drag-move and resize write the date field(s); dragging a timed event into the all-day lane stores a date-only value (and back). Drag-select a range, or click an empty day, opens the create dialog prefilled. Deletion uses the host's `onDelete` seam (a `ViewProps` member every view can use); the review surface is the dialog's inline confirm.

**Recurring events**: point `recurrenceField` at a `text` field holding an RRULE string, e.g. `FREQ=WEEKLY;BYDAY=MO,WE,FR`. The row expands into occurrences across every view via the FullCalendar rrule plugin (the event's own start supplies the DTSTART). Render-only: editing a rule or a per-occurrence exception is an extension point, not built. Occurrences are drag-locked.

**Resource / timeline views**: the per-resource and timeline views are FullCalendar Premium and are not bundled. Wire them by adding the `@fullcalendar/resource-*` packages (a paid license) and a `resource` config key.

**Wiring to Nexus**: every event mutation goes through the store's patch/create/delete path, so a calendar over a `WAREHOUSE=local` or `bigquery`-backed object tolerates rows changing underneath it (an external writer or a workflow landing a row via the warehouse appears on the next sync with no interaction). To have a scheduled workflow or an agent create calendar rows, write records to the object through the warehouse; the calendar renders them with no extra wiring.

## Add a gallery view to an object
1. `starter.config.json`, on the object, add a `gallery` entry to its `views` (the demo `demo_showcase` object carries one):
```jsonc
"views": [
  { "type": "gallery", "coverField": "cover", "coverFit": "cover", "titleField": "title",
    "cardFields": ["kind", "notes"], "groupField": "kind", "sortField": "title", "cardSize": "m" },
  { "type": "table" }
]
```
2. Keys (all optional): `coverField` names a `url`, `links`, or `array` field rendered as the card cover at a fixed 4/3 aspect (for a list field the first image-like value is used); a missing/broken image falls back to a tokenized initials placeholder, and if the key is omitted the first `url` field is inferred. `coverFit` is `"cover"` (default) or `"contain"`. `titleField` is the card title (default: the primary field). `cardFields` (ordered field keys) render on each card through the field registry — select/multiselect as their colored chips, others as their registry preview; `cardFields` supersedes the legacy `metaFields`, which stays honored. By default cards are **label-less** — dense values (a colored chip for a select, quiet text otherwise) under a prominent title, matching Airtable's card look; set `cardFieldLabels: true` to prefix each value with its field label. `groupField` (a select/user field) splits the cards into collapsible sections with per-group counts; it shares the board's `groupBy`, so a group choice carries across the two views. `sortField` + `sortDir` (`"asc"`/`"desc"`) order the cards. `cardSize` is `"s" | "m" | "l"` (column min-width 200/260/340px). `cardClick` is `"peek"` (default) or `"open"` (the full record page).
3. Interactions: click or Enter on a card opens its record in the peek (cmd/ctrl-click opens a real browser tab). Group-by and sort are ALSO toolbar controls right of the view switcher, matching the board's pickers (they persist per object in the saved-view state); a card's hover checkbox selects it into the shared bulk bar. Cards pack into masonry columns over exact card heights (no measurement pass), windowed per section — only cards near the viewport mount, so a 10k-row object scrolls smoothly.
4. Mobile: the masonry reflows to a single full-width column; tapping a card opens the peek (no hover-only affordance).
5. States: rows render as cards; empty renders a designed empty state with a "create the first one" CTA (when the caller has create rights); a still-generating placeholder row renders gracefully. A `coverField` naming a non-url field, or more than 3 `metaFields`, degrades to the standard explanatory chip in place of the view; the other tabs keep working.
6. Wiring to Nexus: the gallery has no write path of its own — it reads records like any view, so rows created or updated by a workflow, an agent, or an external writer (through the warehouse and `/api/sync`) appear on the next rev poll with no extra wiring.

## Add a form view to an object
1. `starter.config.json`, on the object, add a `form` entry to its `views` (the demo `people` object carries one):
```jsonc
"views": [
  { "type": "table" },
  { "type": "form",
    "sections": [{ "label": "Contact", "fields": ["name", "email"] }, { "label": "Company", "fields": ["company", "size", "channel"] }],
    "requiredOverrides": { "email": true },
    "requiredWhen": { "size": { "field": "channel", "equals": "Event" } },
    "submitLabel": "Add lead", "successMode": "another" }
]
```
2. Keys (all optional): `fields` picks the field subset and their order (default: every form-editable field in config order — `json` and multi-relations are excluded, they edit on the record page). `sections` (`[{label, fields[]}]`) render the fields in labeled groups and supersede `fields`. `requiredOverrides` (`{ key: true|false }`) adjusts the required set over the default (the primary field). `requiredWhen` (`{ key: {field, equals} }`) makes a field required ONLY when its trigger field equals a value (the asterisk appears and validation blocks accordingly). `submitLabel` renames the submit button. `successMode` is `"another"` (default — a success card with "Create another") or `"view"` (open the created record).
3. Rendering: a centered single column at document-layout width; each field is the same per-type editor the create dialog and record page use (one shared field-type registry), with an inline error slot. Submit shows a busy state; on success the designed success card offers "Create another" (resets the form) or opens the record.
4. Validation is layered: the required check + the existing per-type validators run client-side (the same rules the server implies from field types), and a server rejection maps back onto the field its message names (unmatched → a form-level banner). Submit goes through the SAME create path as the dialog — typed numbers coerce (a `"50"` saves as `50`, not a rejected string) and an unset kanban stage defaults to its first option.
5. Single relations author by the target's primary name; the server resolves a label matching exactly one live record to its id (an ambiguous name errors inline, naming the candidates).
6. Wiring to Nexus: a form submit lands as an `<object>.created` event in the typed webhook catalog (`/p/webhooks`, HMAC-signed payload `{ event, data: { row } }`) — point a Nexus workflow's webhook trigger at it to run intake automation (enrich, notify, route) with no app changes. v1 is a config-driven form VIEW; a drag-and-drop form BUILDER (question palette, branching, public share links) is a future lane.

## Give an object a map view

A full-fidelity map: a switchable basemap (streets/light/dark/satellite/terrain), layer toggles (points · clustering · heatmap), color- and size-by-field markers with a legend, draw/measure tools that filter records by the drawn area, search + geocode, routing between records, and click-to-add. Records without coordinates are counted in a corner chip (never silently dropped). Every capability is config-composable with a sensible default and overridable.

1. The object needs two `number` fields holding latitude/longitude, and a `views` entry with `"type": "map"`. The minimum is inference-driven — coordinate fields named `lat`/`latitude` and `lng`/`lon`/`long`/`longitude` are picked up automatically:
```jsonc
{ "key": "sites", "label": "Sites", "labelOne": "Site", "defaultView": "map",
  "views": [
    { "type": "table" },
    { "type": "map", "colorField": "kind", "sizeField": "headcount" }
  ],
  "fields": [
    { "key": "name", "label": "Name", "type": "text", "primary": true },
    { "key": "kind", "label": "Kind", "type": "select",
      "options": [ { "value": "Office", "color": "blue" }, { "value": "Warehouse", "color": "orange" } ] },
    { "key": "headcount", "label": "Headcount", "type": "number" },
    { "key": "lat", "label": "Latitude", "type": "number" },
    { "key": "lng", "label": "Longitude", "type": "number" }
  ] }
```

2. The full config surface (every key optional; each has a default so it works out of the box AND is overridable so a client tailors it):

| Key | Values | Drives |
|---|---|---|
| `latField` / `lngField` | `number` field keys (inferred when omitted) | the coordinates |
| `titleField` | any field key (default: the primary) | the pin/popup title |
| `colorField` | a `select` field key | pins/points/clusters tint from its option palette; the legend lists them |
| `sizeField` | a `number`/`currency` field key | marker radius scales by the value; the legend shows the ramp |
| `basemaps` | a subset of `streets`·`light`·`dark`·`satellite`·`terrain` (default all) | which basemaps the switcher offers |
| `defaultBasemap` | one of the offered (default `streets`) | the basemap on load |
| `clustering` | boolean (default true) | cluster nearby points past the threshold |
| `clusterRadius` | 20–100 px (default 50) | the cluster grouping radius (also a live slider) |
| `clusterThreshold` | number (default 25) | located-count above which clustering activates |
| `heatmap` | boolean (default false) | show the heatmap layer by default (always toggleable) |
| `heatmapWeightField` | a `number`/`currency` field key | weights the heatmap density |
| `legend` | boolean (default true) | the color/size legend |
| `draw` | boolean (default true) | the draw + measure tools (distance/area/radius) |
| `filterByArea` | boolean (default true) | a drawn polygon/circle filters the plotted records |
| `geocode` | boolean (default true) | address search in the map search box |
| `route` | boolean (default true) | route/directions between two records |
| `addPoint` | boolean (default true) | click the map to create a record there (needs create rights) |
| `scaleControl` / `geolocateControl` / `fullscreenControl` | boolean (defaults true/false/true) | the native controls |
| `geocodeEndpoint` / `routeEndpoint` | URL strings (optional) | the provider seam — see below |

3. **Layers** — a Layers panel toggles Points, Cluster-nearby (with a live radius slider) and Heatmap; the choices persist per object in the saved-view state. Points render as real keyboard-focusable pin buttons up to the threshold (or with clustering off, up to 400), and as GPU circles/clusters above it. Turning Points off leaves a heatmap-only view. With clustering OFF, pins that collide on screen **spiderfy** — they fan onto a ring with a leader line to the true location, so tight groups stay individually readable + clickable (recomputed as you zoom/pan).

4. **Basemaps** — the switcher offers vector styles (OpenFreeMap `bright`/`positron`, CARTO `dark-matter`) and raster imagery (Esri World Imagery satellite — a HYBRID with transparent road + place-label overlays, OpenTopoMap terrain). All are FREE and keyless — no token can leak. When a style/tile host is unreachable the view falls back to a token-only canvas (markers, clustering, heatmap, draw and popups keep working) and shows a "Map tiles unavailable" chip; offline CI runs on exactly this path. All chrome (controls, panels, legend, popups) is token-themed in light and dark and re-derives on a skin change; over a **dark basemap** the floating chrome + native controls drive the dark tokens in any app theme (no white-cards-on-black).

5. **Draw / measure / filter** — the tool rail draws a line (distance), a polygon (area) or a radius circle; a drawn polygon/circle also filters the plotted records to those inside (a "N of M in area" chip clears it). **Route** picks two records and draws a path with a distance + ETA. **Add point** opens the create dialog seeded with the clicked coordinates (the review surface — no silent write).

6. **Geocode + route provider seam** — geocoding and routing ship with a LOCAL deterministic MOCK (works offline; a small gazetteer + a great-circle route), so the capability is wired end-to-end with no external service and no key. To use a real provider, set `geocodeEndpoint` / `routeEndpoint` on the view to an APP route that proxies a keyed vendor SERVER-SIDE (the key never reaches the browser). Shapes: geocode returns `[{ label, lng, lat, bbox? }]`; route takes `{ waypoints: [[lng,lat],…] }` and returns `{ coordinates: [[lng,lat],…], distanceM, durationS }`. See `src/ui/record-core/views/map/geocode.ts`.

7. **Wiring to Nexus** — records usually arrive with coordinates set (imports, warehouse sync); a record created or updated by a workflow, agent or external writer appears on the next rev poll like any view. To geocode an address INTO `lat`/`lng` at write time, use the AI-enrichment seam ("Make a field AI-enrichable"): a `primitive` task on an address field whose output writes the two number fields.

8. Demo object: `demo_places` (hidden from the nav; front door on the Kit demo page) — a dense, realistic geo demo (100+ located rows across Western Europe, colored by kind and sized by headcount). Journeys + manifest rows: `journeys/extra/map-view.mjs`; pure cores unit-tested in `journeys/unit/map-geo.test.ts` + `journeys/unit/map-depth.test.ts`.

## Save + share list views
Views menu (any object list): shape filters/layout/grouping/rollup → "Save current as view" → named, server-persisted, visible to the whole workspace; "All <object>" resets. Kanban Rollup picker: sum/avg/min/max over any numeric field per column. Bulk edit: select rows → Edit → field + value (empty clears) with live progress. Multi-level sort: shift-click a second header.

## Add a journey
1. Append to the array in `journeys/run.mjs`: `{ name, feature, async run(page) }` — `feature` must EXACTLY match a manifest row's Feature column (the runner stamps `Last verified` by that string).
2. Assert VISIBLE outcomes (a value changed, a card moved, a toast) — never a bare 200.
3. Radix menu items are reachable by POINTER (click the item) and by KEYBOARD (press ArrowDown UNTIL the target has `data-highlighted`, then Enter — blind arrow counts race the focus transfer). Keyboard is geometry-free; a pointer-click also asserts the popper is positioned on-screen (`journeys/extra/popper-positioning.mjs`).
4. If the journey changes persisted view state (saved views, group-by), RESTORE defaults at the end — journeys share one browser context.

## Wire real auth
Set `AUTH_USERS` (`user:pass,user2:pass2`) + `APP_SECRET` (32+ chars) → the login gate arms. See `.env.example`. Swap the seam for SSO/OAuth in `server/auth.mjs` — the gate call-sites don't change.

## Turn on accounts, teams, permissions
1. `.env`: `AUTH_MODE=accounts` + `APP_SECRET` (32+ chars). Signup/verification/reset/deletion flows arm; mail lands in the dev outbox (`GET /api/outbox`) until `SMTP_URL` + a real transport are wired in `server/email.mjs`.
2. Teams live at `/p/team`: create, invite by mail, or share the join code. Roles: owner > admin > member.
3. Per-object permissions in the config: `"permissions": { "admin": [...], "member": ["view","create","editOwn"], "viewer": ["view"] }` — omit the block and everything stays open. Roles: owner > admin > member > viewer. `editOwn`/`deleteOwn` grant the action only on rows the caller created (`_createdBy`). The server 403s uncovered actions; the UI hides their affordances (`src/app/permissions.ts` mirrors `server/permissions.mjs` — keep them in sync).
4. Team-scoped data: `"teamScoped": true` on an object → rows belong to the creator's ACTIVE team (the sidebar switcher; `x-nx-team` header), other teams can't see or reach them, and the caller's PER-TEAM role governs. The team page also carries the audit trail (invites, joins, role changes, revocations); removing a pending member kills their invite token.

## Go persistent (native warehouse spine)
1. `.env`: `WAREHOUSE=bigquery` + `NEXUS_API_KEY` + `WAREHOUSE_CREDENTIAL_ID` (from `nexus tool credentials <toolId>` — tool-scoped, not the org-wide id). Optional: `BQ_DATASET`/`BQ_LOCATION` (location must match the dataset's region) / `BQ_PROJECT`.
2. Boot — the server creates the dataset + `events` table, then REPLAYS the append-only command log over the deterministic seed: same ids, true timestamps, nothing lost across restarts. Unset `WAREHOUSE` and the in-memory mock serves the identical API.
3. Semantics: single writer; the job queue + webhook delivery logs are operational state and stay in memory (a restart drops pending jobs). Files ride the log as base64 — move heavy attachment volumes to object storage before they matter.

## Point an AI assistant at the app (MCP)
`claude mcp add my-app -- node scripts/mcp-server.mjs` (the app must be running; `NX_APP_URL` overrides the target). Read-only tools: `list_entities · describe_entity · query_records · get_record · get_timeline`. Claude Desktop config lives in the header of `scripts/mcp-server.mjs`.

## Notify another system on record changes (webhooks)
`/p/webhooks` → endpoint URL + events from the typed catalog (`<object>.created/updated/deleted`, `*`). Deliveries are HMAC-SHA256 signed (`x-nx-signature`, secret shown once) and logged per endpoint; failures retry via the job queue.

## Run something on a schedule (jobs)
One handler per type in `server/jobs.mjs` + `enqueue(store, "<type>", payload)`. The shipped `digest` job (arm with `DIGEST_EVERY_MS`, optional `DIGEST_TO`) is the reference: rollups into `app_state`, runs visible at `/api/jobs`.

## Work the list without a mouse

Tables carry a three-level focus model: ↑↓ (or j/k) move a row focus; `x` selects (Shift+x extends, Cmd/Ctrl+A selects all); Enter drops into cells; arrows move spreadsheet-style; typing on a cell opens its editor seeded with the keystroke; Enter saves and steps down, Tab saves and steps sideways; Escape climbs back out one level at a time. Cmd/Ctrl+Enter opens the focused record in the side peek.

## The side peek

Rows open in a right-edge panel over the list (set `"openIn": "page"` on an object to navigate instead). Related records stack onto the same panel — Escape steps back, then closes; the panel root rides the URL (`?peek=<id>`), so reload and share restore it; cmd/ctrl-click a row link for a real new tab. The header pages through the set you opened from (N of M, wrapping). In a relation picker, a search with no match offers "Create …" — the record is born with just a title, attached, and opened for progressive completion.

## Pick a record-page layout

`recordLayout` on an object chooses how its record page is shaped (default `"standard"`):

- **`"standard"`** — the fields panel (inline-edit rows) beside the timeline/notes/files tabs. A `richText` field spans the FULL details column (label above, editor below) and stays readable at any width, including inside the narrow side-peek, so a rich document is never crammed into the value half-column.
- **`"document"`** — a Notion-style full page: the object's first `richText` field becomes a WIDE hero editor as the main column, and everything else (the other fields, related lists, timeline/notes/files) moves into a compact sidebar. A `"document"` object opens in FULL PAGE by default (set `"openIn": "peek"` to override). With no `richText` field it falls back to standard.

Both layouts render the same editor + the AI-suggestions review surface (`suggestTaskId`), and both degrade gracefully in a narrow container: the editor+rail grid stacks the rail under the editor rather than crushing the document column.

```jsonc
{ "key": "docs", "label": "Docs", "labelOne": "Doc",
  "recordLayout": "document", "pipelineField": "status",
  "fields": [
    { "key": "title", "type": "text", "primary": true },
    { "key": "status", "type": "select", "options": ["Draft", "In review", "Approved", "Published"] },
    { "key": "body", "type": "richText", "suggestTaskId": "doc-suggest" }
  ] }
```

## The panel: peek, search, actions

The side panel is a page STACK, not just a record preview — record pages, a search page, and an actions page all push onto one navigation history with shared crumbs, back, and the layered Escape (clear text → step back → close; Backspace on an empty search also steps back). `/` (outside inputs, dialogs, and focused table cells) opens the search page: always-focused input, live results across every object (type labels when they span objects), ↑↓ + Enter pushes the hit onto the same panel so the list behind never navigates. The ⚡ button on a record peek — or Cmd/Ctrl+K while the panel is open — stacks the actions page: the same context actions the ⌘K palette shows (favorite, promote, new, trash…), plus "Search records". Search/actions pages are ephemeral: only a record root rides the URL, so reload lands on the record or closed.

## Recover deleted records (trash)

Deleting is recoverable: rows get a `_deletedAt` stamp and move to the per-object Trash (toolbar icon next to New). Restore brings a row back intact; **Delete forever** is permanent and is its own permission — grant `destroy` (and optionally `destroyOwn`) in the object's `permissions` table; `restore` rides the `delete` grant. Owners always hold both. Set `TRASH_RETENTION_DAYS` to auto-destroy expired trash (a `trash-sweep` job runs on an interval; unset/0 keeps trash forever).

Creating a record whose unique field matches a TRASHED row restores that row and applies the incoming data (the response is `200` with `_resurrected: true` and the original id) — imports and re-syncs converge instead of colliding. A collision with a live row still 400s.

## Find duplicates

Every object gets deterministic duplicate detection — no scoring, no AI, each match explainable in one sentence: same normalized primary (case, accents, spacing and punctuation ignored); one normalized primary beginning the other at a word boundary when the shorter is ≥ 8 characters; the same email-field value; the same url-field domain. Unique fields are skipped — the server already makes live collisions impossible, so a unique match can't exist. Trashed rows never match.

Two surfaces: a record with suspected twins shows a **Possible duplicates** section (each candidate names its matched rule; one click opens the merge dialog preselected — Cancel moves nothing and leaves the pair selected on the list), and any list's **Find duplicates** action sweeps the whole object into groups with a per-group Review merge. Read-only API: `GET /api/objects/:key/duplicates` (groups) and `GET /api/objects/:key/:id/duplicates` (one record's candidates) — both ride the `view` permission; merging stays behind `edit`+`delete`.

## Merge duplicates

Select 2–10 rows → **Merge** → pick the survivor. The preview shows the final value per field and where inherited values come from: the winner keeps its values on conflict and absorbs the losers' non-empty fields into its own empties. Relation fields elsewhere that pointed at a loser re-point to the winner; timelines and watchers travel; losers land in the trash. `POST /api/objects/:key/merge {ids, winnerId, preview?}`.

## Import records from CSV

Any object list → **Import** (toolbar) → paste CSV text or pick a `.csv` file → map columns to fields (auto-matched on name/label; the primary field must be mapped) → preview the first rows against the server's validators → run. Rows import in chunks with live progress and a cancel between chunks; the summary counts created / restored / skipped / failed, and failed rows download as a CSV with the reason per row. A unique value matching a TRASHED row restores it (original id, new data); a collision with a live row is skipped as a duplicate. Another system can call it directly: `POST /api/objects/:key/import {rows: [{field: value}], preview?}` — rows keyed by field key, at most 2000 per call, gated by the `create` permission.

## Let another system call the app (API keys)

`/p/apikeys` (owners/admins; `FEATURE_APIKEYS=0` hides page + API together) → name + role → **Create** → copy the `nak_…` key: it is shown exactly once, only its sha256 hash is stored. A request carrying the key authenticates as the key's role through the same permission tables as a signed-in member, with or without account auth:

```
curl -H "x-api-key: nak_…" https://your-app/api/objects/companies
```

`Authorization: Bearer nak_…` works too. Scoping: a `viewer` key reads whatever viewers can view and nothing more; `member`/`admin` keys follow each object's `permissions` table; revoking a key kills it immediately (every call answers 401). Team-scoped objects stay session-only — keys carry no team membership.

## Pin favorites

The star on any record header pins it to a Favorites section in the sidebar. Pins are personal and device-local (localStorage), so they work with or without accounts.

## Add an AI copilot side-panel

A docked right-column panel that chats with a native agent about whatever the user is looking at. Add a `copilot` block to `starter.config.json`; omit it and nothing renders (the iframe `chat.embedUrl` dock is the fallback).

```jsonc
"copilot": {
  "title": "Copilot",            // header + toggle label
  "mark": "C",                    // 1–2 char brand glyph (falls back to a sparkle)
  "emptyStateCopy": "Your in-app assistant. It sees the record or list you're on.",
  "suggestions": ["Summarize what I'm looking at", "Draft a follow-up for this record"]
}
```

Point it at the agent with the `COPILOT_DEPLOYMENT_ID` env var (the deployment id is a secret — it never lands in the browser-visible config). Set `NEXUS_API_KEY` too; without both, `/api/copilot` returns 400 and the panel shows the error inline.

**Per-object context (no hardcoding).** Each object's `contextFields: ["name", "status", …]` names the fields sent to the agent when a record of that object is open (omitted → the primary field only). Lists and pages send their label; the home sends the app name. So the copilot always knows what the user is looking at without any per-object code.

Open it with the toggle in the chrome, `⌘/Ctrl+I`, or `c`; `Escape` closes it. The reply renders as Markdown and shows the agent's invoked tools as chips.

## Add a guided create flow
Give an object a `createWizard` in `starter.config.json` and its "New <object>" opens the library **Wizard** (a guided-vs-blank landing) instead of the plain create dialog:
```json
"createWizard": { "questions": [
  { "key": "title",  "label": "Title",  "kind": "text",   "required": true },
  { "key": "status", "label": "Status", "kind": "select", "options": ["Draft","In review"], "required": true },
  { "key": "body",   "label": "First paragraph", "kind": "long" }
] }
```
Each question's `key` names the field it fills. A `text`/`long` answer written to a `richText` field becomes a one-paragraph block value (via `textToBlocks`). Question `kind`s: `text` · `long` · `select` (auto-advances on pick) · `list` · `sources`; `required` (on text/select/long) gates **Next**. Omit `createWizard` and the plain dialog is used, unchanged.

## Ship
`npm run precheck` (tsc + build + journey-stamp freshness) → `docs/PRODUCTION_CHECKLIST.md` → push. CI runs the full journey suite; the deploy gate reads `journeys/.last-pass` + the manifest stamps.
