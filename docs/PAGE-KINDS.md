# PAGE KINDS — surfaces declared in config

A **page** is any surface that is not an object's record list. There are two ways to add one:

| Route | When | Cost |
|---|---|---|
| `config.pages[]` — a **page kind** | the surface is one of the built-in kinds | a config entry, zero code |
| `src/app/pages.tsx` — a **custom page** | the surface is bespoke to your product | a React component + a registry row |

This file covers the first. Custom pages: `docs/EXTENDING.md` §"Add a page".

> **The pages host.** `config.pages[]` is read by the app shell: the `PageKind` union and
> `PageConfig` type in `src/app/api.ts`, the nav merge in `src/app/pages.tsx`
> (`navPages` / `configPageFor`), the kind→component branch in
> `src/app/pages/pageHost.tsx`, and the icon resolver `src/app/pageIcons.tsx`. If those are
> absent from an app, it has only the custom-page registry — add a page as a component
> instead, or bring the shell up to date.

## The two families

Every page kind is one of two shapes, and the difference decides what you must configure:

| Family | Content comes from | Needs |
|---|---|---|
| **Free surface** | its OWN persisted document in `app_state`, keyed per page | nothing but a `key` — an empty page is a valid page |
| **Aggregate** | records of one or more configured objects | `source` (which object(s)), and optionally `view` overrides |

The free-surface family all implement the block contract in `docs/UI-KIT.md`
§"The free-surface block contract" — same `value` / `onChange` / `reloadNonce` /
storeKey / guard / seed shape, so they behave identically from the host's side.

## `config.pages[]`

```jsonc
"pages": [
  { "key": "canvas",   "label": "Canvas",   "kind": "whiteboard", "demoSeed": true },
  { "key": "model",    "label": "Model",    "kind": "spreadsheet" },
  { "key": "sites",    "label": "Sites",    "kind": "map",      "source": "demo_places",
    "view": { "defaultBasemap": "satellite", "clustering": true } },
  { "key": "schedule", "label": "Schedule", "kind": "calendar",
    "source": ["deals", "demo_calendar"] }
]
```

| Key | Type | Required | What it does |
|---|---|---|---|
| `key` | string | yes | the route segment — the page lives at `#/p/<key>` — and the `app_state` page key for free surfaces |
| `label` | string | yes | the nav label |
| `kind` | PageKind | yes | which surface renders |
| `icon` | lucide icon name | no | resolved from a curated set; falls back to the kind's own icon |
| `source` | string \| string[] | aggregate kinds | the object key(s) whose records feed the surface. An ARRAY merges objects onto one surface — every deal AND every session on one calendar |
| `view` | object | aggregate kinds | any of the underlying view type's config keys (`docs/CONFIG.md` §4), so a page tailors its surface |
| `whiteboard` | WhiteboardConfig | `whiteboard` kind | the canvas option set (tools, palette, templates, ops) — same shape as the whiteboard FIELD's config |
| `scene` | `"vehicle"` \| `"floorplan"` | `viewer3d` kind | which demo scene seeds the page — the kind-specific option pattern: a kind may add its own key, resolved by its host component |
| `demoSeed` | boolean | free-surface kinds | seed this page with rich EXAMPLE content on first load. **Omitted → the page starts EMPTY**, which is what a genuinely new page should be; the starter's showcase pages set it true |

Icons are declared as a NAME because JSON is stringly-typed. Matching is normalized on
case and separators, so `"pen-tool"`, `"PenTool"` and `"pentool"` all resolve to the same
icon. The resolvable set is curated on purpose — only those icons ship, rather than
lucide's whole registry — so an unknown name falls back to the kind's default rather than
bloating the bundle. Extend the map in `src/app/pageIcons.tsx` to offer more names.

Config pages and hand-written custom pages merge into ONE ordered nav list, so adding a
`config.pages[]` entry adds a nav item with no code at all.

## The kinds

| Kind | Family | What it is | Needs | Host component |
|---|---|---|---|---|
| `whiteboard` | free surface | an excalidraw canvas page | — (optional `whiteboard` config) | `WhiteboardPage` |
| `flow` | free surface | a node-graph canvas page | — | `FlowPage` |
| `spreadsheet` | free surface | a full Univer workbook | — | `Spreadsheet` |
| `document` | free surface | a Notion-style page WORKSPACE — nested pages, tree, links, backlinks | — (spectrum options: `docs/BLOCKS.md`) | `DocumentPage` (lazy) |
| `viewer3d` | free surface | a 3D object / floor-plan viewer | — (optional `scene`) | `Viewer3DPage` (lazy) |
| `map` | aggregate | records plotted on a GL map | `source` + coordinate fields on the object | `AggregatePage` |
| `calendar` | aggregate | records on a calendar; `source` may merge objects | `source` + a date field on each object | `AggregatePage` |

Both aggregate kinds share ONE host component, because an aggregate page is the matching
VIEW rendered over `source`'s rows — which is why `view` takes that view type's config keys
directly. The heavy free surfaces are lazy branches in the host, so a page kind costs
nothing until someone opens it.

`presentation` and `esignature` kinds are not in this set yet; when their blocks land they
become one row here and one section in `docs/BLOCKS.md`.

Per-kind surface behavior and options are the same as the equivalent VIEW where one
exists — a `map` page and a `map` view render the same surface, so `docs/CONFIG.md` §4 is
the option reference for both, passed through the page's `view` object.

### Adding a kind

A new kind is a block plus a host branch, not a new mechanism:

1. Build the block in nexus-ui implementing the free-surface contract
   (`docs/UI-KIT.md`), or reuse an existing view for an aggregate kind.
2. Add the kind to the `PageKind` union in `src/app/api.ts`.
3. Give it a default icon in `src/app/pageIcons.tsx`.
4. Host it: a free-surface kind loads its `app_state` key, guards, seeds, mounts and
   persists exactly like the reference page — the shape in
   `docs/EXTENDING.md` §"Add a free-surface page". An aggregate kind renders the view
   with `source`'s rows and the page's `view` overrides.
5. Add its row to the table above and to `docs/CONFIG.md`, then a manifest row and a
   journey.

Because every free-surface kind repeats the same host shape, step 4 is a copy of an
existing page with one store key and one surface swapped.
