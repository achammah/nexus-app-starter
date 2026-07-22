# docs/ — index

Start at `AGENTS.md` in the repo root (the front door), then come here.

## Read this first

| I want to… | Read |
|---|---|
| understand what this app IS and how it is put together | `ARCHITECTURE.md` — file map + data flow |
| call the server, or understand persistence and `app_state` | **`API.md`** — the endpoint table + the data spine |
| know every key I may write in `starter.config.json` | **`CONFIG.md`** — the complete config reference |
| see what THIS config currently produces | `DATA-MODEL.md` — generated ER + field tables (`npm run model`) |
| do a specific task (add an entity, wire enrichment, add a whiteboard field…) | `RECIPES.md` — exact files, exact order |
| add a page without writing code (`config.pages[]`) | **`PAGE-KINDS.md`** — every kind, free-surface vs aggregate |
| configure a workbook, document workspace, or 3D viewer | **`BLOCKS.md`** — the free-surface block reference |
| add a view type, field type, page, data source, journey | **`EXTENDING.md`** — the code-level seams |
| use the component kit, the registries, or theming | **`UI-KIT.md`** — `src/ui`, sync-ui, tokens, skins |
| write or run tests | **`TESTING.md`** — the journey harness |
| avoid the traps | **`CONSTRAINTS.md`** — install flags, lazy loading, mobile, themes, store rules |
| add or judge a dependency | `DEPENDENCIES.md` — every package, why, weight, load strategy |
| ship for real | `PRODUCTION_CHECKLIST.md` |

## Folder docs — the mechanism layer

Each folder that owns a mechanism carries its own `README.md`, written to one shape:
**`DOC-CONTRACT.md`**. Those docs answer "how does this work and how do I change it";
the files above answer "what do I pass it and what must I know before shipping".

They live with the code (`src/ui/blocks/<block>/README.md`,
`src/ui/record-core/views/<view>/README.md`, `server/README.md`) so they are edited in the
same commit as the thing they describe — and because `npm run sync-ui` copies `src/`
wholesale, a library folder's doc arrives in this app automatically.

## The four gate artifacts

The deploy gate reads these; they belong to the app YOU build, not to the template.

| File | Contract |
|---|---|
| `SPEC.md` | one row per user ASK, appended the turn it arrives (requester's words → status → evidence) |
| `DESIGN.md` | the visual lock — replace the default canvas after picking a direction from `boards/` |
| `feature-manifest.md` | one row per feature: primitive id (or `mock`/`local`) + exact click path + VISIBLE proof. `Last verified` is written by the journey runner, never by hand |
| `COVERAGE.md` | written by `npm run journeys` — one verdict row per journey, latest run only |

`journeys/.last-pass` is the fifth stamp: written only by an all-green run.

## Also here

- `plans/` — per-lane design notes (`docs/plans/README.md`); working documents, not contracts.
- `media/` — screenshots used by the root `README.md`.

## Library docs

The UI kit is vendored into `src/ui/` from the nexus-ui repo. Its own catalog (one row per
component with "when to use") is `docs/INDEX.md` + `docs/catalog.json` in THAT repo, and
the deep record-core doc is `docs/record-core.md` there. Inside a running app,
`#/p/gallery` renders the whole surface live with a skin switcher.
