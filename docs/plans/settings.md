# Settings lane — T0

## Files
nexus-ui: `src/primitives/SettingsTabs.tsx`, `src/primitives/EditableRuleList.tsx` (+ CSS in each), `scripts/gen-docs.mjs` (OURS rows) → regenerated `docs/INDEX.md`/`catalog.json`.
starter: `src/app/pages/Settings.tsx` (new example page), `src/app/pages.tsx` (+1 row), `starter.config.json` (+1 fixture object `settings_rules`), `journeys/run.mjs` (+1 journey file), `docs/feature-manifest.md` (+1 row).

## SettingsTabs API
`{ tabs: {key,label,icon?,render:()=>ReactNode}[], defaultKey? }`. Internal `useState` active tab (uncontrolled). Renders sticky `.set-tabs`/`.set-tab` bar + `.set-body`. No page head/eyebrow — that's app content. testid `settings-tab-<key>`.

## EditableRuleList API
`{ objectKey, rows: RecordRow[]|null, textField, severityField?, severityOptions?: {value,label?,color}[], activeField? (default "active"), onCreate, onPatch, onRemove, placeholder?, addLabel?, emptyLabel? }`. No fetch inside — caller wires `api.list/create/patch/remove` exactly like DataTable's `onPatch` contract. Renders add button, inline add/edit editor (textarea + severity `<select>` when `severityOptions` given + active checkbox when `activeField` given), row list (severity chip + text + edit/delete icons), empty state. Mobile: 2×2 edit-row grid, full-width add, ≥16px inputs (no iOS zoom). CSS prefix `.erl-*`, `--nx-*` tokens only (accent/ok/danger/border/fg-muted — no hex fallbacks needed, tokens always defined).

## Fixture + example page
`settings_rules` object (rule:text primary, severity:select[Critical/Important/Minor], active:boolean) → demonstrates the CRUD tab. `Settings.tsx` = `SettingsTabs` with tab "Writing rules" (EditableRuleList wired to the fixture via `api.*`) + tab "About" (static render, proves the shell holds non-CRUD content too). Registered at `pages.tsx` key `settings`.

## Testids
`settings-tab-<key>` · `settings_rules-add` · `settings_rules-input` · `settings_rules-save` · `settings_rules-cancel` · `settings_rules-row-<id>` · `settings_rules-edit-<id>` · `settings_rules-del-<id>`.

## Journeys (band 5650-5699)
1. `settings-tabs-switch` — click "About" tab → About content renders; back to "Writing rules" → list renders.
2. `settings-rules-crud` — @390px: add a rule (2×2 form, no iOS-zoom check) → edit inline → toggle active (row dims) → delete → empty state shown.
