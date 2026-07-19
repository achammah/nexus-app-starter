# AGENTS.md — how an agent builds on nexus-app-starter

You are in a starter-born Nexus app (marker: `.nexus-starter` — it arms the strict deploy gate). Read order: this file → `starter.config.json` (what the app IS) → `docs/` contracts (SPEC · DESIGN · feature-manifest · COVERAGE) → `docs/ARCHITECTURE.md` (file map + data flow) → `src/ui/` docs via the library's own `AGENTS.md`/`docs/INDEX.md` (vendored copy of nexus-ui; catalog also at `src/ui/../..` in the library repo).

## The four gate artifacts (the deploy gate READS these)
| File | Contract |
|---|---|
| `docs/SPEC.md` | one row per user ASK, appended THE TURN it arrives (user's words + status asked→built→journey-green + evidence + source) |
| `docs/DESIGN.md` | the P0.5 design lock — replace the default canvas after the direction pick (boards in `boards/`); tokens live in `src/ui/tokens/tokens.css` |
| `docs/feature-manifest.md` | one row per feature: primitive id (or `mock`/`local`) + exact click path + VISIBLE proof; `Last verified` is written by the journey runner, never by hand |
| `journeys/.last-pass` | stamped ONLY by an all-green `npm run journeys` |

## Common tasks
| Task | Do |
|---|---|
| Add an entity (table/board/record page) | add an object to `starter.config.json` (fields, stageField, defaultView) + seed rows in `server/seed.mjs` → the surfaces exist; add a manifest row + a journey |
| Add a non-record surface (dashboard, console, wizard…) | create the component under `src/app/pages/`, register in `src/app/pages.tsx` → nav + `#/p/<key>` route appear; full vendored kit available |
| Add a feature journey | append to `journeys/run.mjs` (assert a VISIBLE outcome — a value changed, a card moved; never a bare 200) + a manifest row; `npm run journeys` |
| Wire the platform | `src/lib/nexusClient.mjs` (api-key client, server-side only) · `connectFlow.mjs` (vendor OAuth via platform credentials) · `scripts/register-as-tool.mjs` (archetype 1/2 close-out) · `appState` (swap `server/store.mjs` for the warehouse twin; the /api surface doesn't change) |
| Embed the org agent chat | set `chat.embedUrl` (EMBED deployment URL) → the dock renders; rung 3 seam: `src/lib/chatBridge.ts` |
| New string | born in `src/app/i18n.ts` dicts (never inline) |
| Before every push | `npm run precheck` (tsc + build + journeys-stamp freshness); the deploy gate DENIES a starter-born repo shipping red artifacts (`NEXUS_GATE_ACK=1` is the deliberate override) |

## Invariants
- `src/ui/` is a SYNCED COPY of nexus-ui (`npm run sync-ui`; version in `src/ui/.ui-version`) — fix library issues in the library, then re-sync; never fork the copy.
- Server API JSON is `no-store` (a cached list = moved cards rendering in the old column — measured).
- Irreversible/bulk actions ship WITH a review surface naming their targets (see ObjectView's delete flow) — the pattern is binding (ux-canon).
- Every interactive element gets a `data-testid`; journeys assert on those.
