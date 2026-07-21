# view-registry: T0 design note

Goal: the three hardcoded view branches in ObjectView become one self-registering registry; the three
existing views port as thin wrappers with zero behavior change; the wave's doc surfaces scaffold.

Files (nexus-ui): `src/record-core/views/{types.ts, registry.ts, resolve.ts, group.ts, glob.d.ts,
controls.tsx}` · `views/{table,kanban,chart}/definition.tsx` · `types.ts` (+`views?`, `defaultView`
widened) · `index.ts` (registry exports) · `scripts/gen-docs.mjs` (+8 OURS rows).
Files (starter): `src/app/ObjectView.tsx` (registry-driven switcher, generic viewState bag, unknown-type
chip) · `src/app/App.tsx` (viewIcons prop dropped, registry icons replace it) · `scripts/gen-model.mjs`
(preserves DATA-MODEL's hand-maintained tail below its marker) · `docs/{DEPENDENCIES.md, RECIPES.md,
DATA-MODEL.md, feature-manifest.md}` · `CONTRIBUTING-AGENTS.md` ("Adding a view type") ·
`journeys/{fixtures/view-registry.config.json, extra/view-registry.mjs}`.

Contract (`views/types.ts`): `ViewDefinition { type, label, icon, component, Toolbar?, configSchema?,
defaultConfig?, validateConfig? }` · `ViewProps { object, rows, users, readOnly, viewConfig, viewState,
onViewState, onOpen, onPeek, onPatch, selection, onSelectionChange }` · the Toolbar renders twice per
bar (`side: "lead" | "trail"`). Registry: `import.meta.glob("./*/definition.{ts,tsx}", { eager: true })`.

Config: `ObjectConfig.views?: [{ type, ...config }]`; absent derives the pre-registry set (the table,
plus board + chart when a select/user field exists). The persisted `nx-view-<key>` blob keeps its exact
legacy keys (`{q, view, selFilters, filters}` + the state bag), so existing localStorage state and
server-saved views restore unchanged; same-key views share state (board + chart share `groupBy`).

Testids: `view-switch` (buttons from the registry, labels Table/Board/Chart) · `view-unknown` (the
not-installed chip) · every existing toolbar testid unchanged (`columns-menu`, `col-toggle-*`,
`group-by(-*)`, `measure-*`, `agg-*`).

Journeys (`journeys/extra/view-registry.mjs`, fixture server on 5841): `view-registry-tabs` ·
`view-registry-persist` · `view-registry-unknown` · `view-registry-mobile` (390x664, touch tap).
Unit tests (`npm test` → node:test): `journeys/unit/view-registry.test.ts` over the pure core
(`views/resolve.ts`: glob fold, unknown lookup, legacy derivation). Chip copy through i18n
(`views.notInstalled`); chip enters with `nx-pop-in` (reduced-motion guarded). Eager bundle
49292a9 → lane: 1,268.07 → 1,274.53 kB min (+0.51%), gzip 374.81 → 376.92 kB (+0.56%).
