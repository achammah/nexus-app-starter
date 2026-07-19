import * as React from "react";
import { Columns3, Download, Plus, Search, Trash2 } from "lucide-react";
import type { SortingState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/components/ui/dropdown-menu";
import { api } from "./api";
import { useToast } from "./App";
import { t } from "./i18n";
import { Button } from "../ui/primitives/Button";
import { Input, Badge } from "../ui/primitives/fields";
import { Dialog } from "../ui/primitives/overlays";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/components/ui/alert-dialog";
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
  // Saved view v0: q + view kind persist per object (localStorage) and restore on
  // mount; a palette/relation jump can hand off a pending query via sessionStorage.
  const saved = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("nx-view-" + config.key) ?? "{}") as {
        q?: string;
        view?: "table" | "kanban";
        hidden?: string[];
        sort?: SortingState;
      };
    } catch {
      return {};
    }
  }, [config.key]);
  const pendingQ = React.useMemo(() => {
    const v = sessionStorage.getItem("nx-pending-q");
    if (v !== null) sessionStorage.removeItem("nx-pending-q");
    return v;
  }, []);
  const [rows, setRows] = React.useState<RecordRow[] | null>(null);
  const [q, setQ] = React.useState(pendingQ ?? saved.q ?? "");
  const [view, setView] = React.useState<"table" | "kanban">(saved.view ?? config.defaultView);
  const [hidden, setHidden] = React.useState<string[]>(saved.hidden ?? []);
  const [sort, setSort] = React.useState<SortingState>(saved.sort ?? []);
  const [selFilters, setSelFilters] = React.useState<Record<string, string[]>>(
    (saved as { selFilters?: Record<string, string[]> }).selFilters ?? {},
  );
  const [relOpts, setRelOpts] = React.useState<Record<string, string[]>>({});
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  React.useEffect(() => {
    localStorage.setItem("nx-view-" + config.key, JSON.stringify({ q, view, hidden, sort, selFilters }));
  }, [config.key, q, view, hidden, sort, selFilters]);

  // relation options for the create dialog (fetched once the dialog opens)
  React.useEffect(() => {
    if (!creating) return;
    config.fields
      .filter((f) => f.type === "relation" && f.relation)
      .forEach((f) => {
        api
          .list(f.relation!)
          .then((rows) => setRelOpts((m) => ({ ...m, [f.key]: rows.map((r) => String(r.name ?? r.title ?? r.id)) })))
          .catch(() => {});
      });
  }, [creating, config.fields]);

  const activeSelFilters = Object.entries(selFilters).filter(([, vals]) => vals.length > 0);
  const visibleRows = React.useMemo(
    () =>
      rows?.filter((r) => activeSelFilters.every(([k, vals]) => vals.includes(String(r[k] ?? "")))) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selFilters],
  );

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

  const exportCsv = () => {
    const chosen = rows?.filter((r) => selection[r.id]) ?? [];
    const cols = config.fields.map((f) => f.key);
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [cols.join(","), ...chosen.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${config.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t("bulk.exported", { n: chosen.length }));
  };

  const deleteSelected = async () => {
    setConfirmingDelete(false);
    let n = 0;
    for (const id of selectedIds) {
      try {
        await api.remove(config.key, id);
        n++;
      } catch (e) {
        toast(`Delete failed: ${(e as Error).message}`);
      }
    }
    setSelection({});
    toast(t("bulk.deleted", { n }));
    load();
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
        {config.fields
          .filter((f) => f.type === "select" && f.key !== config.stageField)
          .map((f) => {
            const active = selFilters[f.key] ?? [];
            return (
              <DropdownMenu key={f.key}>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant={active.length ? "primary" : "ghost"} data-testid={`filter-${f.key}`}>
                    {f.label}
                    {active.length > 0 && ` · ${active.length}`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(f.options ?? []).map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o}
                      checked={active.includes(o)}
                      data-testid={`filter-${f.key}-${o.replaceAll(/\W+/g, "-").toLowerCase()}`}
                      onCheckedChange={(on) =>
                        setSelFilters((m) => ({
                          ...m,
                          [f.key]: on ? [...(m[f.key] ?? []), o] : (m[f.key] ?? []).filter((x) => x !== o),
                        }))
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {o}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        {activeSelFilters.length > 0 && (
          <Badge tone="accent">
            <button
              style={{ border: 0, background: "none", cursor: "pointer", color: "inherit", font: "inherit" }}
              data-testid="filters-clear"
              onClick={() => setSelFilters({})}
            >
              clear all ×
            </button>
          </Badge>
        )}
        <span className="nxSpacer" />
        {view === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="md" variant="ghost" icon={<Columns3 size={14} />} data-testid="columns-menu">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {config.fields
                .filter((f) => !f.primary)
                .map((f) => (
                  <DropdownMenuCheckboxItem
                    key={f.key}
                    checked={!hidden.includes(f.key)}
                    data-testid={`col-toggle-${f.key}`}
                    onCheckedChange={(on) =>
                      setHidden((h) => (on ? h.filter((k) => k !== f.key) : [...h, f.key]))
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {f.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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

      {selectedIds.length > 0 && (
        <div
          className="nxCard"
          data-testid="bulk-bar"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 12 }}
        >
          <Badge tone="accent" dot>
            {selectedIds.length} {t("bulk.selected")}
          </Badge>
          <span className="nxSpacer" style={{ flex: 1 }} />
          <Button size="sm" icon={<Download size={13} />} data-testid="bulk-export" onClick={exportCsv}>
            {t("bulk.exportCsv")}
          </Button>
          <Button size="sm" variant="danger" icon={<Trash2 size={13} />} data-testid="bulk-delete" onClick={() => setConfirmingDelete(true)}>
            {t("bulk.delete")}
          </Button>
        </div>
      )}

      {visibleRows === null ? (
        <div className="nxCard" style={{ padding: 40, textAlign: "center", color: "var(--nx-fg-faint)" }} data-testid="list-loading">
          Loading {config.label.toLowerCase()}…
        </div>
      ) : view === "kanban" && config.stageField ? (
        <KanbanBoard config={config} rows={visibleRows} onPatch={patch} onOpen={onOpen} />
      ) : (
        <DataTable
          config={config}
          rows={visibleRows}
          onOpen={onOpen}
          onPatch={patch}
          hiddenFields={hidden}
          sort={sort}
          onSortChange={setSort}
          selection={selection}
          onSelectionChange={setSelection}
        />
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent data-testid="bulk-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("bulk.confirmTitle", { n: selectedIds.length, label: config.label.toLowerCase() })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulk.confirmBody")}
              <span style={{ display: "block", marginTop: 8, color: "var(--nx-fg)" }}>
                {(rows ?? [])
                  .filter((r) => selection[r.id])
                  .map((r) => String(r[primary.key] ?? r.id))
                  .join(" · ")}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("bulk.cancel")}</AlertDialogCancel>
            <AlertDialogAction data-testid="bulk-confirm-go" onClick={deleteSelected}>
              {t("bulk.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            .slice(0, 6)
            .map((f) => (
              <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="nxMicro">{f.label}</span>
                {f.type === "relation" ? (
                  <select
                    className="nxInput"
                    value={draft[f.key] ?? ""}
                    data-testid={`new-${f.key}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {(relOpts[f.key] ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === "select" ? (
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
