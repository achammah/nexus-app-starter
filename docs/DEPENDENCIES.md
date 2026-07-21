# Dependencies

Every npm dependency, why it exists, and how it loads. The server (`server/*.mjs`) is zero-dependency by hard rule: node built-ins only. Adding a client dependency needs a maintainer go and a row here (name, exact resolved version, license, why, weight, lazy-load strategy). Sizes are unpacked `node_modules` kilobytes for the package itself (measured with `du -sk`, transitive deps not included).

## Runtime

| Package | Range → resolved | License | Why it exists | KB | Loading |
|---|---|---|---|---|---|
| react / react-dom | ^18.3.1 → 18.3.1 | MIT | the UI runtime | 368 / 4488 | main chunk |
| @tanstack/react-table | ^8.20.0 → 8.21.3 | MIT | DataTable's column/sort model | 776 | main chunk |
| @tanstack/react-virtual | ^3.10.0 → 3.14.6 | MIT | DataTable windowing past 80 rows | 68 | main chunk |
| @dnd-kit/core | ^6.1.0 → 6.3.1 | MIT | KanbanBoard drag | 1532 | main chunk |
| @dnd-kit/sortable | ^8.0.0 → 8.0.0 | MIT | sortable variants for dnd-kit consumers | 360 | main chunk |
| lucide-react | ^0.427.0 → 0.427.0 | ISC | the icon set (tree-shaken per icon) | 32812 | main chunk (only imported icons bundle) |
| radix-ui | ^1.1.0 → 1.6.2 | MIT | umbrella for the vendored shadcn kit's primitives (the per-primitive @radix-ui packages install through it) | 80 (+primitives) | main chunk |
| class-variance-authority | ^0.7.0 → 0.7.1 | Apache-2.0 | shadcn variant API | 44 | main chunk |
| clsx | ^2.1.1 → 2.1.1 | MIT | class merge (with tailwind-merge behind `cn()`) | 40 | main chunk |
| tailwind-merge | ^2.5.0 → 2.6.1 | MIT | class merge (the shadcn contract) | 760 | main chunk |
| tw-animate-css | ^1.2.0 → 1.4.0 | MIT | shadcn animation utilities | 56 | main chunk |
| cmdk | ^1.0.0 → 1.1.1 | MIT | the ⌘K palette + typeahead lists | 116 | main chunk |
| sonner | ^1.5.0 → 1.7.4 | MIT | vendored toast system (the starter shell ships its own minimal toast; pick ONE per app) | 288 | main chunk |
| next-themes | ^0.3.0 → 0.3.0 | MIT | sonner's theme binding | 36 | main chunk |
| vaul | ^1.0.0 → 1.1.2 | MIT | vendored drawer (bottom sheet) | 196 | main chunk |
| date-fns | ^3.6.0 → 3.6.0 | MIT | date math for the vendored calendar | 36620 | main chunk (tree-shaken) |
| react-day-picker | ^9.0.0 → 9.14.0 | MIT | the vendored calendar / date picking | 32196 | main chunk |
| embla-carousel-react | ^8.1.0 → 8.6.0 | MIT | vendored carousel | 88 | main chunk |
| input-otp | ^1.2.0 → 1.4.2 | MIT | vendored one-time-code input | 124 | main chunk |
| react-hook-form | ^7.52.0 → 7.82.0 | MIT | vendored form wiring | 2124 | main chunk |
| @hookform/resolvers | ^3.9.0 → 3.10.0 | MIT | zod resolver for react-hook-form | 1756 | main chunk |
| zod | ^3.23.0 → 3.25.76 | MIT | form validation schemas (KitDemo, vendored form) | 5136 | main chunk |
| react-resizable-panels | ^4.0.0 → 4.12.2 | MIT | vendored split panes | 556 | main chunk |
| recharts | 3.8.0 (pinned) → 3.8.0 | MIT | the vendored chart.tsx wrapper (token-bound `--chart-1..5`); record-core ChartView itself is dependency-free flex bars | 8636 | main chunk |
| @glideapps/glide-data-grid | 6.0.3 (pinned) → 6.0.3 | MIT | the Sheet view's canvas grid engine (fill-handle, range selection, TSV clipboard, frozen columns, keyboard nav) | 5308 | LAZY chunk (React.lazy view; only the definition metadata is eager) |
| @linaria/react + canvas-hypertxt + react-number-format | → 4.5.4 / 1.0.3 / 5.4.5 | MIT | glide-data-grid's own dependencies (build-time CSS-in-JS runtime, canvas text measuring, number formatting) | 132 / 72 / 268 | ride the grid's lazy chunk |
| lodash + marked + react-responsive-carousel | → 4.18.1 / 4.3.0 / 3.2.23 | MIT | glide-data-grid peer dependencies (npm auto-installs); marked and the carousel serve its markdown/image cell kinds, which the Sheet view does not use and the bundler tree-shakes OUT of the chunk | 4972 / 460 / 320 | not bundled (verified by chunk size) |
| @xyflow/react | 12.11.2 (pinned) → 12.11.2 | MIT | the flow view's node-graph canvas (pan/zoom, drag, minimap, controls, viewport windowing); transitive: @xyflow/system 1192 KB, classcat 24 KB, zustand 708 KB (internal to the library — the app adopts no store) | 2860 | lazy view chunk (FlowView) |
| @dagrejs/dagre | 3.0.0 (pinned) → 3.0.0 | MIT | the flow view's tree auto-layout (TB ranks) for graphs up to 2,000 nodes; above that an in-repo O(V+E) BFS-rank grid takes over (`views/flow/layout.ts`) | 1404 | lazy view chunk (FlowView) |
| @excalidraw/excalidraw | 0.18.1 (pinned exact) → 0.18.1 | MIT | the whiteboard field type's canvas engine + `exportToSvg` thumbnails (`fields/whiteboard/`) | 79184 | lazy only — see "Whiteboard chunks" below; zero eager cost |
| @fullcalendar/core | 6.1.21 (pinned) → 6.1.21 | MIT | the calendar view's engine (month/week grids, event layout, "+N more" overflow). Pinned exact: the freshly-restructured v7 line splits the package set and adds a temporal-polyfill peer — do not bump past 6.x without re-validating the whole calendar lane | 3256 | lazy chunk (calendar view) |
| @fullcalendar/react | 6.1.21 (pinned) → 6.1.21 | MIT | the React component wrapper around the engine | 44 | lazy chunk (calendar view) |
| @fullcalendar/daygrid | 6.1.21 (pinned) → 6.1.21 | MIT | month + all-day week grids (dayGridMonth/dayGridWeek) | 228 | lazy chunk (calendar view) |
| @fullcalendar/timegrid | 6.1.21 (pinned) → 6.1.21 | MIT | the hourly week grid for dateTime objects (timeGridWeek) | 260 | lazy chunk (calendar view) |
| @fullcalendar/interaction | 6.1.21 (pinned) → 6.1.21 | MIT | drag-to-reschedule, resize, and day-click (dateClick) | 344 | lazy chunk (calendar view) |
| react-map-gl | 8.1.1 (pinned) → 8.1.1 | MIT | React wrapper for the map view: `<Map>` lifecycle, `<Marker>`/`<Popup>` portal real React children, `<Source cluster>`+`<Layer>` declarative GL layers (imported via the `react-map-gl/maplibre` entrypoint) | 800 (+19972 `@vis.gl/react-maplibre`, the runtime it re-exports) | lazy view chunk (MapView) |
| maplibre-gl | 5.24.0 (pinned) → 5.24.0 | BSD-3-Clause | the GL vector-tile renderer under the map view — free stack, no vendor token, no account (OpenFreeMap style; falls back to an inline background style offline) | 45148 | lazy chunk (own, loaded with MapView) |

## Dev

| Package | Range → resolved | License | Why it exists | KB |
|---|---|---|---|---|
| vite | ^5.4.0 → 5.4.21 | MIT | build + dev server (also provides `import.meta.glob` for the view registry) | 3452 |
| @vitejs/plugin-react | ^4.3.1 → 4.7.0 | MIT | React fast refresh + JSX transform | 80 |
| typescript | ^5.5.4 → 5.9.3 | Apache-2.0 | typecheck (`tsc -b` in `npm run build`) | 23388 |
| tailwindcss + @tailwindcss/vite | ^4.0.0 → 4.3.3 | MIT | the shadcn styling layer over the `--nx-*` tokens | 852 + 28 |
| playwright | ^1.45.0 → 1.61.1 | Apache-2.0 | the journey runner's browser | 4904 |
| @types/react, @types/react-dom | → 18.3.31 / 18.3.7 | MIT | React typings | 464 / 60 |

## Loading strategy + bundle budget

The app builds as ONE main chunk plus a lazy chunk per heavy view. Measured eager-bundle checkpoints (`vite build` output, `dist/assets/index-*.js`):

| State | JS min | JS gzip | CSS min |
|---|---|---|---|
| pre view-registry (49292a9) | 1,268.07 kB | 374.81 kB | 158.79 kB |
| with the view registry | 1,274.53 kB | 376.92 kB | 158.79 kB |
| with the Sheet + flow view definitions (eager) | 1,284.67 kB | 380.19 kB | 158.82 kB |
| with the field registry + whiteboard | 1,294.06 kB | 383.79 kB | 160.33 kB |
| with the field registry + whiteboard + calendar view | 1,299.62 kB | 385.44 kB | 160.33 kB |
| with the built-in draft editors + gallery/form views | 1,286.19 kB | 380.33 kB | 156.57 kB |
| current main with flow-native (db0cddb) | 1,316.21 kB | 389.45 kB | — |
| with the map view (eager: definition + RecordCard + token resolver) | 1,322.23 kB | 391.20 kB | 160.54 kB |

The calendar view is a lazy view chunk: `CalendarView-*.js` 266.06 kB min / **77.88 kB gzip** (+ 4.81 kB CSS), loaded only when a calendar tab first renders. Its eager cost (the registry definition plus host wiring) adds +0.43% gzip over the whiteboard baseline, inside the 2% budget.

Lazy view chunks (each loads on first open of its view tab):

| Chunk | JS min | JS gzip | CSS |
|---|---|---|---|
| SpreadsheetView (the Sheet view + glide) | 310.39 kB | 103.55 kB | 12.92 kB |
| FlowView (xyflow + dagre + canvas) | 217.20 kB | 70.69 kB | 19.53 kB |
| CalendarView (FullCalendar month/week) | 266.06 kB | 77.88 kB | 4.81 kB |
| GalleryView (cover-card masonry) | 6.24 kB | 2.78 kB | — |
| FormView (config-driven intake) | 4.29 kB | 1.84 kB | — |
| MapView (view code + react-map-gl wrapper) | 27.28 kB | 9.98 kB | 73.34 kB (10.91 kB gzip; mostly maplibre-gl.css) |
| maplibre-gl (the GL renderer, loads only with MapView) | 1,053.93 kB | 283.63 kB | — |

Budget rule: the eager bundle must not grow more than 2% over the previous baseline without an explicit maintainer go (the registry landed at +0.51% min / +0.56% gzip; the Sheet view added +0.38% min / +0.45% gzip eager; the flow definition adds +0.41% min / +0.41% gzip over the Sheet-merged baseline; the field registry + whiteboard adds +0.73% min / +0.95% gzip over the Sheet+flow baseline — the field registry, the whiteboard definition + thumbnail shell, and the gallery's inline demo scene; excalidraw itself is fully lazy; the calendar view adds +0.43% gzip over the whiteboard baseline; the built-in draft editors + gallery/form views leave the eager bundle at 380.33 kB gzip — at or under the calendar baseline (the per-type Draft editors the create dialog and record page share are the only eager addition; both new views are fully lazy; vite keeps excalidraw's chunk fully lazy on this graph)). New HEAVY view types register a `React.lazy` component (the registry host wraps rendering in Suspense), which code-splits them out of the eager chunk automatically; a lazy view chunk stays at or under ~250 KB gzip (the Sheet chunk sits at 103.55 KB gzip, FlowView at 70.69 KB gzip, CalendarView at 77.88 KB gzip). The natural first split candidates in the existing set are recharts, react-day-picker and date-fns if the eager chunk needs to shrink.

The map view's eager side (the registry definition, RecordCard, and the token→literal color resolver) adds +0.46% min / +0.45% gzip over the current-main baseline (db0cddb: 1,316.21 kB min / 389.45 kB gzip) — inside the 2% budget. Both the MapView chunk and the maplibre-gl renderer are fully lazy: they load only when a `map` view first renders.

**Documented budget exceptions** (maintainer-approved): the map view's maplibre-gl chunk (283.63 kB gzip) exceeds the ~250 kB lazy line. The GL renderer is a monolith with no tree-shakeable subset; it and the MapView code load only when a `map` view actually renders, and the eager bundle stays flat. Excalidraw (whiteboard lane, below) is the other approved exception.

**deck.gl — the named escalation path, deliberately NOT adopted.** Token pins and GL clusters at business-record scale (proven to 10k rows by the `map-cluster-scale` journey) do not need GPU aggregation. If a future surface genuinely outgrows that — hundreds of thousands of points, heatmap/hexbin density layers — the upgrade path is `@deck.gl/mapbox`'s `MapboxOverlay` mounted through react-map-gl's `useControl` on the SAME maplibre basemap: no container rewrite, the view keeps its config surface. deck.gl core plus its per-layer packages are a substantial further GL dependency, so this is a scale-forced escalation, never a default.

### Whiteboard chunks (the one documented exception to the 250 KB lazy cap)

The whiteboard field loads nothing eagerly: empty cells render a static glyph with zero imports. Measured chunks (`vite build`, this repo's dist):

| Chunk | When it loads | min | gzip |
|---|---|---|---|
| excalidraw editor core (`percentages-*.js` — the editor + `exportToSvg`/`getSceneVersion`) | first NON-EMPTY thumbnail on screen, or a canvas mount — shared by both paths | 1,109.22 kB | 358.65 kB |
| excalidraw UI + vendor (`index-*.js`) | with the editor core | 637.62 kB | 153.44 kB |
| `WhiteboardField-*.js` + its CSS | a record page mounts the canvas | 2.89 kB + 145.62 kB CSS | 1.29 kB + 23.03 kB CSS |
| font machinery (`subset-shared.chunk-*.js`) + per-language locales | on demand from inside excalidraw | 1,823.57 kB | 742.48 kB |
| mermaid-to-excalidraw diagram family (~20 chunks: cytoscape, katex, per-diagram) | never — the text-to-diagram dialog is not exposed in our `UIOptions` | on disk only | on disk only |

Fonts self-host: the build emits the woff2 files into `dist/assets` (no CDN fetch; journeys run fully offline). `@excalidraw/utils` is deliberately NOT used for thumbnails: its latest published build predates the current scene format by three years, while the main package exports the same `exportToSvg`/`getSceneVersion` version-matched to the editor.

## Adapted-source provenance

Adapted foreign code (MIT / Apache-2.0 / BSD family only) carries a one-line `// adapted from <repo> (<license>)` header comment in the file and a row here. Current adapted files:

| File | Adapted from | License | What was adapted |
|---|---|---|---|
| `src/ui/record-core/views/flow/FlowView.tsx` (nexus-ui `src/record-core/views/flow/FlowView.tsx`) | xyflow/xyflow `examples/react` Layouting | MIT | the auto-layout wiring shape (compute positions → set nodes → fitView); the layout algorithms themselves are a dependency (dagre) and in-repo code |
| `src/ui/record-core/views/gallery/pack.ts` | usememos/memos `ColumnGrid` | MIT | the deterministic shortest-column masonry assignment (re-expressed as pure functions over exact card heights, plus windowing) |
| `src/ui/record-core/views/map/MapView.tsx` (cluster Source/Layer block) | visgl/react-map-gl `examples/maplibre/clusters` | MIT | the three-layer cluster config shape (cluster circles / count symbols / unclustered points, `point_count` filters, step-expression radii) — re-expressed on token-resolved literals |
