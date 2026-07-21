# Flow view — design note

Goal: a `flow` view type rendering an object's records as record-card nodes with a configured relation as edges (pan/zoom, minimap, drag-arrange, auto-layout). Records-as-graph; not a workflow builder.

Files (nexus-ui): `src/record-core/views/flow/definition.tsx` (eager registry entry: label/icon/lazy component/toolbar/config schema/validate) · `FlowView.tsx` (lazy chunk: xyflow wrapper, custom nodes, drag persistence) · `graph.ts` (pure: relation resolution + node/edge derivation; no heavy imports) · `layout.ts` (dagre + BFS-rank strategies; lazy chunk only) · `flow.css` (--xy-* variables derived from --nx-* tokens + card styles).
Files (starter): `starter.config.json` (people: `views` + extra sample rows) · `journeys/extra/flow-view.mjs` · `journeys/fixtures/flow-view.config.json` · `journeys/unit/flow-graph.test.ts` · docs rows (manifest, RECIPES, DATA-MODEL, DEPENDENCIES) · gallery catalog restamp.

Dependencies (exact, both repos): `@xyflow/react` 12.11.2 (MIT) · `@dagrejs/dagre` 3.0.0 (MIT). Both load in the lazy view chunk; the eager addition is the definition only.

Config keys (`views` entry): `relationField` (relation field key; default = the object's first relation field) · `labelField` (default = primary). `validateConfig` explains a missing/invalid relation in plain language. View-state keys: `flowRel` (toolbar relation pick) · `flowPos` (per-relation map of dragged node positions; un-dragged nodes re-layout).

Graph semantics: self-relation entries pointing at rows in the current (filtered) set draw parent→child record edges; cross-object and polymorphic entries draw one hub chip-node per distinct target (id from `_refs`, label from the projected value) with hub→record edges; dangling labels and filtered-out self targets draw no edge. Layout: dagre TB up to 2000 nodes, BFS-rank grid above (dagre measured 394ms at 2k, 4.6–8.5s at 10k); `onlyRenderVisibleElements` windows the DOM at scale.

Testids: `flow-<objectKey>` · `flow-node-<id>` · `flow-hub-<obj>-<id>` · `flow-empty` · `flow-relation-menu` (+ per-item `flow-relation-<key>`).

Journeys (band 5860–5869): flow-renders (counts + edge + minimap/controls) · flow-drag-persists (position survives reload) · flow-open-peek (click and keyboard Enter open the peek) · flow-hubs (hub labels + external API-created row appears via rev poll) · flow-states (no-relation chip + designed empty state) · flow-mobile (390×664 touch: tap-open + tap-zoom) · flow-perf-10k (thresholds + windowing proof).
