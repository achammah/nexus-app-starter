# plumbing lane — dormant Nexus plumbing made VISIBLE (T0)

Make three foundations-shipped-but-untriggered capabilities first-class + visible, config-driven.
All hooks/indicators already exist in nexus-ui (`useAsyncOp`, `useDebouncedSave`, `ThinkingDots`,
`usePollRev`, all exported) — this lane WIRES them; the one library touch is the save-state in the
richText field (nexus-ui) → genuine dual PR. Everything else is app-level (`src/app`) + server.

## KEY DECISION — the mock shape (needs your nod)
`sync()` + async-gen "external-writer catch-up" REQUIRE a warehouse: the default in-memory `Store`
has no `sync` → `/api/sync` returns `{applied:0}` (verified). `RemoteStore` only activates on
`WAREHOUSE=bigquery` (real Nexus creds). To demo offline I propose a **local file-backed warehouse**:
- NEW `server/warehouse-local.mjs` — implements the exact warehouse contract (`ensure/load/loadSince/append`)
  against a JSON events file (node `fs` only, zero-dep). Wire `WAREHOUSE=local` in server.mjs store-select.
- Default app (no `WAREHOUSE`) stays in-memory, unchanged — the sync button just shows "up to date".
  The DEMO + my journeys run `WAREHOUSE=local` so sync + async-gen are fully live.
- `RemoteStore` already seeds sampleRows (super) THEN replays the warehouse — sample data is not lost.
Alternative if you'd rather stay leaner: async-gen settles via an in-process delayed `store.patch` (no
warehouse) — but then the sync button can only ever say "up to date" (no N-event catch-up). **Recommend
the local warehouse** (faithful to `fireAsyncGeneration`'s design + makes the sync spine real). Your call.

## (1) Live-sync affordance — `src/app` topbar (near theme-toggle, testid `sync-now`)
Button → `api.syncStore()`; `ThinkingDots` while in-flight; result toast/badge "synced N events" / "up to date".
Optional light auto-poll (off by default). App-level; reuses the existing hook + indicator.

## (2) Config-driven async-generation — server + `src/app`
- Config knob on `AppObject` (like createWizard): `generate?: { label?, placeholderStatus?, statusField?, resultField? }`.
- NEW route `POST /api/objects/:obj/generate` → `fireAsyncGeneration(store,{objectKey, placeholder, webhookUrl=SELF/api/_mock/generate, payload})` → placeholder row NOW (statusField="Generating").
- NEW mock endpoint `/api/_mock/generate` — after a short delay APPENDS the finished record (statusField="Ready" + resultField text) to the warehouse as an EXTERNAL event (mirrors the enrich/suggest mock; labeled, no creds).
- UI: a "Generate" action drops the placeholder, then `useAsyncOp(inFlight,{pollFn:syncStore})` polls → row settles; STALL copy ("taking longer than usual") after the threshold. Demo object: a small `reports` object in starter.config.json.

## (3) Save-state — nexus-ui `RecordPage` richText field (dual-PR piece)
Wire `useDebouncedSave(persist)` into the richText field's onChange → visible "Saving… / Saved" (idle→saving→saved), tokenized. Generalized (no object/field hardcode).

## Contract/gate
Config-driven, 0 hardcoded hex (`--nx-*`), 0 branding, functional comments, no speculative knobs. Band **5830-5839**.
Journeys (`journeys/extra/plumbing.mjs`, `WAREHOUSE=local` fixture): sync pulls an externally-appended row in (count rises); async-gen placeholder→settles (status Generating→Ready, body appears); save-state shows Saved. Manifest rows + RECIPES + DATA-MODEL. Build clean + full band-pinned lock-guarded suite green. Screenshots (sync indicator · async settle · save-state) → `_shots/`. Dual PR (starter + nexus-ui save-state).
