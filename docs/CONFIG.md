# CONFIG — the complete `starter.config.json` reference

The config IS the app. This file is the exhaustive reference for every key the app reads:
top level, objects, fields, views, and demo data. `docs/DATA-MODEL.md` shows what YOUR
current config produces (`npm run model`); this file shows what you may write.

Types live in `src/app/api.ts` (`AppConfig`, `AppObject`) and `src/ui/record-core/types.ts`
(`ObjectConfig`, `FieldDef`, `FieldType`, `SelectOption`). Per-view options are declared by
each view definition's `configSchema` in `src/ui/record-core/views/<type>/definition.tsx`.

`CONFIG_PATH=path/to/other.config.json npm run serve` boots the same build as a different
product. Relation targets must be listed BEFORE the objects that point at them.

---

## 1. Top level

| Key | Type | Required | What it does |
|---|---|---|---|
| `app.name` | string | yes | product name (shell brand, page title) |
| `app.slug` | string | yes | machine id (returned by `/api/healthz`) |
| `app.nav` | `"side"` \| `"top"` | no (`side`) | left sidebar, or one horizontal top bar with no sidebar |
| `app.goChords` | `{key: hashRoute}` | no | `g` then a key jumps to a route, e.g. `{"c": "#/o/companies"}`; also listed in the `?` shortcuts overlay |
| `theme.accent` | hex string | no | one-knob brand color |
| `theme.skinPreset` | `"nexus"` \| `"ember"` \| `"warm-opt"` | no | a built-in skin (`src/ui/skins/presets.ts`) |
| `theme.skin` | Skin object | no | a full inline brand-as-data skin (see `docs/UI-KIT.md` §Theming) |
| `chat.embedUrl` | URL string | no | a Nexus EMBED deployment URL → the floating chat dock renders; empty/absent → nothing renders |
| `copilot` | object | no | present → the docked AI side panel renders; absent → nothing |
| `copilot.title` | string | no | panel title |
| `copilot.mark` | string | no | one-glyph avatar mark |
| `copilot.emptyStateCopy` | string | no | the empty-panel explainer |
| `copilot.suggestions` | string[] | no | starter prompts |
| `users` | string[] | no | the people directory `user`-type fields pick from |
| `objects` | AppObject[] | yes | the record model (§2) |
| `pages` | PageConfig[] | no | config-declared surfaces that are not record lists — one entry adds a nav item and a `#/p/<key>` route with no code. Full reference: `docs/PAGE-KINDS.md` |

Server-set, never authored by hand (they arrive on `/api/config`): `demo` (seeded rows
exist → the sidebar "Demo data" badge) and `features` (the env feature flags).

The copilot's `deploymentId` is a **secret** and belongs in the environment
(`COPILOT_DEPLOYMENT_ID`), not in this browser-visible file. A `copilot.deploymentId`
key is honored only as a self-contained-demo fallback.

```jsonc
{
  "app": { "name": "Nexus App", "slug": "nexus-app", "nav": "side",
           "goChords": { "c": "#/o/companies", "d": "#/o/deals" } },
  "theme": { "skinPreset": "nexus" },
  "chat": { "embedUrl": "" },
  "copilot": { "title": "Copilot", "mark": "N",
               "emptyStateCopy": "Your in-app assistant.",
               "suggestions": ["Summarize what I'm looking at"] },
  "users": ["you", "Maya Verstraete", "Jonas Peeters"],
  "objects": []
}
```

---

## 2. Objects

One entry per entity. Everything else — nav item, table, board, chart, record page,
relation pickers, filters, CSV export, import mapping, palette search — derives from it.

| Key | Type | Required | What it does |
|---|---|---|---|
| `key` | string | yes | machine key, the URL segment (`#/o/<key>`) and API path |
| `label` | string | yes | plural display name (nav, page title) |
| `labelOne` | string | yes | singular ("New company") |
| `icon` | lucide icon name | no | nav icon |
| `fields` | FieldDef[] | yes | §3 |
| `defaultView` | view type string | yes | the initially-active view tab |
| `views` | ViewInstance[] | no | the view tabs, in order (§4). Omitted → derived: table, plus Board + Chart when a select/user field exists |
| `stageField` | field key | no | a `select` field whose options are the kanban columns |
| `columns` | field key[] | no | default table column visibility (primary always shown). Omitted → every non-primary field shows |
| `openIn` | `"peek"` \| `"page"` | no (`peek`) | how a row click opens a record. `recordLayout: "document"` defaults to `page` |
| `recordLayout` | `"standard"` \| `"document"` | no (`standard`) | `standard` = fields panel + timeline/notes/files tabs. `document` = the primary `richText` field becomes a wide hero editor, other fields move to a compact sidebar |
| `contextFields` | field key[] | no | the fields fed to the copilot when a record is open. Omitted → the primary field only |
| `pipelineField` | field key | no | a `select` field whose options render as a state pipeline above the suggestions surface |
| `hideInNav` | boolean | no | omit from sidebar / drawer / mobile tab bar; still routable and searchable |
| `teamScoped` | boolean | no | rows are stamped to the caller's active team; visibility and roles resolve per team |
| `permissions` | `{role: action[]}` | no | §5. Absent → every action allowed |
| `createWizard` | `{questions: Q[]}` | no | §6 |
| `generate` | object | no | §7 |
| `sampleRows` | row objects[] | no | curated demo rows with stable ids (§8) |
| `seedCount` | number | no (`6`) | generated demo rows when `sampleRows` is absent |

```jsonc
{
  "key": "deals", "label": "Deals", "labelOne": "Deal", "icon": "Handshake",
  "defaultView": "kanban",
  "stageField": "stage",
  "columns": ["stage", "amount", "closeDate"],
  "views": [{ "type": "table" }, { "type": "kanban", "groupField": "stage" }],
  "fields": [
    { "key": "name", "label": "Name", "type": "text", "primary": true },
    { "key": "stage", "label": "Stage", "type": "select",
      "options": [{ "value": "New", "color": "blue" }, { "value": "Won", "color": "green" }] },
    { "key": "amount", "label": "Amount", "type": "currency" },
    { "key": "company", "label": "Company", "type": "relation", "relation": "companies",
      "inverseLabel": "Deals" }
  ],
  "sampleRows": [{ "id": "de_1", "name": "Brightline · platform", "stage": "New", "amount": 53000 }]
}
```

---

## 3. Fields

### 3.1 Field types

| `type` | Stored value | Renders as |
|---|---|---|
| `text` | string | inline text |
| `longText` | string | multi-line text |
| `number` | number | right-aligned number |
| `boolean` | boolean | inline toggle |
| `rating` | number | stars (`scale`, default 5) |
| `select` | option value string | colored chip + filter chip + board/chart grouping |
| `multiselect` | string[] | chips; contains-any filtering |
| `array` | string[] | free tag list |
| `date` | `"YYYY-MM-DD"` | formatted date + day picker |
| `dateTime` | ISO datetime | formatted date-time |
| `currency` | number | currency-formatted number (aggregates in rollups/charts) |
| `money` | `{amount: number, code: string}` | "€12,500"; aggregates by `amount` |
| `email` | string | mailto chip; server-validated |
| `url` | string | anchor showing the bare host; server-validated |
| `emails` | string[] | chips, first + "+N" |
| `phones` | string[] | chips (lenient: digits / `+` / spaces) |
| `links` | string[] | anchors with bare hosts, new tab |
| `address` | `{street?, city?, postcode?, country?}` | cells show "street, city" |
| `fullName` | `{first?, last?}` | cells show "First Last"; may be `primary` |
| `json` | any JSON | raw editor; excluded from form views |
| `relation` | target id(s) — §3.3 | picker + related lists |
| `user` | a `users[]` name | avatar + name; picks from the directory |
| `richText` | `Block[]` | the Notion-style block editor; truncated prose preview in cells |
| `whiteboard` | `{elements: [...], files?: {...}}` | an excalidraw canvas block; SVG thumbnail in cells |

### 3.2 Field keys

| Key | Type | Applies to | What it does |
|---|---|---|---|
| `key` | string | all | machine key (immutable once data exists) |
| `label` | string | all | display label |
| `type` | FieldType | all | §3.1 |
| `primary` | boolean | one per object | the record's display name; the row link and record title |
| `options` | SelectOption[] | select, multiselect | `"Draft"` or `{value, label?, color?}`; colors: `gray blue green yellow orange red purple pink teal` |
| `width` | number | all | table column width in px |
| `unique` | boolean | all | duplicates 409; a collision with a TRASHED row restores that row instead (upsert semantic) |
| `isActive` | boolean | all | `false` → hidden from every surface and write-protected; the stored data survives and returns on re-activation |
| `scale` | number | rating | star count (default 5) |
| `relation` | object key | relation | the single target object |
| `multiple` | boolean | relation | many targets (value: id[]); checkbox picker committing ONE write on close |
| `relationTargets` | object key[] | relation | polymorphic — replaces `relation`; value is `{object, id}` |
| `inverseLabel` | string | relation | names the reverse related-list section on the target object |
| `primitive` | `{kind: "task"\|"workflow", taskId?, id?, label?}` | all | the AI-enrichment seam — the record page gains a sparkle Run affordance |
| `suggestTaskId` | string | richText | AI tracked-change suggestions — the record page mounts the review surface (editor + rail) |
| `whiteboard` | object | whiteboard | per-canvas capability config (see `docs/RECIPES.md` "Add a whiteboard (canvas) field") |

Validation is derived from the type, server-side (`validate()` in `server/store.mjs`) —
there is no separate validation block. `email`/`url`/`number`/`date`/`select` and the
shaped types (`money`, `emails`, `links`, `address`, `fullName`) all validate on write;
a rejection surfaces the server's own message in a toast and reverts the field.

### 3.3 Relation values

Relations persist target **ids** and project the target's primary **label** on read:

| Shape | Stored | Read back |
|---|---|---|
| single | `"co_1"` | the target's primary value, plus `_refs.company = "co_1"` |
| `multiple: true` | `["ce_1", "ce_2"]` | label strings, plus `_refs` id array |
| `relationTargets` | `{object: "a", id: "a_1"}` | the label, plus the typed ref in `_refs` |

Writes accept an id, an `{object?, id}` ref, or a primary-label string (one live match
normalizes to its id; two candidates 400 naming them; no match stays a verbatim dangling
label). Because links are ids: renaming a target updates every inbound cell with no
sweep, merging re-points losers' ids to the winner, a trashed target keeps projecting
its label (restore heals), and destroying a target severs its inbound links.

---

## 4. Views

`views[]` entries: `type` picks an installed view definition; every other key is that
type's config. An entry naming an uninstalled or invalid type renders as an inline
"not installed" chip in place of the view — never a crash. Each type's `validateConfig`
turns a misconfiguration into a plain-language chip naming the gap.

Installed types: `table` · `kanban` · `chart` · `grid` · `gallery` · `form` · `flow` ·
`calendar` · `map` · `timeline` · `focus`. Runtime picks in the Columns / group-by /
measure / rollup menus override config per user (persisted per object; saved views
capture them).

### `table` — Table
No config keys. Column visibility and multi-level sort live in view state
(`hidden`, `sort`); `columns` on the object sets the default visibility.

### `kanban` — Board
| Key | Kind | Default |
|---|---|---|
| `groupField` | a `select` or `user` field key | `stageField`, else the first groupable field |

### `chart` — Chart
| Key | Kind | Default |
|---|---|---|
| `groupField` | a `select` or `user` field key | `stageField`, else the first groupable field |
| `measure` | `"count"` or a `number`/`currency`/`money` field key | `"count"` |

Board and chart deliberately SHARE the `groupBy` view-state key, so a group choice
carries across the two views.

### `grid` — Sheet
No config keys. An Excel-grade canvas grid over the object's records (fill handle,
range selection, TSV clipboard, frozen primary column, keyboard nav). Lazy chunk.

### `gallery` — Gallery
| Key | Kind | Default |
|---|---|---|
| `coverField` | a `url` / `links` / `array` field key | the first such field |
| `coverFit` | `"cover"` \| `"contain"` | `cover` |
| `titleField` | any field key | the primary field |
| `cardFields` | field key[] rendered on each card, in order | the first two non-primary fields |
| `cardFieldLabels` | boolean — prefix each card value with its field label | `false` |
| `groupField` | a `select`/`user` field key → collapsible sections | none |
| `sortField` | any field key | none |
| `sortDir` | `"asc"` \| `"desc"` | `asc` |
| `cardSize` | `"s"` \| `"m"` \| `"l"` | `m` |
| `cardClick` | `"peek"` \| `"open"` | `peek` |

`metaFields` is the superseded name for `cardFields` and stays honored.

### `form` — Form
| Key | Kind | Default |
|---|---|---|
| `fields` | field key[] to render, in order | every form-editable field (`json` and many-relations excluded) |
| `sections` | `[{label, fields: []}]` — labeled groups; supersedes `fields` | none |
| `requiredOverrides` | `{fieldKey: true\|false}` | primary-only |
| `requiredWhen` | `{fieldKey: {field, equals}}` — required when a trigger field equals a value | none |
| `submitLabel` | string | `Create <labelOne lowercased>` |
| `successMode` | `"another"` \| `"view"` | `another` |

### `flow` — Flow (node graph)
| Key | Kind | Default |
|---|---|---|
| `relationField` | a `relation` field key drawing the edges | the first relation field |
| `secondaryRelationField` | a SELF-relation field key overlaying a second edge type | none |
| `labelField` | the card title field | the primary field |
| `nodeColorField` | a `select` field key | none |
| `nodeShapeField` | a `select` field key | none |
| `groupField` | a `select` field key → subflow groups | none |
| `enabledLayouts` | subset of `hierarchical` `force` `grid` | all three |
| `defaultLayout` | one of the above | the first enabled |
| `edgeStyle` | `smoothstep` \| `bezier` \| `straight` \| `step` | per layout: `smoothstep` for hierarchy, `straight` for force/grid |
| `edgeLabels` | boolean — draw the relation label on each edge | `false` |
| `animated` | boolean | `false` |
| `handEdit` | boolean — inline edit + resize + create | `true` |
| `edgeDraw` | boolean — draw an edge to relate two records | `true` |
| `nodeDetail` | boolean — node detail panel | `true` |
| `collapsibleGroups` | boolean | `true` |

A self-relation draws record→child edges; a cross-object relation draws labeled target
hubs. Dragged node positions persist. Lazy chunk.

### `calendar` — Calendar
| Key | Kind | Default |
|---|---|---|
| `startDateField` | a `date`/`dateTime` field key (**required**) | the first date field |
| `endDateField` | a `date`/`dateTime` field key → resizable spans (stored end dates stay inclusive) | none |
| `titleField` | any field key | the primary field |
| `colorField` | a `select` field key → events take its option palette | none |
| `recurrenceField` | a `text` field key holding an RRULE string → render-only occurrence expansion | none |
| `enabledViews` | subset of `month` `week` `day` `listWeek` `listMonth` `year` | all six |
| `defaultView` | one of the above | the first enabled |
| `editable` | boolean — drag to reschedule / resize | on |
| `selectable` | boolean — drag-select creates a prefilled range | on |
| `firstDay` | `Sunday` … `Saturday` | `Monday` |
| `slotDuration` | `"15m"` \| `"30m"` \| `"60m"` | `30m` |
| `snapDuration` | `"5m"` \| `"10m"` \| `"15m"` \| `"30m"` | `15m` (finer than the slot grid) |
| `slotMinTime` / `slotMaxTime` / `scrollTime` | `"HH:MM"` | `00:00` / `24:00` / `08:00` |
| `allDaySlot` | boolean | `true` |
| `weekNumbers` | boolean | `false` |
| `businessHours` | boolean — shades Mon–Fri 09:00–17:00 | `false` |
| `nowIndicator` | boolean | `true` |
| `eventOverlap` | boolean | `true` |

`week`/`day` resolve against the object's all-day-ness: a `date` object takes the
day-grid, a `dateTime` object the hourly time-grid. View state persists the active
view and the visible anchor date. Lazy chunk.

### `timeline` — Timeline (Gantt)

Tasks as bars on a time axis: subtask tree, dependency arrows, drag-to-reschedule, zoom,
today marker, health styling and critical-path emphasis. A due-only task renders as a
milestone diamond. Every key is optional — defaults resolve from the task shape
(§"The task object model"), then from the object's own fields. Lazy chunk.

| Key | Kind | Default |
|---|---|---|
| `startDateField` | a `date`/`dateTime` field key | the object's first date field |
| `dueDateField` | a `date`/`dateTime` field key | the object's second date field, else the first |
| `titleField` | any field key | the primary field |
| `statusField` | a `select` field key — bar color comes from its option palette | — |
| `assigneeField` | a `user` field key | — |
| `progressField` | a `number` field key (0–100) | — |
| `parentField` | a self-`relation` field key → the subtask tree | — |
| `dependenciesField` | a multiple self-`relation` ("blocked by" ids) → arrows | — |
| `doneStatuses` | comma-separated status values counting as complete | values named like done/complete/shipped/closed/cancel |
| `defaultZoom` | `day` \| `week` \| `month` \| `quarter` | `week` |
| `criticalPath` | boolean | on |

View state: `tlZoom`, `tlCollapsed` (id→true), `tlAssignee`. The toolbar adds an assignee
filter (when the object has a `user` field and the app has users) and a zoom segment
(desktop only).

### `focus` — Today

The day-planning surface: an ordered day plan with per-task timers on the left, and a
pull-in pane of due/overdue suggestions plus backlog on the right. Every key is optional.
Lazy chunk.

| Key | Kind |
|---|---|
| `titleField` | any field key |
| `statusField` | a `select` field key |
| `assigneeField` | a `user` field key |
| `dueDateField` | a `date`/`dateTime` field key |
| `estimateField` | a `number` field key, in HOURS — drives the spent-vs-estimate meter |
| `timeEntriesField` | a `json` field key — the time log the timer appends to |
| `plannedForField` | a `date` field key — the day plan itself |
| `focusOrderField` | a `number` field key — order within the day |
| `doneStatuses` | comma-separated status values counting as complete |
| `newTaskStatus` | the status given to new and reopened tasks |

Two behaviors worth designing around: **planning is EXPLICIT** — a due date never drafts
work into the day, it only SUGGESTS — and exactly ONE timer runs at a time across the
whole task set. The view needs somewhere to store the plan: without a `plannedFor` date
field (or a `plannedForField` naming another one) it renders the misconfiguration chip
instead. View state: `focusDate`, `focusUser`, `focusPane`.

### `map` — Map
| Key | Kind | Default |
|---|---|---|
| `latField` | a `number` field key (**required**) | inferred from field names |
| `lngField` | a `number` field key (**required**) | inferred from field names |
| `titleField` | any field key | the primary field |
| `colorField` | a `select` field key → marker colors + legend | none |
| `sizeField` | a `number`/`currency`/`money` field key → marker size ramp | none |
| `basemaps` | subset of the offered basemap ids | all |
| `defaultBasemap` | one of the offered ids | the first offered |
| `clustering` | boolean | `true` |
| `clusterRadius` | number, clamped 20–100 px | `50` |
| `clusterThreshold` | number — cluster above N points, clamped 1–100000 | `25` |
| `heatmap` | boolean — heatmap layer on by default | `false` |
| `heatmapWeightField` | a `number`/`currency`/`money` field key | none |
| `legend` | boolean | on |
| `draw` | boolean — draw + measure tools | `true` |
| `filterByArea` | boolean — a drawn shape filters the plotted records | `true` |
| `geocode` | boolean — address search | `true` |
| `route` | boolean — directions between two records | `true` |
| `addPoint` | boolean — click the map to open a seeded create dialog | `true` |
| `scaleControl` | boolean | `true` |
| `geolocateControl` | boolean | `false` |
| `fullscreenControl` | boolean | `true` |
| `geocodeEndpoint` / `routeEndpoint` | URL string | unset → the offline mock provider |

Basemap ids come from `src/ui/record-core/views/map/basemaps.ts`. Lazy chunk plus a
separate GL-renderer chunk; both load only when a map view first renders.

---

## 4b. The task object model

Work tracking is a shaped OBJECT, not a special surface: an object whose fields follow the
task shape gets the timeline and focus views working with zero view config, because both
resolve their defaults from that shape.

`taskObjectConfig(opts?)` builds the whole `ObjectConfig` for you. The field KEYS it emits
are the contract (`TASK_KEYS`) — keep them and the views configure themselves; rename one
and name it explicitly in the view config instead.

| Field key | Type |
|---|---|
| `title` | text (primary) |
| `status` | select — also the `stageField` |
| `assignee` | user |
| `priority` · `labels` | select · multiselect |
| `startDate` · `dueDate` | date |
| `estimate` · `timeSpent` · `progress` | number (hours, hours, %) |
| `repeat` | select — None / Daily / Weekly / Biweekly / Monthly |
| `parent` | self-relation → subtasks (`inverseLabel: "Subtasks"`) |
| `blockedBy` | multiple self-relation → dependencies (`inverseLabel: "Blocks"`) |
| `description` | richText |
| `timeEntries` | json — the time log |
| `plannedFor` · `focusOrder` | date · number — the day plan |

Subtasks and dependencies are ordinary SELF-RELATIONS, so the whole relation machinery
(pickers, related lists, id identity, merge re-pointing) applies to them unchanged.

Options: `key` (default `tasks` — the self-relations point at it), `label`/`labelOne`,
`statuses` (default Backlog · Todo · In progress · In review · Done, colored),
`doneStatuses`, `priorities` (Urgent · High · Medium · Low), `labels`, `extraFields`,
`views` and `defaultView`. The default view set is Today · Table · Board · Timeline ·
Calendar, opening on Today.

`seedTasks(today?)` returns a ready demo project — a realistic product-launch plan of 34
tasks across 5 people, with subtask trees and real cross-team dependencies, dated relative
to the day you call it, so a timeline and a focus view have something to say immediately.

"Done" resolves automatically: any status value named like done/complete/shipped/closed/cancel
counts as complete for overdue, at-risk and critical-path styling. Pass `doneStatuses` to
be explicit instead.

**Time tracking** (`timeTracking.ts`) is a pure layer over the `timeEntries` json field —
`taskEntries`, `runningEntry`, `isTracking`, `trackedSeconds`, `trackedSecondsOn`,
`totalTrackedOn`, and the patch builders `startTimerPatches` / `stopTimerPatch` /
`toggleTimerPatches`. It performs no I/O: the host applies the patches through the normal
record path.

**Issue sync** (`taskSync.ts`) is a config SEAM, not an integration. It owns the two things
a consumer cannot guess — the normalised shape a provider returns, and the mapping onto
the task record — and performs NO network I/O: you supply `fetchIssues` (your
authenticated call, your rate limits, your pagination) and it returns a patchset of
creates and updates to apply. Its `mockIssues` is explicitly labelled demo data so a
surface rendering it can say so rather than implying a connected account.

## 5. Permissions

```jsonc
"permissions": {
  "admin":  ["view", "create", "edit", "delete", "export"],
  "member": ["view", "create", "editOwn", "deleteOwn"],
  "viewer": ["view"]
}
```

Actions: `view` `create` `edit` `delete` `restore` `destroy` `export`, plus the own-row
grants `editOwn` `deleteOwn` `destroyOwn` (rows carry their creator when accounts are on).
Roles resolve from team membership: `owner` > `admin` > `member` > `viewer`; owners always
pass. No `permissions` block → every action allowed.

`restore` rides the `delete` grant (undoing what you may do). `destroy` is permanent and
must be granted explicitly. The server is the gate (`server/permissions.mjs`); the client
twin (`src/app/permissions.ts`) only hides affordances.

---

## 6. `createWizard` — guided create

```jsonc
"createWizard": { "questions": [
  { "key": "title",  "label": "What is this document?", "kind": "text", "required": true },
  { "key": "status", "label": "Status", "kind": "select", "options": ["Draft", "In review"] },
  { "key": "body",   "label": "What should it say?",    "kind": "long" }
] }
```

Present → "New \<object\>" offers guided-vs-blank; each question's `key` names the field
its answer fills. `kind`: `text` · `long` · `select` · `list` · `sources`. A select
auto-advances; a `required` step gates Next. A text/long answer to a `richText` field
becomes a one-paragraph value. Absent → the plain create dialog, unchanged.

## 7. `generate` — async generation action

```jsonc
"generate": { "label": "Generate", "statusField": "status", "resultField": "body",
              "generating": "Generating", "ready": "Ready",
              "delayMs": 1500, "stallAfterMs": 8000 }
```

| Key | Meaning |
|---|---|
| `statusField` | a `select` field holding the generating/ready state |
| `generating` / `ready` | the option values (default: the first / last option) |
| `resultField` | the `richText`/text field the finished record fills |
| `label` | the button label |
| `titlePlaceholder` | placeholder title on the pending row |
| `delayMs` | the mock writeback delay |
| `stallAfterMs` | the "taking longer than usual" threshold |

The list gains a Generate button that drops a placeholder row immediately; the finished
record lands via the warehouse and the SAME row settles. Needs a warehouse
(`WAREHOUSE=local` or `bigquery`) for the external-writer catch-up; on the in-memory app
the placeholder settles in-process.

## 8. Demo data

`sampleRows` (curated, wins) or `seedCount` (generated, default 6). Sample rows use
stable ids of the form `<two letters>_<n>` (`co_1`, `de_2`) so journeys can assert on
them. Relation values may be written as target primary labels — they normalize to ids
once at boot.

**Relative demo dates.** A `sampleRows` string value may use `@w<weekOffset>.<isoWeekday>[T<HH:MM>]`,
resolved at seed time so a demo always lands on the CURRENT week:

| Token | Resolves to |
|---|---|
| `@w0.3` | this week's Wednesday, all-day (`"YYYY-MM-DD"`) |
| `@w1.1T09:30` | next Monday 09:30 local (floating ISO) |
| `@w-1.5` | last week's Friday |

`weekOffset` 0 = this week; `isoWeekday` 1 = Monday … 7 = Sunday. Only `@`-prefixed
strings are transformed; every other value passes through untouched.

Objects with neither key get `seedCount` typed deterministic rows with fictional values.
Delete both to ship a clean app — the sidebar "Demo data" badge disappears when no
seeded rows exist.

---

## 9. Runtime schema edits

The config file is the immutable SEED. The Schema page (`#/p/schema`, gated by
`FEATURE_SCHEMA`, owner/admin) edits the LIVE schema through command-logged store ops
(add object · add field · edit field label/options/isActive/unique). Changes persist in
the command log and replay on boot in strict order with the data writes that depend on
them; the config FILE is never written. On key collision the seed wins.
Detail: `docs/RECIPES.md` "Edit the schema at runtime".
