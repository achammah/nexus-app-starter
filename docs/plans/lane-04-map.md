# T0 — Lane 4: Map view (feat/view-map, band 5880-5889)

**Goal:** a registry `map` view type plotting records with lat/lng as token-styled markers with real-Card popups (click-through to peek), GL clustering past ~25 points, fit-bounds on load, free tiles (OpenFreeMap), offline-graceful — plus the shared token→literal GL color resolver other canvas lanes consume.

## Verified base + file map (read, not assumed)
Base: starter d42a4fd (warehouse-local.mjs present), nexus-ui de3c9ac. Worktrees wt-l4 / wt-ui-l4 created, sync-ui + npm ci done (only `.ui-version` differs — content-identical vendor; restamp per contract §1 at ship).
Read in full: view registry (`views/types.ts` ViewDefinition, `registry.ts` glob self-registration, `resolve.ts` pure core + its unit test `journeys/unit/view-registry.test.ts`), `chart/definition.tsx` (definition idiom incl. lazy note), ObjectView host (Suspense for lazy views · `viewError` → `view-unknown` chip · `onOpen/onPeek` · rows arrive post-filter · `usePollRev` live updates), KanbanBoard `Card` (title + 2 meta fields via `formatCell` — the record-card idiom), `options.tsx` (`OptionColor` 9 names → `--nx-opt-*`), tokens.css + motion.css (`data-theme` stamp, `#nx-skin` tag, nx-rise/pop utils, single reduced-motion blanket), skins/skin.ts (skin engine emits color-mix() — literals require resolution), api.ts, i18n.ts, CONTRIBUTING-AGENTS (invariant 8 scopes `t()` to `src/app`; "Adding a view type" recipe), RECIPES/DATA-MODEL/DEPENDENCIES/feature-manifest, journeys/run.mjs harness + extra/view-registry.mjs (fixture-server-on-band pattern), seed.mjs (`sampleRows` | `seedCount`), pages.tsx + KitDemo.tsx (demo-section question, below). Dossiers: reactmapgl (primary), maplibre, keplergl (reference only), deckgl (escalation only) + salvage index Map-view row / P0 #4.

## Element → source mapping (license per §6)
| Element | Decision | Source / license |
|---|---|---|
| Map container (init/teardown/resize, interactiveLayerIds hit-testing) | IMPORT dep | react-map-gl maplibre entrypoint (MIT) + maplibre-gl (BSD-3). Exact-pinned. If the stable v8 line routes maplibre through `@vis.gl/react-maplibre`, I install that package instead and report — same API per dossier. |
| Markers + popups (portal real React children) | IMPORT dep components; pin + popup card are OWN code | react-map-gl `<Marker>`/`<Popup>` (MIT); card mirrors the kanban Card idiom (formatCell, title + 2 fields) |
| Clustering (Source cluster + 3 layers: cluster circle / count symbol / unclustered point) | ADAPT (~25 lines of layer config re-expressed on token literals) | visgl/react-map-gl clusters example (MIT) — provenance comment + DEPENDENCIES row |
| Token→literal resolver (`resolveTokenColor`, `useTokenColors`, `subscribeTokenColors`) | OWN (re-implement) | none — probe-element getComputedStyle + 1x1 canvas normalize to rgba(); re-resolves on `data-theme` mutation, `#nx-skin` change, prefers-color-scheme change |
| Fit-bounds, coord inference/validation, rows→GeoJSON, without-location split | OWN pure module (`geo.ts`, node:test) | generic; kepler vis-config read as design reference from dossier TEXT only (clone not opened — not needed) |
| Offline fallback style (inline `{version:8, background}` on token literal) | OWN | none |
| deck.gl | NOT adopted | escalation paragraph in DEPENDENCIES.md only |

## Improve-don't-add
New capability enters via the sanctioned registry path (dropped folder, zero switcher edits). Reused primitives: Badge (without-location chip), Button (popup Open), ThinkingDots (style loading), formatCell (popup fields), optionMeta/OptionColor palette (marker tint), nx-pop-in/nx-rise-in-sm motion utils. No new aggregation/field-render paths: popup card consumes builder-1's shared record-card/field-render util if it lands in time (asked — §10 message sent); until then a local mirror of the kanban-Card composition, swap noted in LEDGER. Token resolver: assigned to my lane by dispatch; builder-1 asked for constraints, builder-2 sent the proposed contract to consume (lands in nexus-ui `src/tokens/resolve.ts`, broadcast on land).

## Files
nexus-ui (wt-ui-l4): `src/record-core/views/map/{definition.tsx, MapView.tsx (React.lazy target), geo.ts, map.css}` · `src/tokens/resolve.ts` · package.json (2 exact-pinned deps) · docs/catalog.json regenerated (gen-docs, OURS rows).
starter (wt-l4): `starter.config.json` (+`demo_places`, appended) · `src/ui/**` via sync-ui only · `src/app/gallery.catalog.json` (items + uiVersion restamp) · `journeys/extra/map-view.mjs` · `journeys/fixtures/map-perf.config.json` · `journeys/unit/map-geo.test.ts` · docs (feature-manifest rows, RECIPES entry incl. Wiring-to-Nexus note + future address→coords enrich one-liner, DATA-MODEL hand-section for view config keys + `npm run model`, DEPENDENCIES rows + measured sizes + deck.gl escalation paragraph, `docs/plans/lane-04-map.md`) · LEDGER.md (worktree, uncommitted).
No HOT-file edits: ObjectView/App/api/FilterBar untouched; config edit is append-only.

## Config + demo
View config keys (spec-named, no extras): `latField`/`lngField` (defaultConfig infers from number-field key/label: lat|latitude / lng|lon|long|longitude), `titleField` (default: primary), optional `colorField` (select field → marker tint from its option palette). `validateConfig` names exactly what's missing/mistyped. No viewState keys in v1 (fit-bounds on load is the spec'd behavior; viewport persistence would be speculative). Cluster threshold: internal constant 25 (not a knob).
`demo_places`: ~12 rows, real EU city coords (number fields `lat`/`lng`), realistic fictional org names in the existing seed voice, a colored select (`kind`: Office/Warehouse/Partner w/ option colors) exercising tint, 2 rows WITHOUT coords (chip proof), `views: [{type:"table"},{type:"map"}]`.

## States, mobile, a11y (floors)
Empty: designed centered chip ("No locations to show") — journey-asserted. Loading: host Suspense (lazy chunk) + ThinkingDots overlay until style ready. Error: tiles/style unreachable → automatic inline fallback style (token background; markers/clusters/popups fully functional) + muted "Map tiles unavailable" chip; WebGL-unavailable → designed chip state. Misconfigured: validateConfig → host's graceful chip (free).
Mobile (declared per §4b): one-finger pan + pinch zoom (maplibre native), tap marker = popup, tap Open = peek; pins ≥28px touch targets; no hover-only affordances; map fills the content area (no page-scroll trap); NOTHING desktop-only on this surface. Journey at 390x664 hasTouch + screenshot.
A11y: DOM-mode pins are real `<button>`s (aria-label = record title, focus-visible ring), Tab→Enter opens popup→Tab→Enter opens peek (journey-asserted); chip is role="status". Declared limit: in GL cluster mode (>25 pts) per-point keyboard focus doesn't exist — keyboard path is map pan/zoom (maplibre native) until zoom-in crosses back under the threshold; the asserted keyboard journey runs in DOM mode.
Motion: pin/popup/chip enter via nx-pop-in / nx-rise-in-sm (reduced-motion blanket covers them); cluster-click easeTo duration honors prefers-reduced-motion (0ms); maplibre popup/ctrl chrome overridden to `--nx-*` in map.css; GL-internal transitions left stock (noted).

## §4c (store/plumbing)
Map view v1 mutates nothing (no draggable markers; popup = read + Open). Rows arrive post-filter from the host; markers/GeoJSON re-derive from props every render, so external writes + rev-poll updates flow through (fit-bounds runs ONCE on first data — never re-fits under the user). Popup closes if its row disappears. A live-update journey proves rows-appear-underneath visibly (API create → marker count increments). No WAREHOUSE variant needed: the view has no write path — identical by construction; stated here per §4c.

## Journeys (journeys/extra/map-view.mjs; fixture servers 5881/5882; ALL external tile/style requests route-aborted → deterministic offline + exercises the fallback; asserts DOM/state, never tile pixels)
1. map-markers-render: 10 markers (= coord rows), chip "2 without location" · shot
2. map-popup-open: click pin → popup card shows title → Open → peek opens · shot
3. map-empty-state: search-to-zero → designed empty chip
4. map-keyboard: Tab→Enter→popup→Enter→peek
5. map-mobile (390x664, touch): tap pin → popup → Open → peek · shot
6. map-cluster-perf (map-perf fixture, 10k rows seeded via the import API in-journey — no megabyte fixture file): ready < threshold; container mirrors GL state as data-attrs (`data-map-mode`, `data-map-clusters`, `data-map-zoom`, `data-map-ready` — the DOM-assertable proxy for canvas-painted clusters); zoomed-in unclustered → zoom out → `data-map-clusters` > 0; cluster click → zoom deepens · clustered shot
7. map-live-update: API create w/ coords → marker count +1 within the rev-poll window
8. map-misconfig: fixture object without number fields + map view → graceful chip names the gap
Unit tests (journeys/unit/map-geo.test.ts): inference variants, coord validity (0 is a VALID coordinate), GeoJSON+without-location split, bounds math, validate/default logic (all in pure geo.ts).

## Risks / open decisions (for approval)
1. **Bundle**: maplibre-gl alone is ~274KB gzip (bundlephobia v5.24) vs the ~250KB lazy-chunk line — the map chunk will likely land ~255-285KB. Requesting pre-approval as a documented exception (excalidraw precedent) pending the REAL measured number in DEPENDENCIES.md; eager growth stays ~1-2KB (definition only). deck.gl escalation documented either way.
2. **Kit-demo section**: contract §4d says demo objects register under the existing "Kit demo" section, but at d42a4fd no such mechanism exists (KitDemo is a page; nav has no sections — repo wins per §3). Default: `demo_places` ships `hideInNav: true` (clean nav, fully routable/deep-linked; journeys + palette reach it). Asked builder-1 whether any lane established a mechanism; lead call welcome — I build the default unless redirected.
3. **Cluster visibility proxy**: GL layers aren't DOM; the container's data-attrs (above) + screenshots are the visible-outcome proxy. Naming it here so review isn't surprised.
4. **Spec tension**: 12-row demo never clusters (threshold 25) — cluster/zoom-out assertions run on the >25-point perf fixture; demo journeys cover markers/chip/popup/peek.
5. **Headless WebGL**: maplibre v5 needs WebGL2; Playwright's SwiftShader normally provides it. Smoke-tested first in the build; if CI GL fails I stop and report (fallback = the designed unsupported state, but journeys would then need lead arbitration).
6. **Peer-util timing**: record-card util (builder-1) + resolver consumers (builder-2) coordinated per §10; I proceed on documented defaults past ~10min silence and swap on broadcast.

## Approval outcomes (rulings folded in)
- Bundle: APPROVED as the wave's second documented exception — measured real numbers: maplibre-gl lazy chunk 283.61 kB gzip, MapView chunk 9.92 kB gzip (+10.89 kB CSS), eager growth +1.88 kB gzip (+0.50%, within the 2% budget). Recorded in docs/DEPENDENCIES.md with the rationale + the deck.gl escalation paragraph.
- Kit-demo section (ruled wave-wide, now contract §4d): demo objects ship `hideInNav: true` AND a small link/blurb entry ON the KitDemo page — the page IS the section. `demo_places` follows exactly that.
- Shared utils (peer rulings, §10): L4 extracted BOTH the token→literal resolver (`src/tokens/resolve.ts`, widened per builder-1 to accept arbitrary CSS color expressions) and the shared `RecordCard` (`src/record-core/RecordCard.tsx`, builder-1's contract + an additive `titleField` prop); broadcast to all active lanes. KanbanBoard was NOT refactored onto RecordCard (outside this lane's surface) — flagged for a later dedup pass.
