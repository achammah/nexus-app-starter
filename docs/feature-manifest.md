# Feature/test manifest

One row per feature, written the wave it ships. Primitive = the platform primitive id behind it (`wf_…`/`task_…`/`agent_…`), or `mock` (labeled in the UI), or `local` for pure-UI features with no platform twin. A proof must be VISIBLE ("the API returns 200" is not visible). `Last verified` is written by `npm run journeys`, never by hand.

| Feature | Primitive | How to exercise (exact click path) | VISIBLE outcome that proves it | Last verified (local / hosted) |
|---|---|---|---|---|
| App shell + nav | local | open `/` → click each nav item | active nav item highlights; page title + row count change | local 2026-07-19T15:46 |
| Companies table | local | nav → Companies | 8 seeded rows render; header sort toggles order | local 2026-07-19T15:46 |
| Record page + inline edit | local | Companies → open “Brightline Analytics” → edit City → blur | field persists after reload; timeline gains an `updated` event; toast “Saved” | local 2026-07-19T15:46 |
| Notes | local | any record → Notes tab → type + Add | note appears in list; timeline gains a `note` event | local 2026-07-19T15:46 |
| Deals board (kanban) | local | nav → Deals (Board view) | 5 stage columns; changing a deal’s Stage moves its card to the target column | local 2026-07-19T15:46 |
| Create record | local | Companies → New company → name → Create | dialog closes; record page opens; count increments | local 2026-07-19T15:46 |
| Global search | local | topbar search → type “bright” → Enter | list filters to matching rows; filter chip shows the query | local 2026-07-19T15:46 |
| Theme toggle | local | topbar moon/sun | background/ink invert; choice survives reload | local 2026-07-19T15:46 |
| Data spine (app_state kv) | mock | POST /api/state {key,value} → GET /api/state | latest-per-key value returned (append-only history behind it) | local 2026-07-19T15:46 |
| Command palette (⌘K) | local | Ctrl/⌘-K → type a record name → Enter | palette lists live record hits across objects; selecting one opens its record page | local 2026-07-19T15:46 |
| Saved view (filter+view persist) | local | filter People to “maya” → visit Deals → return | the filter text AND its applied result survive navigation (per-object persistence) | local 2026-07-19T15:46 |
| Relation link cells | local | Deals table → click a Company cell | lands on Companies FILTERED to that company (1 row) | local 2026-07-19T15:46 |
| Bulk select · CSV export · reviewed delete | local | select rows → Export CSV / Delete | a .csv downloads; Delete opens a review dialog NAMING the records; confirm removes them and the count drops | local 2026-07-19T15:46 |
| Embedded agent chat dock | local | set chat.embedUrl in starter.config.json | floating chat button + iframe panel; unconfigured → nothing renders | local 2026-07-19T15:46 |
| Custom pages + kit demo | local | nav → Kit demo | the registered page renders; empty form submit shows a zod error; chart svg + sheet + accordion work live | local 2026-07-19T15:46 |
| Auth seam (login gate) | local | set AUTH_USERS + APP_SECRET → open the app | login card gates the shell; wrong password shows an error; right password enters; the API 401s without a session and unlocks with the cookie | local 2026-07-19T15:46 |
| Virtualized big lists | local | any object >80 rows | the DOM renders a WINDOW (row count < total) while scroll reaches every row; total count stays correct | local 2026-07-19T15:46 |
| Column visibility + sort persist | local | Columns menu → uncheck a field; sort a header; navigate away and back | the column disappears and STAYS hidden; the sort order survives navigation; re-checking restores | — |
| Date fields (calendar) | local | Deals table shows formatted dates → open a deal → Close date → pick a day | table cells render “14 Aug 2026”-style; the calendar pick saves, survives reload, and lands in the timeline | — |
