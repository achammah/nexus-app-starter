# LEDGER — lane 6 (gallery + form + field editors)

| Type | Entry |
|---|---|
| DECISION | Gallery layout = JS column-packing (memos ColumnGrid idea, MIT, adapted as pure `pack.ts`) over literal CSS columns — append-stability + 10k windowing; lead-approved deviation. |
| DECISION | ViewProps gains `onCreate?: (body)=>Promise<RecordRow>` (mine, form submit). L5 holds a distinct `onCreateDraft?: (prefill?)=>void`. Second merger rebases the additive line. Lead arbitration. |
| CONSTRAINT | Wave config grammar: bare `*Field` keys (`coverField`, `titleField`, `metaFields`; form `fields`) — never `*FieldId`. Lead ruling. |
| CONSTRAINT | `deals.stage` colored-options upgrade belongs to builder-5; lane 6 never edits `deals` in starter.config.json. |
| CONSTRAINT | Library components keep English defaults (L0 precedent); starter-side strings go through `t()`. |
| DECISION | Shared RecordCard owned by builder-4 (L1 §10 ruling): path `src/record-core/RecordCard.tsx`, sig `{object,row,fields?,onOpen?,testid?}`, nxKCard visual model. GalleryCard built to that prop shape; one-import swap on L4's broadcast. |
| CONSTRAINT | d2 fix must ship WITH a journey asserting a numeric create via the dialog persists (lead condition). |
| REUSE | memos `ColumnGrid.tsx` (MIT) — `assignColumnsByEstimatedHeight`/`columnCountForWidth` shapes adapted into `views/gallery/pack.ts` w/ provenance header. |
| EVIDENCE | d2 confirmed live: `POST /api/objects/companies {"employees":"50"}` → 400 "Employees must be a number"; dialog stores raw strings (ObjectView default Input branch). |
| EVIDENCE | No repo config uses `{value,label}` select options (grep) → RecordPage option-label unification is latent-safe; depth journeys selectOption by VALUE, unaffected. |
| DECISION | One-registry arbitration executed: b3's `fields/` shell taken verbatim from their local commit aa736b4 (4 files only); my module re-homed as `fields/draft.ts` + `fields/editors.tsx` + 22 per-type `fields/<type>/definition.ts` Draft entries + `fields/draft-resolve.ts`. coerceDraft/validateDraft consult registered per-type coerce/validate slots first (custom types ride the same pipeline). |
| DECISION | FieldDraftProps counter sent to b3 (add optional `fieldKey` + `users`, adopt `error`); both branches carry the identical amended types.ts for a clean add/add merge; second-merger rebases fields/*. |
| CONSTRAINT | tsconfig gains `allowImportingTsExtensions` (both repos) — node strip-types needs `.ts`-extension RUNTIME relative imports for node-tested pure modules (L1 broadcast; hit independently, same fix). L1 lands the same two-liner. |
| BINDING | Form relation drafts author by target primary label; the SERVER's label→id resolution (RECIPES "Relations") is the load-bearing seam — a picker upgrade needs a `relationItems` ViewProps member (named follow-up, not built). |
| REUSE | GalleryCard prop-shaped to L4's RecordCard contract (`{object,row,fields,titleField,onOpen,testid}`, commit 4489e00 on their branch) — swap at merge is one import + a height-model recheck (their nxKCard chrome adds padding/border). |
| CONSTRAINT | `withStageDefault` now takes the first option VALUE (never the raw option object) — protects b5's `deals.stage` `{value,color}` upgrade from storing objects via the dialog default. |
| CONSTRAINT | Catalog restamp must precede `npm run build`: `gallery.catalog.json` AND `.ui-version` are BUNDLED (`?raw` + JSON import), so a post-build restamp leaves dist stale and fails the gallery stamp journey. Order: sync-ui → restamp → build. |
| DECISION | Gallery cards position via the CSS `translate` property, NEVER `transform` — the shared `nxRiseIn` entrance + `nx-hover-lift` both animate `transform` (fill-mode `both` holds `transform:none`), which overrides a positioning `transform` and collapses every windowed card to (0,0); the last-painted card then intercepts the tap (only surfaced at 390px, where the mobile journey exercises the tap path). `translate` composes under `transform`, so position holds through the stagger + lift. Supersedes the earlier tab-bar misdiagnosis of gallery-mobile (reproduced on rebase: sh_3 cover intercepted sh_1). |
| CONSTRAINT | Cross-lane footgun (broadcast): any surface positioning elements via `transform: translate(...)` AND applying an `nx-rise-in*`/`nx-hover-lift` class collapses to (0,0) — position on the CSS `translate` property instead. |
