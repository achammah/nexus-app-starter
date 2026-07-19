import * as React from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { api } from "../api";
import { useToast } from "../App";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro } from "../../ui/primitives/fields";
import type { FieldDef, ObjectConfig, SelectOption } from "../../ui/record-core/types";

/* Schema — runtime schema editing over the store's logged schema ops. The
   config file stays the immutable seed; every change here rides the command
   log and survives restarts. v1 contract: a successful commit RELOADS the app
   so /api/config re-serves the merged schema to every surface. Management is
   owner/admin — the server 403s everyone else; this page mirrors that. */

const FIELD_TYPES = [
  "text", "longText", "number", "boolean", "rating", "select", "multiselect", "array",
  "date", "dateTime", "currency", "email", "url", "json", "relation", "user",
  "money", "emails", "phones", "links", "address", "fullName",
];
const OPTION_COLORS = ["gray", "blue", "green", "yellow", "orange", "red", "purple", "pink", "teal"];

type OptRow = { value: string; color: string };
const toOptRows = (options?: SelectOption[]): OptRow[] =>
  (options ?? []).map((o) => (typeof o === "string" ? { value: o, color: "gray" } : { value: o.value, color: o.color ?? "gray" }));
const fromOptRows = (rows: OptRow[]) =>
  rows.filter((r) => r.value.trim()).map((r) => ({ value: r.value.trim(), color: r.color }));

function OptionsEditor({ idPrefix, rows, onChange }: { idPrefix: string; rows: OptRow[]; onChange: (rows: OptRow[]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Input
            style={{ flex: 1 }}
            placeholder="Option value"
            value={r.value}
            data-testid={`${idPrefix}-value-${i}`}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
          <select
            className="nxInput"
            style={{ width: 110 }}
            value={r.color}
            data-testid={`${idPrefix}-color-${i}`}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
          >
            {OPTION_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="button"
            aria-label={`Remove option ${r.value || i + 1}`}
            data-testid={`${idPrefix}-rm-${i}`}
            style={{ border: 0, background: "none", cursor: "pointer", color: "var(--nx-fg-faint)" }}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <Button size="sm" icon={<Plus size={12} />} data-testid={`${idPrefix}-add`} onClick={() => onChange([...rows, { value: "", color: "gray" }])}>
        Add option
      </Button>
    </div>
  );
}

/* per-object add-field form */
function AddFieldForm({ obj, objects, onCommit }: { obj: ObjectConfig; objects: ObjectConfig[]; onCommit: (p: Promise<unknown>, msg: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState("text");
  const [opts, setOpts] = React.useState<OptRow[]>([{ value: "", color: "gray" }]);
  const [unique, setUnique] = React.useState(false);
  const [target, setTarget] = React.useState("");
  if (!open) {
    return (
      <Button size="sm" icon={<Plus size={12} />} data-testid={`schema-add-field-${obj.key}`} onClick={() => setOpen(true)}>
        Add field
      </Button>
    );
  }
  const withOptions = type === "select" || type === "multiselect";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "var(--nx-bg-sunken)", borderRadius: "var(--nx-radius-s)" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Input style={{ width: 150 }} placeholder="key (slug)" value={key} data-testid="schema-field-key" onChange={(e) => setKey(e.target.value)} />
        <Input style={{ width: 170 }} placeholder="Label" value={label} data-testid="schema-field-label" onChange={(e) => setLabel(e.target.value)} />
        <select className="nxInput" style={{ width: 130 }} value={type} data-testid="schema-field-type" onChange={(e) => setType(e.target.value)}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {type === "relation" && (
          <select className="nxInput" style={{ width: 150 }} value={target} data-testid="schema-field-target" onChange={(e) => setTarget(e.target.value)}>
            <option value="">Pick a target…</option>
            {objects.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        )}
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", font: "var(--nx-text-meta)" }}>
          <input type="checkbox" checked={unique} data-testid="schema-field-unique" onChange={(e) => setUnique(e.target.checked)} />
          Unique
        </label>
      </div>
      {withOptions && <OptionsEditor idPrefix="schema-opt" rows={opts} onChange={setOpts} />}
      <div style={{ display: "flex", gap: 6 }}>
        <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button
          size="sm"
          variant="primary"
          data-testid="schema-commit"
          onClick={() =>
            onCommit(
              api.schemaAddField(obj.key, {
                key: key.trim(),
                label: label.trim(),
                type,
                ...(withOptions ? { options: fromOptRows(opts) } : {}),
                ...(type === "relation" && target ? { relation: target } : {}),
                ...(unique ? { unique: true } : {}),
              }),
              `Field "${label.trim() || key.trim()}" added`,
            )
          }
        >
          Create field
        </Button>
      </div>
    </div>
  );
}

/* per-field inline editor (label / options / unique) */
function FieldEditor({ obj, field, onCommit }: { obj: ObjectConfig; field: FieldDef; onCommit: (p: Promise<unknown>, msg: string) => void }) {
  const [label, setLabel] = React.useState(field.label);
  const [opts, setOpts] = React.useState<OptRow[]>(toOptRows(field.options));
  const [unique, setUnique] = React.useState(!!field.unique);
  const withOptions = field.type === "select" || field.type === "multiselect";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "var(--nx-bg-sunken)", borderRadius: "var(--nx-radius-s)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Input style={{ width: 190 }} value={label} data-testid={`schema-edit-label-${obj.key}-${field.key}`} onChange={(e) => setLabel(e.target.value)} />
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", font: "var(--nx-text-meta)" }}>
          <input type="checkbox" checked={unique} data-testid={`schema-edit-unique-${obj.key}-${field.key}`} onChange={(e) => setUnique(e.target.checked)} />
          Unique
        </label>
      </div>
      {withOptions && <OptionsEditor idPrefix={`schema-edit-opt-${obj.key}-${field.key}`} rows={opts} onChange={setOpts} />}
      <div>
        <Button
          size="sm"
          variant="primary"
          data-testid={`schema-save-${obj.key}-${field.key}`}
          onClick={() =>
            onCommit(
              api.schemaUpdateField(obj.key, field.key, {
                label: label.trim(),
                ...(withOptions ? { options: fromOptRows(opts) } : {}),
                unique,
              }),
              `Field "${label.trim()}" updated`,
            )
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function SchemaPage() {
  const toast = useToast();
  const [state, setState] = React.useState<{ enabled: boolean; role: string; objects: ObjectConfig[] } | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null); // "<obj>:<field>"
  const [addingObject, setAddingObject] = React.useState(false);
  const [objDraft, setObjDraft] = React.useState({ key: "", label: "", labelOne: "", primaryKey: "name", primaryLabel: "Name" });

  React.useEffect(() => {
    api.schemaState().then(setState).catch((e) => setNotice(e.message));
  }, []);

  // v1 contract: a successful schema commit fully reloads the app so every
  // surface re-reads the merged config from /api/config
  const commit = (p: Promise<unknown>, msg: string) =>
    p.then(() => {
      setErr(null);
      toast(`${msg} — reloading`);
      setTimeout(() => location.reload(), 450);
    }).catch((e) => setErr(e.message));

  if (notice) {
    return <div className="nxCard" style={{ padding: 24 }} data-testid="schema-page">{notice}</div>;
  }
  if (!state) return <div className="nxCard" style={{ padding: 24 }} data-testid="schema-page">Loading schema…</div>;

  return (
    <div data-testid="schema-page" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="pageHead" style={{ alignItems: "baseline", gap: 10 }}>
        <h1 className="pageTitle">Schema</h1>
        <Micro>config = seed + runtime changes (command-log persisted) · commits reload the app</Micro>
      </div>
      {err && (
        <div className="nxCard" data-testid="schema-err" style={{ padding: "10px 14px", color: "var(--nx-danger)", border: "1px solid var(--nx-danger)" }}>
          {err}
        </div>
      )}

      <div>
        {!addingObject ? (
          <Button icon={<Plus size={13} />} data-testid="schema-add-object" onClick={() => setAddingObject(true)}>
            Add object
          </Button>
        ) : (
          <div className="nxCard" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Input style={{ width: 140 }} placeholder="key (slug)" value={objDraft.key} data-testid="schema-obj-key" onChange={(e) => setObjDraft((d) => ({ ...d, key: e.target.value }))} />
              <Input style={{ width: 150 }} placeholder="Label (plural)" value={objDraft.label} data-testid="schema-obj-label" onChange={(e) => setObjDraft((d) => ({ ...d, label: e.target.value }))} />
              <Input style={{ width: 150 }} placeholder="Label (singular)" value={objDraft.labelOne} data-testid="schema-obj-labelOne" onChange={(e) => setObjDraft((d) => ({ ...d, labelOne: e.target.value }))} />
              <Input style={{ width: 140 }} placeholder="primary key" value={objDraft.primaryKey} data-testid="schema-obj-primary" onChange={(e) => setObjDraft((d) => ({ ...d, primaryKey: e.target.value }))} />
              <Input style={{ width: 150 }} placeholder="Primary label" value={objDraft.primaryLabel} onChange={(e) => setObjDraft((d) => ({ ...d, primaryLabel: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button size="sm" onClick={() => setAddingObject(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                data-testid="schema-obj-commit"
                onClick={() =>
                  commit(
                    api.schemaAddObject({
                      key: objDraft.key.trim(),
                      label: objDraft.label.trim(),
                      labelOne: objDraft.labelOne.trim(),
                      primaryField: { key: objDraft.primaryKey.trim(), label: objDraft.primaryLabel.trim() },
                    }),
                    `Object "${objDraft.label.trim()}" added`,
                  )
                }
              >
                Create object
              </Button>
            </div>
          </div>
        )}
      </div>

      {state.objects.map((obj) => (
        <div className="nxCard" key={obj.key} data-testid={`schema-obj-${obj.key}`} style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <b>{obj.label}</b>
            <Micro>{obj.key}</Micro>
            <span className="nxSpacer" style={{ flex: 1 }} />
            <AddFieldForm obj={obj} objects={state.objects} onCommit={commit} />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {obj.fields.map((f) => {
              const retired = f.isActive === false;
              const editKey = `${obj.key}:${f.key}`;
              return (
                <React.Fragment key={f.key}>
                  <div
                    data-testid={`schema-field-${obj.key}-${f.key}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--nx-radius-s)", background: "var(--nx-bg-raised)", opacity: retired ? 0.55 : 1 }}
                  >
                    <code style={{ font: "12px/1 var(--nx-font-mono)" }}>{f.key}</code>
                    <span style={{ flex: 1 }}>{f.label}</span>
                    <Badge>{f.type}</Badge>
                    {f.primary && <Badge tone="accent">primary</Badge>}
                    {f.unique && <Badge>unique</Badge>}
                    {retired && <Badge>retired</Badge>}
                    {!f.primary && !retired && (
                      <Button size="sm" variant="ghost" icon={<Pencil size={12} />} aria-label={`Edit ${f.label}`} data-testid={`schema-edit-${obj.key}-${f.key}`}
                        onClick={() => setEditing(editing === editKey ? null : editKey)} />
                    )}
                    {!f.primary && !retired && (
                      <Button size="sm" variant="ghost" icon={<Archive size={12} />} data-testid={`schema-retire-${obj.key}-${f.key}`}
                        onClick={() => commit(api.schemaUpdateField(obj.key, f.key, { isActive: false }), `Field "${f.label}" retired`)}>
                        Retire
                      </Button>
                    )}
                    {retired && (
                      <Button size="sm" variant="ghost" icon={<ArchiveRestore size={12} />} data-testid={`schema-reactivate-${obj.key}-${f.key}`}
                        onClick={() => commit(api.schemaUpdateField(obj.key, f.key, { isActive: true }), `Field "${f.label}" re-activated`)}>
                        Re-activate
                      </Button>
                    )}
                  </div>
                  {editing === editKey && <FieldEditor obj={obj} field={f} onCommit={commit} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
