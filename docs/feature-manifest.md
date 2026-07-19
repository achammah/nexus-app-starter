# Feature/test manifest

One row per feature, written the wave it ships. Primitive = the platform primitive id behind it (`wf_…`/`task_…`/`agent_…`), or `mock` (labeled in the UI), or `local` for pure-UI features with no platform twin. A proof must be VISIBLE ("the API returns 200" is not visible). `Last verified` is written by `npm run journeys`, never by hand.

| Feature | Primitive | How to exercise (exact click path) | VISIBLE outcome that proves it | Last verified (local / hosted) |
|---|---|---|---|---|
| App shell + nav | local | open `/` → click each nav item | active nav item highlights; page title + row count change | local 2026-07-19T14:40 |
| Companies table | local | nav → Companies | 8 seeded rows render; header sort toggles order | local 2026-07-19T14:40 |
| Record page + inline edit | local | Companies → open “Brightline Analytics” → edit City → blur | field persists after reload; timeline gains an `updated` event; toast “Saved” | local 2026-07-19T14:40 |
| Notes | local | any record → Notes tab → type + Add | note appears in list; timeline gains a `note` event | local 2026-07-19T14:40 |
| Deals board (kanban) | local | nav → Deals (Board view) | 5 stage columns; changing a deal’s Stage moves its card to the target column | local 2026-07-19T14:40 |
| Create record | local | Companies → New company → name → Create | dialog closes; record page opens; count increments | local 2026-07-19T14:40 |
| Global search | local | topbar search → type “bright” → Enter | list filters to matching rows; filter chip shows the query | local 2026-07-19T14:40 |
| Theme toggle | local | topbar moon/sun | background/ink invert; choice survives reload | local 2026-07-19T14:40 |
| Data spine (app_state kv) | mock | POST /api/state {key,value} → GET /api/state | latest-per-key value returned (append-only history behind it) | local 2026-07-19T14:40 |
