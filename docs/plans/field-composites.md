# Lane: field-composites — shaped field values (money/emails/phones/links/address/fullName)

Types (nexus-ui `record-core/types.ts`, additive): `FieldType += "money" | "emails" | "phones" | "links" | "address" | "fullName"`;
`MoneyValue {amount:number; code:string}` · `AddressValue {street?;city?;postcode?;country?}` · `FullNameValue {first?;last?}`; lists are `string[]`.
Helpers exported from `types.ts`: `isMeasurable(f)` (number|currency|money), `measurableValue(v)` (number | money.amount | 0), guards; `csvCell(v,type)` next to `formatCell` in DataTable.

Cell render (DataTable `formatCell` + typed cells): money → `Intl.NumberFormat` currency (`€12,500`), right-aligned via nxNum; emails/phones → first chip + `+N`;
links → anchors, bare-host label, `target=_blank`; address → "street, city" one-liner; fullName → "First Last". Primary link / RecordPage title / kanban card +
drag overlay render via `formatCell(v, primary.type)` (joined name when a fullName is primary). KanbanBoard rollups + ChartView sums use `measurableValue` so money aggregates.

Record-page editors (one patch each): money → amount(number)+code(3-letter) inputs; emails/phones/links → list editor (row inputs, × remove, add-on-Enter,
per-entry validation with inline error `field-<key>-err`); address → inline group of 4 labeled inputs; fullName → first/last inputs.
Testids: `field-<key>`, `-amount/-code`, `-input`, `-rm-<i>`, `-street/-city/-postcode/-country`, `-first/-last`, `-err`.

Keyboard grid: all 6 join SPECIAL (not generic-editable); Backspace-clear → emails/phones/links `[]`, money/address/fullName `null`.

Server (`store.mjs`, additive): `validate()` — money `{amount:number}` (+3-letter code if present), per-entry email format, per-entry URL-or-domain for links,
phones lenient `[0-9+()\-\s]`, address/fullName plain objects; 400 message names the field. `list()` q-match stringifies nested values (arrays/objects flattened).
`mergePlan.empty()` also treats `[]` and all-empty `{}` as empty. No new store ops → no LOGGED_OPS change; no new routes.

SHARED `src/app/ObjectView.tsx` — exact diffs proposed at T1: (1) `exportCsv` flattens via `csvCell` (money → `amount code`; lists → `a; b`; address/fullName joined);
(2) `numericFields` filter → `isMeasurable` (exposes money in chart-measure + rollup pickers); (3) merge/trash/bulk-confirm primary labels + `merge-final` cells via
`formatCell`/`csvCell` (else `[object Object]` for shaped primaries). RecordView relationOptions derivation for fullName-primary targets: out of scope (fixture has no inbound relation to it) — flagged.

Fixture: `depth.config.json` vendors gain one field of each type (2 rows valued); new object `reps` (fullName primary + region select) for primary-rendering checks.
Journeys (ports 5050/5055/5060/5065, own server each, marker `// --- lane: field-composites`): `composite-render` (cell formats incl. joined-name link + card),
`composite-edit` (each editor saves → toast, survives reload, timeline event), `composite-validate` (bad email/URL → visible error naming the field, value kept),
`composite-export` (select → CSV → parse download → flattened columns). Docs: ui `record-core.md` object model + behaviors; starter `RECIPES.md` type list; 4 manifest rows.
