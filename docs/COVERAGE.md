# COVERAGE — journey verdicts

Written by `npm run journeys` (and the journey-verifier lane). One row per journey per run; the deploy gate reads `journeys/.last-pass` (stamped only when every journey passes).

| Journey | Surface | Verdict | Visible outcome observed | Evidence | Timestamp |
|---|---|---|---|---|---|
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:21:07.651Z |
| table-renders-sorts | local | FAIL | assert failed: header sort reorders rows ("Brightline Analytics" → "Brightline Analytics") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:21:07.651Z |
| record-edit-persists | local | FAIL | page.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('.nxRowLink:has-text("Brightline Analytics")')[22m
[2m    62 × locator resolved to | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:21:07.651Z |
| notes-add | local | FAIL | page.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('.nxRowLink').first()[22m
[2m    62 × locator resolved to <a class="nxRowLink" hre | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:21:07.651Z |
| stage-moves | local | FAIL | assert failed: card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:21:07.651Z |
| create-record | local | FAIL | page.waitForFunction: Timeout 30000ms exceeded. | .playwright-mcp/journey-create-record.png | 2026-07-19T14:21:07.651Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:21:07.651Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:21:07.651Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:21:07.651Z |
| mobile-390 | local | FAIL | page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="nav"]') to be visible[22m
[2m    64 × locator resolved to | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:21:07.651Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:23:05.615Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:23:05.615Z |
| record-edit-persists | local | FAIL | assert failed: timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:23:05.615Z |
| notes-add | local | FAIL | page.waitForFunction: Timeout 6000ms exceeded. | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:23:05.615Z |
| stage-moves | local | FAIL | assert failed: card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:23:05.615Z |
| create-record | local | FAIL | page.waitForFunction: Timeout 30000ms exceeded. | .playwright-mcp/journey-create-record.png | 2026-07-19T14:23:05.615Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:23:05.615Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:23:05.615Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:23:05.615Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:23:05.615Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:27:05.040Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:27:05.040Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-23721); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:27:05.040Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:27:05.040Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:27:05.040Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T14:27:05.040Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:27:05.040Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:27:05.040Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:27:05.040Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:27:05.040Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:28:35.992Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:28:35.992Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-14650); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:28:35.992Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:28:35.992Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:28:35.992Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T14:28:35.992Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:28:35.992Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:28:35.992Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:28:35.992Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:28:35.992Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:39:34.792Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:39:34.792Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-73436); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:39:34.792Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:39:34.792Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:39:34.792Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T14:39:34.792Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:39:34.792Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:39:34.792Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:39:34.792Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:39:34.792Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T14:40:06.447Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T14:40:06.447Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-04881); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T14:40:06.447Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T14:40:06.447Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T14:40:06.447Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T14:40:06.447Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T14:40:06.447Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T14:40:06.447Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T14:40:06.447Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T14:40:06.447Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:08:51.894Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:08:51.894Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-28546); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:08:51.894Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:08:51.894Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:08:51.894Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:08:51.894Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:08:51.894Z |
| views-persist | local | PASS | filter survives navigation (maya); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:08:51.894Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:08:51.894Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:08:51.894Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:08:51.894Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:08:51.894Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:08:51.894Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:08:51.894Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:08:51.894Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:12:20.198Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:12:20.198Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-36371); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:12:20.198Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:12:20.198Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:12:20.198Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:12:20.198Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:12:20.198Z |
| views-persist | local | PASS | filter survives navigation (maya); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:12:20.198Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:12:20.198Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:12:20.198Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:12:20.198Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:12:20.198Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:12:20.198Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:12:20.198Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:12:20.198Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:12:20.198Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:13:01.477Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:13:01.477Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-77732); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:13:01.477Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:13:01.477Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:13:01.477Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:13:01.477Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:13:01.477Z |
| views-persist | local | PASS | filter survives navigation (maya); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:13:01.477Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:13:01.477Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:13:01.477Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:13:01.477Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:13:01.477Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:13:01.477Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:13:01.477Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:13:01.477Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:13:01.477Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:23:22.292Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:23:22.292Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-89636); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:23:22.292Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:23:22.292Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:23:22.292Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:23:22.292Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:23:22.292Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:23:22.292Z |
| views-persist | local | FAIL | assert failed: filter survives navigation () | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:23:22.292Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:23:22.292Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:23:22.292Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:23:22.292Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:23:22.292Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:23:22.292Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:23:22.292Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:23:22.292Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:23:22.292Z |
| auth-flow | local | FAIL | page.waitForSelector: Timeout 8000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="login-card"]') to be visible[22m
 | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:23:22.292Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:23:22.292Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:26:51.104Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:26:51.104Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-06245); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:26:51.104Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:26:51.104Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:26:51.104Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:26:51.104Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:26:51.104Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:26:51.104Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:26:51.104Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:26:51.104Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:26:51.104Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:26:51.104Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:26:51.104Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:26:51.104Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:26:51.104Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:26:51.104Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:26:51.104Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:26:51.104Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:26:51.104Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:45:16.166Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:45:16.166Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-80617); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:45:16.166Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:45:16.166Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:45:16.166Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:45:16.166Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:45:16.166Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:45:16.166Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:45:16.166Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:45:16.166Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:45:16.166Z |
| table-prefs-persist | local | FAIL | page.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="col-toggle-domain"]')[22m
[2m    - locator resolved to <div tabinde | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T15:45:16.166Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T15:45:16.166Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:45:16.166Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:45:16.166Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:45:16.166Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:45:16.166Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:45:16.166Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:45:16.166Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:45:16.166Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:45:16.166Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:46:11.184Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:46:11.184Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-35573); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:46:11.184Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:46:11.184Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:46:11.184Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:46:11.184Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:46:11.184Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:46:11.184Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:46:11.184Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:46:11.184Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:46:11.184Z |
| table-prefs-persist | local | FAIL | page.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[data-testid="col-toggle-domain"]')[22m
[2m    - locator resolved to <div tabinde | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T15:46:11.184Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T15:46:11.184Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:46:11.184Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:46:11.184Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:46:11.184Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:46:11.184Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:46:11.184Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:46:11.184Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:46:11.184Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:46:11.184Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:46:42.466Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:46:42.466Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-96353); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:46:42.466Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:46:42.466Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:46:42.466Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:46:42.466Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:46:42.466Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:46:42.466Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:46:42.466Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:46:42.466Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:46:42.466Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T15:46:42.466Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T15:46:42.466Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:46:42.466Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:46:42.466Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:46:42.466Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:46:42.466Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:46:42.466Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:46:42.466Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:46:42.466Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:46:42.466Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:58:09.057Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:58:09.057Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-74431); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:58:09.057Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:58:09.057Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:58:09.057Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:58:09.057Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:58:09.057Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:58:09.057Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:58:09.057Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:58:09.057Z |
| bulk-delete-csv | local | FAIL | page.waitForFunction: Timeout 6000ms exceeded. | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:58:09.057Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T15:58:09.057Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T15:58:09.057Z |
| ats-by-config | local | PASS | the app IS the config (Atlas ATS); candidates table renders from config sampleRows (4); applications kanban has ATS stages with the seeded card in Interview; ap | .playwright-mcp/journey-ats-by-config.png | 2026-07-19T15:58:09.057Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T15:58:09.057Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T15:58:09.057Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:58:09.057Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:58:09.057Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:58:09.057Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:58:09.057Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:58:09.057Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:58:09.057Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:58:09.057Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:58:09.057Z |
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T15:59:47.931Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T15:59:47.931Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-79065); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T15:59:47.931Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T15:59:47.931Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T15:59:47.931Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T15:59:47.931Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T15:59:47.931Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T15:59:47.931Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T15:59:47.931Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T15:59:47.931Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T15:59:47.931Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T15:59:47.931Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T15:59:47.931Z |
| ats-by-config | local | PASS | the app IS the config (Atlas ATS); candidates table renders from config sampleRows (4); applications kanban has ATS stages with the seeded card in Interview; ap | .playwright-mcp/journey-ats-by-config.png | 2026-07-19T15:59:47.931Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T15:59:47.931Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T15:59:47.931Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T15:59:47.931Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T15:59:47.931Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T15:59:47.931Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T15:59:47.931Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T15:59:47.931Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T15:59:47.931Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T15:59:47.931Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T15:59:47.931Z |
