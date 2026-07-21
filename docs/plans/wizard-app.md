# wizard-app lane — guided create flow (config-driven)

Wire the existing nexus-ui **Wizard** block into a real "New <object>" guided-create flow.
**No nexus-ui change** — the library Wizard is already generalized (landing guided-vs-blank,
5 kinds, review, `onComplete`). This lane is **starter-only**; the vendored `src/ui/blocks/wizard`
is already in sync (verified). Absent config → today's plain dialog, byte-for-byte unchanged.

## Config shape (`src/app/api.ts` — app-level `AppObject`, exactly like `hideInNav`)
- `createWizard?: { questions: Q[] }` (`Q` imported from `../ui/blocks/wizard`). No `ObjectConfig` edit.
- **Mapping convention:** each question's `key` names the field its answer fills. Coercion: a
  text/long answer to a `richText` field → one-paragraph `Block[]` via `textToBlocks`; else pass-through.

## `src/app/ObjectView.tsx` wiring
- Widen the `config` prop to `AppObject` (extends `ObjectConfig` — assignable everywhere; safe).
- "New <object>" button + palette `nx-new-record`: `config.createWizard ? openWizard : setCreating(true)`.
- Render `<ModalOverlay testId="create-wizard"><Wizard landing={{guided|blank}} …/></ModalOverlay>`.
  - Guided → walk `questions` → `onComplete(answers)` → map to fields → `api.create` → toast · load · `onOpen(id)`.
  - Blank → close wizard, open **today's** dialog (`setCreating(true)`). Existing `create()` untouched.
  - Mirrors the plain create's `stageField` default for parity.

## i18n (`src/app/i18n.ts`) — new `wizard.*` keys (landingTitle/landingHint/guided/guidedDesc/blank/blankDesc/complete).

## Demo (`starter.config.json` → `docs` object)
- Add `createWizard`: questions `title`(text,req) → `status`(select) → `body`(long → richText). Blank preserved.
- **Safety:** no existing journey drives the `docs` plain-create dialog via the UI (verified across run.mjs + extra/) → adding this cannot break a current journey.

## Journey (`journeys/extra/wizard-app.mjs` — band **5821**) + fixture `journeys/fixtures/wizard-app.config.json`
- Fixture object `notes` (recordLayout standard, `openIn:"page"`; title/status/body[richText]) + `createWizard`.
- `wizard-guided-create`: New → landing (guided+blank visible) → Guided → title (Next disabled until filled) →
  status (select auto-advances) → body → review lists answers → Create → record opens: `record-name`=title,
  `field-status`=pick, body prose present. Throwaway fixture (killed) = data hygiene.
- `wizard-blank-fallback`: New → Blank → plain dialog → `create-confirm` → record created (plain path intact).

## testids: `create-wizard`, `create-wizard-close` (+ library `wizard-*`, `new-record`, `create-confirm` reused).
## docs: `DATA-MODEL.md` (createWizard shape) · `RECIPES.md` ("Add a guided create flow"). Manifest feature: "Guided create flow (config-driven wizard)".
## Open decision to double-check: dual-PR expectation vs no nexus-ui diff — nexus-ui branch has no source change (reuse-don't-rebuild), so only the starter PR carries a diff.
