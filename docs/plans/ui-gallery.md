# Lane: ui-gallery (T0)

## Page (key "gallery", FEATURE_GALLERY — the pre-granted 2 env.mjs lines; no server routes, flag rides the existing FEATURES spread + nav filter)
Sections (each an `nxCard` with a Micro header + a copyable `src/ui/...` import path + a scroll anchor):
1. `gallery-primitives` — Button (variants/sizes/busy/icon) · Input (+invalid) · Badge tones · Micro · Checkbox · Tip.
2. `gallery-shadcn` — the curated LIVE subset per spec: dialog, sheet, dropdown, command, calendar, accordion, chart (KitDemo's proven imports).
3. `gallery-inventory` — the FULL 63-item inventory rendered from a committed SNAPSHOT (`src/app/galleryCatalog.ts`, verbatim copy of nexus-ui `docs/catalog.json` items + its `vendoredAt` stamp shown in the section footer; header comment names the source of truth + the refresh step "re-copy when sync-ui bumps `.ui-version`"). RULING RATIONALE: `docs/` is not vendored, a build-time import needs an in-repo file — the stamp makes staleness self-announcing, beating a hand-maintained list on fidelity.
4. `gallery-recordcore` — mini DataTable (LOCAL useState rows, keyboard grid live, onPatch mutates local state only) + a 2-column KanbanBoard on the same local rows.
5. `gallery-fields` — every FieldType (all 22 incl. composites): READ state as a `formatCell` table (type → rendered value, fictional data) + EDIT state via a mini RecordPage frame whose config carries all 22 types (local row/timeline/note handlers; related=[]).
Skin bar: `gallery-skin-nexus|ember`, `gallery-skin-reset`; light/dark `gallery-theme-toggle` reusing the app's `dataset.theme` mechanism (persists exactly like the topbar toggle — the app's own behavior). TOC buttons scrollIntoView — the hash ROUTER owns `location.hash`, so href anchors would clobber the route (stated, not discovered later).

## Skin-state interplay (the T0 ruling item — ONE deviation from the brief's letter)
`applySkin` ALWAYS upserts `#nx-skin` AND caches to `localStorage("nx-skin-css")` (injected pre-paint next boot) — using it for previews would persist them and clobber the Theme page's state. The gallery instead calls the same engine's `skinToCss()` and writes its OWN `#nx-skin-preview` tag appended after `#nx-skin` (equal specificity, later wins). Reset = remove the tag; unmount cleanup = remove the tag (leaving the page can never leak the preview); `#nx-skin` + the cache + `app_state["theme:skin"]` are never touched. The journey asserts `nx-skin-css` is byte-identical across preview→reset. "Reset to app skin" is literal: whatever config/Theme skin was active resumes because it was never displaced.

## Boundaries + journeys (all on the MAIN journey app — local rows need no fixture; no band boots; suite pin :5440)
No src/ui edits (nexus-ui checkout read-only), no new deps, fictional demo data, zero /api writes from the page.
- `gallery-renders` — nav shows Gallery; one testid per section asserted; the journey's own console listener records ZERO page errors.
- `gallery-skin-swap` — computed `--nx-accent` flips to ember's `#FF7900`, reset restores `#4f46e5`; `#/o/companies` afterwards unaffected; `nx-skin-css` unchanged throughout.
- `gallery-interactive` — after load settles, j/k + type-to-edit on the mini table commits a visible local value with a page-level `/api/` request counter delta of ZERO.
Docs: RECIPES "Preview your brand against the kit"; manifest 3 rows? — 2 rows: "UI gallery (catalog + live skin switching)" (renders + skin-swap share it) · "Gallery record-core sandbox (local rows)" (interactive). Count: base 90 + 3 = 93.
