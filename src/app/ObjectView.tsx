import * as React from "react";
import { ArchiveRestore, BarChart3, Bookmark, Columns3, Download, GitMerge, Pencil, Plus, Search, Sigma, Trash2, Upload, X } from "lucide-react";
import type { SortingState } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/components/ui/dropdown-menu";
import { api, type ImportResult, type ImportTotals } from "./api";
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
import { ChartView } from "../ui/record-core/ChartView";
import type { ObjectConfig, RecordRow } from "../ui/record-core/types";
import { usePollRev } from "./usePollRev";
import { can, type Role } from "./permissions";
import { optionValues, normalizeOption } from "../ui/record-core/types";
import { activeFields } from "../ui/record-core/options";

/* ObjectView — the list surface: view bar (search · filter chip · count · view switch ·
   New) + table or kanban. GLANCE → ZOOM → ACT: status visible per row, one click to
   the record, edits in place. */

/* Minimal RFC-4180-ish CSV: quoted fields may hold commas, newlines and ""
   escapes; \n and \r\n both split rows; all-empty lines are dropped. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function ObjectView({
  config,
  users = [],
  role,
  onOpen,
  onCountChange,
  viewIcons,
}: {
  config: ObjectConfig;
  users?: string[];
  role?: Role;
  onOpen: (id: string, set?: string[]) => void;
  onCountChange: (key: string, n: number) => void;
  viewIcons: { table: React.ReactNode; kanban: React.ReactNode };
}) {
  const toast = useToast();
  // permission-driven affordances (the server is the real gate)
  const canCreate = can(role, config, "create");
  const canEdit = can(role, config, "edit");
  const canDelete = can(role, config, "delete");
  const canRestore = can(role, config, "restore");
  const canDestroy = can(role, config, "destroy");
  const canExport = can(role, config, "export");
  // Saved view v0: q + view kind persist per object (localStorage) and restore on
  // mount; a palette/relation jump can hand off a pending query via sessionStorage.
  const saved = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("nx-view-" + config.key) ?? "{}") as {
        q?: string;
        view?: "table" | "kanban" | "chart";
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
  const [view, setView] = React.useState<"table" | "kanban" | "chart">(saved.view ?? config.defaultView);
  const [hidden, setHidden] = React.useState<string[]>(saved.hidden ?? []);
  const [sort, setSort] = React.useState<SortingState>(saved.sort ?? []);
  const [selFilters, setSelFilters] = React.useState<Record<string, string[]>>(
    (saved as { selFilters?: Record<string, string[]> }).selFilters ?? {},
  );
  const [relOpts, setRelOpts] = React.useState<Record<string, string[]>>({});
  // board can group by ANY select/user field (stageField is just the default)
  const groupables = activeFields(config.fields).filter((f) => f.type === "select" || f.type === "user");
  const [groupBy, setGroupBy] = React.useState<string>(
    (saved as { groupBy?: string }).groupBy ?? config.stageField ?? groupables[0]?.key ?? "",
  );
  const groupFieldDef = config.fields.find((f) => f.key === groupBy);
  // chart measure: "count" or a numeric field key to SUM per group
  const numericFields = activeFields(config.fields).filter((f) => f.type === "number" || f.type === "currency");
  const [measure, setMeasure] = React.useState<string>(
    (saved as { measure?: string }).measure ?? "count",
  );
  const measureDef = numericFields.find((f) => f.key === measure);
  // kanban per-column rollup: fn over a numeric field (persisted per object)
  const [aggregate, setAggregate] = React.useState<{ fn: "sum" | "avg" | "min" | "max"; field: string } | null>(
    (saved as { aggregate?: { fn: "sum" | "avg" | "min" | "max"; field: string } | null }).aggregate ?? null,
  );
  // saved views (server-persisted, shareable)
  const [views, setViews] = React.useState<{ id: string; name: string; layout: string; state: Record<string, unknown> }[]>([]);
  const loadViews = React.useCallback(() => {
    api.views(config.key).then(setViews).catch(() => {});
  }, [config.key]);
  React.useEffect(loadViews, [loadViews]);
  const [savingView, setSavingView] = React.useState(false);
  const [viewName, setViewName] = React.useState("");
  // bulk edit dialog
  const [bulkEdit, setBulkEdit] = React.useState<{ field: string; value: string; running: boolean; done: number } | null>(null);
  const bulkCancel = React.useRef(false);
  const [creating, setCreating] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  // trash dialog: null = closed; rows load on open
  const [trash, setTrash] = React.useState<RecordRow[] | null>(null);
  // merge dialog: pick a winner among the selected, preview, commit
  const [merging, setMerging] = React.useState<{ ids: string[]; winnerId: string; fields: { key: string; label: string; value: unknown; source: string }[] | null } | null>(null);
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  // palette actions target the ACTIVE list via events (the palette lives app-level)
  React.useEffect(() => {
    const onNew = () => canCreate && setCreating(true);
    const onTrash = () => openTrashRef.current();
    window.addEventListener("nx-new-record", onNew);
    window.addEventListener("nx-open-trash", onTrash);
    return () => {
      window.removeEventListener("nx-new-record", onNew);
      window.removeEventListener("nx-open-trash", onTrash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate]);

  React.useEffect(() => {
    localStorage.setItem("nx-view-" + config.key, JSON.stringify({ q, view, hidden, sort, selFilters, groupBy, measure, aggregate }));
  }, [config.key, q, view, hidden, sort, selFilters, groupBy, measure, aggregate]);

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
      rows?.filter((r) =>
        activeSelFilters.every(([k, vals]) => {
          const v = r[k];
          // multiselect fields match on ANY overlap; scalar fields on equality
          return Array.isArray(v) ? v.some((x) => vals.includes(String(x))) : vals.includes(String(v ?? ""));
        }),
      ) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selFilters],
  );

  // only the LATEST load's response may commit — concurrent loads (user action +
  // rev poll) can resolve out of order and a stale response would win the state
  const loadSeq = React.useRef(0);
  const load = React.useCallback(() => {
    const seq = ++loadSeq.current;
    api
      .list(config.key, q ? { q } : {})
      .then((r) => {
        if (seq !== loadSeq.current) return;
        setRows(r);
        onCountChange(config.key, r.length);
      })
      .catch((e) => toast(`Load failed: ${e.message}`));
  }, [config.key, q, onCountChange, toast]);

  React.useEffect(load, [load]);
  // live sync: refetch when ANOTHER viewer/writer mutates this object (rev poll)
  usePollRev(config.key, load);
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

  const applyView = (state: Record<string, unknown>) => {
    setQ(String(state.q ?? ""));
    setView((state.view as "table" | "kanban" | "chart") ?? config.defaultView);
    setHidden((state.hidden as string[]) ?? []);
    setSort((state.sort as SortingState) ?? []);
    setSelFilters((state.selFilters as Record<string, string[]>) ?? {});
    setGroupBy(String(state.groupBy ?? config.stageField ?? groupables[0]?.key ?? ""));
    setMeasure(String(state.measure ?? "count"));
    setAggregate((state.aggregate as { fn: "sum" | "avg" | "min" | "max"; field: string } | null) ?? null);
  };
  const resetView = () => applyView({});
  const saveCurrentView = () => {
    if (!viewName.trim()) return;
    api
      .viewCreate({
        objectKey: config.key,
        name: viewName.trim(),
        layout: view,
        state: { q, view, hidden, sort, selFilters, groupBy, measure, aggregate },
      })
      .then(() => {
        toast(`View “${viewName.trim()}” saved`);
        setViewName("");
        setSavingView(false);
        loadViews();
      })
      .catch((e) => toast(e.message));
  };
  const runBulkEdit = async () => {
    if (!bulkEdit) return;
    const f = config.fields.find((x) => x.key === bulkEdit.field);
    if (!f) return;
    let value: unknown = bulkEdit.value;
    if (f.type === "number" || f.type === "currency") value = Number(bulkEdit.value);
    if (f.type === "boolean") value = bulkEdit.value === "true";
    setBulkEdit((b) => (b ? { ...b, running: true, done: 0 } : b));
    bulkCancel.current = false;
    let done = 0;
    for (const id of selectedIds) {
      if (bulkCancel.current) break;
      try {
        await api.patch(config.key, id, { [bulkEdit.field]: value });
        done++;
        setBulkEdit((b) => (b ? { ...b, done } : b));
      } catch (e) {
        toast(`Stopped at ${done}: ${(e as Error).message}`);
        break;
      }
    }
    toast(`Updated ${done} of ${selectedIds.length}`);
    setBulkEdit(null);
    setSelection({});
    load();
  };

  const exportCsv = () => {
    const chosen = rows?.filter((r) => selection[r.id]) ?? [];
    const cols = activeFields(config.fields).map((f) => f.key);
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

  const openTrash = () => {
    api.trash(config.key).then(setTrash).catch((e) => toast(e.message));
  };
  const openTrashRef = React.useRef(openTrash);
  openTrashRef.current = openTrash;
  const restoreRow = (id: string) => {
    api.restore(config.key, id).then(() => {
      toast(`${config.labelOne} restored`);
      openTrash();
      load();
    }).catch((e) => toast(`Restore failed: ${e.message}`));
  };
  const destroyRow = (id: string) => {
    api.destroy(config.key, id).then(() => {
      toast("Permanently deleted");
      openTrash();
    }).catch((e) => toast(`Destroy failed: ${e.message}`));
  };

  const openMerge = () => {
    const ids = selectedIds.slice(0, 10);
    setMerging({ ids, winnerId: ids[0], fields: null });
    api.mergePreview(config.key, ids, ids[0]).then((r) => {
      setMerging((m) => (m && m.winnerId === ids[0] ? { ...m, fields: r.fields } : m));
    }).catch((e) => toast(e.message));
  };
  const pickWinner = (id: string) => {
    setMerging((m) => (m ? { ...m, winnerId: id, fields: null } : m));
    api.mergePreview(config.key, merging?.ids ?? [], id).then((r) => {
      setMerging((m) => (m && m.winnerId === id ? { ...m, fields: r.fields } : m));
    }).catch((e) => toast(e.message));
  };
  const commitMerge = () => {
    if (!merging) return;
    api.merge(config.key, merging.ids, merging.winnerId).then((r) => {
      toast(`Merged ${r.merged} into one`);
      setMerging(null);
      setSelection({});
      load();
    }).catch((e) => toast(`Merge failed: ${e.message}`));
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" icon={<Bookmark size={13} />} data-testid="views-menu">
              Views{views.length > 0 ? ` · ${views.length}` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem checked={false} data-testid="view-all" onCheckedChange={() => resetView()}>
              All {config.label.toLowerCase()}
            </DropdownMenuCheckboxItem>
            {views.map((v) => (
              <DropdownMenuCheckboxItem
                key={v.id}
                checked={false}
                data-testid={`view-${v.id}`}
                onCheckedChange={() => applyView(v.state)}
              >
                <span style={{ flex: 1 }}>{v.name}</span>
                <button
                  type="button"
                  aria-label={`Delete view ${v.name}`}
                  data-testid={`view-del-${v.id}`}
                  style={{ border: 0, background: "none", cursor: "pointer", color: "var(--nx-fg-faint)", marginLeft: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    api.viewDelete(v.id).then(loadViews).catch((err) => toast(err.message));
                  }}
                >
                  <X size={11} />
                </button>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuCheckboxItem checked={false} data-testid="view-save" onCheckedChange={() => setSavingView(true)}>
              <Plus size={12} /> Save current as view…
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {activeFields(config.fields)
          .filter((f) => (f.type === "select" || f.type === "multiselect") && f.key !== config.stageField)
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
                  {(f.options ?? []).map((raw) => {
                    const o = normalizeOption(raw);
                    return (
                    <DropdownMenuCheckboxItem
                      key={o.value}
                      checked={active.includes(o.value)}
                      data-testid={`filter-${f.key}-${o.value.replaceAll(/\W+/g, "-").toLowerCase()}`}
                      onCheckedChange={(on) =>
                        setSelFilters((m) => ({
                          ...m,
                          [f.key]: on ? [...(m[f.key] ?? []), o.value] : (m[f.key] ?? []).filter((x) => x !== o.value),
                        }))
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {o.label}
                    </DropdownMenuCheckboxItem>
                    );
                  })}
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
        {groupables.length > 0 && (
          <div className="viewSwitch" data-testid="view-switch">
            <button data-active={view === "table"} onClick={() => setView("table")}>{viewIcons.table} Table</button>
            <button data-active={view === "kanban"} onClick={() => setView("kanban")}>{viewIcons.kanban} Board</button>
            <button data-active={view === "chart"} onClick={() => setView("chart")}><BarChart3 size={13} /> Chart</button>
          </div>
        )}
        {view === "chart" && numericFields.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" data-testid="measure-by">
                {measureDef ? `Σ ${measureDef.label}` : "Count"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={!measureDef}
                data-testid="measure-count"
                onCheckedChange={() => setMeasure("count")}
              >
                Count
              </DropdownMenuCheckboxItem>
              {numericFields.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.key}
                  checked={measure === f.key}
                  data-testid={`measure-${f.key}`}
                  onCheckedChange={() => setMeasure(f.key)}
                >
                  Σ {f.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {(view === "kanban" || view === "chart") && groupables.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" data-testid="group-by">
                by {groupFieldDef?.label ?? groupBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {groupables.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.key}
                  checked={groupBy === f.key}
                  data-testid={`group-by-${f.key}`}
                  onCheckedChange={() => setGroupBy(f.key)}
                >
                  {f.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {view === "kanban" && numericFields.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" icon={<Sigma size={13} />} data-testid="agg-by">
                {aggregate ? `${aggregate.fn} · ${config.fields.find((f) => f.key === aggregate.field)?.label ?? aggregate.field}` : "Rollup"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={!aggregate} data-testid="agg-none" onCheckedChange={() => setAggregate(null)}>
                None
              </DropdownMenuCheckboxItem>
              {numericFields.flatMap((f) =>
                (["sum", "avg", "min", "max"] as const).map((fn) => (
                  <DropdownMenuCheckboxItem
                    key={`${fn}-${f.key}`}
                    checked={aggregate?.fn === fn && aggregate.field === f.key}
                    data-testid={`agg-${fn}-${f.key}`}
                    onCheckedChange={() => setAggregate({ fn, field: f.key })}
                  >
                    {fn === "sum" ? "Sum" : fn === "avg" ? "Average" : fn === "min" ? "Min" : "Max"} of {f.label}
                  </DropdownMenuCheckboxItem>
                )),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="md" variant="ghost" icon={<ArchiveRestore size={14} />} data-testid="trash-open" onClick={openTrash} aria-label="Open trash" />
        {canCreate && (
        <Button size="md" variant="ghost" icon={<Upload size={14} />} data-testid="import-open" onClick={() => setImportOpen(true)}>
          {t("import.open")}
        </Button>
        )}
        {canCreate && (
        <Button variant="primary" size="md" icon={<Plus size={14} />} data-testid="new-record" onClick={() => setCreating(true)}>
          New {config.labelOne.toLowerCase()}
        </Button>
        )}
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
          {canExport && (
          <Button size="sm" icon={<Download size={13} />} data-testid="bulk-export" onClick={exportCsv}>
            {t("bulk.exportCsv")}
          </Button>
          )}
          {canEdit && (
          <Button size="sm" icon={<Pencil size={13} />} data-testid="bulk-edit" onClick={() => setBulkEdit({ field: "", value: "", running: false, done: 0 })}>
            Edit
          </Button>
          )}
          {canEdit && canDelete && selectedIds.length >= 2 && selectedIds.length <= 10 && (
          <Button size="sm" icon={<GitMerge size={13} />} data-testid="bulk-merge" onClick={openMerge}>
            Merge
          </Button>
          )}
          {canDelete && (
          <Button size="sm" variant="danger" icon={<Trash2 size={13} />} data-testid="bulk-delete" onClick={() => setConfirmingDelete(true)}>
            {t("bulk.delete")}
          </Button>
          )}
        </div>
      )}

      {visibleRows === null ? (
        <div className="nxCard" style={{ padding: 40, textAlign: "center", color: "var(--nx-fg-faint)" }} data-testid="list-loading">
          Loading {config.label.toLowerCase()}…
        </div>
      ) : view === "chart" && groupFieldDef ? (
        <ChartView
          config={config}
          rows={visibleRows}
          groupField={groupBy}
          groupOptions={groupFieldDef.type === "user" ? users : undefined}
          measure={measureDef ? measure : "count"}
        />
      ) : view === "kanban" && groupFieldDef ? (
        <KanbanBoard
          config={config}
          rows={visibleRows}
          onPatch={patch}
          onOpen={(id) => onOpen(id, visibleRows?.map((r) => String(r.id)))}
          groupField={groupBy}
          groupOptions={groupFieldDef.type === "user" ? users : undefined}
          readOnly={!canEdit}
          aggregate={aggregate ?? undefined}
        />
      ) : (
        <DataTable
          config={config}
          rows={visibleRows}
          onOpen={(id) => onOpen(id, visibleRows?.map((r) => String(r.id)))}
          onPeek={(id) => onOpen(id, visibleRows?.map((r) => String(r.id)))}
          onPatch={patch}
          readOnly={!canEdit}
          hiddenFields={hidden}
          sort={sort}
          onSortChange={setSort}
          selection={selection}
          onSelectionChange={setSelection}
        />
      )}

      {importOpen && (
        <ImportDialog
          config={config}
          onClose={(changed) => {
            setImportOpen(false);
            if (changed) load();
          }}
        />
      )}

      {trash !== null && (
        <Dialog
          open
          onOpenChange={(v) => { if (!v) setTrash(null); }}
          title={`Trash — ${config.label.toLowerCase()}`}
        >
          <div data-testid="trash-dialog">
          {trash.length === 0 ? (
            <div style={{ padding: 16, color: "var(--nx-fg-faint)" }} data-testid="trash-empty-state">
              Trash is empty. Deleted {config.label.toLowerCase()} land here and can be restored.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 380, overflowY: "auto" }}>
              {trash.map((r) => (
                <div key={r.id} data-testid={`trash-row-${r.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: "var(--nx-radius-s)", background: "var(--nx-bg-raised)" }}>
                  <span style={{ flex: 1, fontWeight: 500 }}>{String(r[primary.key] ?? r.id)}</span>
                  <span style={{ color: "var(--nx-fg-faint)", fontSize: 12 }}>
                    deleted {String(r._deletedAt ?? "").slice(0, 10)}
                  </span>
                  {canRestore && (
                    <Button size="sm" icon={<ArchiveRestore size={12} />} data-testid={`trash-restore-${r.id}`} onClick={() => restoreRow(r.id)}>
                      Restore
                    </Button>
                  )}
                  {canDestroy && (
                    <Button size="sm" variant="danger" data-testid={`trash-destroy-${r.id}`} onClick={() => destroyRow(r.id)}>
                      Delete forever
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </Dialog>
      )}

      {merging && (
        <Dialog open onOpenChange={(v) => { if (!v) setMerging(null); }} title={`Merge ${merging.ids.length} ${config.label.toLowerCase()}`}>
          <div style={{ display: "grid", gap: 12 }} data-testid="merge-dialog">
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, color: "var(--nx-fg-faint)" }}>Keep as the surviving record:</div>
              {merging.ids.map((mid) => {
                const r = rows?.find((x) => x.id === mid);
                return (
                  <label key={mid} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="merge-winner"
                      checked={merging.winnerId === mid}
                      data-testid={`merge-winner-${mid}`}
                      onChange={() => pickWinner(mid)}
                    />
                    <span>{String(r?.[primary.key] ?? mid)}</span>
                  </label>
                );
              })}
            </div>
            <div data-testid="merge-preview">
              {merging.fields === null ? (
                <div style={{ color: "var(--nx-fg-faint)", fontSize: 12 }}>Computing preview…</div>
              ) : (
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <tbody>
                    {merging.fields.map((f) => (
                      <tr key={f.key} style={{ borderTop: "1px solid var(--nx-border)" }}>
                        <td style={{ padding: "5px 8px", color: "var(--nx-fg-faint)", whiteSpace: "nowrap" }}>{f.label}</td>
                        <td style={{ padding: "5px 8px" }} data-testid={`merge-final-${f.key}`}>{String(f.value)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right" }}>
                          {f.source !== "winner" && <Badge>{`from ${f.source}`}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button onClick={() => setMerging(null)}>Cancel</Button>
              <Button variant="primary" data-testid="merge-go" disabled={merging.fields === null} onClick={commitMerge}>
                Merge — losers go to trash
              </Button>
            </div>
          </div>
        </Dialog>
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
        open={savingView}
        onOpenChange={setSavingView}
        title="Save current view"
        footer={
          <>
            <Button onClick={() => setSavingView(false)}>Cancel</Button>
            <Button variant="primary" data-testid="view-save-go" onClick={saveCurrentView} disabled={!viewName.trim()}>
              Save view
            </Button>
          </>
        }
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="nxMicro">Name</span>
          <Input data-testid="view-name" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Hot leads this quarter" />
          <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
            Captures the current layout, filters, sort, grouping and rollup — visible to the whole workspace.
          </span>
        </label>
      </Dialog>

      <Dialog
        open={!!bulkEdit}
        onOpenChange={(o) => { if (!o) { bulkCancel.current = true; setBulkEdit(null); } }}
        title={`Edit ${selectedIds.length} ${config.label.toLowerCase()}`}
        footer={
          <>
            <Button onClick={() => { bulkCancel.current = true; setBulkEdit(null); }}>Cancel</Button>
            <Button variant="primary" data-testid="bulk-edit-go" busy={bulkEdit?.running}
              onClick={runBulkEdit} disabled={!bulkEdit?.field || bulkEdit?.running}>
              {bulkEdit?.running ? `Updating ${bulkEdit.done}/${selectedIds.length}…` : "Update all"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="nxMicro">Field</span>
            <select
              className="nxInput"
              data-testid="bulk-edit-field"
              value={bulkEdit?.field ?? ""}
              onChange={(e) => setBulkEdit((b) => (b ? { ...b, field: e.target.value, value: "" } : b))}
            >
              <option value="">Pick a field…</option>
              {activeFields(config.fields)
                .filter((f) => ["text", "longText", "number", "currency", "select", "user", "email", "url", "boolean"].includes(f.type) && !f.primary)
                .map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
            </select>
          </label>
          {bulkEdit?.field && (() => {
            const f = config.fields.find((x) => x.key === bulkEdit.field);
            if (!f) return null;
            if (f.type === "select" || f.type === "user") {
              const opts = f.type === "user" ? users : optionValues(f.options);
              return (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="nxMicro">New value</span>
                  <select className="nxInput" data-testid="bulk-edit-value" value={bulkEdit.value}
                    onChange={(e) => setBulkEdit((b) => (b ? { ...b, value: e.target.value } : b))}>
                    <option value="">—</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              );
            }
            if (f.type === "boolean") {
              return (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="nxMicro">New value</span>
                  <select className="nxInput" data-testid="bulk-edit-value" value={bulkEdit.value}
                    onChange={(e) => setBulkEdit((b) => (b ? { ...b, value: e.target.value } : b))}>
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              );
            }
            return (
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="nxMicro">New value (empty clears the field)</span>
                <Input data-testid="bulk-edit-value" value={bulkEdit.value}
                  onChange={(e) => setBulkEdit((b) => (b ? { ...b, value: e.target.value } : b))} />
              </label>
            );
          })()}
        </div>
      </Dialog>

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
          {activeFields(config.fields)
            .filter((f) => !["json", "array", "rating", "boolean"].includes(f.type))
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
                    value={draft[f.key] ?? optionValues(f.options)[0] ?? ""}
                    data-testid={`new-${f.key}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  >
                    {(f.options ?? []).map((raw) => { const o = normalizeOption(raw); return (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ); })}
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

/* Import wizard — paste/pick a CSV, map columns to fields, preview the first
   rows against the server's validators, then run in chunks of 200 with a
   cancel between chunks (the bulk-edit pattern). Totals and failed rows
   accumulate across ALL chunks; failed rows download as CSV with a reason. */
function ImportDialog({ config, onClose }: { config: ObjectConfig; onClose: (changed: boolean) => void }) {
  const toast = useToast();
  const fields = activeFields(config.fields);
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];
  const [step, setStep] = React.useState<"input" | "map" | "preview" | "run" | "done">("input");
  const [text, setText] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [dataRows, setDataRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<string[]>([]); // per CSV column: field key or "" (skip)
  const [previewRes, setPreviewRes] = React.useState<ImportResult[] | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [totals, setTotals] = React.useState<ImportTotals>({ created: 0, restored: 0, skipped: 0, failed: 0 });
  const [failedRows, setFailedRows] = React.useState<{ cells: string[]; reason: string }[]>([]);
  const cancelRef = React.useRef(false);
  const changedRef = React.useRef(false);

  const parseInput = () => {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      toast("Need a header row plus at least one data row");
      return;
    }
    setHeaders(rows[0]);
    setDataRows(rows.slice(1));
    setMapping(
      rows[0].map((h) => {
        const n = h.trim().toLowerCase();
        const f = fields.find((x) => x.key.toLowerCase() === n || x.label.toLowerCase() === n);
        return f?.key ?? "";
      }),
    );
    setStep("map");
  };

  const mappedRow = React.useCallback(
    (cells: string[]) => {
      const o: Record<string, unknown> = {};
      mapping.forEach((fk, i) => {
        if (fk) o[fk] = cells[i] ?? "";
      });
      return o;
    },
    [mapping],
  );
  const primaryMapped = mapping.includes(primary.key);

  const toPreview = () => {
    api
      .importRows(config.key, dataRows.slice(0, 5).map(mappedRow), true)
      .then((r) => {
        setPreviewRes(r.results);
        setStep("preview");
      })
      .catch((e) => toast(e.message));
  };

  const run = async () => {
    setStep("run");
    cancelRef.current = false;
    // totals + failed rows accumulate across EVERY chunk — the summary is the
    // whole file, never just the last batch
    const agg: ImportTotals = { created: 0, restored: 0, skipped: 0, failed: 0 };
    const fails: { cells: string[]; reason: string }[] = [];
    for (let start = 0; start < dataRows.length; start += 200) {
      if (cancelRef.current) break;
      const chunk = dataRows.slice(start, start + 200);
      try {
        const r = await api.importRows(config.key, chunk.map(mappedRow));
        agg.created += r.totals.created;
        agg.restored += r.totals.restored;
        agg.skipped += r.totals.skipped;
        agg.failed += r.totals.failed;
        for (const res of r.results) {
          if (res.verdict === "failed") fails.push({ cells: chunk[res.index], reason: res.reason ?? "" });
        }
        if (r.totals.created + r.totals.restored > 0) changedRef.current = true;
        setProgress(Math.min(start + 200, dataRows.length));
        setTotals({ ...agg });
      } catch (e) {
        toast(`Import stopped at row ${start + 1}: ${(e as Error).message}`);
        break;
      }
    }
    setFailedRows(fails);
    setTotals({ ...agg });
    setStep("done");
  };

  const downloadFailed = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [
      [...headers, "reason"].map(esc).join(","),
      ...failedRows.map((f) => [...headers.map((_, i) => f.cells[i]), f.reason].map(esc).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${config.key}-import-failed.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const close = () => {
    cancelRef.current = true;
    onClose(changedRef.current);
  };
  const verdictTone = (v: ImportResult["verdict"]) =>
    v === "failed" ? "danger" : v === "skipped" ? undefined : "accent";

  return (
    <Dialog
      open
      onOpenChange={(v) => { if (!v) close(); }}
      title={t("import.title", { label: config.label })}
      footer={
        step === "input" ? (
          <>
            <Button onClick={close}>{t("import.cancel")}</Button>
            <Button variant="primary" data-testid="import-next" disabled={!text.trim()} onClick={parseInput}>
              {t("import.next")}
            </Button>
          </>
        ) : step === "map" ? (
          <>
            <Button data-testid="import-back" onClick={() => setStep("input")}>{t("import.back")}</Button>
            <Button variant="primary" data-testid="import-next" disabled={!primaryMapped} onClick={toPreview}>
              {t("import.next")}
            </Button>
          </>
        ) : step === "preview" ? (
          <>
            <Button data-testid="import-back" onClick={() => setStep("map")}>{t("import.back")}</Button>
            <Button variant="primary" data-testid="import-run" onClick={run}>
              {t("import.run", { n: dataRows.length })}
            </Button>
          </>
        ) : step === "run" ? (
          <Button data-testid="import-cancel" onClick={() => { cancelRef.current = true; }}>
            {t("import.cancel")}
          </Button>
        ) : (
          <Button variant="primary" data-testid="import-close" onClick={close}>
            {t("import.close")}
          </Button>
        )
      }
    >
      <div style={{ display: "grid", gap: 12, minWidth: 440 }} data-testid="import-dialog">
        {step === "input" && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="nxMicro">Paste CSV (first row = headers)</span>
              <textarea
                className="nxInput"
                data-testid="import-text"
                rows={8}
                placeholder={"name,email\nAda Example,ada@example.test"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ font: "var(--nx-text-meta)", fontFamily: "ui-monospace, monospace", resize: "vertical", minHeight: 120 }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
              or pick a file:
              <input
                type="file"
                accept=".csv,text/csv"
                data-testid="import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) f.text().then(setText).catch(() => toast("Could not read that file"));
                }}
              />
            </label>
          </>
        )}

        {step === "map" && (
          <div style={{ display: "grid", gap: 8 }}>
            {headers.map((h, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <code>{h || `(column ${i + 1})`}</code>
                </span>
                <select
                  className="nxInput"
                  data-testid={`import-map-${i}`}
                  value={mapping[i] ?? ""}
                  onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? e.target.value : v)))}
                >
                  <option value="">Skip</option>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
            {!primaryMapped && (
              <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-warn, var(--nx-fg-muted))" }}>
                Map a column to {primary.label} to continue.
              </span>
            )}
          </div>
        )}

        {step === "preview" && (
          <div data-testid="import-preview" style={{ display: "grid", gap: 6 }}>
            <span className="nxMicro">First {Math.min(5, dataRows.length)} of {dataRows.length} rows</span>
            {(previewRes ?? []).map((r) => (
              <div key={r.index} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 8px", borderRadius: "var(--nx-radius-s)", background: "var(--nx-bg-raised)" }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {String(mappedRow(dataRows[r.index])[primary.key] ?? "—")}
                </span>
                <Badge tone={verdictTone(r.verdict)}>{r.verdict}</Badge>
                {r.reason && <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-faint)" }}>{r.reason}</span>}
              </div>
            ))}
          </div>
        )}

        {step === "run" && (
          <div style={{ padding: 12, textAlign: "center" }} data-testid="import-progress">
            Importing… {progress} / {dataRows.length}
          </div>
        )}

        {step === "done" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div data-testid="import-summary" style={{ fontWeight: 600 }}>
              {t("import.summary", { ...totals })}
            </div>
            {failedRows.length > 0 && (
              <Button icon={<Download size={13} />} data-testid="import-failed-csv" onClick={downloadFailed}>
                {t("import.failedCsv")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
