# The folder-doc contract

Every folder that owns a mechanism carries a `README.md` written to this shape. One shape,
so an agent that has read one folder doc can navigate any other without re-learning the
format.

Audience: an agent that lands in this folder cold, needs to understand the mechanism, and
then needs to change it safely. Not a marketing reader, not a reviewer of your work.

---

## Where a folder doc lives

**In the folder it documents.** `src/blocks/presentation/README.md`,
`src/record-core/views/map/README.md`, `server/README.md`.

Two reasons, and the second is the load-bearing one:

1. It is edited by whoever edits the code, in the same commit, so it drifts slower than a
   doc in a central directory.
2. **`npm run sync-ui` copies `src/` wholesale**, so a README inside a library folder is
   delivered into every app's `src/ui/**` automatically. A folder doc needs no new
   distribution machinery to reach an adopter — it rides the mechanism that is already
   there.

Discoverability is solved by an INDEX, not by centralising the files: `docs/README.md`
links every folder doc, so there is one place to start and one place per mechanism.

## What lives where — one fact, one home

Two audiences, two homes, no duplicated prose:

| | Folder `README.md` (with the code) | `docs/*.md` (in the app) |
|---|---|---|
| Answers | "how does this work and how do I change it" | "what do I pass it and what must I know before shipping" |
| Owns | the file map, internal model, control flow, extension walkthroughs, traps | config keys, host-facing props, seams, limits, the cross-block picture |
| Reader | someone modifying the mechanism | someone adopting it |

Where the two would overlap, the folder doc owns the FULL detail and the app doc states
only what a host must pass, then links. Example: the presentation snapshot's complete type
lives in `src/blocks/presentation/README.md`; `docs/BLOCKS.md` documents the config surface
and the limits, and points at the folder for the model.

**The rule:** before writing a paragraph, ask which of the two homes owns that fact. If it
is already in the other one, link it instead. Two prose descriptions of one mechanism will
diverge, and then a reader cannot tell which is stale.

---

## The sections

Every folder doc has these, in this order. Omit a section only when it is genuinely empty,
and say so in one line rather than dropping the heading.

### 1. What this folder is
One paragraph: the mechanism, not the value proposition. What it does, what it is built
on, and the one design decision that explains the rest.

### 2. File map
Every file, one line each, what it OWNS. The test: a reader picks the right file to open
without reading any of them.

```
snapshot.ts       the persisted shape + its guard, seeds and store key — dependency-free
PresentationSurface.tsx  the editor shell: toolbars, selection, keyboard, undo
elements.ts       free-placement geometry helpers (hit-testing, resize, snapping)
```

### 3. Boundary — what this folder does NOT own
The neighbouring responsibilities and where they live. This is what stops two folders
documenting the same thing and stops a change landing in the wrong place.

### 4. The model
The types and state this folder owns, where they persist, and who else reads them. Name
the invariants of the shape here (what must always be true of a valid value).

### 5. Seams
The extension points, named, one row each: what a host passes in, what a config key
changes, what a consumer can swap. **This is the "how to improve it" half and it is the
half that usually goes missing** — a reader who cannot find the seam edits the internals
instead, and that is how a fork starts.

For each: what it is for, its shape, and what happens when it is absent (the default).

### 6. How to add X
Two or three walkthroughs of the MOST LIKELY change — "add an element type", "add a view",
"add a basemap" — each naming exact files and functions in order. Concrete over general: a
reader following it should not have to make a single judgement call you could have made
for them.

### 7. Invariants and traps
What breaks if you get it wrong, and the non-obvious constraints. Every gotcha that cost
someone hours belongs here, stated as the rule plus the symptom you would see.

### 8. Limits
What it deliberately does not do, current and honest — the scoped-out list, and anything
that looks supported but is not. A missing limit gets discovered; a FALSE limit gets
believed, so state the ones you know and do not guess at the rest.

### 9. Verifying a change
Which journeys, unit tests or probes cover this folder, and the one command that runs
them. If a mechanism has no coverage, say so — that is a finding, not an omission.

---

## Rules for writing one

1. **Verified or omitted.** Every claim is read off the code at HEAD, not from memory, a
   plan, or a previous self-review. Where a fact comes from something weaker than the
   source, say so inline. (`CONTRIBUTING-AGENTS.md` invariants 12 and 13.)
2. **Update it in the SAME commit as the code.** This is the whole anti-drift mechanism.
   A doc updated later is a doc that is wrong in between, and a reader cannot tell.
3. **Present tense, no history.** No "we rebuilt this", no wave numbers, no PR references,
   no lane names. The reader wants the mechanism as it is today.
4. **Show the real thing.** Copy exact type shapes, exact config keys, exact file paths.
   An invented example that does not compile is worse than no example.
5. **Length follows the mechanism.** A small folder gets a short doc. Do not pad to look
   thorough, and do not compress a genuinely complex mechanism to look tidy. If §6 needs
   40 lines to be followable, it gets 40 lines.
6. **Write §5 and §6 for someone who will change it**, not for someone admiring it. If a
   reader still has to open three files to find the seam, the section failed.

## Anti-patterns

| Don't | Do |
|---|---|
| a file list with no ownership ("`utils.ts` — utilities") | say what it OWNS ("the pure geometry core — hit-testing and resize math, node-testable") |
| describing the UI ("a beautiful toolbar") | describing the mechanism ("the toolbar reads `configSchema` and renders one control per key") |
| "see the code for details" | the detail, or a precise pointer (`file.ts` `functionName`) |
| repeating an app-doc section verbatim | one home, and a link |
| a limits section that lists only easy limits | the limit that will actually surprise someone |
