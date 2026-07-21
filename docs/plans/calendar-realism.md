# Calendar realism depth pass (feat/calendar-realism)

Goal: turn the merged calendar from a demo grid into a real calendar (Google Calendar / Fantastical class) — precise-hour time grid, full 24h, rich demo density — per the user feedback "still feels like a toy, the day needs all the hours, moving on precise hours."

Base: nexus-app-starter `5da35b9`, nexus-ui `4f16b4a`. The engine (all 6 view types, interaction plugin, rrule, EventEditDialog, token-mapped CSS) already shipped in the cal-depth lane; this is an INTERACTION-FIDELITY + POLISH + DEMO-DENSITY pass, not a rebuild.

## Verified file map (read, not assumed)
- `nexus-ui/src/record-core/views/calendar/CalendarView.tsx` — FC host. Missing: scrollTime, snapDuration, slotLabelInterval/Format, eventResizableFromStart, expandRows, explicit allDaySlot, responsive height (fixed 640), eventTimeFormat.
- `.../viewOptions.ts` — pure config→FC mapping. slotMin/Max default full-day already. Add scrollTime/snapDuration/allDaySlot.
- `.../events.ts` — pure record→event mapping. No change needed (already handles all-day/timed/multi-day/rrule).
- `.../EventEditDialog.tsx` — already datetime-local time pickers + all-day toggle swap. Verify only.
- `.../AgendaList.tsx` — mobile agenda (dots + times). Keep.
- `.../definition.tsx` — configSchema + the nxSeg view picker (CalendarToolbar, trail slot). Add new config keys.
- `.../calendar.css` — `--fc-*`→`--nx-*` map. Time-grid polish gaps: now-indicator prominence, today-column tint, minor gridlines, comfortable slot height, leading/trailing dim, all-day divider.
- `starter.config.json` `demo_calendar` ("Sessions") — sampleRows pinned to Aug 2026; today is Jul → week view opens EMPTY. THE core toy cause.
- `server/seed.mjs` — sampleRows win verbatim. Add an `@`-guarded relative-date resolver so the demo always lands on the current week.
- `journeys/fixtures/calendar.config.json` — journey fixture (absolute Aug dates, anchored via localStorage). Add a `timed` object with an overlapping rich week for the precision journeys. No journey depends on the live demo_calendar (verified).

## Work (all additive)
1. viewOptions.ts: `scrollTime` (default 08:00), `snapDuration` (default 15m), `allDaySlot` (default true) → CalFcOptions + mapping + config parse.
2. CalendarView.tsx: wire the above + slotLabelInterval (01:00) + slotLabelFormat (24h) + eventResizableFromStart (editable) + expandRows + eventTimeFormat + a bounded responsive height hook.
3. calendar.css: prominent now-indicator (thicker line + axis dot), today-column tint in timegrid, hour vs half-hour gridline weight, comfortable slot height, leading/trailing `.fc-day-other` dim, all-day lane divider, timegrid event time+title.
4. definition.tsx: configSchema rows for scrollTime/snapDuration/allDaySlot + doc comment.
5. demo_calendar: relative rich week (overlaps at 9:00+9:30, morning→afternoon spread, an all-day, a multi-day offsite, the recurring standup) via `@w<off>.<dow>[THH:MM]` tokens; add scrollTime/snapDuration to the view config.
6. seed.mjs: `@`-guarded relative-date resolver (this-week Monday anchor). Only transforms `@`-prefixed strings; generator + other objects untouched.
7. fixtures/calendar.config.json: `timed` object (start+end dateTime, colored track) with an overlapping dense week for the precision journeys.
8. journeys/extra/calendar-view.mjs: add precision journeys — 24h reachable + scrollTime opened-scrolled + overlap side-by-side + rich-week N events; click-empty-slot→create-at-HH:MM + drag-create + resize-from-top; dialog time-edit changes the record time.
9. journeys/unit: viewOptions scrollTime/snapDuration/allDaySlot mapping + a seed relative-date resolver unit test.
10. Docs: feature-manifest row, RECIPES entry (config keys + relative demo dates), DATA-MODEL note, DEPENDENCIES (no new deps).

## Journey plan (visible outcomes)
- timegrid-precision: week view of `timed` shows >= N events; a late-hour (23:00) slot exists in the DOM (24h reachable); the scroller opened scrolled past midnight (scrollTop > 0); two overlapping events render at different x (side-by-side).
- time-create-resize: click an empty 10:00 slot → create dialog prefilled with 10:00; drag the top edge of an event up → the record's start moves earlier.
- time-edit: open an event, change the datetime-local end, save → the record's end time changed.
- now-indicator retained in timed-options (anchored today).
All existing journeys stay green (unchanged objects/ids).

## Risks
- seed.mjs is shared; the change is `@`-guarded + additive (zero effect on non-`@` values). Low conflict risk; flagged to the orchestrator if a merge collides.
- expandRows vs 24h scroll: 24h content overflows the bounded height, so expandRows only removes dead space when slots are short (narrow slotMin/Max) — no conflict with the scroll model.

## Mobile / a11y / tokens
- Time-grid precision is desktop; 390px keeps the agenda list (existing, unchanged). New config is inert on mobile.
- All new CSS routes through `--nx-*` (both themes). No new hardcoded values.
- Keyboard path (event focus + Enter) and datetime-local inputs unchanged; new journeys keep the keyboard journey green.
