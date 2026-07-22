# EXTENDING — the exact files, in order

Every extension point in one place. Config-only tasks (add an entity, add a field,
wire enrichment, whiteboard, generation, tasks) have their cookbook in
`docs/RECIPES.md`; this file covers the CODE-level seams and what each one costs.

**Order of preference — always try the cheapest rung first:**

| Rung | Change | Where |
|---|---|---|
| 1 | a new entity, field, view instance, relation, demo data | `starter.config.json` only |
| 2 | a new non-record surface | a component in `src/app/pages/` + a registry row |
| 3 | a new view TYPE or field TYPE | a dropped folder in **nexus-ui**, then `npm run sync-ui` |
| 4 | new server behavior | `server/*.mjs` (node built-ins only) + a permission gate + a client twin |

Rungs 3 and 4 both end with: a manifest row, a journey asserting a VISIBLE outcome, and
`npm run journeys` green.

---

## Add an object

Config only. See `docs/CONFIG.md` §2 for every key.

```bash
npm run generate object Invoice -- --fields "name:text:primary,amount:currency,stage:select:Draft|Sent|Paid,owner:user"
```

Writes the config entry (board on the first select, seeded rows) and refreshes
`docs/DATA-MODEL.md`. `--dry` prints the JSON without writing; `--seed N` sets
`seedCount`; `--config <file>` targets another config.

By hand: append to `objects[]` — relation targets must be listed BEFORE the objects that
point at them. Then `npm run model`, a `docs/feature-manifest.md` row, and a journey.

## Add a field to an object

Config only (`docs/CONFIG.md` §3). Nothing else derives: table cell, record-page editor,
filter chip, create dialog, form view, CSV export and import mapping all read the field
registry. Validation comes from the type, server-side.

If the type is new, that is the next recipe.

---

## Add a field TYPE

A field type is a **folder in nexus-ui**, never a switch edit here.

1. **nexus-ui** → create `src/record-core/fields/<type>/definition.tsx`, default-exporting
   a `FieldTypeDefinition` (`fields/types.ts`; slot table in `docs/UI-KIT.md`). Fill only
   the slots your type owns. Use `React.lazy` for a heavy editor — the host wraps the
   registry branch in Suspense with a designed loading state.
2. **nexus-ui** → `render` receives `{field, row, value, readOnly?, onSave}`. `onSave`
   commits ONE whole-value patch through the record store; that is the only write path.
   Keep live editing state local and seeded once.
3. **this repo** → if the server must validate the value shape, add a type case to
   `validate()` in `server/store.mjs`, plus a `flatVal` case so timeline summaries stay
   readable. Seed generators return `null` for structured types unless you add a typed
   generator in `server/seed.mjs`.
4. **this repo** → `npm run sync-ui`, then a config field of the new type, a manifest row,
   a journey per visible behavior, and a `journeys/unit/` test for any pure logic.
5. Mobile is part of the definition, not a later pass: every control needs a tap path and
   the surface must work at 390px.

Reference implementation: `src/ui/record-core/fields/whiteboard/`.

## Add a view TYPE

Same shape, one folder up.

1. **nexus-ui** → `src/record-core/views/<type>/definition.tsx` default-exporting a
   `ViewDefinition` (slot table in `docs/UI-KIT.md`). Declare `configSchema` so the type's
   config keys are self-documenting, `defaultConfig` so it works with an empty entry, and
   `validateConfig` so a misconfiguration renders a plain-language chip instead of a crash.
2. **nexus-ui** → the component takes `ViewProps`. Read `viewConfig` for configuration and
   `viewState` for the user's runtime picks; write state back through `onViewState(patch)`.
   Pick UNIQUE state keys unless sharing is intended. Never re-filter `rows`.
3. **nexus-ui** → heavy view? `component: React.lazy(...)`. The registry host renders under
   Suspense, and the engine code-splits out of the eager bundle automatically.
4. **this repo** → `npm run sync-ui`, then give an object the view:
   `"views": [{ "type": "table" }, { "type": "<type>", "someKey": "..." }]`.
5. **this repo** → refresh `src/app/gallery.catalog.json` (see `docs/UI-KIT.md`), add the
   type's row to `docs/CONFIG.md` §4, a manifest row, and a journey — including a 390x664
   touch pass.

The switcher tabs, the toolbar and the view body all resolve from the registry; the
ObjectView switcher is never edited.

---

## Add a page (non-record surface)

The registry in `src/app/pages.tsx` is the any-product extension point. A page is
ordinary React with the full vendored kit, the tokens and the `/api` client available.

```bash
npm run generate page Reports        # scaffolds + registers in one step
```

By hand:

1. `src/app/pages/Reports.tsx` — the component (template: `scripts/templates/page.tsx.tpl`;
   edit the template once and every later `generate` uses your version).
2. `src/app/pages.tsx` — add a `PageDef` row: `{ key, label, icon, component }`.
   `generate` appends above the `// generate:pages` marker — keep that line.
3. Nav item and the `#/p/<key>` route appear automatically.
4. Manifest row + journey.

Delete the shipped `kit` demo page (and any other example page) when the app is real.

Server-side feature flags hide a built-in page's nav entry AND 404 its API together
(`FEATURE_TEAMS` `FEATURE_WEBHOOKS` `FEATURE_THEME` `FEATURE_APIKEYS` `FEATURE_TASKS`
`FEATURE_SCHEMA` `FEATURE_GALLERY`, `"0"` disables). Your own pages carry no flag unless
you add one in `server/env.mjs`.

## Add a free-surface page (its own persisted document)

For a page whose content is one opaque document rather than record rows — a workbook, a
document workspace, a canvas, a 3D scene. `src/app/pages/Spreadsheet.tsx` is the reference
implementation, and every free-surface page repeats the SAME six steps:

```
storeKey(pageKey) → api.state() load → guard → seed if unset
                  → mount the surface (lazily if the engine is heavy)
                  → debounced api.setState persist
```

That shape is identical across every block in `docs/BLOCKS.md`, so a new one is a copy of
an existing page with one store key and one surface swapped.

1. **The block** lives in nexus-ui (`src/blocks/<block>/`) and exports the contract in
   `docs/UI-KIT.md` §"free-surface block contract": `value` / `onChange` / `reloadNonce`,
   a `<block>StoreKey(pageKey)` helper, an `is<Block>Snapshot` guard, a `seed<Block>()`,
   and a `Lazy<Block>Surface` React.lazy export.
2. **The page** (`src/app/pages/YourSurface.tsx`) owns persistence, in this exact order —
   every wired free-surface page is this file with two nouns swapped:

   ```tsx
   const KEY = React.useMemo(() => yourStoreKey(pageKey), [pageKey]);   // 1. namespace the store
   // 2. load once, 3. guard, 4. seed if unset (and persist the seed when demoSeed)
   React.useEffect(() => {
     let live = true;
     api.state().then((s) => {
       if (!live) return;
       const snap = s[KEY];
       if (isYourSnapshot(snap)) setInitial(snap);
       else { const seed = seedYour(); setInitial(seed); if (demoSeed) api.setState(KEY, seed).catch(() => {}); }
       setPhase("ready");
     }).catch(() => { setInitial(seedYour()); setPhase("ready"); });
     return () => { live = false; };
   }, [KEY, demoSeed]);
   // 5. persist debounced — ONE timer for the page lifetime, cleared on unmount
   const persist = React.useCallback((v: YourSnapshot) => {
     if (saveTimer.current) clearTimeout(saveTimer.current);
     saveTimer.current = setTimeout(() => { api.setState(KEY, v).catch(() => {}); }, SAVE_DELAY);
   }, [KEY]);
   // 6. mount (lazily when the engine is heavy), showing a designed loading state first
   ```

   Take a `pageKey` prop rather than hardcoding one — that is what lets several pages of
   the same shape share ONE component, each with its own document. A catch on the load
   falls back to the seed, so a store read failing never leaves a dead page.
3. **Register** in `src/app/pages.tsx`. Wrap the page root in `.pageBleed` if the surface
   should fill the content area with no card frame, and pass page controls (save state,
   reset) as the block's `actions` so they render inside the vendor toolbar row.
4. Manifest row + journey, including the 390px path.

Because the document is an ordinary `app_state` value, a workflow or agent can write one
with `POST /api/state {key, value}`.

## Add a nav item or route

Routing is hash-based with zero router dependencies (`src/app/App.tsx`):

| Route | Surface |
|---|---|
| `#/o/<objectKey>` | an object's list |
| `#/o/<objectKey>/r/<id>` | a record's full page |
| `#/o/<objectKey>?peek=<id>` | the list with the record open in the side peek |
| `#/p/<pageKey>` | a registered custom page |

Nav renders objects first, then pages. To add an item you add an object (config) or a
page (registry) — there is no separate nav list. `hideInNav: true` on an object keeps it
routable but out of every nav surface. `app.goChords` maps `g`+key to any hash route and
the binding shows up in the `?` shortcuts overlay.

---

## Customize the theme

Ascending power, all in `starter.config.json`: `theme.accent` → `theme.skinPreset` →
`theme.skin` (the full object). Token list, skin knob set and mechanics:
`docs/UI-KIT.md` §Tokens + theming.

To change the BASELINE canvas rather than skin over it, edit `tokens.css` in nexus-ui and
re-sync — never patch `src/ui/` in place. Record the locked direction in `docs/DESIGN.md`
(render the three `boards/direction-*.html` with the app's real nouns, pick one, lock it).

Build every surface against `--nx-*` tokens, never literal colors, and verify both themes:
a `[data-theme]` flip must repaint everything with no reload.

## Wire a new data source

The `/api` surface is the contract (`docs/API.md`); the store behind it is swappable.

| Seam | File | Swap |
|---|---|---|
| record + timeline + note + file + `app_state` storage | `server/store.mjs` (in-memory) | replace with a real client — `server/store-remote.mjs` is the command-logged twin; the `/api` surface and the whole UI stay unchanged |
| durable append-only spine | `server/warehouse.mjs` (BigQuery via the Nexus connector) / `server/warehouse-local.mjs` (file-backed, zero-dep, offline) | `WAREHOUSE=bigquery` + `NEXUS_API_KEY` + `WAREHOUSE_CREDENTIAL_ID`, or `WAREHOUSE=local` |
| external writers | `RemoteStore.sync()` → `POST /api/sync` | pulls out-of-process warehouse events into the running app with no restart |
| platform calls | `src/lib/nexusClient.mjs` (api-key client, server-side ONLY) | AI tasks (`server/aiTaskRunner.mjs`), agent chat (`emulatorChat`), generation (`server/asyncGeneration.mjs`) |
| vendor OAuth | `src/lib/connectFlow.mjs` | in-app connect via platform credentials (popup + poll) |
| mail | `server/email.mjs` | dev OUTBOX transport (`/api/outbox`) until `SMTP_URL` is set |
| the enrichment mock | the `mockValue` line in `server/server.mjs` `/enrich` | a real task/workflow call; the UI, config shape and journey do not change |

Every new store mutation that changes domain state must be a named `Store` method
registered in `LOGGED_OPS` (`server/store-remote.mjs`) and must replay deterministically:
no `Date.now()` and no randomness inside — the store clock is `this._now()` and ids come
from the store counter. Operational state (queues, delivery logs) stays out of the log.

Every new route gates through `can(role, cfg, action, {own})` (`server/permissions.mjs`)
and its client twin `src/app/permissions.ts`. New actions extend BOTH. The server is the
gate; the client only hides affordances.

The server is **zero-dependency**: node built-ins only, no npm packages under `server/`.

## Add a journey test

See `docs/TESTING.md` for the harness. Shortest path:

```bash
npm run generate journey invoice-flow -- --feature "Invoices board"
```

Scaffolds `journeys/extra/invoice-flow.mjs` (auto-loaded by the runner) and expects a
matching `docs/feature-manifest.md` row whose `Feature` cell equals the journey's
`feature` string.
