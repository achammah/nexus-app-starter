# Architecture — file map + data flow

Config key reference: `docs/CONFIG.md` · page kinds: `docs/PAGE-KINDS.md` · the block library: `docs/BLOCKS.md` · the `/api` surface + data spine: `docs/API.md` · extension seams: `docs/EXTENDING.md` · the
vendored kit and its registries: `docs/UI-KIT.md` · docs index: `docs/README.md`.

```
starter.config.json      app identity · theme seed · chat.embedUrl · OBJECTS (the record model)
index.html → src/app/main.tsx   css order: tokens → shadcn bridge → primitives → record-core → app
src/app/
  App.tsx                shell: sidebar nav (objects + custom pages) · topbar (search · ⌘K hint · theme) ·
                         hash router (#/o/<obj> · #/o/<obj>/r/<id> · #/p/<page>) · toasts · palette · chat dock
  ObjectView.tsx         list surface: view bar (filter · count · view switch · New) · saved-view persistence
                         (localStorage nx-view-<obj>) · pending-q handoff (sessionStorage) · bulk bar
                         (CSV export · reviewed delete) · DataTable | KanbanBoard
  RecordView.tsx         loads row + timeline → RecordPage; optimistic patch + reload-on-error
  CommandPalette.tsx     ⌘K/Ctrl-K: live record search across objects + object/page jumps (vendored command)
  ChatDock.tsx           EMBED-deployment iframe dock (renders nothing when unconfigured)
  pages.tsx              custom-pages registry — the any-product extension point
  i18n.ts                string dicts (new strings are born here)
  api.ts                 relative /api client (timeout + non-2xx throw) — one code path dev/prod
src/ui/                  SYNCED nexus-ui (tokens · shadcn bridge · vendored kit · primitives · record-core)
src/lib/                 nexusClient · connectFlow · chatBridge (rung-3 seam)
server/
  server.mjs             zero-dep node: static dist + /api (objects CRUD+timeline+notes+activities ·
                         files upload/list/download (base64, 5 MB cap) · /enrich (MOCK — the single
                         swap-point for a real platform task/workflow via field.primitive) · app_state kv ·
                         watch/watchers · rev (live-sync poll) · users directory · healthz w/ VERSION) ·
                         permission gate per route (server/permissions.mjs) · feature flags 404 disabled
                         modules · JSON no-store · binds PORT+3000+8080 · placeholder page when dist
                         missing (a delivery failure must not read as a crash loop)
  auth.mjs               cookie sessions (HMAC+pwv) · AUTH_USERS gate or AUTH_MODE=accounts flows
                         (signup/verify/reset+decoy/delete-by-confirmation)
  teams.mjs              membership + dual invitations (mail token / join code) + roles
  permissions.mjs        role × object-config action table (client twin: src/app/permissions.ts)
  jobs.mjs               store-backed queue + scheduler (digest · webhook-deliver · notify-subscribers)
  webhooks.mjs           typed event catalog (from config) · HMAC deliveries · delivery log
  email.mjs              mail seam — dev OUTBOX transport (/api/outbox); SMTP_URL is the swap point
  store.mjs              in-memory store — the data-spine SHAPE (append-only app_state, latest-per-key);
                         swap for the warehouse client in prod, the /api surface (and UI) doesn't change
  seed.mjs               deterministic FICTIONAL seed (stable ids → journeys can assert on de_2 etc.)
journeys/run.mjs         the verification harness: boots the server if needed, drives every journey as the
                         user, asserts VISIBLE outcomes, screenshots each, writes docs/COVERAGE.md rows,
                         stamps manifest Last-verified, writes journeys/.last-pass on all-green
scripts/                 sync-ui · precheck (tsc+build+stamp) · generate (object/page/journey) ·
                         gen-model (ER doc) · mcp-server (assistant over the data model) · register-as-tool
boards/                  design direction boards (serve, pick one, lock in docs/DESIGN.md)
docs/                    SPEC · DESIGN · feature-manifest · COVERAGE (+ this file) — the gate artifacts
```

**Data flow:** UI → relative `/api` (vite proxies in dev; same origin in prod) → store (mock) or warehouse (prod twin). **State:** records live server-side; `app_state` kv is the cross-session spine; UI-only prefs (saved views, theme) live in localStorage. **Routing:** hash-based, zero router deps; palette/relations hand off filters via `sessionStorage["nx-pending-q"]`.

**Verification chain:** feature → manifest row → journey asserting its VISIBLE outcome → `npm run journeys` stamps → deploy gate reads the stamps. `npm run precheck` before every push.

**AI-enrichment seam:** a field whose config carries `primitive: {kind: "task"|"workflow", id?, label?}` renders a sparkle affordance on the record page. Clicking it POSTs `/api/objects/:obj/:id/enrich {field}` — the server MOCK writes a clearly-labeled `(mock)` value + a timeline event. To go live, replace the `mockValue` line in `server/server.mjs` with a platform call using `primitive.id` (`src/lib/nexusClient` holds the client seam); the UI, config shape, and journey don't change.
