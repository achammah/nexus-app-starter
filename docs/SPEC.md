# SPEC — the living requirement contract

One row per ASK, appended THE TURN it arrives (the user's words, near-verbatim). Status moves `asked → built → journey-green`; Evidence = the journey/COVERAGE row or execId that proves it; Source = turn/date ref. The deploy gate reads this file; the PRD (org workspace) is the intake snapshot — this is the day-to-day contract.

| # | Requirement (user's words + ref) | Status | Evidence | Source |
|---|---|---|---|---|
| 1 | Starter boots with shell + three seeded objects (companies, people, deals) — clone-and-run | journey-green | journeys/core: shell-loads | starter v0.1 seed |
| 2 | Records open, fields edit inline and persist, timeline records changes | journey-green | journeys/core: record-edit-persists | starter v0.1 seed |
| 3 | Deals board drags across stages; stage change is visible + persisted | journey-green | journeys/core: stage-moves | starter v0.1 seed |
| 4 | Real shadcn/ui vendored as the component base (“I don't want to recreate my own library”) — full useful registry set | journey-green (build+journeys on vendored kit) | nexus-ui .vendor-manifest.json (47 items) | user 2026-07-19 |
| 5 | “ANY product can be built with our app starter and UI” — custom pages registry + full kit + config-driven objects | built | src/app/pages.tsx · #/p/<key> route | user 2026-07-19 |
| 6 | ⌘K palette jumping to any record/object/page | journey-green | journeys: cmdk-navigates | comprehensiveness wave 2026-07-19 |
| 7 | Bulk selection with CSV export + reviewed delete (review surface names records) | journey-green | journeys: bulk-delete-csv | comprehensiveness wave 2026-07-19 |
| 8 | Relation cells navigate to the related record’s home, filtered | journey-green | journeys: relation-link | comprehensiveness wave 2026-07-19 |
| 9 | Per-object saved view (filter + view kind) persists across navigation | journey-green | journeys: views-persist | comprehensiveness wave 2026-07-19 |
| 10 | Embedded agent chat dock (EMBED rung 1) configurable via chat.embedUrl | journey-green (unconfigured-deterministic) | journeys: chat-dock-config · src/app/ChatDock.tsx | starter-guide contract 2026-07-19 |
| 11 | “most comprehensive… keep going” — full shadcn registry (48 components + 2 copy-out blocks) + env validation + error boundary + auth seam + virtualization | journey-green | journeys: auth-flow · big-list-virtualized · kit-demo-page; nexus-ui catalog 60 entries | user 2026-07-19 (research: next-forge/bulletproof-react convergence) |
| 12 | “most well documented and navigable by an agent” — generated catalog (INDEX.md + catalog.json), AGENTS.md ×2, ARCHITECTURE.md, record-core deep reference, llms.txt | built (docs generated from live tree; gap-erroring) | nexus-ui scripts/gen-docs.mjs · AGENTS.md both repos | user 2026-07-19 |
| 13 | Hosted deploy proof on a real vibe app | asked → HELD — now VERIFIED-undeletable two ways (CLI has no delete; API route absent, nil-UUID probe) → NEX-2806 filed; probe still needs your go | deploy_watch chain wired; local 22/22 | Cue hold 2026-07-19 |
| 14 | Record-core depth: column visibility + sort persistence per object; date fields with calendar editing | journey-green | journeys: table-prefs-persist · date-picker | comprehensiveness wave 2026-07-19 |
| 15 | “keep improving the library so a full record-system app can be recreated easily” — config IS the app (entities+data+demo via sampleRows/CONFIG_PATH), relation pickers + related lists + select filters | journey-green | journeys: blocks-coverage-litmus (fixture: journeys/fixtures/coverage.config.json — see row 17) · relations-deep · select-filters; .playwright-mcp/journey-blocks-coverage.png | user 2026-07-19 |
| 16 | “make both UI and app-starter public so other people can use it” | built (MIT LICENSE added; visibility flipped; provenance publication-clean: zero copyleft, shadcn MIT w/ NOTICE) | gh repo edit → public · LICENSE · PROVENANCE.md notes | user 2026-07-19 |
| 17 | “the record-system rebuild is a TEST of the building blocks, not a product to ship” (+ no product-class naming anywhere in this repo) — the config is now a journey FIXTURE (`journeys/fixtures/coverage.config.json`), the journey is the blocks-coverage litmus, all product-class framing swept | journey-green | journeys: blocks-coverage-litmus; README litmus section | user correction 2026-07-19 |
| 18 | Block wave (“yes keep going”): user (assignee) fields + multiselect tags across table/board/record/filters | journey-green | journeys: user-field-picker · multiselect-tags | user 2026-07-19 |
| 19 | Board groups by ANY select/user field (not just stageField); per-object persisted choice | journey-green | journeys: board-group-by; KanbanBoard groupField/groupOptions props | user 2026-07-19 |
| 20 | Attachments + activity composer on every record (files tab w/ real download bytes; call/email/meeting logging w/ icons) | journey-green | journeys: attachments · activity-composer | user 2026-07-19 |
| 21 | AI-enrichment seam: `field.primitive` → sparkle → /enrich (mock, labeled; single swap-point for a real platform task/workflow) | journey-green | journeys: enrich-field; fixture candidates.summary proves config-driven on a sibling type | user 2026-07-19 |
