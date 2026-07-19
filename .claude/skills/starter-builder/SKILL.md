---
name: starter-builder
description: Build on THIS app (a nexus-app-starter clone) — add entities/fields/pages, re-brand for an org, wire auth/teams/permissions/webhooks, connect an AI assistant via MCP, verify with journeys. Use whenever the user asks to extend, restyle, or ship this app.
---

# starter-builder — playbooks for this app

North star: **the config IS the app**. Prefer a config change over new code, a journey over a claim, the smallest diff that ships the ask. Read `AGENTS.md` for the contract; every playbook below names its files — `docs/RECIPES.md` carries the full step lists.

## Playbooks

| Ask sounds like | Do | Files |
|---|---|---|
| "add invoices/projects/tickets…" | `npm run generate object Invoice -- --fields "name:text:primary,amount:currency,stage:select:Draft\|Sent\|Paid,owner:user"` → table/board/chart/record page/nav all exist; add a manifest row + journey | `starter.config.json` · `docs/feature-manifest.md` |
| "add a field" | append to the object's `fields[]` — email/url/number/date/select validate server-side FROM the type | `starter.config.json` |
| "make it look like OUR brand" | `theme.skin` = the org's brand as JSON (colors/chrome/radius/fonts/labels/logo) or tweak live at `#/p/theme` → Export JSON | `starter.config.json` · `src/ui/docs/THEMING.md` |
| "AI should fill this field" | `"primitive": {kind, id, label}` on the field → sparkle appears; swap the `/enrich` mock for the real platform call | `starter.config.json` · `server/server.mjs` |
| "add a dashboard/console page" | `npm run generate page Reports` (template: `scripts/templates/page.tsx.tpl`) | `src/app/pages/` · `src/app/pages.tsx` |
| "people should sign in / teams / roles" | `AUTH_MODE=accounts` + `APP_SECRET`; teams at `#/p/team`; per-object `permissions` block (server 403s, UI hides) | `.env` · `starter.config.json` · `docs/RECIPES.md` |
| "notify another system on changes" | `#/p/webhooks` → endpoint + events from the typed catalog; deliveries are HMAC-signed + logged | `server/webhooks.mjs` |
| "run something on a schedule" | add a handler in `server/jobs.mjs` (one small function per type) + `enqueue`/interval knob | `server/jobs.mjs` · `.env` |
| "let Claude/an assistant query the data" | `claude mcp add my-app -- node scripts/mcp-server.mjs` (app must be running) — read-only tools over entities/records/timelines | `scripts/mcp-server.mjs` |
| "is it done?" | a journey asserting the VISIBLE outcome + `npm run journeys` green — never a bare claim | `journeys/run.mjs` (or `npm run generate journey <name>`) |

## Hard rules
- `src/ui/` is a SYNCED copy of nexus-ui — fix library issues upstream, `npm run sync-ui`; never edit the copy.
- Every interactive element gets a `data-testid`; journeys assert on those, never CSS classes.
- Irreversible/bulk actions ship WITH a review surface naming their targets.
- `npm run precheck` before every push.
