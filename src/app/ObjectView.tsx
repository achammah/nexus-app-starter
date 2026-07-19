import * as React from "react";
import { Plus, Search } from "lucide-react";
import { api } from "./api";
import { useToast } from "./App";
import { Button } from "../ui/primitives/Button";
import { Input, Badge } from "../ui/primitives/fields";
import { Dialog } from "../ui/primitives/overlays";
import { DataTable } from "../ui/record-core/DataTable";
import { KanbanBoard } from "../ui/record-core/KanbanBoard";
import type { ObjectConfig, RecordRow } from "../ui/record-core/types";

/* ObjectView — the list surface: view bar (search · filter chip · count · view switch ·
   New) + table or kanban. GLANCE → ZOOM → ACT: status visible per row, one click to
   the record, edits in place. */

export function ObjectView({
  config,
  onOpen,
  onCountChange,
  viewIcons,
}: {
  config: ObjectConfig;
  onOpen: (id: string) => void;
  onCountChange: (key: string, n: number) => void;
  viewIcons: { table: React.ReactNode; kanban: React.ReactNode };
}) {
  const toast = useToast();
  const [rows, setRows] = React.useState<RecordRow[] | null>(null);
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<"table" | "kanban">(config.defaultView);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];

  const load = React.useCallback(() => {
    api
      .list(config.key, q ? { q } : {})
      .then((r) => {
        setRows(r);
        onCountChange(config.key, r.length);
      })
      .catch((e) => toast(`Load failed: ${e.message}`));
  }, [config.key, q, onCountChange, toast]);

  React.useEffect(load, [load]);
  React.useEffect(() => {
    const on = (e: Event) => setQ(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("nx-search", on);
    return () => window.removeEventListener("nx-search", on);
  }, []);

  const patch = (id: string, p: Record<string, unknown>) => {
    setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...p } : r)) : rs)); // optimistic
    api
      .patch(config.key, id, p)
      .then(() => toast("Saved"))
      .catch((e) => {
        toast(`Save failed: ${e.message}`);
        load(); // restore truth
      });
  };

  const create = () => {
    const body: Record<string, unknown> = { ...draft };
    if (config.stageField && !body[config.stageField]) {
      const sf = config.fields.find((f) => f.key === config.stageField);
      body[config.stageField] = sf?.options?.[0];
    }
    api
      .create(config.key, body)
      .then((row) => {
        setCreating(false);
        setDraft({});
        toast(`${config.labelOne} created`);
        load();
        onOpen(row.id);
      })
      .catch((e) => toast(`Create failed: ${e.message}`));
  };

  return (
    <div>
      <div className="pageHead">
        <h1 className="pageTitle">{config.label}</h1>
        <span className="nxCount" data-testid="row-count">{rows ? `${rows.length}` : "…"}</span>
      </div>

      <div className="nxViewBar">
        <div style={{ position: "relative", width: 260 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--nx-fg-faint)" }} />
          <Input
            placeholder={`Filter ${config.label.toLowerCase()}…`}
            value={q}
            data-testid="list-search"
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 28 }}
          />
        </div>
        {q && (
          <Badge tone="accent">
            “{q}” <button style={{ border: 0, background: "none", cursor: "pointer", color: "inherit", font: "inherit" }} onClick={() => setQ("")} aria-label="Clear filter">×</button>
          </Badge>
        )}
        <span className="nxSpacer" />
        {config.stageField && (
          <div className="viewSwitch" data-testid="view-switch">
            <button data-active={view === "table"} onClick={() => setView("table")}>{viewIcons.table} Table</button>
            <button data-active={view === "kanban"} onClick={() => setView("kanban")}>{viewIcons.kanban} Board</button>
          </div>
        )}
        <Button variant="primary" size="md" icon={<Plus size={14} />} data-testid="new-record" onClick={() => setCreating(true)}>
          New {config.labelOne.toLowerCase()}
        </Button>
      </div>

      {rows === null ? (
        <div className="nxCard" style={{ padding: 40, textAlign: "center", color: "var(--nx-fg-faint)" }} data-testid="list-loading">
          Loading {config.label.toLowerCase()}…
        </div>
      ) : view === "kanban" && config.stageField ? (
        <KanbanBoard config={config} rows={rows} onPatch={patch} onOpen={onOpen} />
      ) : (
        <DataTable config={config} rows={rows} onOpen={onOpen} onPatch={patch} />
      )}

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={`New ${config.labelOne.toLowerCase()}`}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" data-testid="create-confirm" onClick={create} disabled={!draft[primary.key]?.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {config.fields
            .filter((f) => f.type !== "relation")
            .slice(0, 5)
            .map((f) => (
              <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="nxMicro">{f.label}</span>
                {f.type === "select" ? (
                  <select
                    className="nxInput"
                    value={draft[f.key] ?? f.options?.[0] ?? ""}
                    data-testid={`new-${f.key}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    data-testid={`new-${f.key}`}
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                )}
              </label>
            ))}
        </div>
      </Dialog>
    </div>
  );
}
