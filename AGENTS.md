# AGENTS.md — how an agent builds on nexus-app-starter

**North star: the config IS the app. Prefer a config change over new code, a journey over a claim, and the smallest diff that ships the ask.**

You are in a starter-born Nexus app (marker: `.nexus-starter` — it arms the strict deploy gate). Read order: this file → `starter.config.json` (what the app IS) → `docs/README.md` (the docs index — which file answers which question) → `docs/RECIPES.md` (exact files + order for common tasks) → `docs/` contracts (SPEC · DESIGN · feature-manifest · COVERAGE) → `docs/ARCHITECTURE.md` (file map + data flow) + `docs/DATA-MODEL.md` (generated ER view) → `src/ui/` docs via the library's own `AGENTS.md`/`docs/INDEX.md` (vendored copy of nexus-ui; catalog also at `src/ui/../..` in the library repo).

| Question | File |
|---|---|
| every key I may write in the config | `docs/CONFIG.md` |
| the `/api` surface, persistence, `app_state` | `docs/API.md` |
| configure a workbook / document workspace / 3D viewer | `docs/BLOCKS.md` |
| how to add a view type / field type / page / data source / journey | `docs/EXTENDING.md` |
| the component kit, the registries, tokens + skins | `docs/UI-KIT.md` |
| how to write and run tests | `docs/TESTING.md` |
| the traps (install flags, lazy loading, mobile, themes, store rules) | `docs/CONSTRAINTS.md` |

## Commands (the sanctioned set — anything else, justify in your PR)
| Command | Does |
|---|---|
| `npm run dev` | vite dev server + API proxy |
| `npm run serve` | build-less server (serves last `dist/`) — pair with `CONFIG_PATH=` to boot another product |
| `npm run build` | tsc + vite build |
| `npm run journeys` | full journey suite; stamps manifest + `journeys/.last-pass` on all-green |
| `npm run precheck` | tsc + build + journey-stamp freshness — run before EVERY push |
| `npm run sync-ui` | pull the pinned nexus-ui copy into `src/ui/` |
| `npm run model` | regenerate `docs/DATA-MODEL.md` from the config |
| `npm run generate` | scaffold an object / page / journey (non-interactive; see docs/RECIPES.md) |
| `npm run mcp` | MCP server over the app's entities/records (read-only; app must be running) |

## The four gate artifacts (the deploy gate READS these)
| File | Contract |
|---|---|
| `docs/SPEC.md` | one row per user ASK, appended THE TURN it arrives (user's words + status asked→built→journey-green + evidence + source) |
| `docs/DESIGN.md` | the design lock — replace the default canvas after picking a direction (boards in `boards/`); tokens live in `src/ui/tokens/tokens.css` |
| `docs/feature-manifest.md` | one row per feature: primitive id (or `mock`/`local`) + exact click path + VISIBLE proof; `Last verified` is written by the journey runner, never by hand |
| `journeys/.last-pass` | stamped ONLY by an all-green `npm run journeys` |

## Common tasks
| Task | Do |
|---|---|
| Add an entity (table/board/record page) | add an object to `starter.config.json` (fields, stageField, defaultView, `sampleRows` demo data — or `seedCount` for generated rows; full key reference: `docs/CONFIG.md`) → the surfaces, relation pickers, related lists, and filters exist; add a manifest row + a journey |
| Give an object another view (board, calendar, map, gallery, form, flow, sheet) | add a `views[]` entry — `{"type": "<type>", …options}`; per-type options: `docs/CONFIG.md` §4 |
| Become a different product | write a config → `CONFIG_PATH=<file> npm run serve`; relation targets are listed BEFORE the objects that point at them (the fullest reference config is the blocks-coverage FIXTURE `journeys/fixtures/coverage.config.json` — a test artifact, not a template) |
| Add a non-record surface (dashboard, console, wizard…) | create the component under `src/app/pages/`, register in `src/app/pages.tsx` → nav + `#/p/<key>` route appear; full vendored kit available |
| Add a feature journey | `npm run generate journey <name> -- --feature "<manifest row>"` → `journeys/extra/<name>.mjs` (assert a VISIBLE outcome — a value changed, a card moved; never a bare 200) + a manifest row; `npm run journeys` (`docs/TESTING.md`) |
| Wire the platform | `src/lib/nexusClient.mjs` (api-key client, server-side only) · `connectFlow.mjs` (vendor OAuth via platform credentials) · `scripts/register-as-tool.mjs` (archetype 1/2 close-out) · `appState` (swap `server/store.mjs` for the warehouse twin; the /api surface doesn't change) |
| Embed the org agent chat | set `chat.embedUrl` (EMBED deployment URL) → the dock renders; rung 3 seam: `src/lib/chatBridge.ts` |
| New string | born in `src/app/i18n.ts` dicts (never inline) |
| Before every push | `npm run precheck` (tsc + build + journeys-stamp freshness); the deploy gate DENIES a starter-born repo shipping red artifacts (`NEXUS_GATE_ACK=1` is the deliberate override) |

## Invariants
- `src/ui/` is a SYNCED COPY of nexus-ui (`npm run sync-ui`; version in `src/ui/.ui-version`) — fix library issues in the library, then re-sync; never fork the copy.
- Server API JSON is `no-store` (a cached list = moved cards rendering in the old column — measured).
- Irreversible/bulk actions ship WITH a review surface naming their targets (see ObjectView's delete flow) — the pattern is binding.
- Every interactive element gets a `data-testid`; journeys assert on those.
- `npm run journeys` drives whatever answers `JOURNEY_URL` (default `:4000`) and MUTATES its data — pin your own port: `PORT=<p> JOURNEY_URL=http://localhost:<p> npm run journeys`.
- Both themes and 390px are part of a feature's definition, never a later pass (`docs/CONSTRAINTS.md`).
