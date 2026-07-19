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
| 13 | Hosted deploy proof on a real vibe app | asked → HELD (vibe app has no delete; a zz-probe would permanently pollute the org dashboard — needs your go or a scratch org) | deploy_watch chain wired; local 20/20 | Cue hold 2026-07-19 |
