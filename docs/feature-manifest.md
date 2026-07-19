# Feature/test manifest

One row per feature, written the wave it ships. Primitive = the platform primitive id behind it (`wf_…`/`task_…`/`agent_…`), or `mock` (labeled in the UI), or `local` for pure-UI features with no platform twin. A proof must be VISIBLE ("the API returns 200" is not visible). `Last verified` is written by `npm run journeys`, never by hand.

| Feature | Primitive | How to exercise (exact click path) | VISIBLE outcome that proves it | Last verified (local / hosted) |
|---|---|---|---|---|
| App shell + nav | local | open `/` → click each nav item | active nav item highlights; page title + row count change | local 2026-07-19T16:12 |
| Companies table | local | nav → Companies | 8 seeded rows render; header sort toggles order | local 2026-07-19T16:12 |
| Record page + inline edit | local | Companies → open “Brightline Analytics” → edit City → blur | field persists after reload; timeline gains an `updated` event; toast “Saved” | local 2026-07-19T16:12 |
| Notes | local | any record → Notes tab → type + Add | note appears in list; timeline gains a `note` event | local 2026-07-19T16:12 |
| Deals board (kanban) | local | nav → Deals (Board view) | 5 stage columns; changing a deal’s Stage moves its card to the target column | local 2026-07-19T16:12 |
| Create record | local | Companies → New company → name → Create | dialog closes; record page opens; count increments | local 2026-07-19T16:12 |
| Global search | local | topbar search → type “bright” → Enter | list filters to matching rows; filter chip shows the query | local 2026-07-19T16:12 |
| Theme toggle | local | topbar moon/sun | background/ink invert; choice survives reload | local 2026-07-19T16:12 |
| Data spine (app_state kv) | mock | POST /api/state {key,value} → GET /api/state | latest-per-key value returned (append-only history behind it) | local 2026-07-19T16:12 |
| Command palette (⌘K) | local | Ctrl/⌘-K → type a record name → Enter | palette lists live record hits across objects; selecting one opens its record page | local 2026-07-19T16:12 |
| Saved view (filter+view persist) | local | filter People to “maya” → visit Deals → return | the filter text AND its applied result survive navigation (per-object persistence) | local 2026-07-19T16:12 |
| Relation link cells | local | Deals table → click a Company cell | lands on Companies FILTERED to that company (1 row) | local 2026-07-19T16:12 |
| Bulk select · CSV export · reviewed delete | local | select rows → Export CSV / Delete | a .csv downloads; Delete opens a review dialog NAMING the records; confirm removes them and the count drops | local 2026-07-19T16:12 |
| Embedded agent chat dock | local | set chat.embedUrl in starter.config.json | floating chat button + iframe panel; unconfigured → nothing renders | local 2026-07-19T16:12 |
| Custom pages + kit demo | local | nav → Kit demo | the registered page renders; empty form submit shows a zod error; chart svg + sheet + accordion work live | local 2026-07-19T16:12 |
| Auth seam (login gate) | local | set AUTH_USERS + APP_SECRET → open the app | login card gates the shell; wrong password shows an error; right password enters; the API 401s without a session and unlocks with the cookie | local 2026-07-19T16:12 |
| Virtualized big lists | local | any object >80 rows | the DOM renders a WINDOW (row count < total) while scroll reaches every row; total count stays correct | local 2026-07-19T16:12 |
| Column visibility + sort persist | local | Columns menu → uncheck a field; sort a header; navigate away and back | the column disappears and STAYS hidden; the sort order survives navigation; re-checking restores | local 2026-07-19T16:12 |
| Date fields (calendar) | local | Deals table shows formatted dates → open a deal → Close date → pick a day | table cells render “14 Aug 2026”-style; the calendar pick saves, survives reload, and lands in the timeline | local 2026-07-19T16:12 |
| Select-field filter chips | local | Companies → Industry chip → check Software | list narrows to matching rows; the chip shows the active count; clear-all restores | local 2026-07-19T16:12 |
| Relation picker + related lists | local | open a company → related People/Deals panels; open a deal → Company picker | related panels list linked records (click opens them); the combobox sets the relation, saves, and the jump button lands filtered on the target | local 2026-07-19T16:12 |
| Building-blocks litmus (record-system class by config) | local | `CONFIG_PATH=journeys/fixtures/coverage.config.json npm run serve` | the SAME build assembles the hardest known topology (two-sided relations · staged pipeline · dates · scores) with zero code changes — a continuous TEST of block coverage, not a shipped template | local 2026-07-19T16:12 |
| User (assignee) fields | local | open a deal → Owner → pick from the directory | combobox over `users` from config; table cells render avatar + name; pick saves + persists | — |
| Multiselect (tags) fields | local | People table tag chips → Tags filter → record page toggle | chips in cells; contains-any filtering; toggling a tag saves, persists, and updates chips | — |
