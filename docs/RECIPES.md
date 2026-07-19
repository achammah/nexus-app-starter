# RECIPES — exact files, exact order

Task cookbook. Each recipe names the files touched and the order of operations. If a recipe and the code disagree, the code won; fix the recipe in the same commit.

## Add an entity
Fastest: `npm run generate object Invoice -- --fields "name:text:primary,amount:currency,stage:select:Draft|Sent|Paid,owner:user"` — writes the config entry (board on the first select, seeded rows, `npm run model` refresh). By hand:
1. `starter.config.json` → append to `objects[]`: `key/label/labelOne/icon`, `fields[]`, optional `stageField` (a select field's key → enables the board), `defaultView`, and demo data (`sampleRows` with stable ids, or `seedCount`). Relation targets must be listed BEFORE the objects that point at them.
2. Nothing else — tables/board/chart/record page/pickers/filters/nav derive from config.
3. `docs/feature-manifest.md` → one row. A journey asserting a VISIBLE outcome (`npm run generate journey <name> -- --feature "<row>"` scaffolds one under `journeys/extra/`).
4. `npm run journeys`.

## Scaffold a page or journey
- `npm run generate page Reports` → `src/app/pages/Reports.tsx` from `scripts/templates/page.tsx.tpl` (edit the template once — every later generate uses your version) + auto-registered at the `// generate:pages` marker.
- `npm run generate journey invoice-flow -- --feature "Invoices board"` → `journeys/extra/invoice-flow.mjs` skeleton, auto-loaded by the runner.
- All subcommands are flag-driven (no prompts) so an agent can run them headlessly; `--dry` on `object` prints the JSON without writing.

## Add a field to an existing entity
1. `starter.config.json` → append to that object's `fields[]`. Types: `text · number · select · date · currency · email · url · relation · user · multiselect`.
2. `email/url/number/date/select` values are validated server-side FROM the type — no separate validation block (`server/store.mjs` `validate()`).
3. `user` fields read the top-level `users[]` directory; `multiselect` needs `options`.

## Make a field AI-enrichable
1. On the field: `"primitive": { "kind": "task" | "workflow", "id": "<platform id>", "label": "Company research" }`.
2. The record page shows a sparkle Run button → `POST /api/objects/:o/:id/enrich`.
3. Ship real: replace the `mockValue` line in `server/server.mjs` with a platform call via `src/lib/nexusClient.mjs` using `primitive.id`. The UI and config don't change.

## Add a custom page (non-record surface)
1. Component under `src/app/pages/YourPage.tsx`.
2. Register in `src/app/pages.tsx` (`key/label/icon/component`) → nav + `#/p/<key>` route appear.
3. Journey + manifest row.

## Add an activity kind (beyond call/email/meeting)
1. `server/server.mjs` → extend the allowed-kind list in the `/activities` route.
2. `src/ui/record-core/RecordPage.tsx` is the library copy — add the kind + icon in nexus-ui (`ACTIVITY_KINDS` + `evIcon`), then `npm run sync-ui`. Never edit `src/ui/` directly.

## Boot as a different product
`CONFIG_PATH=path/to/other.config.json npm run serve` — the config IS the app. Fullest reference shape: `journeys/fixtures/coverage.config.json` (a test fixture, not a template).

## Re-brand for an organisation (skins)
1. `starter.config.json` → `theme.skin` = the org's brand as JSON (or `theme.skinPreset` for a built-in; `theme.accent` for the one-knob shortcut). Full knob set → `src/ui/docs/THEMING.md`: brand ramp, dark/brand chrome shell, radius personality (0 = squared, reaches the vendored shadcn kit), fonts, labels, semantic palette, logo mark/wordmark, raw token overrides.
2. Reload — the whole app re-brands, dark mode derives from the same brand. Reference example: the `ember` preset (dark chrome + sharp corners + own palette).

## Change the base theme
`src/ui/tokens/tokens.css` holds the `--nx-*` canvas (light + dark) — the static layer skins write over. Fix tokens in nexus-ui, re-sync.

## Add a journey
1. Append to the array in `journeys/run.mjs`: `{ name, feature, async run(page) }` — `feature` must EXACTLY match a manifest row's Feature column (the runner stamps `Last verified` by that string).
2. Assert VISIBLE outcomes (a value changed, a card moved, a toast) — never a bare 200.
3. Radix menus in headless: select items by pressing ArrowDown UNTIL the target has `data-highlighted`, then Enter (blind arrow counts race the focus transfer).
4. If the journey changes persisted view state (saved views, group-by), RESTORE defaults at the end — journeys share one browser context.

## Wire real auth
Set `AUTH_USERS` (`user:pass,user2:pass2`) + `APP_SECRET` (32+ chars) → the login gate arms. See `.env.example`. Swap the seam for SSO/OAuth in `server/auth.mjs` — the gate call-sites don't change.

## Turn on accounts, teams, permissions
1. `.env`: `AUTH_MODE=accounts` + `APP_SECRET` (32+ chars). Signup/verification/reset/deletion flows arm; mail lands in the dev outbox (`GET /api/outbox`) until `SMTP_URL` + a real transport are wired in `server/email.mjs`.
2. Teams live at `/p/team`: create, invite by mail, or share the join code. Roles: owner > admin > member.
3. Per-object permissions in the config: `"permissions": { "admin": [...], "member": ["view","create","editOwn"], "viewer": ["view"] }` — omit the block and everything stays open. Roles: owner > admin > member > viewer. `editOwn`/`deleteOwn` grant the action only on rows the caller created (`_createdBy`). The server 403s uncovered actions; the UI hides their affordances (`src/app/permissions.ts` mirrors `server/permissions.mjs` — keep them in sync).
4. Team-scoped data: `"teamScoped": true` on an object → rows belong to the creator's ACTIVE team (the sidebar switcher; `x-nx-team` header), other teams can't see or reach them, and the caller's PER-TEAM role governs. The team page also carries the audit trail (invites, joins, role changes, revocations); removing a pending member kills their invite token.

## Point an AI assistant at the app (MCP)
`claude mcp add my-app -- node scripts/mcp-server.mjs` (the app must be running; `NX_APP_URL` overrides the target). Read-only tools: `list_entities · describe_entity · query_records · get_record · get_timeline`. Claude Desktop config lives in the header of `scripts/mcp-server.mjs`.

## Notify another system on record changes (webhooks)
`/p/webhooks` → endpoint URL + events from the typed catalog (`<object>.created/updated/deleted`, `*`). Deliveries are HMAC-SHA256 signed (`x-nx-signature`, secret shown once) and logged per endpoint; failures retry via the job queue.

## Run something on a schedule (jobs)
One handler per type in `server/jobs.mjs` + `enqueue(store, "<type>", payload)`. The shipped `digest` job (arm with `DIGEST_EVERY_MS`, optional `DIGEST_TO`) is the reference: rollups into `app_state`, runs visible at `/api/jobs`.

## Ship
`npm run precheck` (tsc + build + journey-stamp freshness) → `docs/PRODUCTION_CHECKLIST.md` → push. CI runs the full journey suite; the deploy gate reads `journeys/.last-pass` + the manifest stamps.
