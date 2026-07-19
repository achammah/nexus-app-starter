# RECIPES — exact files, exact order

Task cookbook. Each recipe names the files touched and the order of operations. If a recipe and the code disagree, the code won; fix the recipe in the same commit.

## Add an entity
1. `starter.config.json` → append to `objects[]`: `key/label/labelOne/icon`, `fields[]`, optional `stageField` (a select field's key → enables the board), `defaultView`, and demo data (`sampleRows` with stable ids, or `seedCount`). Relation targets must be listed BEFORE the objects that point at them.
2. Nothing else — tables/board/record page/pickers/filters/nav derive from config.
3. `docs/feature-manifest.md` → one row. `journeys/run.mjs` → one journey asserting a VISIBLE outcome.
4. `npm run journeys`.

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

## Change the theme
`src/ui/tokens/tokens.css` holds the `--nx-*` canvas (light + dark). Fix tokens in nexus-ui, re-sync. Per-app accent: `theme.accent` in `starter.config.json`.

## Add a journey
1. Append to the array in `journeys/run.mjs`: `{ name, feature, async run(page) }` — `feature` must EXACTLY match a manifest row's Feature column (the runner stamps `Last verified` by that string).
2. Assert VISIBLE outcomes (a value changed, a card moved, a toast) — never a bare 200.
3. Radix menus in headless: select items by pressing ArrowDown UNTIL the target has `data-highlighted`, then Enter (blind arrow counts race the focus transfer).
4. If the journey changes persisted view state (saved views, group-by), RESTORE defaults at the end — journeys share one browser context.

## Wire real auth
Set `AUTH_USERS` (`user:pass,user2:pass2`) + `APP_SECRET` (32+ chars) → the login gate arms. See `.env.example`. Swap the seam for SSO/OAuth in `server/auth.mjs` — the gate call-sites don't change.

## Ship
`npm run precheck` (tsc + build + journey-stamp freshness) → `docs/PRODUCTION_CHECKLIST.md` → push. CI runs the full journey suite; the deploy gate reads `journeys/.last-pass` + the manifest stamps.
