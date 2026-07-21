# Contributing — agent lanes

Rules for building a feature lane in this repo. Deviations need a maintainer go **before** code lands.

## Invariants

1. **Config is the app.** A feature is driven by `starter.config.json` (or an env knob) — never hardcoded to one object/field. New config surface is documented in `docs/DATA-MODEL.md` (shape) and `docs/RECIPES.md` (how to use it).
2. **Zero-dep server.** `server/*.mjs` uses node built-ins only. No new npm dependencies anywhere without flagging the maintainer first (client deps included).
3. **Command-log discipline.** Every new store mutation that changes domain state is a named `Store` method registered in `LOGGED_OPS` (`server/store-remote.mjs`) and must replay deterministically: no `Date.now()`/randomness inside — the store clock is `this._now()`; ids come from the store counter. Operational state (queues, delivery logs) stays out of the log.
4. **Permissions.** Every new route gates through `can(role, cfg, action, {own})` (`server/permissions.mjs`) and its client twin mirrors it (`src/app/permissions.ts`). New actions extend BOTH.
5. **UI primitives.** Components come from `src/ui` (vendored nexus-ui). Never edit `src/ui/**` in this repo — library changes go to the nexus-ui repo and arrive via `npm run sync-ui` (source override: `NEXUS_UI_PATH`). App-level UI lives in `src/app`.
6. **Visible-outcome journeys.** Every feature ships a journey in `journeys/run.mjs` asserting something a USER can see (a row appears, a value changes, a panel opens) — never just an API 200. One `docs/feature-manifest.md` row per feature, `feature` string matching the journey's, proof column phrased as the visible outcome. `Last verified` is stamped by the runner, never by hand.
7. **Testids.** Interactive elements carry `data-testid`, kebab-case, `<surface>-<thing>[-<id>]` (`trash-restore-co_1`, `peek-pos`). Journeys select on testids or visible text, never CSS classes.
8. **i18n.** User-facing strings in `src/app` go through `t()` where a key exists; new high-traffic strings add keys rather than inline literals.
9. **Language/tone of docs.** Docs serve the person or agent USING the repo: present tense, functional, no build history, no internal process vocabulary.
10. **Ports.** Journey servers bind inside your assigned band only (see your lane spec). Never 4400–4402 (live demo instances) or another lane's band.
11. **Escape/keyboard surfaces** follow the laddered model already in place (edit → cell → row; peek pop → close). Don't add a flat global Escape handler.
12. **Data hygiene in journeys.** Create what you assert on; restore or destroy it after. A journey must leave the seed state it found (the suite runs in one shared app).

## Adding a view type

Views are self-registering: the switcher tabs, the per-view toolbar and the view body all come from the view registry (`src/ui/record-core/views/registry.ts`), which discovers every `views/<type>/definition.{ts,tsx}` at build time via `import.meta.glob`. A new view type is a dropped folder in nexus-ui; nobody edits the ObjectView switcher.

1. In nexus-ui, create `src/record-core/views/<type>/definition.tsx` default-exporting a `ViewDefinition` (see `views/types.ts`): `type` (the config string), `label` + `icon` (the switcher tab), `component` (a `React.ComponentType<ViewProps>`; use `React.lazy` for heavy views, the host wraps rendering in Suspense), optional `Toolbar` (view-bar controls, rendered twice with `side: "lead" | "trail"`, return null on the unused side), optional `configSchema` / `defaultConfig` / `validateConfig` (a returned message renders as the graceful chip in place of the view).
2. `ViewProps` hands the component `object`, filtered `rows`, `users`, `readOnly`, `viewConfig` (the object's `views` entry merged over `defaultConfig`), the persisted `viewState` bag + `onViewState(patch)`, `onOpen` / `onPeek` / `onPatch`, and `selection` / `onSelectionChange`. Pick UNIQUE `viewState` keys unless sharing is intended: views naming the same key share it (the board and chart share `groupBy` deliberately). The bag persists per object and saved views capture it.
3. Give an object the view via config: `"views": [{ "type": "table" }, { "type": "<type>", ... }]` (shape: docs/DATA-MODEL.md "App-object options"; recipe: docs/RECIPES.md "Give an object multiple views"). Objects without `views` derive the pre-registry set (the table, plus board + chart when a select/user field exists).
4. Mobile is part of the definition, never a later rework: every control needs a tap path (no hover-only affordances) and the view must render usefully at 390px. Ship a 390x664 journey exercising the core interaction by touch.
5. Vendor into the starter: `npm run sync-ui` (source override `NEXUS_UI_PATH`). sync-ui rewrites `src/ui/.ui-version`, which STALES the gallery inventory: if nexus-ui exports changed, first regenerate `docs/catalog.json` in nexus-ui (`node scripts/gen-docs.mjs`, with OURS rows for the new files), copy its fields into `src/app/gallery.catalog.json`, and in every case restamp that file's `uiVersion` to the new `.ui-version` line. A stale stamp fails the gallery journey.
6. `npm run model` regenerates docs/DATA-MODEL.md and preserves everything below its `<!-- hand-maintained below -->` marker (the App-object options section lives there). Hand-written schema notes go below the marker; text above it is generator-owned.

## Workflow

- Branch `feat/<lane>` from the tag named in your spec, in your own git worktree. Commit in logical units with plain one-line messages.
- **T0 — design note before deep code.** Write `docs/plans/<lane>.md` (≤30 lines: file plan, API/store/config shapes, testids, journey list) and report it back. Wait for the go.
- **T1 — mid checkpoint.** Server + store landed, journeys stubbed: report the diffstat and anything that drifted from T0.
- **T2 — final.** `npm run build` clean; `npm run journeys` fully green in YOUR worktree (paste the tail); manifest + docs rows in; then `git push -u origin feat/<lane>` and `gh pr create` with the checklist below in the body. Report the PR URL.
- Blocked, or a decision touches an invariant / another lane's files: STOP and ask the maintainer. Never guess on irreversible calls.

## Full-suite runs on a shared machine

Journeys you add bind inside your port band — but the BASE suite boots fixed ports (the :4000 main app, 4600–4915 fixture servers), so two full-suite runs at once cross-kill each other's servers. Two rules:

1. Pin the main app into your band for suite runs: `PORT=<band-port> JOURNEY_URL=http://localhost:<band-port> npm run journeys`.
2. Full-suite runs take the machine lock first:
   ```bash
   while ! mkdir /tmp/nx-suite-lock 2>/dev/null; do
     [ -n "$(find /tmp/nx-suite-lock -maxdepth 0 -mmin +15 2>/dev/null)" ] && rmdir /tmp/nx-suite-lock && continue
     sleep 10
   done
   trap 'rmdir /tmp/nx-suite-lock 2>/dev/null' EXIT
   ```
   Run the suite, let the trap release. A lock older than 15 minutes is stale — steal it.

Reserved-port traps inside otherwise-free bands on macOS: **5000 and 7000** (ControlCenter/AirPlay listens on both — the runner reports "server failed to boot") and **5060/5061** (Chromium refuses them, ERR_UNSAFE_PORT). Skip all four when picking ports.

## PR checklist (goes in the PR body)

- [ ] All journeys green locally (count + tail pasted)
- [ ] New store ops in `LOGGED_OPS`, replay-safe (no wall-clock/randomness)
- [ ] Routes permission-gated; client twin updated
- [ ] Manifest row(s) added, journey `feature` strings match
- [ ] Docs updated (`RECIPES` / `DATA-MODEL` as applicable)
- [ ] No edits under `src/ui/**` (or: paired nexus-ui PR linked)
- [ ] No new dependencies (or: flagged and approved)
- [ ] Journeys clean up after themselves
