# Lane 5 ledger — calendar view

| Class | Entry |
|---|---|
| DECISION | Engine = FullCalendar 6.1.21 exact pins (5 packages, MIT). Deciding axis drag-reschedule quality; v7.0.1 restructure (temporal-polyfill peer, split packages) deliberately avoided. Fan-out: package.json both repos, DEPENDENCIES.md, the whole view implementation. |
| DECISION | Week mode picks its grid from the start field type: `date` objects render dayGridWeek (one all-day row), `dateTime` objects render timeGridWeek (hourly). No extra config knob. |
| DECISION | `calDate` (visible anchor) persists in the view-state bag beside `calMode`: reload lands where you were, saved views capture it, and journeys anchor deterministically through the app's own persistence instead of a test backdoor. |
| DECISION | Date navigation (prev/today/next + title) lives in the view body header; only the Month⇄Week toggle sits in the view bar (side trail, `.nxSeg` idiom). FC headerToolbar disabled, all chrome ours. |
| DECISION | Record end dates are INCLUSIVE; the calendar's exclusive all-day ends are converted at the boundary (events.ts spanToEventEnd/eventEndToSpan, unit-tested). Malformed data (end<start, invalid start) normalizes, never crashes. |
| DECISION | No dedicated pointer-drag RESIZE journey: the mandated drag journey proves the pointer→PATCH pipeline, resize shares it, and its patch math is unit-tested; the span SHAPE is journey-asserted (st_1 renders across its range). Conscious CI-fragility budget call, disclosed in the report. |
| DECISION | CalendarView stays out of index.ts exports: lazy-only via the registry, so an eager library import cannot defeat the chunk split. |
| CONSTRAINT | Lead ruling (wave-wide): bare `*Field` config-key grammar (startDateField, endDateField, titleField, colorField) matching the shipped `groupField` grammar. |
| CONSTRAINT | Lead ruling: mobile agenda collapse is a gate criterion (contract §4b supersedes the lane file's stale "stretch" line); drag declared desktop-only with the peek date-field as the mobile path. |
| CONSTRAINT | Lead ruling: the drag journey's assertion is never weakened; bounded pointer retries, STOP per §11 if irreducibly flaky. |
| CONSTRAINT | Lead ruling: deals.stage option colorization is Lane 5's edit; builder-6 hands off deals. |
| REUSE | optionMeta/chipStyle (record-core/options.tsx) = the ONE palette formula for event colors; formatCell (DataTable) for titles/dates; @tanstack/react-virtual (existing dep) for the agenda; `.nxSeg` segmented idiom for the mode toggle; the host's create dialog via the new ViewProps.onCreate seam; nxPopIn/motion tokens for the "+N more" popover. |
| REUSE | builder-1 §10 broadcast consumed (import, never re-extract). builder-4's token→literal resolver NOT needed here: the --fc-* mapping is pure var()→var() indirection, no literals anywhere. |
| BINDING | starter.config.json deals: `views` list (table/kanban/chart/calendar with startDateField closeDate, colorField stage) + stage options upgraded to `{value,color}` (New blue, Qualified purple, Proposal yellow, Won green, Lost red). Kanban columns and table chips now show the same colors, which is the shared-palette point. |
| BINDING | ViewProps gains optional `onCreateDraft?(prefill?)`; ObjectView passes it canCreate-gated, seeding the PLAIN create dialog (the wizard has no prefill seam). Named per lead arbitration: L6 owns `onCreate?(body): Promise<RecordRow>` (direct create); this seam only opens the reviewed dialog. |
| CONSTRAINT | Journey anchoring writes localStorage via addInitScript (pre-boot, MERGE into the existing blob) — an evaluate-then-reload write races ObjectView's own persistence effect and loses nondeterministically (the measured 3-journey July-instead-of-August failure). |
