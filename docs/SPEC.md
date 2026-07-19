# SPEC — the living requirement contract

One row per ASK, appended THE TURN it arrives (the user's words, near-verbatim). Status moves `asked → built → journey-green`; Evidence = the journey/COVERAGE row or execId that proves it; Source = turn/date ref. The deploy gate reads this file; the PRD (org workspace) is the intake snapshot — this is the day-to-day contract.

| # | Requirement (user's words + ref) | Status | Evidence | Source |
|---|---|---|---|---|
| 1 | Starter boots with shell + three seeded objects (companies, people, deals) — clone-and-run | journey-green | journeys/core: shell-loads | starter v0.1 seed |
| 2 | Records open, fields edit inline and persist, timeline records changes | journey-green | journeys/core: record-edit-persists | starter v0.1 seed |
| 3 | Deals board drags across stages; stage change is visible + persisted | journey-green | journeys/core: stage-moves | starter v0.1 seed |
