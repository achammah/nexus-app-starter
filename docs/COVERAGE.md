# Coverage — latest `npm run journeys` run

Written by the journey runner; one verdict row per journey, latest run only.

| Journey | Surface | Verdict | Checks | Screenshot | At |
|---|---|---|---|---|---|
| shell-loads | local | PASS | page title shows Companies (got "Companies"); nav click switches the page title to Deals | .playwright-mcp/journey-shell-loads.png | 2026-07-19T17:55:54.018Z |
| table-renders-sorts | local | PASS | seeded rows render (8 ≥ 8); header sort (desc) reorders rows ("Brightline Analytics" → "Veldkliniek Group") | .playwright-mcp/journey-table-renders-sorts.png | 2026-07-19T17:55:54.018Z |
| record-edit-persists | local | PASS | edited City survives reload (Ghent-23165); timeline shows the update event | .playwright-mcp/journey-record-edit-persists.png | 2026-07-19T17:55:54.018Z |
| notes-add | local | PASS | added note appears in the list | .playwright-mcp/journey-notes-add.png | 2026-07-19T17:55:54.018Z |
| stage-moves | local | PASS | 5 stage columns render (5); card visibly moved to the Qualified column | .playwright-mcp/journey-stage-moves.png | 2026-07-19T17:55:54.018Z |
| kanban-true-drag | local | PASS | pointer drag visibly moves the card to Proposal; drag result PERSISTED across reload | .playwright-mcp/journey-kanban-true-drag.png | 2026-07-19T17:55:54.018Z |
| create-record | local | PASS | record page opens on the new record; count incremented (8 → 9) | .playwright-mcp/journey-create-record.png | 2026-07-19T17:55:54.018Z |
| cmdk-navigates | local | PASS | palette jump lands on the record (Cargolane dispatch automation) | .playwright-mcp/journey-cmdk-navigates.png | 2026-07-19T17:55:54.018Z |
| views-persist | local | PASS | filter survives navigation (restored to 'maya'); restored filter is APPLIED (1 row) | .playwright-mcp/journey-views-persist.png | 2026-07-19T17:55:54.018Z |
| relation-link | local | PASS | relation click lands filtered on the target (Brightline Analytics) | .playwright-mcp/journey-relation-link.png | 2026-07-19T17:55:54.018Z |
| bulk-delete-csv | local | PASS | CSV downloads (companies-2026-07-19.csv); review surface names the exact records; count returns to 8 after reviewed delete (ui=8, server=8, toast="1 rows export | .playwright-mcp/journey-bulk-delete-csv.png | 2026-07-19T17:55:54.018Z |
| select-filters | local | PASS | Industry=Software narrows to the 2 software companies; clear-all restores the full list | .playwright-mcp/journey-select-filters.png | 2026-07-19T17:55:54.018Z |
| relations-deep | local | PASS | related People lists the linked person; related Deals lists the linked deal; clicking a related row opens ITS record; picker sets the relation (Cargolane) and s | .playwright-mcp/journey-relations-deep.png | 2026-07-19T17:55:54.018Z |
| blocks-coverage-litmus | local | PASS | the app IS the config (Coverage Fixture); candidates table renders from config sampleRows (4); applications kanban has the pipeline stages with the seeded card  | .playwright-mcp/journey-blocks-coverage-litmus.png | 2026-07-19T17:55:54.018Z |
| table-prefs-persist | local | PASS | unchecking Domain removes the column; hidden column SURVIVES navigation; sort survives navigation (top stays "Veldkliniek Group"); re-enabling restores the colu | .playwright-mcp/journey-table-prefs-persist.png | 2026-07-19T17:55:54.018Z |
| date-picker | local | PASS | table renders the formatted date (14 Aug 2026); picked day lands in the field; date persisted across reload (20 Aug 2026); timeline records the date change | .playwright-mcp/journey-date-picker.png | 2026-07-19T17:55:54.018Z |
| accounts-signup-verify | local | PASS | signup creates the account and enters the app; verification mail is in the outbox; the account is verified after following the mail link | .playwright-mcp/journey-accounts-signup-verify.png | 2026-07-19T17:55:54.018Z |
| reset-antienum-delete | local | PASS | forgot-password answers identically for known and unknown addresses; known address got a reset mail; unknown address got a DECOY mail (timing parity); old passw | .playwright-mcp/journey-reset-antienum-delete.png | 2026-07-19T17:55:54.018Z |
| webhook-delivery | local | PASS | signing secret is shown exactly once at creation; the endpoint received the delivery (job queue tick); HMAC signature verifies against the once-shown secret; pa | .playwright-mcp/journey-webhook-delivery.png | 2026-07-19T17:55:54.018Z |
| watch-notify-mention | local | PASS | watch toggle arms from the record header; mention autocomplete inserts the name (Loop in @Ada ); the watcher gets the activity mail; the actor is not notified a | .playwright-mcp/journey-watch-notify-mention.png | 2026-07-19T17:55:54.018Z |
| jobs-digest | local | PASS | the recurring digest job computed rollups into app_state (companies=8); the job log shows the digest run as done | .playwright-mcp/journey-jobs-digest.png | 2026-07-19T17:55:54.018Z |
| teams-invite-join | local | PASS | invited member shows as PENDING before accepting; invitation mail is in the outbox; accepting activates bob's membership; join code adds carol as a member (UI); | .playwright-mcp/journey-teams-invite-join.png | 2026-07-19T17:55:54.018Z |
| permissions-enforced | local | PASS | member sees NO create button; cells render read-only (no inline editors); the API itself 403s an edit (server is the gate); viewing stays allowed; an owner sees | .playwright-mcp/journey-permissions-enforced.png | 2026-07-19T17:55:54.018Z |
| org-reskin | local | PASS | default skin holds the nexus accent (#4f46e5); org brand applies (--nx-accent #FF7900); radius personality applies (0px); dark chrome applies to the shell (rgb( | .playwright-mcp/journey-org-reskin.png | 2026-07-19T17:55:54.018Z |
| chart-view | local | PASS | companies chart bars by Industry (Software=2); deals chart sums Amount per stage (Qualified=92000) | .playwright-mcp/journey-chart-view.png | 2026-07-19T17:55:54.018Z |
| live-sync | local | PASS | another writer's edit appears in the open table without a reload (rev poll) | .playwright-mcp/journey-live-sync.png | 2026-07-19T17:55:54.018Z |
| generator-litmus | local | PASS | generated object boots live: board + 4 seeded rows (config → app, one command); generated select options became board columns | .playwright-mcp/journey-generator-litmus.png | 2026-07-19T17:55:54.018Z |
| field-validation | local | PASS | server rejects a bad email with a human message (toast); the field reverts to the stored value after the rejection; the API itself 400s (not just the UI) | .playwright-mcp/journey-field-validation.png | 2026-07-19T17:55:54.018Z |
| demo-badge | local | PASS | seeded fictional rows surface as a visible Demo badge | .playwright-mcp/journey-demo-badge.png | 2026-07-19T17:55:54.018Z |
| image-upload-downscale | local | PASS | stored image is downscaled (width 1600 ≤ 1600 from 2400) | .playwright-mcp/journey-image-upload-downscale.png | 2026-07-19T17:55:54.018Z |
| attachments | local | PASS | uploaded file lists with name + size; download returns the exact uploaded bytes; timeline gains the attach event | .playwright-mcp/journey-attachments.png | 2026-07-19T17:55:54.018Z |
| activity-composer | local | PASS | logged email appears in the timeline with its kind icon; activity survives reload | .playwright-mcp/journey-activity-composer.png | 2026-07-19T17:55:54.018Z |
| enrich-field | local | PASS | About fills from the enrich primitive (labeled mock); timeline records the enrichment with its primitive label | .playwright-mcp/journey-enrich-field.png | 2026-07-19T17:55:54.018Z |
| board-group-by | local | PASS | companies board groups by Industry (Brightline in Software); board regroups by Owner (user field; 2 cards under 'you') | .playwright-mcp/journey-board-group-by.png | 2026-07-19T17:55:54.018Z |
| user-field-picker | local | PASS | owner picked from the app users directory; table renders the user cell (avatar + name) | .playwright-mcp/journey-user-field-picker.png | 2026-07-19T17:55:54.018Z |
| tags-multiselect | local | PASS | tag chips render in the table; contains-any tag filter narrows to the tagged person; toggled tag persists across reload | .playwright-mcp/journey-tags-multiselect.png | 2026-07-19T17:55:54.018Z |
| kit-demo-page | local | PASS | zod validation error renders on empty submit; chart renders an svg on the token palette; sheet opens as a side panel; accordion expands | .playwright-mcp/journey-kit-demo-page.png | 2026-07-19T17:55:54.018Z |
| chat-dock-config | local | PASS | dock renders NOTHING while chat.embedUrl is unconfigured (deterministic) | .playwright-mcp/journey-chat-dock-config.png | 2026-07-19T17:55:54.018Z |
| search-filters | local | PASS | filter narrows to the matching row (Brightline Analytics) | .playwright-mcp/journey-search-filters.png | 2026-07-19T17:55:54.018Z |
| theme-toggle | local | PASS | background flips (rgb(250, 250, 249) → rgb(22, 21, 19)); choice survives reload | .playwright-mcp/journey-theme-toggle.png | 2026-07-19T17:55:54.018Z |
| state-kv | local | PASS | state append accepted; latest-per-key read returns the appended value | .playwright-mcp/journey-state-kv.png | 2026-07-19T17:55:54.018Z |
| big-list-virtualized | local | PASS | DOM renders a WINDOW, not all rows (26 < 110 of 128+); scrolling reaches the LAST row (window follows scroll) | .playwright-mcp/journey-big-list-virtualized.png | 2026-07-19T17:55:54.018Z |
| auth-flow | local | PASS | API is GATED without a session (401); wrong password shows a visible error; correct password enters the app shell; session cookie unlocks the API | .playwright-mcp/journey-auth-flow.png | 2026-07-19T17:55:54.018Z |
| mobile-390 | local | PASS | no horizontal page scroll at 390px | .playwright-mcp/journey-mobile-390.png | 2026-07-19T17:55:54.018Z |
