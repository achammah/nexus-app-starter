# Lane: dup-detect (T0)

## Detection — store READS, no logged op, no config surface
- `norm(s)`: lowercase → NFKD + strip combining marks (accents) → non-alphanumeric runs → single space → trim. `host(u)`: lowercase, strip scheme + `www.` + path.
- Rules (each explainable in one sentence; unique fields SKIPPED — collisions impossible live; trashed + self excluded; empty values never match):
  1. NAME-EXACT — `norm(primary)` equal → "Same name ignoring case, accents, spacing and punctuation."
  2. NAME-PREFIX (RULING #1) — one normalized primary is a WORD-BOUNDARY prefix of the other (`longer.startsWith(shorter + " ")`) AND the shorter is ≥ 8 normalized chars → "One name begins with the other." Conservative by the length floor + word boundary; strictly-longer only (equal = rule 1).
  3. EMAIL — same non-unique `email`-type field, lowercase-exact equal → "Same email address."
  4. DOMAIN — same non-unique `url`-type field, `host()` equal → "Same web domain."
- Store methods (pure reads): `duplicatesFor(objKey, id)` → `[{id, name, reasons:[label…]}]` (O(N) scan) · `duplicateGroups(objKey)` → `[{ids, reasons}]` — per-rule buckets (norm-value maps; prefix via sorted-adjacent scan) merged by union-find; deterministic, near-linear.

## Server (additive, objects block)
- `GET /api/objects/:key/duplicates` (deny("view")) → `{groups}` · `GET /api/objects/:key/:id/duplicates` (deny("view")) → `{candidates}`. No new permission actions; merge itself stays behind the existing edit+delete gates.

## Record panel (RULING #2: NO RecordPage prop needed)
- Composed as a SYNTHETIC RelatedList appended to `related` in `RecordView.tsx` only when candidates exist: `key:"duplicates"`, label "Possible duplicates", synthetic rows carry the candidate name (primaryKey) + joined reason labels (metaKey — the WHY renders in the section's meta slot). Zero `src/ui` edits; testids come free (`related-duplicates`, `related-duplicates-<id>`).
- The section row's single click IS "Review merge": writes `nx-pending-merge` = `[thisId, candidateId]` (sessionStorage, the `nx-pending-q` handoff pattern) → `go(#/o/<key>)` → ObjectView consumes it, selects the pair and opens the EXISTING merge dialog preselected. Tradeoffs disclosed: no separate open-the-record affordance inside the panel (the merge preview names both; Cancel lands on the list with the pair selected), section caps at the related-card's own 6-row slice, and a user without edit+delete gets the pair selected but no dialog.

## List sweep (ObjectView, additive)
- Toolbar "Find duplicates" (`dup-sweep-open`, next to Import) → dialog (`dup-sweep-dialog`): one card per group (`dup-group-<i>`) with member names + reason labels + "Review merge" (`dup-group-merge-<i>`, shown when canEdit&&canDelete) → `openMergeWith(ids)` (surgical refactor: `openMerge = () => openMergeWith(selectedIds)`). Empty state `dup-sweep-empty`. i18n: one contiguous `dup.*` hunk.

## Journeys (band 5200–5249; marker `// --- lane: dup-detect`) + docs
- Fixture `journeys/fixtures/dup.config.json`: `orgs` (name-exact pair + domain pair), `contacts` (ONE pair matching BOTH prefix and email — panel asserts both labels), `assets` (clean). All four rules journey-locked, per-journey own boots.
- `dup-panel` :5200 — contacts record shows the panel with reasons; row click lands in the merge dialog with both records. `dup-sweep` :5210 — orgs sweep shows exactly 2 groups; group review-merge opens the merge dialog preselected. `dup-clean` :5220 — assets sweep reports none.
- Manifest: 2 rows ("Possible duplicates panel (record page)" · "Duplicate sweep (find + review-merge)" shared by sweep+clean). RECIPES: "Find and merge duplicates". DATA-MODEL untouched.
