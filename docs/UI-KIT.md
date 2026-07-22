# UI KIT — the vendored `src/ui`

`src/ui/` is a **synced copy** of the nexus-ui library, vendored into the app the shadcn
way: the app owns its copy, imports from relative paths, and never installs it as a
package. The synced commit is recorded in `src/ui/.ui-version`.

**Never edit `src/ui/**` in this repo.** Library changes go to the nexus-ui repo and
arrive here via `npm run sync-ui`. A local edit is silently destroyed by the next sync.

```bash
npm run sync-ui                              # from a sibling ../nexus-ui checkout
NEXUS_UI_PATH=/path/to/nexus-ui npm run sync-ui
```

`scripts/sync-ui.mjs` deletes `src/ui/`, copies `<source>/src` over it, and stamps
`.ui-version` with the source commit + timestamp.

> `sync-ui` STALES the gallery inventory. If nexus-ui's exports changed, regenerate the
> library's `docs/catalog.json`, copy its fields into `src/app/gallery.catalog.json`, and
> in every case restamp that file's `uiVersion` to the new `.ui-version` line. A stale
> stamp fails the gallery journey.

## What is in it

| Path | What |
|---|---|
| `src/ui/tokens/` | `tokens.css` (the `--nx-*` canvas), `motion.css`, `resolve.ts` |
| `src/ui/styles/` | the shadcn bridge — vendored components read `--nx-*` through it |
| `src/ui/components/ui/` | ~48 vendored shadcn components (dialog, popover, command, table, sheet…) |
| `src/ui/primitives/` | house wrappers with the app's API: `Button`, `fields.tsx` (Input · Badge · Micro · Tabs · Checkbox · Tip), `overlays.tsx`, `Markdown.tsx`, `SettingsTabs.tsx`, `EditableRuleList.tsx`, `ThinkingDots.tsx` |
| `src/ui/record-core/` | the config-driven record system: `DataTable`, `KanbanBoard`, `ChartView`, `RecordPage`, `Filters`, `NotionEditor`, `Pipeline`, `SuggestionPanel`, plus the `views/` and `fields/` registries |
| `src/ui/blocks/` | larger composed surfaces: `workbook` (Univer spreadsheet), `copilot`, `wizard`, `mobile`, `login-03`, `sidebar-07` |
| `src/ui/skins/` | `skin.ts` (`applySkin`, `skinToCss`) + `presets.ts` (`nexus`, `ember`, `warm-opt`) |

The library's own catalog (one row per component with "when to use") lives in the
nexus-ui repo at `docs/INDEX.md` + `docs/catalog.json`; the deep record-core doc is
`docs/record-core.md` there. Inside the app, `#/p/gallery` renders the whole surface
live with a skin switcher.

---

## The view registry

Views are **self-registering**. `src/ui/record-core/views/registry.ts` discovers every
`views/<type>/definition.{ts,tsx}` at build time via `import.meta.glob`, so the switcher
tabs, the per-view toolbar and the view body all resolve from config. Adding a view type
is a dropped folder in nexus-ui — nobody edits a switch statement.

A definition default-exports a `ViewDefinition` (`views/types.ts`):

| Slot | Required | What |
|---|---|---|
| `type` | yes | the string config uses (`"table"`, `"map"`, …) |
| `label` | yes | the switcher tab label |
| `icon` | yes | the switcher tab icon |
| `component` | yes | `React.ComponentType<ViewProps>`; use `React.lazy` for heavy views — the host wraps rendering in Suspense |
| `Toolbar` | no | view-bar controls; rendered twice with `side: "lead" \| "trail"` — return `null` on the unused side |
| `configSchema` | no | declarative list of the type's config keys (`{key, label, kind, fieldTypes?, options?, required?}`) |
| `defaultConfig` | no | `(object) => Record<string, unknown>` — defaults for keys the entry leaves unset |
| `validateConfig` | no | `(object, cfg) => string \| null` — a returned message renders as a graceful chip in place of the view |

`ViewProps` hands the component: `object`, `rows` (already search+filter-narrowed — a
view never re-filters), `users`, `readOnly`, `viewConfig` (the object's entry merged over
`defaultConfig`), `viewState` + `onViewState(patch)`, `onOpen` / `onPeek` / `onPatch`,
`selection` / `onSelectionChange`, and the optional `onCreateDraft(prefill?)` (opens the
host's create dialog — never a silent write) / `onCreate(body)` (the host store path;
absent when the caller lacks create rights).

Pick UNIQUE `viewState` keys unless sharing is intended — views naming the same key share
it (board and chart share `groupBy` deliberately). The bag persists per object and saved
views capture it.

## The field registry

The field twin of the view registry: `src/ui/record-core/fields/registry.ts` globs every
`fields/<type>/definition.{ts,tsx}`, and the hosts (RecordPage, DataTable, KanbanBoard,
Filters) consult it BEFORE their built-in type switches. A definition default-exports a
`FieldTypeDefinition` (`fields/types.ts`); every slot is optional.

| Slot | Surface it owns |
|---|---|
| `render` | the record-page surface (`{field, row, value, readOnly?, onSave}`); `onSave` commits ONE whole-value patch — the only write path |
| `cell` | the read-only list cell (table cells, kanban card meta) |
| `previewText` | one-line text for `formatCell` / `csvCell` / palette surfaces |
| `layout: "block"` | full-width record-page breakout (the richText treatment) |
| `filterable: false` | drop the type from the FilterBar |
| `keyboardEditable: false` | the grid's type-to-edit skips it |
| `clearValue` | the value Backspace writes on the keyboard grid |
| `Draft` | the controlled editor for create dialog / form view / wizard |
| `coerce(raw, field)` | raw input (CSV cell, form string) → typed value |
| `validate(value, field)` | client-side shape check |

`Draft` / `coerce` / `validate` ride the shared pure core `fields/draft.ts`
(`coerceDraft` · `validateDraft` · `withStageDefault` · `requiredKeys`), so one entry
gives a type typed create, form-view submit and wizard coercion at once. Keep live
editing state local and seeded once — the host keys `render` by row id, so a same-record
poll never clobbers an in-progress edit. Reference implementation: `fields/whiteboard/`.

## The free-surface block contract

A **free surface** is a page whose content is one opaque document, not record rows —
the Spreadsheet page is the reference. Every such block follows the same contract:

| Piece | Contract |
|---|---|
| `value` | the document to load; `null` → the block seeds a demo |
| `onChange(snapshot)` | fires on every persisted change; the HOST debounces and persists |
| `reloadNonce` | bump to force a fresh mount from the current `value` (reset, external reload) |
| store key | `<blockStoreKey>("<pageKey>")` — an `app_state` key; own key = own document |
| guard | `is<Block>Snapshot(value)` — validate before mounting; a bad value renders a designed invalid state |
| seed | `seed<Block>()` — the starting document when the store is empty |
| lazy surface | `Lazy<Block>Surface` (a `React.lazy` export) mounted under Suspense; the heavy engine never rides the eager bundle |

The workbook block (`src/ui/blocks/workbook`) exports exactly that set:
`workbookStoreKey` · `isWorkbookSnapshot` · `seedWorkbook` · `seedLargeWorkbook` ·
`WorkbookSurface` / `LazyWorkbookSurface`, plus `WorkbookSurfaceProps`
(`value`, `onChange`, `reloadNonce`, `className`, `actions`, `data-testid`) and the
theme derivation helpers. `actions` renders host controls (save state, reset) INTO the
vendor toolbar's reserved right end, so the page needs no extra header strip.

Because the document is an ordinary `app_state` value, a workflow or agent can produce
one by writing the same key: `POST /api/state {key, value}`.

---

## Tokens + theming

Every surface — record-core, the app shell, and the vendored shadcn components — reads
one CSS custom-property canvas: `src/ui/tokens/tokens.css`.

| Group | Tokens |
|---|---|
| Surfaces | `--nx-bg` `--nx-bg-raised` `--nx-bg-sunken` |
| Ink | `--nx-fg` `--nx-fg-muted` `--nx-fg-faint` |
| Lines | `--nx-border` `--nx-border-strong` |
| Accent | `--nx-accent` `--nx-accent-fg` `--nx-accent-soft` |
| Semantic | `--nx-ok(-soft)` `--nx-warn(-soft)` `--nx-danger(-soft)` |
| Type | `--nx-font-sans` `--nx-font-mono` `--nx-text-title` `--nx-text-body` `--nx-text-meta` `--nx-text-micro` `--nx-tracking-micro` |
| Shape | `--nx-radius-s/m/l`, `--nx-gap-1..5` |
| Depth + motion | `--nx-shadow-1/2`, `--nx-ease*`, `--nx-t-fast/med/slow/spin`, `--nx-stagger` |

Light and dark are both first-class: a `[data-theme]` stamp on the root beats the OS
query in BOTH directions. Build every surface against the tokens, never literal colors —
that is what makes a live theme flip and a skin change repaint without a reload.

**Skins are brand as data.** One small JSON re-derives the whole canvas:

```jsonc
{ "name": "acme",
  "brand": { "primary": "#0B6E4F", "primaryHover": "#095C42", "onPrimary": "#ffffff" },
  "ink": "#141414",
  "surfaces": { "bg": "#FAFAF9", "card": "#fff", "sunken": "#F2F1EF", "border": "#E8E6E3" },
  "chrome": { "style": "dark", "bg": "#000", "accent": "#0B6E4F" },
  "semantic": { "ok": "#1B7F4D", "warn": "#C77700", "danger": "#C43A31" },
  "font": { "sans": "\"Helvetica Neue\", Helvetica, Arial, sans-serif" },
  "labels": "uppercase",
  "radius": 0,
  "density": "compact",
  "shadow": "flat",
  "logo": { "mark": "■", "markBg": "#0B6E4F", "markFg": "#fff", "wordmark": "Acme" },
  "overrides": { "light": { "--nx-warn-soft": "#FFF4E0" }, "dark": { "--nx-bg": "#0E0E10" } } }
```

Give as little as `brand.primary` — the hover, soft tint, focus ring and dark-mode
variant derive via CSS `color-mix`, no JS color math. `radius` reaches the vendored kit
(the shadcn `--radius` variables bridge to `--nx-radius-*`). `chrome` styles the shell
region independently of content surfaces. Anything unspecified keeps the token default.
`overrides` is the escape hatch: any `--nx-*` token, per mode.

Wire it three ways, in ascending power: `theme.accent` (one color) → `theme.skinPreset`
(`nexus` · `ember` · `warm-opt`) → `theme.skin` (a full inline object). At runtime the
Theme page (`#/p/theme`) edits and persists a skin into `app_state` and exports the JSON
for the config; the Gallery page previews skins without persisting anything (previews
compile into a separate `#nx-skin-preview` style tag).

Mechanically: `skinToCss(skin)` compiles the JSON to CSS; `applySkin(skin)` upserts a
`<style id="nx-skin">` tag and caches the CSS in `localStorage("nx-skin-css")` so the
app can inject it before first paint on the next visit.
