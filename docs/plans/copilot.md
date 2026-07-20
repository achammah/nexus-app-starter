# Lane: copilot — design note (T0)

A reusable AI copilot side-panel: a docked right column + a toggle, chatting with a
native agent (request-response via the existing `/api/copilot` → `emulatorChat` path)
about whatever the user is looking at. Config-driven; absent config → nothing renders.

## File plan
- **nexus-ui** (library, arrives via `sync-ui`)
  - `src/primitives/Markdown.tsx` + `markdown.css` — shared `renderMarkdown(text)` + `<Markdown>` (inline/block MD → React; tokenized).
  - `src/blocks/copilot/CopilotPanel.tsx` + `copilot.css` + `index.ts` — `CopilotPanel` (conversation state + render; transport injected via `send`, context via `getContext`) and `CopilotToggle`. Reuses `ThinkingDots`.
  - `src/record-core/types.ts` — `ObjectConfig.contextFields?: string[]`.
  - `src/index.ts` — export the above.
- **starter** (app)
  - `src/app/Copilot.tsx` — wiring: builds per-turn context from the route + `contextFields`, injects `api.copilot`, renders the dock.
  - `src/app/App.tsx` — mount, `copilotOpen` state, ⌘/Ctrl+I + `c` + Esc, `shell--copilot` class, toggle in the chrome; supersedes `ChatDock` (fallback).
  - `src/app/api.ts` — `AppConfig.copilot?` type (`api.copilot` already exists from foundations).
  - `src/app/app.css` — `.nxCopilotDock` (fixed, slide-in) + `.shell--copilot` (pushes content); mobile = full-width overlay.
  - `server/server.mjs` — `/api/copilot` route → `emulatorChat`; `server/env.mjs` — `COPILOT_DEPLOYMENT_ID`.
  - `starter.config.json` — `copilot` block + `contextFields` on companies/people/deals.
  - `journeys/fixtures/copilot.config.json`, `journeys/extra/copilot.mjs`, manifest + RECIPES rows.

## Config shape
`copilot: { title?, mark?, emptyStateCopy?, suggestions?: string[] }` (deploymentId = env secret).
`ObjectConfig.contextFields?: string[]` — fields sent as context per record.

## Testids
`copilot-toggle` · `copilot-dock` (`.is-open`) · `copilot-panel` · `copilot-close` · `copilot-input` · `copilot-send` · `copilot-suggestion-<i>` · `copilot-msg-user` / `copilot-msg-agent` · `copilot-tool`.

## Journeys (band 5600-5649)
- `copilot-chat` — boot the fixture pointed at an inline mock emulator; toggle opens the dock; a sent message returns a Markdown reply (heading + bold) with tool chips; ⌘I closes it.
