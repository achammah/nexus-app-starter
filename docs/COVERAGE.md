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
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:18:03.468Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:18:03.468Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-67527); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:18:03.468Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:18:03.468Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:18:03.468Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:18:03.468Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:18:03.468Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:18:03.468Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:18:03.468Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:18:03.468Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:18:03.468Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:18:03.468Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:18:03.468Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:18:03.468Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:18:03.468Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:18:03.468Z |
| board-group-by | local | FAIL | page.waitForSelector: Timeout 6000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="col-you"]') to be visible[22m
 | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:18:03.468Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:18:03.468Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:18:03.468Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:18:03.468Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:18:03.468Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:18:03.468Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:18:03.468Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:18:03.468Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:18:03.468Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:18:03.468Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:18:03.468Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:23:04.137Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:23:04.137Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-73866); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:23:04.137Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:23:04.137Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:23:04.137Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:23:04.137Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:23:04.137Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:23:04.137Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:23:04.137Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:23:04.137Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:23:04.137Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:23:04.137Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:23:04.137Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:23:04.137Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:23:04.137Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:23:04.137Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 8 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:23:04.137Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:23:04.137Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:23:04.137Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:23:04.137Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:23:04.137Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:23:04.137Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:23:04.137Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:23:04.137Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:23:04.137Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:23:04.137Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:23:04.137Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:29:51.433Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:29:51.433Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-50390); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:29:51.433Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:29:51.433Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:29:51.433Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:29:51.433Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:29:51.433Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:29:51.433Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:29:51.433Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:29:51.433Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:29:51.433Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:29:51.433Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:29:51.433Z |
| blocks-coverage-litmus | local | FAIL | page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="enrich-summary"]') to be visible[22m
 | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:29:51.433Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:29:51.433Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:29:51.433Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T16:29:51.433Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T16:29:51.433Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T16:29:51.433Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 8 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:29:51.433Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:29:51.433Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:29:51.433Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:29:51.433Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:29:51.433Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:29:51.433Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:29:51.433Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:29:51.433Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:29:51.433Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:29:51.433Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:29:51.433Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:30:35.285Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:30:35.285Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-14293); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:30:35.285Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:30:35.285Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:30:35.285Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:30:35.285Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:30:35.285Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:30:35.285Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:30:35.285Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:30:35.285Z |
| bulk-delete-csv | local | FAIL | assert failed: count returns to 8 after reviewed delete (ui=0, server=8, toast="1 rows exported") | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:30:35.285Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:30:35.285Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:30:35.285Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:30:35.285Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:30:35.285Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:30:35.285Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T16:30:35.285Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T16:30:35.285Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T16:30:35.285Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 8 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:30:35.285Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:30:35.285Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:30:35.285Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:30:35.285Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:30:35.285Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:30:35.285Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:30:35.285Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:30:35.285Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:30:35.285Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:30:35.285Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:30:35.285Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:31:22.531Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:31:22.531Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-71288); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:31:22.531Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:31:22.531Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:31:22.531Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:31:22.531Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:31:22.531Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:31:22.531Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:31:22.531Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:31:22.531Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:31:22.531Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:31:22.531Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:31:22.531Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:31:22.531Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:31:22.531Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:31:22.531Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T16:31:22.531Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T16:31:22.531Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T16:31:22.531Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 8 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:31:22.531Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:31:22.531Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:31:22.531Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:31:22.531Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:31:22.531Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:31:22.531Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:31:22.531Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:31:22.531Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:31:22.531Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:31:22.531Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:31:22.531Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:36:46.274Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:36:46.274Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-95337); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:36:46.274Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:36:46.274Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:36:46.274Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:36:46.274Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:36:46.274Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:36:46.274Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:36:46.274Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:36:46.274Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:36:46.274Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:36:46.274Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:36:46.274Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:36:46.274Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:36:46.274Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:36:46.274Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T16:36:46.274Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T16:36:46.274Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T16:36:46.274Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 2 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:36:46.274Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:36:46.274Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:36:46.274Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:36:46.274Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:36:46.274Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:36:46.274Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:36:46.274Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:36:46.274Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:36:46.274Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:36:46.274Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:36:46.274Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T16:46:37.566Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T16:46:37.566Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-85822); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T16:46:37.566Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T16:46:37.566Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T16:46:37.566Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T16:46:37.566Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T16:46:37.566Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T16:46:37.566Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T16:46:37.566Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T16:46:37.566Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T16:46:37.566Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T16:46:37.566Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T16:46:37.566Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T16:46:37.566Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T16:46:37.566Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T16:46:37.566Z |
| field-validation | local | PASS | server rejects a bad email with a human message (toast); the field reverts to the stored value after the rejection; the API itself 400s (not just the UI) | .playwright-mcp/journey-field-validation.png | 2026-07-19T16:46:37.566Z |
| demo-badge | local | PASS | seeded fictional rows surface as a visible Demo badge | .playwright-mcp/journey-demo-badge.png | 2026-07-19T16:46:37.566Z |
| image-upload-downscale | local | PASS | stored image is downscaled (width 1600 ≤ 1600 from 2400) | .playwright-mcp/journey-image-upload-downscale.png | 2026-07-19T16:46:37.566Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T16:46:37.566Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T16:46:37.566Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T16:46:37.566Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 2 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T16:46:37.566Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T16:46:37.566Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T16:46:37.566Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T16:46:37.566Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T16:46:37.566Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T16:46:37.566Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T16:46:37.566Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T16:46:37.566Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T16:46:37.566Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T16:46:37.566Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T16:46:37.566Z |
