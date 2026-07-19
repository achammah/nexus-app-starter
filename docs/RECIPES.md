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
1. `starter.config.json` → append to that object's `fields[]`. Types: `text · longText · number · boolean · rating · select · multiselect · array · date · dateTime · currency · email · url · json · relation · user · money · emails · phones · links · address · fullName`. Select/multiselect options may be strings or `{value, label, color}` (colored chips everywhere). Field flags: `unique: true` (duplicates 409), `isActive: false` (hidden + write-protected, data preserved), `scale` for ratings.
2. `email/url/number/date/select` values are validated server-side FROM the type — no separate validation block (`server/store.mjs` `validate()`). Shaped types validate too: `money` wants `{ "amount": 12500, "code": "EUR" }`, `emails`/`links` check every entry, `phones` is lenient (digits/+/spaces).
3. `user` fields read the top-level `users[]` directory; `multiselect` needs `options`.
4. Shaped values: `money {amount, code}` (renders “€12,500”, sums by `amount` in rollups/charts) · `emails/phones/links` are `string[]` (chips in cells, list editor on the record page; links anchor with the bare host) · `address {street, city, postcode, country}` (cells show “street, city”) · `fullName {first, last}` (cells show “First Last”; may be `primary` — the row link and record title render the joined name). CSV export flattens them (`12500 EUR` · `a; b` · joined).

## Relations (identity model: store ids, read labels)

Relation fields persist target row IDS — single: `"co_1"` · many (`multiple: true`): `["ce_1", …]` · polymorphic (`relationTargets: ["a","b"]` instead of `relation`): `{ "object": "a", "id": "a_1" }`. Every read projects the target's PRIMARY label into the field itself (the API returns label strings, exactly as before) and adds `_refs` — the raw ids per relation field — for identity-aware UI. Writes accept an id, an `{object?, id}` ref, or a primary-label string: a label resolving to ONE live target normalizes to its id; two candidates → 400 naming them; no match → the string stays verbatim (a dangling label). Because links are ids: renaming a target updates every inbound cell with no sweep; merging re-points losers' ids to the winner; a TRASHED target keeps projecting (restore heals); DESTROYING a target severs its inbound links. `inverseLabel` on a relation field names the reverse related-list section on the target object. Seed rows may use labels — they normalize to ids once at boot. The create dialog authors single relations by id (poly selects grouped per type); `multiple` relations attach on the record page via the checkbox picker, which commits ONE write when it closes.

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

## Put the nav on top

`starter.config.json` → `"app": { …, "nav": "top" }` — the left sidebar is replaced by one horizontal bar: brand, object/page items (with live counts), and search/theme/sign-out on the right; favorites and the team switcher become compact controls in the bar. Omit the field (or set `"side"`) for the default sidebar. Both modes are mobile-responsive out of the box: at ≤768px the nav collapses to a burger that opens a drawer (objects, pages, favorites, team switcher, search, sign-out), and the side peek becomes a full-screen sheet.

## Change the base theme
`src/ui/tokens/tokens.css` holds the `--nx-*` canvas (light + dark) — the static layer skins write over. Fix tokens in nexus-ui, re-sync.

## Save + share list views
Views menu (any object list): shape filters/layout/grouping/rollup → "Save current as view" → named, server-persisted, visible to the whole workspace; "All <object>" resets. Kanban Rollup picker: sum/avg/min/max over any numeric field per column. Bulk edit: select rows → Edit → field + value (empty clears) with live progress. Multi-level sort: shift-click a second header.

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

## Go persistent (native warehouse spine)
1. `.env`: `WAREHOUSE=bigquery` + `NEXUS_API_KEY` + `WAREHOUSE_CREDENTIAL_ID` (from `nexus tool credentials <toolId>` — tool-scoped, not the org-wide id). Optional: `BQ_DATASET`/`BQ_LOCATION` (location must match the dataset's region) / `BQ_PROJECT`.
2. Boot — the server creates the dataset + `events` table, then REPLAYS the append-only command log over the deterministic seed: same ids, true timestamps, nothing lost across restarts. Unset `WAREHOUSE` and the in-memory mock serves the identical API.
3. Semantics: single writer; the job queue + webhook delivery logs are operational state and stay in memory (a restart drops pending jobs). Files ride the log as base64 — move heavy attachment volumes to object storage before they matter.

## Point an AI assistant at the app (MCP)
`claude mcp add my-app -- node scripts/mcp-server.mjs` (the app must be running; `NX_APP_URL` overrides the target). Read-only tools: `list_entities · describe_entity · query_records · get_record · get_timeline`. Claude Desktop config lives in the header of `scripts/mcp-server.mjs`.

## Notify another system on record changes (webhooks)
`/p/webhooks` → endpoint URL + events from the typed catalog (`<object>.created/updated/deleted`, `*`). Deliveries are HMAC-SHA256 signed (`x-nx-signature`, secret shown once) and logged per endpoint; failures retry via the job queue.

## Run something on a schedule (jobs)
One handler per type in `server/jobs.mjs` + `enqueue(store, "<type>", payload)`. The shipped `digest` job (arm with `DIGEST_EVERY_MS`, optional `DIGEST_TO`) is the reference: rollups into `app_state`, runs visible at `/api/jobs`.

## Work the list without a mouse

Tables carry a three-level focus model: ↑↓ (or j/k) move a row focus; `x` selects (Shift+x extends, Cmd/Ctrl+A selects all); Enter drops into cells; arrows move spreadsheet-style; typing on a cell opens its editor seeded with the keystroke; Enter saves and steps down, Tab saves and steps sideways; Escape climbs back out one level at a time. Cmd/Ctrl+Enter opens the focused record in the side peek.

## The side peek

Rows open in a right-edge panel over the list (set `"openIn": "page"` on an object to navigate instead). Related records stack onto the same panel — Escape steps back, then closes; the panel root rides the URL (`?peek=<id>`), so reload and share restore it; cmd/ctrl-click a row link for a real new tab. The header pages through the set you opened from (N of M, wrapping). In a relation picker, a search with no match offers "Create …" — the record is born with just a title, attached, and opened for progressive completion.

## Recover deleted records (trash)

Deleting is recoverable: rows get a `_deletedAt` stamp and move to the per-object Trash (toolbar icon next to New). Restore brings a row back intact; **Delete forever** is permanent and is its own permission — grant `destroy` (and optionally `destroyOwn`) in the object's `permissions` table; `restore` rides the `delete` grant. Owners always hold both. Set `TRASH_RETENTION_DAYS` to auto-destroy expired trash (a `trash-sweep` job runs on an interval; unset/0 keeps trash forever).

Creating a record whose unique field matches a TRASHED row restores that row and applies the incoming data (the response is `200` with `_resurrected: true` and the original id) — imports and re-syncs converge instead of colliding. A collision with a live row still 400s.

## Find duplicates

Every object gets deterministic duplicate detection — no scoring, no AI, each match explainable in one sentence: same normalized primary (case, accents, spacing and punctuation ignored); one normalized primary beginning the other at a word boundary when the shorter is ≥ 8 characters; the same email-field value; the same url-field domain. Unique fields are skipped — the server already makes live collisions impossible, so a unique match can't exist. Trashed rows never match.

Two surfaces: a record with suspected twins shows a **Possible duplicates** section (each candidate names its matched rule; one click opens the merge dialog preselected — Cancel moves nothing and leaves the pair selected on the list), and any list's **Find duplicates** action sweeps the whole object into groups with a per-group Review merge. Read-only API: `GET /api/objects/:key/duplicates` (groups) and `GET /api/objects/:key/:id/duplicates` (one record's candidates) — both ride the `view` permission; merging stays behind `edit`+`delete`.

## Merge duplicates

Select 2–10 rows → **Merge** → pick the survivor. The preview shows the final value per field and where inherited values come from: the winner keeps its values on conflict and absorbs the losers' non-empty fields into its own empties. Relation fields elsewhere that pointed at a loser re-point to the winner; timelines and watchers travel; losers land in the trash. `POST /api/objects/:key/merge {ids, winnerId, preview?}`.

## Import records from CSV

Any object list → **Import** (toolbar) → paste CSV text or pick a `.csv` file → map columns to fields (auto-matched on name/label; the primary field must be mapped) → preview the first rows against the server's validators → run. Rows import in chunks with live progress and a cancel between chunks; the summary counts created / restored / skipped / failed, and failed rows download as a CSV with the reason per row. A unique value matching a TRASHED row restores it (original id, new data); a collision with a live row is skipped as a duplicate. Another system can call it directly: `POST /api/objects/:key/import {rows: [{field: value}], preview?}` — rows keyed by field key, at most 2000 per call, gated by the `create` permission.

## Let another system call the app (API keys)

`/p/apikeys` (owners/admins; `FEATURE_APIKEYS=0` hides page + API together) → name + role → **Create** → copy the `nak_…` key: it is shown exactly once, only its sha256 hash is stored. A request carrying the key authenticates as the key's role through the same permission tables as a signed-in member, with or without account auth:

```
curl -H "x-api-key: nak_…" https://your-app/api/objects/companies
```

`Authorization: Bearer nak_…` works too. Scoping: a `viewer` key reads whatever viewers can view and nothing more; `member`/`admin` keys follow each object's `permissions` table; revoking a key kills it immediately (every call answers 401). Team-scoped objects stay session-only — keys carry no team membership.

## Pin favorites

The star on any record header pins it to a Favorites section in the sidebar. Pins are personal and device-local (localStorage), so they work with or without accounts.

## Ship
`npm run precheck` (tsc + build + journey-stamp freshness) → `docs/PRODUCTION_CHECKLIST.md` → push. CI runs the full journey suite; the deploy gate reads `journeys/.last-pass` + the manifest stamps.
