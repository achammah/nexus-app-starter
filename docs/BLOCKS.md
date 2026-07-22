# BLOCKS — the free-surface library reference

The composed surfaces in `src/ui/blocks/`. Each implements the contract in
`docs/UI-KIT.md` §"The free-surface block contract"; this file is the per-block
option reference — what you pass, what it stores, what it can do.

> **Acquiring them.** These blocks live in the nexus-ui library and arrive in an app
> through `npm run sync-ui`. A block's own npm dependencies are NOT vendored — the app
> must declare them in its `package.json` or the build fails on an unresolved import:
> `exceljs` (workbook XLSX/CSV), `docx` + `mammoth` (document import/export), `three`
> (3D viewer). Check `src/ui/.ui-version` to see which library commit an app currently
> carries. See `docs/CONSTRAINTS.md` §"A vendored block brings its own dependencies".

---

## `workbook` — a full spreadsheet

A complete Univer workbook: formula engine (400+ functions), formula bar, number formats,
styling, merge, freeze, multi-sheet, insert/delete rows and columns.

**Persistence:** one `IWorkbookData` snapshot per page under `workbook:<pageKey>`.
**Weight:** the engine is lazy — `LazyWorkbookSurface`, zero eager cost.

### `WorkbookConfig`

One config gates which Excel capabilities a surface carries: dial everything off for a
plain grid, leave the defaults for a full financial model. Every key defaults to `true`;
`resolveWorkbookConfig(partial)` merges a partial over the full-Excel defaults, so passing
one `false` flips exactly that feature.

| Key | Gates |
|---|---|
| `filters` | column autofilter — dropdown filter chips on a header row |
| `sort` | range sort: ascending, descending, custom |
| `conditionalFormatting` | color scales, data bars, highlight rules |
| `dataValidation` | dropdown lists, number/date ranges, checkboxes |
| `findReplace` | find and replace across the workbook |
| `notes` | cell notes / comments |
| `importExport` | the XLSX + CSV import and export toolbar actions |

Two ready presets ship: `DEFAULT_WORKBOOK_CONFIG` (everything on) and
`MINIMAL_WORKBOOK_CONFIG` (formula engine and core editing only — a lightweight embedded
grid, no data tooling, no I/O).

### XLSX + CSV round-trip

Univer's OSS engine does not ship client-side `.xlsx` exchange, so the round-trip is built
on `exceljs` — **lazy-loaded**, entering the bundle only when a user actually imports or
exports. Exports: `exportWorkbookToXlsx`, `exportSheetToCsv`. Imports:
`importXlsxToWorkbook`, `importCsvToWorkbook`. `triggerDownload` is the shared file-save
helper, and `WorkbookIOController` is the type the toolbar actions speak.

What survives the round-trip in both directions: values, formulas, the common cell styles
(bold, italic, underline, strike, font size/family/color, fill, number format, alignment,
wrap), merges, column widths, row heights and frozen panes. Anything one side models and
the other does not degrades to the nearest equivalent.

---

## `document` — a document surface and a page workspace

Two surfaces from one block. `DocumentSurface` is a single document; `PageWorkspace` is
the linked page system (tree, nested pages, `[[page]]` links, backlinks, ⌘K) that mounts a
`DocumentSurface` for whichever page is active.

**Persistence:** a single document stores a `DocumentSnapshot` under `document:<pageKey>`;
a workspace stores the whole `PageStore` under `pageworkspace:<key>`.
**Weight:** eager — the editor and outline are light. Only `docx` (export) and `mammoth`
(import) are dynamic, loading when a user actually exports or imports.

### `DocumentSnapshot`

| Field | Meaning |
|---|---|
| `id`, `title`, `blocks` | the identity and the body (the block array); the guard requires exactly these three |
| `icon` | a title emoji |
| `cover` | a preset key (`"preset:dawn"`, `"flat:blue"`) or an uploaded `data:` URI |
| `coverY` | vertical focal point (0–100%) for an uploaded cover |
| `pageWidth` | `"narrow" \| "wide"` |
| `suggestions` | tracked changes, persisted alongside the doc so a review survives a reload — the accepted text lives in `blocks`, the review state here |

Covers are bundled gradients and flat colours, pure CSS with concrete values so an
exported page renders identically standalone. Nothing is fetched: a cover is either a
preset or a user-uploaded data URI. There is no stock-photo provider — a keyed vendor and
an external image host are both ruled out by the CSP rules in `docs/CONSTRAINTS.md`.

### `PageStore`

`{ version, pages: Record<id, PageNode>, activeId?, expanded? }`. A `PageNode` carries
`title`, `icon`, `cover`/`coverY`, `parentId` (null = top level), a fractional `order`
sort key among siblings, `blocks`, its own `suggestions`, `favorite`, and
`createdAt`/`updatedAt`.

The store ships with its whole operation set as pure functions, so a host can drive it
without the UI: `createPage` `duplicatePage` `deletePage` `movePage` `reorderPage`
`renamePage` `setPageIcon` `setPageCover` `setPageBlocks` `toggleFavorite` `setActive`
`setExpanded`, plus the read helpers `rootPages` `childrenOf` `breadcrumb` `descendants`
`backlinksOf` `outboundRefs` `searchPages` `favorites` `plainText`.

### The composability spectrum

ONE document surface, dialable from a Word-like document to a full Notion workspace. Every
structural element is an independent toggle; named presets mark points along the range.
Explicit flags override the preset; anything left undefined inherits it.

`preset` (default `wiki`):

| Preset | Shape |
|---|---|
| `doc` | a single focused document, no nav chrome |
| `single-doc` | an alias of `doc` |
| `review` | a single document tuned for review: fixed reading width, no cover |
| `wiki` | nested pages + tree + backlinks + ⌘K — a knowledge base |
| `workspace` | the full Notion: everything on |
| `library` | the same as `workspace`, with pages presented as a TABLE instead of a tree |

Read the presets honestly: they differ in **navigation shape**, not in per-page features.
`wiki` and `workspace` resolve to identical flags; `library` differs only by `tree: "table"`;
`doc`, `single-doc` and `review` turn the nav chrome off, and `review` additionally fixes
the reading width and drops the cover.

Per-element toggles, each overriding the preset:

| Key | Element |
|---|---|
| `tree` | page navigation: `"sidebar"` \| `"off"` \| `"table"` |
| `breadcrumbs` | the workspace trail |
| `backlinks` | the "linked references" panel |
| `cmdK` | the ⌘K quick-switcher and its search entries |
| `suggestions` | track-changes / suggesting mode |
| `outline` | the per-page outline rail |
| `cover` · `icons` | per-page cover image / icon |
| `export` | the import/export menu |
| `wordCount` · `pageWidth` · `findReplace` | the readout, the narrow/wide toggle, the find bar |

**`suggestions` is ORTHOGONAL** — it is on across every preset, so "a simple doc with
track changes" and "a full workspace with track changes" are each one flag away, and a
company that does not want review turns it off explicitly. The surface degrades
coherently: drop the tree and its collapse control goes with it; drop breadcrumbs and ⌘K
moves to the tree head.

```jsonc
// the minimal end: a Word-like document with track changes
{ "preset": "doc" }

// the maximal end: a full Notion workspace, review off
{ "preset": "workspace", "suggestions": false }
```

`DocumentConfig` (passed as `documentConfig`, or reached through the workspace flags
above) additionally carries `editor` (block set, inline toolbar, markdown shortcuts, slash
menu) and `chrome` (the cover + icon + title header as a whole). Precedence when both are
supplied: an explicit `WorkspaceConfig` flag beats an explicit `documentConfig` flag beats
the preset default.

### Suggesting mode

With `suggestions` on, the surface offers an Editing ↔ Suggesting toggle and a review
panel. Edits made while suggesting become tracked changes attributed to `author`
(`{name, color}`), rendered inline and as review cards, and accept/reject resolves them
into the block text. Tracked changes persist on the snapshot, so a review survives a
reload.

### Import and export

| Direction | Formats |
|---|---|
| Export | Markdown, HTML (standalone, concrete inline styles), `.docx`, PDF |
| Import | `.md` `.markdown` `.txt` `.html` `.htm` `.docx` |

PDF is **export-only, via the browser's own print dialog** — the surface opens the
standalone HTML in a window and invokes Save-as-PDF, so the document renders exactly as
styled with zero added bundle weight. There is no PDF import. `.docx` export uses `docx`
and `.docx` import uses `mammoth`, both dynamically imported at the moment of use;
Markdown and HTML are pure and tiny, so those paths are always available.

### Feeding the app's unified search

A workspace can publish its pages into the app's own search instead of running a second
palette:

| Prop | Does |
|---|---|
| `onPageIndex(entries)` | fires whenever the page set changes; each entry is `{id, title, path, icon}` where `path` is the breadcrumb of ancestor titles |
| `onOpenPageRef(open)` | hands the host an opener it calls to jump to a hit |

Pair either with `config={{ cmdK: false }}` so the app owns the single ⌘K palette and doc
pages still appear in it. Set `breadcrumbs={false}` when the HOST already renders a trail
for the page, so the surface never stacks two.

---

## `viewer3d` — a 3D object and floor-plan viewer

Two modes from one snapshot: `object` (a model on a turntable) and `floorplan` (levels you
step through).

**Persistence:** `Viewer3DSnapshot` under `viewer3d:<pageKey>`.
**Weight:** three.js is lazy — `LazyViewer3DSurface`, zero eager cost.

| Field | Meaning |
|---|---|
| `mode` | `"object"` \| `"floorplan"` |
| `object` | the model source: a `gltf` URL or a `procedural` build |
| `floorplan` | `levels[]`, each with rooms |
| `hotspots` | annotated points, each with a tone |
| `autoRotate` · `activeLevel` | persisted viewer state |
| `controls.presets` · `controls.wireframe` | chrome a config can hide (both default true; wireframe is object mode) |

`seedScene("vehicle" | "floorplan")` returns a ready demo of either mode — the seed is
parameterised, so one block serves both page shapes.

**The look dial-board.** Lighting, exposure, shadow, material response, and camera framing
and easing all live in ONE exported object, `LOOK` (with `PRESET_DIRS` and
`derivePalette`). Import and mutate it to re-tune the viewer's feel without touching the
surface. It is a light module with no three.js import, so reading or adjusting it costs
the bundle nothing.
