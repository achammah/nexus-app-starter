# Architecture — file map + data flow

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
  server.mjs             zero-dep node: static dist + /api (objects CRUD+timeline+notes · app_state kv ·
                         healthz w/ VERSION) · JSON no-store · binds PORT+3000+8080 · placeholder page when
                         dist missing (a delivery failure must not read as a crash loop)
  store.mjs              in-memory store — the data-spine SHAPE (append-only app_state, latest-per-key);
                         swap for the warehouse client in prod, the /api surface (and UI) doesn't change
  seed.mjs               deterministic FICTIONAL seed (stable ids → journeys can assert on de_2 etc.)
journeys/run.mjs         the verification harness: boots the server if needed, drives every journey as the
                         user, asserts VISIBLE outcomes, screenshots each, writes docs/COVERAGE.md rows,
                         stamps manifest Last-verified, writes journeys/.last-pass on all-green
scripts/                 sync-ui · precheck (tsc+build+stamp) · register-as-tool
boards/                  P0.5 direction boards (serve-then-link pick)
docs/                    SPEC · DESIGN · feature-manifest · COVERAGE (+ this file) — the gate artifacts
```

**Data flow:** UI → relative `/api` (vite proxies in dev; same origin in prod) → store (mock) or warehouse (prod twin). **State:** records live server-side; `app_state` kv is the cross-session spine; UI-only prefs (saved views, theme) live in localStorage. **Routing:** hash-based, zero router deps; palette/relations hand off filters via `sessionStorage["nx-pending-q"]`.

**Verification chain:** feature → manifest row → journey asserting its VISIBLE outcome → `npm run journeys` stamps → deploy gate reads the stamps. `npm run precheck` before every push.
