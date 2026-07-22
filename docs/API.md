# API + DATA — the server surface

One zero-dependency node server (`server/server.mjs`) serves the built UI and `/api`.
The UI reaches it through `src/app/api.ts` — a RELATIVE `/api` client with a timeout and
a non-2xx throw, so there is ONE code path in dev (vite proxies) and in prod (same origin).

**API JSON is `no-store`** — never browser-cached. A cached list renders moved cards in
their old column.

## Authentication + identity

| Mode | How |
|---|---|
| open (default) | no auth; the caller is owner-equivalent |
| `AUTH_USERS` + `APP_SECRET` | a login gate over a fixed user list |
| `AUTH_MODE=accounts` + `APP_SECRET` | self-serve signup, mail verification, reset, delete-by-confirmation |
| `x-api-key: nak_…` | a role-scoped API key (`/p/apikeys`); the key acts as ITS role |

Sessions are HMAC-signed cookies (`httpOnly`, `sameSite=lax`). The active TEAM rides every
call as `x-nx-team`; team-scoped objects resolve visibility and the caller's per-team role
from it. Roles: `owner` > `admin` > `member` > `viewer`.

`/api/auth/*`: `me` · `login` · `logout` · `signup` · `verify` · `forgot` · `reset` ·
`delete-request` · `delete-confirm`.

## Records

`:o` = an object key from the config, `:id` = a row id.

| Method + path | Does |
|---|---|
| `GET /api/config` | the merged config the whole UI renders from (+ server-set `demo`, `features`) |
| `GET /api/objects/:o` | `{rows}` — every live row; query params narrow |
| `POST /api/objects/:o` | create a row |
| `GET /api/objects/:o/:id` | one row |
| `PATCH /api/objects/:o/:id` | partial update (a field editor sends ONE whole-value patch) |
| `DELETE /api/objects/:o/:id` | soft-delete to trash |
| `GET /api/objects/:o/trash` | trashed rows |
| `POST /api/objects/:o/:id/restore` | restore from trash |
| `DELETE /api/objects/:o/:id/destroy` | permanent — a separate `destroy` grant |
| `GET /api/objects/:o/rev` | the object's revision counter (the live-sync poll) |
| `POST /api/objects/:o/merge` | merge duplicates (`{ids, winnerId, preview?}`); relations re-point to the winner |
| `GET /api/objects/:o/duplicates` | suspected duplicate groups + the rules that matched |
| `GET /api/objects/:o/:id/duplicates` | candidates for one record |
| `POST /api/objects/:o/import` | CSV import (`{rows, preview?}`) → per-row verdicts + totals |
| `GET/POST /api/objects/:o/:id/timeline` \| `/notes` \| `/activities` | the record's event stream, notes, logged activities |
| `GET/POST /api/objects/:o/:id/files` · `GET …/files/:fileId` | attachments (base64 upload, 5 MB cap, images downscaled to 1600px) |
| `GET /api/objects/:o/:id/watchers` · `POST …/watch` | record subscriptions |
| `POST /api/objects/:o/:id/enrich` | the AI-enrichment seam (`{field}`) — real task with `field.primitive.taskId` + `NEXUS_API_KEY`, else a labeled mock |
| `POST/PATCH /api/objects/:o/:id/suggest/:field` | request / persist richText tracked changes |
| `POST /api/objects/:o/generate` | fire the object's `generate` action — returns the placeholder row immediately |

Relation reads project the target's primary label into the field AND return the raw ids
under `_refs` (see `docs/CONFIG.md` §3.3). Field values are validated server-side from the
field TYPE (`validate()` in `server/store.mjs`); a rejection is a 400 whose message names
the field, which the client surfaces verbatim in a toast.

Every route gates through `can(role, cfg, action, {own})` (`server/permissions.mjs`).

## System surfaces

| Path | Does |
|---|---|
| `GET /api/healthz` | `{ok, version, app}` — the probe the journey runner uses |
| `GET /api/users` | the people directory (`user`-type fields) |
| `GET/POST/PATCH/DELETE /api/views` | saved views per object (server-persisted, workspace-visible) |
| `GET/POST /api/tasks` · `PATCH/DELETE /api/tasks/:id` | cross-record tasks (filters: `status`, `assignee`, `record=<obj>:<id>`, `due=overdue\|today\|week`) |
| `/api/teams…` | teams, members, invitations, join codes, roles, activity log |
| `/api/webhooks…` + `/api/webhooks/catalog` | typed event catalog, HMAC-signed deliveries, per-endpoint delivery log, test-send |
| `/api/apikeys…` | create (full key shown once), list, revoke |
| `/api/schema…` | runtime schema edits (add object · add field · update field) |
| `GET /api/jobs` | the queue's recent runs (status, retries) |
| `GET /api/outbox` | the dev mail outbox (until `SMTP_URL` is set) |
| `POST /api/copilot` | one turn of agent chat through the emulator proxy (needs `COPILOT_DEPLOYMENT_ID`) |
| `POST /api/sync` | pull external warehouse writes into the running store → `{applied}` |
| `POST /api/_mock/generate` | the labeled generation MOCK — the single swap point for a real generation workflow |

A disabled feature flag makes ONE change in three places at once: the nav entry
disappears, the page is gone, and its routes 404 (`FEATURE_TEAMS` `FEATURE_WEBHOOKS`
`FEATURE_APIKEYS` `FEATURE_TASKS` `FEATURE_SCHEMA` `FEATURE_THEME` `FEATURE_GALLERY`).

## Unified search

One implementation sits behind every search surface — the top-bar search (which opens the
⌘K palette), and the `/` panel search. Surfaces differ in chrome, never in what they can
find.

| Export (`src/app/useGlobalSearch.ts`) | Does |
|---|---|
| `useRecordSearch(config, q, active?)` | debounced (180ms) cross-object record search; queries every configured object in parallel via `GET /api/objects/:o?q=`, takes the top 5 per object, caps at 12 hits. `active=false` parks it when the surface is closed; a query under 2 characters returns nothing |
| `navMatches(items, q)` | substring match over the nav taxonomy (objects, pages) for the surfaces that do not get cmdk's own filtering |
| `RecordHit` | `{obj, row, name}` — `name` is the row's primary value formatted for display |

Records come from the API; the nav taxonomy is matched client-side and each surface
renders it itself.

**A page kind can publish its own index into the same palette.** The document workspace
emits `onPageIndex(entries)` whenever its page set changes and hands back an opener
through `onOpenPageRef(open)`, so handbook pages appear alongside records in ONE ⌘K.
Pair it with that surface's own `cmdK` turned off so the app owns the single palette —
detail in `docs/BLOCKS.md` §"Feeding the app's unified search". Any block can follow the
same two-prop shape.

## The data spine — `app_state`

```
GET  /api/state            → { key: latestValue, … }   (latest per key)
POST /api/state {key,value} → append a new value for that key
```

`app_state` is an **append-only** key-value log read as latest-per-key. It is the
cross-session spine: anything that is not record data lives here — the persisted theme
skin, digest rollups, and every free-surface document (a workbook page persists its whole
snapshot under one `workbook:<pageKey>` key).

Because it is a plain HTTP key-value surface, a workflow or agent can produce or read one
of these documents with a single `POST /api/state`.

Three kinds of state, deliberately separate:

| State | Lives in |
|---|---|
| records, timelines, notes, files, tasks, teams | the store (`/api/objects/*`) |
| free-surface documents, app-wide settings, rollups | `app_state` (`/api/state`) |
| UI-only preferences (saved-view layout, theme choice, active team) | `localStorage` |

## Persistence + the store

| Mode | Behavior |
|---|---|
| default (no `WAREHOUSE`) | `server/store.mjs` — in memory; a restart starts from the seed |
| `WAREHOUSE=local` | `server/warehouse-local.mjs` — a file-backed append-only command log (node `fs` only, no credentials); `WAREHOUSE_LOCAL_PATH` sets the file |
| `WAREHOUSE=bigquery` | `server/warehouse.mjs` — the durable spine through the Nexus Google Cloud connector (`NEXUS_API_KEY` + `WAREHOUSE_CREDENTIAL_ID` + `BQ_*`) |

With a warehouse, every record/note/team/file/schema action is an event in an append-only
log that replays on boot in strict order with the same ids and timestamps — a restart
loses nothing, and runtime schema deltas re-apply at their original position relative to
the data writes that depend on them. The `/api` surface is identical in all three modes,
so the UI never knows which one is behind it.

Command-log discipline for new mutations: a named `Store` method registered in
`LOGGED_OPS` (`server/store-remote.mjs`), deterministic on replay — no `Date.now()`, no
randomness (the clock is `this._now()`, ids come from the store counter). Operational
state (queues, delivery logs) stays OUT of the log.

**External writers.** Another process can append events to the warehouse; `POST /api/sync`
(`RemoteStore.sync()`, the topbar Sync button, and the record poll) pulls them into the
running app with no restart. That is how an async generation's finished record lands.

## Seeding

Demo data is config-driven (`docs/CONFIG.md` §8): `sampleRows` (curated, stable ids like
`co_1` so journeys can assert on them) or `seedCount` generated typed rows. Relation
values may be written as target labels and normalize to ids once at boot; `@w0.3T09:30`
style tokens resolve to the CURRENT week at seed time. Sample rows are fictional by
construction — the sidebar shows a "Demo data" badge for as long as seeded rows exist.

## Reading the model from an assistant

```bash
claude mcp add my-app -- node scripts/mcp-server.mjs      # the app must be running
```

`scripts/mcp-server.mjs` exposes five READ-ONLY MCP tools over the live app: list
entities, read schemas, query records and timelines.
