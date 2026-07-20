# Wizard lane — T0 plan

**Contract (the reuse surface).**
```ts
type Kind = "select" | "text" | "long" | "list" | "sources";
interface Q { key: string; label: string; hint?: string; kind: Kind; options?: string[]; placeholder?: string; suggest?: string[]; required?: boolean }
interface SourceDoc { name: string; text: string }
interface Sources { urls: string[]; docs: SourceDoc[] }
type Ans = Record<string, string | string[] | Sources>;
```
`required` (select/text/long only) drives built-in `canNext` gating — no app-supplied validator needed.

**Block API** (`nexus-ui/src/blocks/wizard/`):
- `Wizard({ questions, onComplete, completing?, completeLabel?, title?, landing? })` — steps one `Q` at a time (progress bar, slide-in animation via local easing — `--nx-ease-*` unmerged; TODO note left for the foundations sweep), review screen lists every answered `Q` generically (chips for list/sources), `onComplete(answers)` fires from Generate/Complete. `landing?: { eyebrow, title, hint, guidedLabel, guidedDesc, blankLabel, blankDesc, blankBusy?, onBlank }` renders the optional guided-vs-blank choice first.
- `kindRenderers: Record<Kind, KindRenderer>` — registry object (select/text/long/list/sources), exported so a consumer can extend with a new `Kind`.
- `ModalOverlay({ onClose, children, testId, label })` — backdrop+Escape+click-outside close, optional × button; zero content coupling.
- `ChipListInput({ value, onChange, placeholder?, suggestions?, testIdPrefix? })` — generalized `ListInput`.
- `SourcesInput({ urls, docs, onChange, accept?, maxCharsPerDoc?, readFile? })` — generalized `SourcesInput`/`FileList`; `readFile` defaults to `f.text()`, override for other readers.
- Files: `types.ts`, `Wizard.tsx`, `ModalOverlay.tsx`, `ChipListInput.tsx`, `SourcesInput.tsx`, `wizard.css`, `index.ts` barrel. Tokens: `--nx-accent/-soft`, `--nx-border`, `--nx-bg*`, `--nx-fg*`, `--nx-font-*`. `docs/` catalog: add rows to `OURS` in `scripts/gen-docs.mjs`, regenerate.

**Demo (starter, no App.tsx edit).** New `gallery-wizard` `Section` in `src/app/pages/Gallery.tsx` (Gallery/pages.tsx aren't frozen) wiring `Wizard` with a small sample `questions` set (select/text/long/list/sources) + `landing`, `ModalOverlay` demo trigger, `ChipListInput`/`SourcesInput` standalone demos.

**Journeys** (append to `journeys/run.mjs`, `#/p/gallery`, no new server/port needed): (1) wizard-steps-review — step through all 5 kinds, review shows answers, complete fires; (2) wizard-chips — type+Enter adds, × removes; (3) wizard-modal — open/Escape/backdrop close; (4) wizard-sources — click-upload adds a file entry. Manifest row appended.

Blog residue (`QUESTIONS`, `compile`, `api.*`) stays out of the block entirely — demo uses its own tiny fictional question set.
