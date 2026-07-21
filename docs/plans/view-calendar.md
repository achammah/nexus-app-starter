# Lane plan — calendar view

Goal: a registry `calendar` view type over any object with a date/dateTime field: month + week, drag-to-reschedule writing through the store, event colors from the object's own select-option palette, mobile agenda collapse, 10k-safe, lazy chunk.

Engine: FullCalendar, all five packages pinned exact 6.1.21 (MIT). Deciding axis was drag-reschedule quality: first-class eventDrop/eventResize, built-in "+N more" overflow, and a CSS-variable theming surface that keeps the live theme flip pure CSS. react-big-calendar (MIT) loses on drag polish (addon) and theming (SASS overrides). The v7.0.1 line is a fresh restructure (temporal-polyfill peer, split packages) and is deliberately not used.

Files (nexus-ui): `src/record-core/views/calendar/{definition.tsx, CalendarView.tsx, AgendaList.tsx, events.ts, calendar.css}` plus an additive optional `onCreateDraft?` on `ViewProps` (opens the host's create DIALOG prefilled; the name leaves `onCreate` free for a direct-create seam).
Files (starter): the vendored copy, `journeys/extra/calendar-view.mjs`, `journeys/fixtures/calendar{,-10k}.config.json`, `journeys/unit/calendar-events.test.ts`, docs rows, the deals `views` entry + stage option colors, and the ~5-line canCreate-gated `onCreateDraft` pass-through in ObjectView.

Config: `startDateField` (required; defaultConfig picks the first date/dateTime field) · `endDateField?` (spans + resize; stored ends inclusive, converted to the calendar's exclusive ends internally) · `titleField?` (default primary) · `colorField?` (select; its option palette via the shared optionMeta/chipStyle). State: `calMode`, `calDate`.

Interactions: event click = peek · drag/resize = PATCH through the host (toast + revert are the host's) · empty-day click = prefilled create (only with create rights) · Month⇄Week segmented toggle (view bar, trail side). Week grid follows the start field: date = dayGridWeek, dateTime = timeGridWeek.

Mobile (≤768px): a structurally different virtualized agenda list (day rows create, event rows peek); drag is desktop-only, mobile reschedules via the record's date field.

States: designed empty banner (journey-asserted) · host Suspense loading · validateConfig chip for date-less objects · drag failures revert via the host's reload-on-error.

Testids: `calendar-<objectKey>` · `calendar-title/prev/today/next` · `cal-mode-month/week` · `calendar-event-<id>` · `calendar-empty` · `calendar-agenda` · `agenda-day-<date>` · `agenda-create-<date>`.

Journeys (`journeys/extra/calendar-view.mjs`, fixtures on 5891/5892): events-render (count + palette colors + span shape) · drag-reschedule (+7 days, toast, API + reload assert) · peek-open · day-create (prefill + created event visible) · mode-persist (week survives reload; timeGrid for dateTime) · keyboard (focus + Enter opens peek) · mobile-agenda (390x664 touch) · empty-state · misconfigured · external-update (out-of-band PATCH lands via rev poll) · perf-10k (paint + nav thresholds). Unit: the pure events core.

Measured: lazy chunk 77.86 kB gzip (+1.28 kB CSS); eager bundle 376.92 → 379.21 kB gzip (+0.61%, inside the 2% budget).
