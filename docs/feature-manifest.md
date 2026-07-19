# Feature/test manifest

One row per feature, written the wave it ships. Primitive = the platform primitive id behind it (`wf_…`/`task_…`/`agent_…`), or `mock` (labeled in the UI), or `local` for pure-UI features with no platform twin. A proof must be VISIBLE ("the API returns 200" is not visible). `Last verified` is written by `npm run journeys`, never by hand.

| Feature | Primitive | How to exercise (exact click path) | VISIBLE outcome that proves it | Last verified (local / hosted) |
|---|---|---|---|---|
| App shell + nav | local | open `/` → click each nav item | active nav item highlights; page title + row count change | local 2026-07-19T17:28 |
| Companies table | local | nav → Companies | 8 seeded rows render; header sort toggles order | local 2026-07-19T17:28 |
| Record page + inline edit | local | Companies → open “Brightline Analytics” → edit City → blur | field persists after reload; timeline gains an `updated` event; toast “Saved” | local 2026-07-19T17:28 |
| Notes | local | any record → Notes tab → type + Add | note appears in list; timeline gains a `note` event | local 2026-07-19T17:28 |
| Deals board (kanban) | local | nav → Deals (Board view) | 5 stage columns; changing a deal’s Stage moves its card to the target column | local 2026-07-19T17:28 |
| Create record | local | Companies → New company → name → Create | dialog closes; record page opens; count increments | local 2026-07-19T17:28 |
| Global search | local | topbar search → type “bright” → Enter | list filters to matching rows; filter chip shows the query | local 2026-07-19T17:28 |
| Theme toggle | local | topbar moon/sun | background/ink invert; choice survives reload | local 2026-07-19T17:28 |
| Data spine (app_state kv) | mock | POST /api/state {key,value} → GET /api/state | latest-per-key value returned (append-only history behind it) | local 2026-07-19T17:28 |
| Command palette (⌘K) | local | Ctrl/⌘-K → type a record name → Enter | palette lists live record hits across objects; selecting one opens its record page | local 2026-07-19T17:28 |
| Saved view (filter+view persist) | local | filter People to “maya” → visit Deals → return | the filter text AND its applied result survive navigation (per-object persistence) | local 2026-07-19T17:28 |
| Relation link cells | local | Deals table → click a Company cell | lands on Companies FILTERED to that company (1 row) | local 2026-07-19T17:28 |
| Bulk select · CSV export · reviewed delete | local | select rows → Export CSV / Delete | a .csv downloads; Delete opens a review dialog NAMING the records; confirm removes them and the count drops | local 2026-07-19T17:28 |
| Embedded agent chat dock | local | set chat.embedUrl in starter.config.json | floating chat button + iframe panel; unconfigured → nothing renders | local 2026-07-19T17:28 |
| Custom pages + kit demo | local | nav → Kit demo | the registered page renders; empty form submit shows a zod error; chart svg + sheet + accordion work live | local 2026-07-19T17:28 |
| Auth seam (login gate) | local | set AUTH_USERS + APP_SECRET → open the app | login card gates the shell; wrong password shows an error; right password enters; the API 401s without a session and unlocks with the cookie | local 2026-07-19T17:28 |
| Virtualized big lists | local | any object >80 rows | the DOM renders a WINDOW (row count < total) while scroll reaches every row; total count stays correct | local 2026-07-19T17:28 |
| Column visibility + sort persist | local | Columns menu → uncheck a field; sort a header; navigate away and back | the column disappears and STAYS hidden; the sort order survives navigation; re-checking restores | local 2026-07-19T17:28 |
| Date fields (calendar) | local | Deals table shows formatted dates → open a deal → Close date → pick a day | table cells render “14 Aug 2026”-style; the calendar pick saves, survives reload, and lands in the timeline | local 2026-07-19T17:28 |
| Select-field filter chips | local | Companies → Industry chip → check Software | list narrows to matching rows; the chip shows the active count; clear-all restores | local 2026-07-19T17:28 |
| Relation picker + related lists | local | open a company → related People/Deals panels; open a deal → Company picker | related panels list linked records (click opens them); the combobox sets the relation, saves, and the jump button lands filtered on the target | local 2026-07-19T17:28 |
| Building-blocks litmus (record-system class by config) | local | `CONFIG_PATH=journeys/fixtures/coverage.config.json npm run serve` | the SAME build assembles the hardest known topology (two-sided relations · staged pipeline · dates · scores) with zero code changes — a continuous TEST of block coverage, not a shipped template | local 2026-07-19T17:28 |
| User (assignee) fields | local | open a deal → Owner → pick from the directory | combobox over `users` from config; table cells render avatar + name; pick saves + persists | local 2026-07-19T17:28 |
| Multiselect (tags) fields | local | People table tag chips → Tags filter → record page toggle | chips in cells; contains-any filtering; toggling a tag saves, persists, and updates chips | local 2026-07-19T17:28 |
| Board group-by any field | local | any object w/ a select field → Board; deals board → “by …” picker → Owner | companies (no stageField) still gets a Board via Industry; deals board regroups into user columns; the choice persists per object | local 2026-07-19T17:28 |
| Attachments (files on records) | local | record → Files tab → Upload file | file lists with name + size + date; Download returns the exact bytes; timeline gains an “Attached …” event | local 2026-07-19T17:28 |
| Activity composer (call/email/meeting) | local | record → Timeline tab → pick kind → type → Log | activity appears at the top of the timeline with its kind icon; survives reload | local 2026-07-19T17:28 |
| AI-enrichment seam (field.primitive) | mock | company record → sparkle next to About | the field fills with a labeled (mock) value; timeline logs “Enriched … via Company research (mock)”; swap the /enrich mock in server/server.mjs for a real task/workflow call | local 2026-07-19T17:28 |
| Field-type validation (config-implied) | local | open a person → set Email to “not-an-email” → blur | toast carries the server’s message (“… valid email address”); the field reverts; the API 400s | local 2026-07-19T17:28 |
| Demo-data badge | local | boot with seeded config → look at the sidebar footer | a “Demo data” chip is visible whenever seeded fictional rows exist; delete the seed and it disappears | local 2026-07-19T17:28 |
| Image downscale on upload | local | record → Files → upload a large image | the stored file’s pixel width is capped at 1600 (verified by reading the PNG header of the downloaded bytes) | local 2026-07-19T17:28 |
| Chart view (group + measure) | local | any object w/ a select/user field → Chart; deals → “Σ Amount” | one bar per group option with value labels; measure switches Count ↔ field sums (deals New = 53,000); group/measure choices persist per object | local 2026-07-19T17:28 |
| Live sync (cross-viewer updates) | local | open a table; edit the same object from another tab/agent | the change appears in the open view within ~5s, no reload (per-object rev poll; pauses when the tab is hidden) | local 2026-07-19T17:28 |
| Generator CLI (object scaffolding) | local | `npm run generate object Gadget -- --fields "name:text:primary,status:select:A\|B"` | the config gains the object; the app boots with its table/board + seeded rows; `generate page`/`journey` scaffold from editable templates | local 2026-07-19T17:28 |
| Skin system (org brand as data) | local | set `theme.skinPreset` (or an inline `theme.skin` object) → reload | the WHOLE app re-brands from one small JSON: accent ramp, dark chrome shell, radius personality (vendored shadcn kit included), fonts, labels, semantic palette, logo mark/wordmark; dark mode derives from the same brand | local 2026-07-19T17:28 |
