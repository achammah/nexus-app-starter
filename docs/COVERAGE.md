# COVERAGE — journey verdicts

Written by `npm run journeys` (and the journey-verifier lane). One row per journey per run; the deploy gate reads `journeys/.last-pass` (stamped only when every journey passes). The log is periodically reset to its header (older runs live in git history).

| Journey | Surface | Verdict | Visible outcome observed | Evidence | Timestamp |
|---|---|---|---|---|---|
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:12:59.926Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:12:59.926Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-70361); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:12:59.926Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:12:59.926Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:12:59.926Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:12:59.926Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:12:59.926Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:12:59.926Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:12:59.926Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:12:59.926Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:12:59.926Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:12:59.926Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:12:59.926Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:12:59.926Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:12:59.926Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:12:59.926Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:12:59.926Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:12:59.926Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:12:59.926Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:12:59.926Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:12:59.926Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:12:59.926Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:12:59.926Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:12:59.926Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:12:59.926Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:12:59.926Z |
