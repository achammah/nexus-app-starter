# CONSTRAINTS — what will bite you

The rules that are not obvious from reading one file, and the failure each one prevents.

## Install + dependencies

**Both install paths need `--force`.**

```bash
npm install --force     # first install
npm ci --force          # from the committed lockfile
```

`@glideapps/glide-data-grid@6.0.3` (the Sheet view's engine) pins its peer to React ≤18
but renders correctly on React 19. `--force` keeps npm's modern peer resolution so every
glide/recharts peer still auto-installs. **`--legacy-peer-deps` does NOT work here** — it
strips those peers and the build fails to resolve `react-is` / `react-responsive-carousel`.

A plain `npm ci` fails the same way (`ERESOLVE`, conflicting peer `react@18.3.1`) — the
committed lockfile does not exempt it, so CI needs the flag too. If a shared npm cache is
under concurrent use, an `EACCES`/`File exists` failure inside `_cacache` is contention,
not a broken lockfile: retry with `--cache <a private dir>`.

**A vendored block brings its own dependencies.** `npm run sync-ui` copies library SOURCE
into `src/ui/`; it does NOT touch `package.json`. A block that imports an npm package
needs that package declared in the APP's `package.json`, or the build fails on an
unresolved import (a dynamically imported one fails at the moment a user triggers the
feature, which is worse — it looks like a broken button). Current examples: `exceljs`
(workbook XLSX/CSV I/O), `docx` and `mammoth` (document export/import), `three` (the 3D
viewer), `polygon-clipping` (whiteboard boolean ops). After any sync that pulls in a new
block, check its imports against your dependency list before assuming the feature works.

**Dependency reachability decides eager vs lazy — not the author's intent.** A module ends
up in the eager bundle if ANY eagerly-imported module reaches it. `polygon-clipping`
(364 KB) stays out of the main chunk only because it is reached solely through
`geometry.ts` → `OpsRail` → `WhiteboardCanvas` → the `React.lazy` `WhiteboardField`. Add
one eager import of that module — surfacing a boolean-op affordance in a list cell, or
touching it from a registry definition — and the whole library lands in the main bundle.
Trace the import path before adding one, and re-measure against the 2% budget after.

**Successive `npm install --no-save` calls prune each other.** Each run reconciles
`node_modules` against `package.json`, so packages added by an earlier `--no-save` call
are removed by the next one. Install extra packages in ONE command, or declare them in
`package.json` properly.

**The server is zero-dependency.** `server/*.mjs` uses node built-ins only. No npm package
may be imported under `server/`. Client dependencies need a maintainer go and a row in
`docs/DEPENDENCIES.md` (name, exact resolved version, license, why, weight, load strategy).

**Bundle budget: the eager chunk may not grow more than 2%** over the previous baseline
without an explicit go. Measured checkpoints and the per-chunk table are in
`docs/DEPENDENCIES.md`.

## Lazy-load anything heavy

A heavy engine belongs in a lazy chunk, never the eager bundle:

- A heavy VIEW registers `component: React.lazy(...)` — the registry host wraps rendering
  in Suspense, and vite code-splits it out automatically.
- A heavy FIELD editor uses `React.lazy` in its `render` slot; the host wraps the registry
  branch in Suspense with a designed loading state.
- A heavy free-surface BLOCK exports a `Lazy<Block>Surface`; only the light helpers
  (store key, guard, seed) ship eagerly.

Already-lazy: the Sheet grid, Flow, Calendar, Gallery, Form, Map (+ the GL renderer), the
whiteboard editor, and the Univer workbook. The lazy line is ~250 KB gzip per chunk; three
documented exceptions (maplibre-gl, excalidraw, Univer) exceed it because the engines are
irreducible monoliths and load only when their surface actually mounts.

An empty value must cost nothing: an empty whiteboard cell renders a static glyph with
zero imports. Apply the same rule to any new heavy field type.

## Serve every asset extension the app ships

The static server maps a file extension to a content type from ONE table in
`server/server.mjs`; anything unlisted is served as `application/octet-stream`. A browser
REFUSES an ES module with a non-JavaScript MIME type, so a block that ships an
ES-module worker or a `.mjs` asset (pdf.js and its worker are the usual case) breaks with
"Expected a JavaScript module script" until `.mjs` is in that table:

```js
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", … };
```

The same applies to any other extension a new block emits into `dist/assets` — `.wasm`,
`.glb`, a font format not already listed. Check the table when you add a block whose build
output is not plain `.js`/`.css`.

## No external hosts at runtime

Nothing is fetched from a CDN. `index.html` loads one module and no external script or
stylesheet; excalidraw's fonts are emitted into `dist/assets` and self-hosted; the journey
suite runs fully offline. Anything an app needs must be bundled or generated at build time.

The one deliberate exception is map basemap tiles (OpenFreeMap / Carto / ArcGIS /
OpenTopoMap — free stacks, no vendor token, no account). With tile hosts unreachable the
map degrades to a token canvas plus a "Map tiles unavailable" chip and every overlay keeps
working. If your deployment forbids that egress, restrict `basemaps` in the view config and
expect the degraded canvas.

Server-side, the api-key platform client (`src/lib/nexusClient.mjs`) is **server-only**:
anything imported from `src/app` ships to every browser, so no secret may live there.
Secrets go in the environment (schema: `server/env.mjs`) or the host's secret store.

## Mobile is part of the definition, not a later pass

Every view, field and page must render usefully at 390px and be operable by touch:

- No hover-only affordances — every control needs a tap path.
- No horizontal page scroll at 390px (a wide surface owns its own internal scroll).
- Desktop-only interactions are allowed but need a documented mobile equivalent: the
  whiteboard rests as a preview + "Edit canvas" (fullscreen overlay), the Sheet's fill
  handle is desktop-only with inline overlay editing as the mobile edit path, the calendar
  swaps its grid for a tappable agenda list.
- Ship a 390x664 touch journey with the feature, not after it.

## Both themes are first-class

Light and dark are equal citizens: a `[data-theme]` stamp on the root beats the OS query in
BOTH directions. Build against `--nx-*` tokens, never literal colors, and verify a live
theme flip repaints with no reload — including embedded vendor surfaces, which bind their
own variables from the tokens (excalidraw's chrome, xyflow's `--xy-*`, Univer's chrome and
canvas). A skin change must re-derive the same surfaces.

## Never edit `src/ui/**`

It is a synced copy (`npm run sync-ui`); a local edit is destroyed by the next sync. Fix
the library, then re-sync. After a sync, restamp `src/app/gallery.catalog.json`'s
`uiVersion` — a stale stamp fails the gallery journey.

## Store + API discipline

- **API JSON is `no-store`.** A cached list renders moved cards in their old column.
- **Every new store mutation** that changes domain state is a named `Store` method in
  `LOGGED_OPS` (`server/store-remote.mjs`) and must replay deterministically: no
  `Date.now()`, no randomness (the store clock is `this._now()`, ids come from the store
  counter). Operational state (queues, delivery logs) stays out of the log.
- **Every new route** gates through `can(role, cfg, action, {own})`
  (`server/permissions.mjs`) with its client twin in `src/app/permissions.ts`. The server
  is the gate; the client only hides affordances.
- **Field validation is server-side and derived from the type** (`validate()` in
  `server/store.mjs`). A new structured type without a case there is unvalidated.

## Irreversible actions need a review surface

Anything irreversible or bulk (delete, destroy, bulk edit, send, import) ships WITH a
surface naming its targets and offering cancel, and a verifiable result state afterwards.
ObjectView's reviewed-delete flow is the binding pattern; the vendored `alert-dialog` is
the component. A bare fire-button is not acceptable, whatever the action.

## Config-first, never instance-bound

A feature is driven by `starter.config.json` (or an env knob) and never hardcoded to one
object or field. New config surface is documented in `docs/CONFIG.md`, and its recipe in
`docs/RECIPES.md`. A view or field type carries a sensible default for every option so it
works with an empty config entry, and a `validateConfig` message so a misconfiguration
renders a plain-language chip instead of crashing the page.

## Strings and testids

- User-facing strings in `src/app` are born in `src/app/i18n.ts` dicts and go through
  `t()` — never inline literals for new high-traffic strings.
- Every interactive element carries a kebab-case `data-testid` shaped
  `<surface>-<thing>[-<id>]`. Journeys select on those; a missing testid means the feature
  cannot be verified.
- Escape/keyboard behavior follows the laddered model already in place (edit → cell → row;
  peek pop → close). Do not add a flat global Escape handler.

## Before every push

```bash
npm run precheck      # tsc -b + vite build + journeys stamp freshness (<24h)
```

The deploy gate DENIES a starter-born repo (`.nexus-starter` marker) shipping red
artifacts. `NEXUS_GATE_ACK=1` is the deliberate override, not a routine flag.
