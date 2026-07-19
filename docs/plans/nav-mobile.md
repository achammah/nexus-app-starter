# nav-mobile — design note (T0)

## Nav placement knob
- `starter.config.json` → `app.nav?: "side" | "top"`, default `"side"`. `AppConfig.app` gains `nav?` in `src/app/api.ts` (additive). `/api/config` already spreads the whole config — zero server changes.
- App.tsx: `mode = config.app.nav ?? "side"`. Side mode renders the existing `<aside class="side">` untouched (org-reskin reads `.side` computed styles — desktop side mode stays byte-identical).
- Top mode: no aside, no `.main > .top` header. One horizontal bar `<header class="topNav" data-testid="nav-top">`: brand mark+name · object/page items (same `nav-<key>`/`nav-p-<key>` testids, icon+label+count, active state, features-filtered) · right: favorites dropdown (vendored dropdown-menu, trigger `topnav-favs`, items reuse `fav-link-<id>`) when favs exist · team `<select>` (reuses `team-switch`) when teams exist · demo chip (`demo-badge`) · global search (`global-search`) · theme toggle · sign-out (`logout`). Modes are mutually exclusive → no testid collisions. The `v0.2 · starter` footer string is not carried into top mode (flagging: cosmetic drop).
- Shell layout: `.shell--top { display:flex; flex-direction:column }`; item strip `overflow-x:auto` for many objects.

## Mobile (≤768px, both modes)
- Replace the current 760px "horizontal strip" media block with 768px rules. Side mode: aside compacts to a slim bar (brand + burger); nav items/favs/team/footer hidden — the burger `data-testid="nav-burger"` renders INSIDE the `[data-testid="nav"]` element so mobile-390's visible-nav wait stays green. Top mode: bar keeps brand+burger+theme; items/search/dropdowns hidden.
- Burger opens a controlled Sheet (vendored `src/ui/components/ui/sheet`, `side="left"`) `data-testid="nav-drawer"`: search (`drawer-search`, Enter → nx-search + close), objects `drawer-nav-<key>` + pages `drawer-nav-p-<key>` (counts + active), favorites `drawer-fav-<id>`, team `drawer-team-switch`, sign-out `drawer-signout`. Navigation closes the drawer. New i18n key `nav.menu`.
- Peek → full screen via CSS only: `@media (max-width:768px) .peekPanel { inset:0; width:100vw; height:100dvh; border-radius:0 }`. Escape interplay safe (peek handler already skips defaultPrevented; Radix prevents default on its Escape close).
- Topbar (side mode `.top`) keeps crumb+theme at mobile; search stays hidden (moved into drawer). Tables/kanban/chart/record/dialogs at 390: verify by screenshot, CSS-only containment fixes in app.css if MY changes regress (ObjectView/RecordView are frozen).

## Journeys (band 5000–5049) + docs
- `nav-top` (port 5010): fixture `journeys/fixtures/navtop.config.json` = starter config + `app.nav:"top"`; spawn pattern from unique-resurrect; assert `nav-top` visible, `[data-testid="nav"]` count 0, counts render (digit in `nav-companies`), click `nav-deals` → `.pageTitle` "Deals".
- `mobile-drawer` (URLBASE, 390×844): burger visible → no h-scroll → drawer opens → `drawer-nav-deals` → title changes + drawer detaches + kanban no h-scroll → drawer → companies → row click → peek `getBoundingClientRect().width ≥ innerWidth-1` + no h-scroll → Escape closes → restore 1280×800.
- Manifest rows (Last verified `—`): features "Nav placement (config app.nav: top)" and "Mobile nav drawer + full-screen peek". RECIPES.md: "Put the nav on top" paragraph + mobile note. DATA-MODEL.md is generated + objects-only → not touched.
