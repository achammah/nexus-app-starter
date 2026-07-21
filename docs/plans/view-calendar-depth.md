# Plan — Calendar depth pass (full FullCalendar fidelity)

Bring the merged v1 calendar (month/week + drag-move + day-click create + mobile agenda) to the full
capability a FullCalendar user expects: all view types, in-place event CRUD with an edit surface,
recurring-event rendering, and the full option set — every option exposed through the view config,
native-themed, mobile + a11y + flake-hardened. Config-exposed is the model for every view's depth pass.

## Files
UI (`src/record-core/views/calendar/`, vendored to the starter via sync-ui):
- `definition.tsx` — grow `configSchema` to the full option set; replace the Month/Week toggle with a
  view picker (a segmented `nxSeg` control rendered from `enabledViews`).
- `CalendarView.tsx` — add plugins (list, multimonth, rrule), the full view set, `select`→range-create,
  the edit surface, richer `eventContent`, and option wiring through `viewOptions.ts`.
- `events.ts` — recurring expansion (rrule `EventInput`), all-day⇄timed drop flip, range-select prefill;
  stays JSX-free + node-testable.
- `AgendaList.tsx` — KEEP (the mobile render for month/day/week/year); desktop list views are FC's own
  list plugin.
- `calendar.css` — theme list-view rows, multimonth month headers, all-day lane, now-indicator,
  business-hours shading, week-number cells, and the edit surface.
- `viewOptions.ts` (NEW, pure) — config → FC-options mapping, node-tested.
- `EventEditDialog.tsx` (NEW) — the quick detail/edit/delete surface.
- `types.ts` (contract seam) — ADD `onDelete?(id): void` to `ViewProps`; ADD kind `"multiSelect"` to
  `ViewConfigField`.

Host (`src/app/ObjectView.tsx`, HOT — allowed by spec): wire `onDelete` (the `api.remove` path already
exists) with the standard reviewed-delete surface, gated by `canDelete`.

## Two repo-driven deviations from the T0 (the repo wins over the brief — §3)
1. **Edit surface is Dialog-backed, not a floating popover.** The repo exposes no `Popover` primitive
   (only `Dialog` and `Menu` in `primitives/overlays.tsx`), and the app's Radix floating poppers have a
   known base defect (paint offscreen for pointer users; under separate fix by the popper-positioning
   lane). The `Dialog` primitive positions via CSS centering (not floating-ui), so `EventEditDialog`
   renders as a centered modal on desktop and a bottom-sheet at ≤390px — delivering the full approved
   capability (title / dates / all-day toggle / color / other quick fields / "open full record" → peek /
   delete-with-inline-confirm) without inheriting the popper defect and without a new overlay dep.
2. **View picker is a segmented `nxSeg` control, not a dropdown.** Plain buttons (no floating-ui) extend
   the v1 Month/Week idiom, stay pointer + keyboard + touch native, and dodge the same popper defect. It
   shows only the views in `enabledViews`; the choice persists in the bag (`calView`) beside `calDate`.

## Element-by-element source mapping (import / adapt / re-implement · license)
| Element | Decision | License |
|---|---|---|
| `@fullcalendar/{core,react,daygrid,timegrid,interaction}` 6.1.21 | IMPORTED (already ours) | MIT |
| `@fullcalendar/list` 6.1.21 (agenda views) | IMPORT new | MIT |
| `@fullcalendar/multimonth` 6.1.21 (year view) | IMPORT new | MIT |
| `@fullcalendar/rrule` 6.1.21 (recurrence render) | IMPORT new | MIT |
| `rrule` 2.8.1 (RRULE parser the plugin consumes) | IMPORT new | BSD-3-Clause (permissive, verified live) |
| view picker, edit dialog, richer eventContent, all option theming | RE-IMPLEMENT on our tokens/primitives | ours |
| Resource/timeline views | NOT pulled — FC Premium; documented as an option in RECIPES | — |

## Improve-don't-add
Everything extends the ONE calendar folder + the ONE `ViewDefinition` — no parallel view. The picker
replaces (not duplicates) the Month/Week toggle. Colors keep reusing `optionMeta`/`chipStyle`. The edit
dialog uses the existing `Dialog` + `Button` primitives, not a new overlay system. `onDelete` is a
first-class `ViewProps` seam every view can use (grid/table get reviewed-delete for free), not a
calendar-private hack.

## Config / option surface
All keys optional with sane defaults; existing 4 keys unchanged. New:
| Key | Kind | Values / default | Drives |
|---|---|---|---|
| `defaultView` | select | month·week·day·listWeek·listMonth·year → month | initialView |
| `enabledViews` | multiSelect (new kind) | the 6 above → all | which views the picker offers |
| `editable` | boolean | true | drag-move + resize + edit save (AND readOnly) |
| `selectable` | boolean | true | drag-select range → create (AND create rights) |
| `firstDay` | select | Sun…Sat → Monday | week start |
| `slotDuration` | select | 15m·30m·60m → 30m | timegrid slot size |
| `slotMinTime`/`slotMaxTime` | text HH:MM | 00:00 / 24:00 | visible time window |
| `weekNumbers` | boolean | false | ISO week column |
| `businessHours` | boolean | false | shade Mon–Fri 9–5 |
| `nowIndicator` | boolean | true | the "now" line |
| `eventOverlap` | boolean | true | allow overlap |
| `recurrenceField` | field (text) | — | a field holding an RRULE string → events expand (render) |
Each maps through the pure `viewOptions.ts` (config → FC props), so config is the single source and it is
node-testable. Business-language framing where FC's raw value would be opaque (firstDay as weekday names,
slotDuration as "30 min"), FC-native where the agent audience expects it.

## Views + plugins
month=dayGridMonth · week=timeGridWeek (timed) / dayGridWeek (all-day objects) · day=timeGridDay /
dayGridDay · agenda=listWeek + listMonth (@fullcalendar/list) · year=multiMonthYear
(@fullcalendar/multimonth). Picker offers only `enabledViews`.

## Event CRUD (all through onPatch / onCreateDraft / onDelete)
- **Create by range**: FC `select` → `onCreateDraft` prefilled with start+end. Empty-day click stays.
- **Edit dialog** (click event): themed `EventEditDialog` — title, start/end (+ all-day toggle), color
  (colorField options), the object's other quick fields; "Open full record" → the peek (`onOpen`); Save →
  `onPatch`; Delete → `onDelete` with an inline confirm.
- **Move/resize**: keep (onPatch); add all-day⇄timed drop conversion in `patchForDrop`.

## Recurring
`recurrenceField` (a text field with an RRULE string, e.g. `FREQ=WEEKLY;BYDAY=MO`) → `events.ts` emits an
FC `rrule` `EventInput` (via @fullcalendar/rrule); occurrences RENDER across views. Editing a recurrence
rule / per-occurrence exceptions is OUT of scope for this pass (rendering + the field only) — noted in
RECIPES as the extension point.

## Demo / config
Extend the calendar journey fixtures with a recurrence field; add a demo object with a `dateTime` field +
a recurrence field (day/week/slots/recurring demoable) under the Kit-demo section (`hideInNav`); enable a
second view set on the existing `deals` (add `enabledViews` + `defaultView`). Additive edits only.

## Journeys (`journeys/extra/calendar-view.mjs` extended)
Per-view render + picker persists across reload · drag-select 3 days → create dialog prefilled with the
range · click event → edit dialog; change title + Save → table/API shows it, dialog closes · delete via
dialog → confirm → event gone + row deleted (API) · all-day toggle in dialog moves it to the all-day lane ·
resize (keep) · recurring event renders N occurrences in month + week · weekNumbers column present ·
nowIndicator present in timeGridDay · businessHours shaded · firstDay + slotDuration honored · listMonth
lists events grouped by day · multiMonthYear renders 12 months, click a day → that day's view · mobile:
view picker → agenda, tap-day create, tap-event dialog · the flake-hardened drag journey (bounded pointer
retries, assertion never weakened) · 10k perf holds. Unit tests: `viewOptions.ts` (config→props) +
`events.ts` recurrence/all-day-flip additions.

## Mobile (§4b)
Picker collapses to a horizontally-scrollable segmented control. month→agenda (keep). week/day→agenda list
(the timegrid never squeezes below legibility at 390px). year→single-column month list. list views are
agenda-native already. Edit dialog → bottom-sheet at 390px. Drag desktop-only (declared); mobile edits via
the dialog.

## Native-not-widget (§4) + motion
Theme every new FC surface to `--nx-*`: list-view day headers + rows, multimonth month titles + grid, the
all-day lane label, now-indicator line (`--nx-danger`), business-hours shading (`--nx-accent-soft`),
week-number cells. Picker + edit dialog use our motion tokens (nxPopIn/settle) with
`prefers-reduced-motion` guards. Before/after screenshots of each new surface.

## Bundle budget
New lazy weight in the CalendarView chunk: list + multimonth plugins + @fullcalendar/rrule + rrule. v1 lazy
chunk was 77.88 kB gzip; projected under the ~250 kB cap; eager unchanged (all lazy). Real numbers measured
+ recorded in DEPENDENCIES.md at build.
