# Mobile lane — design note (T0)

Generalizes blog-studio-lambda's mobile chrome into the starter + nexus-ui, config-driven,
coexisting with the shipped drawer + copilot dock + document peek (all preserved).

## nexus-ui — new files under `src/blocks/mobile/`
- `ShortcutsOverlay.tsx` — pure `?`-help modal. Props `{ groups: {title, items:{keys[],label}[]}[], onClose, title? }`.
  Host composes the Core vs App groups. Tokenized/calm (no terminal/chromatic branding).
- `MobileReviewBanner.tsx` — generic bottom step-through. Props
  `{ index, total, title, subtitle?, onPrev, onNext, onHead?, actions: {label,icon?,onClick,testid?,tone?}[] }`.
  Fixed above the tab bar via `var(--nx-mobilenav-h)`.
- `mobile.css` (both components; each imports it) · `index.ts` re-exports ·
  `export * from "./blocks/mobile"` in `src/index.ts` · rows in `scripts/gen-docs.mjs`.

## starter — `src/app` (mine)
- `api.ts`: `AppConfig.objects` element gains `hideInNav?: boolean`; `app.goChords?: Record<char, hashRoute>`.
  Additive/optional — no record-core edit (ObjectConfig stays untouched).
- `App.tsx`: (1) bottom tab bar `.mobileNav` off `config.objects` (filters `hideInNav`) + a Copilot tab
  (when `config.copilot`) — a BOUNDED bar; custom/utility pages stay in the burger/drawer (kept), which
  otherwise 13 tabs crowd unusably. COEXISTS with the drawer. (2) keyboard-nav layer:
  `?`→ShortcutsOverlay, `g`+char→`goChords` route, `n`→new-record — all guarded (yield to inputs/cells/dialogs).
  (3) MobileReviewBanner wired to the mobile peek record-SET (the mobile twin of the desktop peekPager, hidden ≤768px).
- `app.css`: `.mobileNav`/`.mnItem` tokenized, iOS (≥16px inputs, ≥44px targets, safe-area inset); the mobile
  copilot dock lifted to sit ABOVE the nav (input reachable); mobile peek body bottom-pad to clear banner+nav.

## Reconciliations (blog vs ours — kept the better)
- DROP `side--icons`/`side--peek` sidebar collapse — conflicts with the shipped push-dock; keep our dock.
- KEEP the burger/drawer (favorites/team/signout) — the tab bar is additive, not a replacement.
- Refreshed `src/app/gallery.catalog.json` (the gallery's self-enforcing src/ui snapshot) to the re-synced
  library — a mechanical consequence of adding components; every component-adding lane does this.

## config + testids
- config: `objects[].hideInNav`, `app.goChords`. testids: `mobile-nav`, `mnav-<obj>`, `mnav-copilot`,
  `mnav-p-<page>`, `shortcuts-overlay`, `review-banner`, `review-prev`/`review-next`/`review-open`.

## journeys — `journeys/extra/mobile.mjs` (band 5800-5809) · fixture `journeys/fixtures/mobile.config.json`
- `mobile-tabbar` (tab bar off config + navigates + `hideInNav` object absent + copilot tab toggles),
  `mobile-shortcuts` (`?` opens overlay, `g c` navigates via goChords, Esc closes),
  `mobile-review` (banner steps a 3-record set). Keep mobile-390 / mobile-drawer / side-peek-stack / copilot-chat green.
