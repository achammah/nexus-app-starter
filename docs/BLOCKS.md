# BLOCKS — the free-surface library reference

The composed surfaces in `src/ui/blocks/`. Each implements the contract in
`docs/UI-KIT.md` §"The free-surface block contract"; this file is the per-block
option reference — what you pass, what it stores, what it can do.

> **Acquiring them.** These blocks live in the nexus-ui library and arrive in an app
> through `npm run sync-ui`; `src/ui/.ui-version` records which library commit an app
> currently carries. A block's npm dependencies are NOT vendored with its source — the app
> must declare them itself: `three` (3D viewer, a STATIC import, so it breaks the build
> when missing), `exceljs` (workbook XLSX/CSV) and `docx` + `mammoth` (document
> import/export), all three dynamic, so they break at the click instead. Verify against
> `package.json` and the lockfile, not against a local build —
> `docs/CONSTRAINTS.md` §"A vendored block brings its own dependencies".

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

## `presentation` — a deck editor with share + track

A slide deck: layout templates AND free placement, shapes, images, charts, tables,
speaker notes, present mode, PPTX/PDF export, PPTX import, plus a share-and-track layer
(links, view analytics, data rooms).

**Persistence:** one `DeckSnapshot` under `presentation:<pageKey>`.
**Weight:** the editor is light and the barrel is safe to import eagerly; `pptxgenjs`
(export) and `jszip` (import) hide behind dynamic imports inside their own modules. A
`LazyPresentationSurface` is exported too, so a host can wire it exactly like the workbook.

### The deck

`DeckSnapshot` is `{kind, version, id, title, theme, slides, sharing, analytics, rooms}`.

Each `Slide` carries a `layout`, its `blocks`, plain-text `notes`, an optional
`transition`, and an optional `elements` array. **Two content paths coexist on every
slide**: layout REGIONS are the template path — the layout decides where text sits — and
ELEMENTS are the PowerPoint path, anything anywhere on top, painted in array order as
z-order. A layout gives a fast start; elements give full freedom.

| Type | Values |
|---|---|
| `SlideLayout` | `title` · `title-body` · `two-column` · `image` · `quote` · `section` · `blank` · `canvas` (no regions — pure free placement) |
| `SlideTransition` | `none` · `fade` · `slide` · `zoom` |
| `DeckThemeId` | `native` · `paper` · `midnight` · `accent` · `gradient` |
| `ElementKind` | `text` · `shape` · `image` · `chart` · `table` · `video` |
| `ShapeKind` | `rect` · `roundRect` · `ellipse` · `triangle` · `arrow` · `line` · `star` · `callout` |
| `ChartKind` | `bar` · `line` · `pie` · `area` · `scatter` |
| `AnimEffect` | `none` · `fade` · `rise` · `pop` · `wipe` |

Element geometry (`x/y/w/h`, `rot`, `locked`, `groupId`) is in a 1280×720 design box, so a
slide renders identically as a thumbnail, on the canvas, in present mode and in an export.
`ElementStyle` separates `opacity` (whole element) from `fillOpacity` (shape fill only,
leaving the label readable) — the latter is what PowerPoint's shape Transparency actually
does.

A chart carries its OWN data (`ChartSpec.series` + `rows`), so a deck is self-contained
and a slide never depends on a live query to render.

### `PresentationConfig`

| Key | Does |
|---|---|
| `defaultTheme` | the theme new decks start on |
| `features` | switches, all defaulting ON: `share` · `analytics` · `rooms` · `pptxExport` · `pptxImport` · `pdfExport` · `present` |
| `buildShareUrl(slug)` | host-owned slug → public URL. The default builds a location-based URL; a real deployment points this at its viewer route |
| `onAnalyticsEvent(event)` | a seam — viewer events are ALSO forwarded here (e.g. to a backend); the in-snapshot fold still happens through `onEvent` → `applyViewEvent` |

### Import and export

| Direction | Format | How |
|---|---|---|
| Export | PPTX | `exportDeckToPptx` (pptxgenjs, dynamically imported) |
| Export | PDF | `exportDeckToPdf` — a print window with each slide as one fixed 16:9 landscape page, then the browser's Save-as-PDF. No library, no bundle cost |
| Import | PPTX | `import.ts` (jszip, dynamically imported) — PowerPoint, Google Slides via File → Download → .pptx, Keynote's PPTX export, or this block's own output |

**Imported slides land on the `canvas` layout as free elements, deliberately.** A
PowerPoint slide is already absolutely positioned, so mapping it onto template layouts
would mean guessing at — and losing — the author's geometry; `canvas` is lossless for
position.

Import fidelity is scoped, and **anything unread is reported in `warnings`, never silently
dropped**:

| Read | Not read |
|---|---|
| shape geometry (position, size, rotation) · drawable preset shape kinds · solid fills and outlines · text with per-run bold/italic/underline/size/colour · bullets · pictures (embedded as data URLs) · grouped shapes (flattened with composed transforms) · speaker notes | theme colour inheritance · gradient and image fills · tables · charts · SmartArt · animations · master/placeholder geometry inheritance · WordArt effects |

### Share and track

`ShareLink` carries a url-safe `slug`, an optional `expiresAt` the viewer refuses entry
after, an `emailGate` flag that collects an email before showing the deck, and `disabled`.
`ViewSession` records per-link viewing: `slideMs` per slide, `maxSlideIndex`, and whether
the session `completed`. The viewer emits `session_start` / `slide_time` /
`session_complete`, which the host folds into the snapshot with `applyViewEvent` or ships
to a backend via `onAnalyticsEvent`.

A `DataRoom` is an ordered grouping shared as one set. Items are either `this-deck` or a
`link` — a reference by title and href — because a snapshot owns only its own deck;
resolving a pointer to another page is the host's seam.

### Deck master, templates and animation

`deck.master` (`DeckMaster`) is deck-level defaults layered over the theme: heading and body
font stacks, palette overrides (`bg`/`fg`/`accent`/`muted`), a logo with a corner position and
design-px size, and a footer line with optional slide numbers. It applies as slide-scoped CSS
custom properties, so the filmstrip, canvas, present stage, viewer and PDF export all pick it
up without each renderer knowing about it.

`deck.templates` (`SlideTemplate[]`) are user-saved slides — id-less, cloned under fresh ids on
insert — offered from the New-slide menu. They are per-deck by design, not a shared library.

Each element may carry an entrance animation (`anim.effect`: `fade` · `rise` · `pop` · `wipe`,
or `none`). It plays when the slide ENTERS in present mode or the shared viewer, never while
editing; ordering follows array order, each step staggering after the previous.

### Limits

PPTX import does not read masters, placeholder geometry inheritance or animations, so a deck
built on those imports without them — reported in `warnings`, never silently dropped. Templates
are per-deck, so a slide library does not travel between decks.

## `esign` — an e-signature envelope

A signing surface: document intake, field placement, ordered signers, a review-gated send,
signing with drawn / typed / uploaded signatures, an audit trail and a completion
certificate, plus reusable templates.

**Persistence:** one `EsignEnvelope` under `esign:<pageKey>`.
**Weight:** the PDF engines are lazy — `LazyESignSurface`; `pdfjs-dist` renders and
`pdf-lib` flattens, and neither touches the eager bundle. The exported helpers are
dependency-free and node-testable.

### The envelope

`EsignEnvelope` carries `id`, `name`, `status`, `signingOrder`, the `document`, `signers`,
optional `cc` recipients (they receive the completed document and sign nothing), a
`reminders` policy, the placed `fields`, the `events` audit trail, `templates`, and on
completion `completedAt` + `certificateId`.

| Enum | Values |
|---|---|
| `EsignEnvelopeStatus` | `draft` · `sent` · `partially_signed` · `completed` |
| `EsignSignerStatus` | `pending` · `viewed` · `signed` |
| `EsignSigningOrder` | `sequential` · `parallel` |
| `EsignFieldType` | `signature` · `initials` · `date` · `text` · `checkbox` · `dropdown` |
| `EsignFieldFormat` | `any` · `email` · `number` · `phone` · `date` |

Seeds for every stage ship as fixtures: `seedEnvelope`, `seedDraftEnvelope`,
`seedSentEnvelope`, `seedCompletedEnvelope`, enumerated by `ESIGN_SEED_STATES`.

### `ESignConfig`

| Key | Does |
|---|---|
| `title` | surface title; defaults to the envelope name |
| `fieldTypes` | restrict the palette; default is all six types |
| `signingOrder` | the default order for new envelopes |
| `onSend` | **the delivery seam** — a real mailer/backend. Absent → a clearly LABELED demo send that writes an audit event and delivers nothing |
| `signingUrlTemplate` | e.g. `https://app.example.com/sign/{envelopeId}/{signerId}` |
| `demoStates` | the demo-state switcher (draft / partially signed / completed). Defaults TRUE so a visitor can reach post-send states instead of being stranded in a locked envelope — **set it false in a real deployment** |

`EsignSendRequest` is the exact payload a backend mailer needs: the envelope and document
identity, signing order, per-recipient rows (name, email, role, order, field counts, the
`signingUrl` a real backend generates and mails, an optional per-recipient message), the
`cc` list, the reminder cadence and expiry, and `sentAt`. Implement `onSend` against that
shape and nothing else in the surface changes.

The completion certificate id is a SHA-256 over the envelope's terminal facts — its id,
document name, per-signer id/email/signed-at, per-field id/type/page/filled-ness, and the
completion timestamp.

### Limits — read before promising anything to a customer

This surface is a signing UI with seams, not a signing SYSTEM. Four limits decide what you
must build behind it.

**1. The flatten covers OUR field values only — the source PDF's own form fields stay
editable.** Verified by running a probe PDF through the real download path and diffing
with `pdf-lib`:

| | Source | After flatten |
|---|---|---|
| Pages · geometry | 1 · 612×792 | 1 + an appended certificate page · unchanged |
| Existing AcroForm fields | `existing.customerRef` | **still present, still interactive** |
| Page annotations (incl. links) | 2 | preserved |
| Metadata | present | preserved |
| E-signature field values | — | painted as page content; no new form fields |

Signature values are drawn onto the page and cannot be edited afterwards, but a source
document that was an interactive form is delivered with its fields still fillable — a
recipient can change them after completion, and nothing here detects it. **If your sources
carry AcroForm fields, flatten them server-side after download** (`form.flatten()`, qpdf,
or your PDF service) before archiving or distributing. If the artifact must be
tamper-evident, seal it server-side: the client output is not sealed.

**2. Typed signatures rasterise through the browser canvas**, so the exact glyph shapes
depend on the fonts installed on the signing machine. The snapshot deliberately keeps the
typed text AND the font name, so a server can re-render them consistently.

**3. The certificate is an integrity hash, not legal evidence.** `certificateId` is a
SHA-256 over the terminal envelope state, so recomputing it proves a snapshot has not been
altered. It is NOT bound to a verified identity, not countersigned, and not timestamped by
an authority — and because the input IS the snapshot, anyone holding it can produce a
matching certificate. It carries no IP, no trustworthy user-agent provenance, no
geolocation: a browser cannot observe its own IP, and writing a client-declared one into a
certificate of completion would fabricate an audit record, which in a signing product is a
corrupt record rather than a cosmetic lie.

Treat `onSend` as the boundary where the real record begins: your backend issues the
signing links and records, per recipient at the moment they act, the source IP, user
agent, authentication method and identity, and a server clock (ideally an RFC 3161
timestamp). That record is authoritative; the client audit trail is a UX convenience.
Under eIDAS or ESIGN/UETA the evidence, identity-binding and retention obligations all sit
on that backend.

**4. Delivery, signing and validation are seams, not implementations.**

| Seam | What the surface does | What you must add |
|---|---|---|
| Delivery | without `onSend`, a demo send: status moves to `sent`, the audit records it, the dialog states no mail is delivered. `reminders` and `cc` ride in the request | scheduling and sending mail |
| Signing | LOCAL — you act for each signer from the Sign tab, which the UI says plainly | per-recipient links and authentication |
| Validation | `fieldFormatError` runs client-side; it is exported so you can re-run it | server-side validation — the client check is usability, never a trust boundary |
| Adopted signatures | session-only, deliberately NOT written into the snapshot — a stored signature image is a credential, and persisting it into a blob that gets passed around is a leak waiting to happen | store against an authenticated user server-side if you want it saved |

**Scoped out, not overlooked:** multi-select and align/distribute across fields,
snap-to-text, auto-detection of printed signature lines, multi-document envelopes, and a
page-thumbnail navigator. Field editing is one field at a time. Templates key to roles by
ORDER, so a template whose role count differs from the envelope's signer count is refused
outright rather than partially applied.

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
