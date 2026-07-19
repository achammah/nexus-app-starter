# nexus-app-starter

![table, light](docs/media/light-table.png)
<details><summary>dark theme · deals board</summary>

![table, dark](docs/media/dark-table.png)
![board](docs/media/board.png)
</details>

The org's runnable app skeleton for ANY product on Nexus — clone, configure, and you have a working, journey-verified app with the platform wiring in place. The config-driven **record-core** (tables/kanban/record pages from `starter.config.json`) covers record-system classes; everything else is a **custom page** (`src/app/pages.tsx` registry — ordinary React over the full vendored shadcn kit); both hang off the same shell, tokens, data spine, and journeys harness.

## Quick start

```bash
npm install
npm run sync-ui       # vendor nexus-ui source into src/ui (sibling checkout or $NEXUS_UI_PATH)
npm run build
npm run serve         # zero-dep server on :4000 (+3000/8080) — API + built UI
npm run journeys      # drives the app as a user; stamps journeys/.last-pass + docs/COVERAGE.md
npm run dev           # vite dev server (5173) + API (4000)
```

## What ships

- **Config-driven record-core** (`starter.config.json`): objects → fields → views; tables, kanban, record pages render FROM config (a new entity = a config row).
- **Vendored `nexus-ui`** (`src/ui/`): token canvas + primitives + record-core — the app owns its copy (`npm run sync-ui` to refresh; version in `src/ui/.ui-version`).
- **Zero-dep server** (`server/`): static + `/api` (records, timeline, notes, `app_state` kv — the data-spine SHAPE; swap `store.mjs` for the warehouse client, the UI doesn't change). API JSON is `no-store` — never browser-cached.
- **Nexus wiring** (`src/lib/`): platform client (`api-key` header, server-side only), in-app vendor connect flow (platform credentials, popup + poll), warehouse `app_state` twin stubs; `scripts/register-as-tool.mjs` for archetype 1/2 close-out.
- **Journeys harness** (`journeys/run.mjs`): user-level assertions on VISIBLE outcomes; writes `docs/COVERAGE.md`, updates the manifest's `Last verified`, stamps `journeys/.last-pass` (all-green only). Includes a harness self-check (a bogus selector must fail).
- **Docs contracts** (`docs/`): `SPEC.md` (append-per-ask requirement contract) · `DESIGN.md` (P0.5 design lock; ships as the default canvas) · `feature-manifest.md` · `COVERAGE.md` — the four artifacts the deploy gate reads.
- **Direction boards** (`boards/`): three rendered token directions for the P0.5 serve-then-link pick.
- **`.nexus-starter`** marker: arms the strict deploy gate for starter-born repos.

## Lifecycle

Clone → rename + edit `starter.config.json` → P0.5 pick a direction (boards) → build on the record-core → `npm run journeys` green → deploy (`git push` fires the auto-build; `skills/shared/scripts/deploy_watch.sh` drives it to verified-served). Full lifecycle + provenance rules: the org doctrine's `nexus-app-builder/references/starter-guide.md` and `PROVENANCE.md` here (binding).
