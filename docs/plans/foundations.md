# foundations lane — design note (T0)

Dependency root: Nexus plumbing + async + tokens. Config/prop-driven, no blog coupling, no live org ids.

## Server (zero-dep, node built-ins)
- `src/lib/nexusClient.mjs` (EXISTS — has `nexus()`) → ADD `emulatorChat(deploymentId,{message,sessionId,context,contextLabel})→{reply,sessionId,tools}`: create session→send (180s, no abort)→poll new AI turn. Coupling removed: the `[Blog Studio context]` literal → `contextLabel` param (default `"Context"`).
- `server/aiTaskRunner.mjs` NEW → `runAiTask(store,emitEvent,{taskId,objectKey,recordId,buildInput,applyOutput,onFail})`: run task in bg, `applyOutput(store,parsed)` writes result, `onFail` reverts. Generalizes `redlineArticle`.
- `server/asyncGeneration.mjs` NEW → `fireAsyncGeneration(store,{webhookUrl,payload,placeholder})→created`: create placeholder→`flushNow`→fire webhook→return 202 row. Generalizes `/api/generate-article`.
- `server/store-remote.mjs` → add `RemoteStore.sync()` (verbatim). `server/warehouse.mjs` → `loadSince`/`_read` (verbatim; `load` delegates to `_read`).
- `server/server.mjs` → generic `/api/sync` route (guard `store.sync?.()`); wire `runAiTask` into the EXISTING `/enrich` route when `field.primitive.taskId` set (mock stays as fallback). [region-declared shared-file edits]
- `server/env.mjs` → document `*_TASK_ID`/`*_DEPLOYMENT_ID`/`*_WEBHOOK_URL` convention, all `.optional()`, NO defaults. `.env.example` rows.
- `src/app/api.ts` → `j()` gets per-call `timeoutMs` arg (EXISTS in blog); client `syncStore()` + `copilot(message,sessionId?,context?)`.

## nexus-ui (edit worktree + sync-ui; never src/ui/** in starter)
- `src/hooks/`: move `usePollRev` (from `src/app`); `useAsyncOp(predicate,{pollFn,everyMs,stallAfterMs,onSettle,now?})→{stalled,elapsedMs}` (injectable clock); `useDebouncedSave(persistFn,delay)→{saveState,trigger}`; `ThinkingDots` primitive (tokenized `cp-thinking`).
- `src/tokens/`: `--nx-ease-settle:cubic-bezier(.16,1,.3,1)` + `--nx-ease-spring:cubic-bezier(.34,1.56,.64,1)`; NEW `motion.css` (riseIn family + popIn + `.nx-tap-scale`/`.nx-hover-lift` + ONE `@media(prefers-reduced-motion:reduce)` via `[data-motion]`), `@import "./motion.css"` once atop tokens.css. Blog light opt-chip palette → skin-overridable preset (default palette UNCHANGED).

## Journeys (port band 5500-5549; mock-Nexus seam = boot app w/ NEXUS_BASE_URL→mock http server, canned JSON, no creds)
- `runai-enrich` (VISIBLE): fixture field w/ `primitive.taskId` → click `enrich-<f>` → field value shows mock task output.
- `external-sync` (VISIBLE): boot `WAREHOUSE=bigquery` + mock returning canned `loadSince` create row → `/api/sync` → new row appears in list.
- Hooks/tokens/`emulatorChat`/`fireAsyncGeneration` have NO foundations-side UI consumer (copilot panel + generation wizard are wave-2). Proposed: `useAsyncOp` unit journey (injectable clock, stall assertion); `emulatorChat`/`fireAsyncGeneration` seam journeys assert canned-reply shape via a throwaway mock route. **FLAG:** invariant-6 wants per-feature USER-visible outcome — confirm seam/unit journeys are acceptable for these library units, else name a demo surface.
Testids: `enrich-<field>`, `external-sync-row`.
