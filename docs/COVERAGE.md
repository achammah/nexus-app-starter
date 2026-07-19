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
