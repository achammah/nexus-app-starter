# DESIGN — visual lock

**Status: DEFAULT CANVAS (starter-shipped).** This is the starter's own locked baseline — a cloned app REPLACES this file at project start: render the three `boards/` directions with the app's real nouns, the user PICKS, the chosen tokens + board snapshot land here. Frontend work before that pick inherits this canvas knowingly.

## Locked tokens (v0.1 default)
- Palette: warm near-neutrals (`#fafaf9` ground / `#1c1b19` ink, hue-biased, never pure grey) · single accent `--nx-accent: #4f46e5` (indigo) · semantic ok/warn/danger kept separate from the accent.
- Type: system sans (SF Pro/Segoe/Inter stack); title 15/600 tightened, body 13/400, meta 12, micro 10/700 caps +0.06em; tabular numerals in data cells.
- Density: compact record-system density — 7-8px row padding, 232px sidebar, content max-free (tables own their scroll).
- Shape: radii 6/9/14; 1px borders, shadow only at raised/overlay tiers.
- Motion posture: RESTRAINED — 120/200ms standard-ease micro-transitions (hover lift, tab underline, toast in); zero ambient animation; `prefers-reduced-motion` kills all.
- Themes: light + dark first-class (`[data-theme]` beats the OS query in both directions).

## Anti-references (what this canvas is NOT)
- No purple-to-blue gradient heroes, no cream+serif+terracotta default, no emoji as section markers, no rounded-everything.
- Never a donor product's look: a fork's identity is not a direction.

## Boards
`boards/direction-{a,b,c}.html` — token-variant one-screen boards — serve them, pick one, lock it here.
