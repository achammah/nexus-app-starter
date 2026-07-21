import * as React from "react";
import { ArchiveRestore, Bookmark, CopyCheck, Download, GitMerge, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/components/ui/dropdown-menu";
import { api, type AppObject, type DupGroup, type ImportResult, type ImportTotals } from "./api";
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
import { csvCell, formatCell } from "../ui/record-core/DataTable";
import { AddressField, FullNameField, ListField, MoneyField } from "../ui/record-core/fields/editors";
import { coerceDraft, isEmptyValue, listValidators, withStageDefault } from "../ui/record-core/fields/draft";
import { fieldTypeDefinitions } from "../ui/record-core/fields/registry";
import type { RelationItem } from "../ui/record-core/types";
import { getViewDefinition } from "../ui/record-core/views/registry";
import { groupableFields } from "../ui/record-core/views/group";
import { configuredViewsFor } from "../ui/record-core/views/resolve";
import type { ObjectConfig, RecordRow } from "../ui/record-core/types";
import { usePollRev } from "../ui/hooks/usePollRev";
import { useAsyncOp } from "../ui/hooks/useAsyncOp";
import { ThinkingDots } from "../ui/primitives/ThinkingDots";
import { FilterBar, FilterChips, matchFilters, filterableFields } from "../ui/record-core/Filters";
import type { FilterCond } from "../ui/record-core/Filters";
import { can, type Role } from "./permissions";
import { optionValues, normalizeOption } from "../ui/record-core/types";
import { activeFields } from "../ui/record-core/options";
import { textToBlocks } from "../ui/record-core/NotionEditor";
import { Wizard, ModalOverlay, type Ans } from "../ui/blocks/wizard";

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
  appConfig,
  config,
  users = [],
  role,
  onOpen,
  onCountChange,
}: {
  /* the whole app config — relation targets' primaries resolve create-dialog labels */
  appConfig?: { objects: ObjectConfig[] };
  config: AppObject;
  users?: string[];
  role?: Role;
  onOpen: (id: string, set?: string[]) => void;
  onCountChange: (key: string, n: number) => void;
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
      return JSON.parse(localStorage.getItem("nx-view-" + config.key) ?? "{}") as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }, [config.key]);
  const pendingQ = React.useMemo(() => {
    const v = sessionStorage.getItem("nx-pending-q");
    if (v !== null) sessionStorage.removeItem("nx-pending-q");
    return v;
  }, []);
  const [rows, setRows] = React.useState<RecordRow[] | null>(null);
  const [q, setQ] = React.useState(pendingQ ?? (saved.q as string | undefined) ?? "");
  const [selFilters, setSelFilters] = React.useState<Record<string, string[]>>(
    (saved.selFilters as Record<string, string[]> | undefined) ?? {},
  );
  // advanced filters: any column, type-aware operator, removable chips
  const [filters, setFilters] = React.useState<FilterCond[]>((saved.filters as FilterCond[] | undefined) ?? []);
  const filterFields = React.useMemo(() => filterableFields(activeFields(config.fields)), [config.fields]);
  const [relOpts, setRelOpts] = React.useState<Record<string, RelationItem[]>>({});
  /* the object's view tabs: config `views` when declared, else the derived
     pre-registry set (views/resolve.ts). Definitions come from the view registry. */
  const groupables = groupableFields(config);
  const configuredViews = React.useMemo(
    () => configuredViewsFor(config, groupables),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config],
  );
  const [view, setView] = React.useState<string>((saved.view as string | undefined) ?? config.defaultView);
  // a persisted view the object no longer offers falls back to the first tab
  const activeEntry = configuredViews.find((v) => v.type === view) ?? configuredViews[0];
  const activeDef = getViewDefinition(activeEntry.type);
  // this view instance's config: the `views` entry over the definition's defaults
  const viewConfig = React.useMemo(() => {
    const { type: _type, ...entry } = activeEntry;
    return { ...(activeDef?.defaultConfig?.(config) ?? {}), ...entry };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry, activeDef, config]);
  /* the per-view state bag — everything in the persisted blob beyond the filter
     layer (table: hidden/sort · board: groupBy/aggregate · chart: groupBy/measure;
     same-key views share, so the board and chart regroup together) */
  const [viewState, setViewState] = React.useState<Record<string, unknown>>(() => {
    const rest = { ...saved };
    delete rest.q; delete rest.view; delete rest.selFilters; delete rest.filters;
    return rest;
  });
  const onViewState = React.useCallback(
    (patch: Record<string, unknown>) => setViewState((s) => ({ ...s, ...patch })),
    [],
  );
  // a config error renders as the graceful chip; the toolbar hides with it
  const viewError = activeDef?.validateConfig?.(config, viewConfig) ?? null;
  const ViewToolbar = viewError ? undefined : activeDef?.Toolbar;
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
  // guided-create (config.createWizard): the wizard modal + its in-flight create
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardCreating, setWizardCreating] = React.useState(false);
  // async-generation (config.generate): the placeholder's id + whether we're polling
  // for its finished record to land from the warehouse (see fireGenerate / useAsyncOp)
  const [genInFlight, setGenInFlight] = React.useState(false);
  const [genId, setGenId] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  // trash dialog: null = closed; rows load on open
  const [trash, setTrash] = React.useState<RecordRow[] | null>(null);
  // merge dialog: pick a winner among the selected, preview, commit
  const [merging, setMerging] = React.useState<{ ids: string[]; winnerId: string; fields: { key: string; label: string; value: unknown; source: string }[] | null } | null>(null);
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];
  // display text for a row's primary value — shaped primaries (fullName) render joined, never "[object Object]"
  const primaryLabel = (r: RecordRow | undefined | null) => (r ? formatCell(r[primary.key], primary.type) || r.id : "");
  // create gate: a string primary needs text; a shaped primary (fullName) needs any non-empty part
  const draftHasPrimary = !isEmptyValue(draft[primary.key]);
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  // palette actions target the ACTIVE list via events (the palette lives app-level)
  React.useEffect(() => {
    const onNew = () => canCreate && (config.createWizard ? setWizardOpen(true) : setCreating(true));
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
    localStorage.setItem("nx-view-" + config.key, JSON.stringify({ q, view, selFilters, filters, ...viewState }));
  }, [config.key, q, view, selFilters, filters, viewState]);

  // relation items for the create dialog (fetched once the dialog opens) —
  // {id, label, type}: options save by ID, labels come from the target's
  // primary via formatCell (a fullName-primary target lists joined)
  React.useEffect(() => {
    if (!creating) return;
    config.fields
      .filter((f) => f.type === "relation" && !f.multiple)
      .forEach((f) => {
        const targets = f.relationTargets ?? (f.relation ? [f.relation] : []);
        Promise.all(
          targets.map(async (tKey) => {
            const target = appConfig?.objects.find((o) => o.key === tKey);
            const tPrimary = target ? target.fields.find((x) => x.primary) ?? target.fields[0] : undefined;
            const rows = await api.list(tKey).catch(() => [] as RecordRow[]);
            return rows.map((r) => ({
              id: r.id,
              label: tPrimary ? formatCell(r[tPrimary.key], tPrimary.type) || r.id : String(r.name ?? r.title ?? r.id),
              type: tKey,
              typeLabel: target?.labelOne ?? tKey,
            }));
          }),
        )
          .then((lists) => setRelOpts((m) => ({ ...m, [f.key]: lists.flat() })))
          .catch(() => {});
      });
  }, [creating, config.fields, appConfig]);

  const activeSelFilters = Object.entries(selFilters).filter(([, vals]) => vals.length > 0);
  const visibleRows = React.useMemo(
    () =>
      rows?.filter((r) =>
        activeSelFilters.every(([k, vals]) => {
          const v = r[k];
          // multiselect fields match on ANY overlap; scalar fields on equality
          return Array.isArray(v) ? v.some((x) => vals.includes(String(x))) : vals.includes(String(v ?? ""));
        }) && matchFilters(r, filters),
      ) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selFilters, filters],
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

  /* async-generation (config.generate): fire it — a placeholder row drops NOW (status
     = "generating") — then poll syncStore()+reload until the finished record lands from
     the warehouse and the row's status moves off the generating value. useAsyncOp drives
     the poll + the "taking longer than usual" stall hint. Objects with no `generate`
     config never enter this path (genInFlight stays false → the hook is inert). */
  const gen = config.generate;
  const fireGenerate = React.useCallback(() => {
    if (!gen || genInFlight) return;
    setGenInFlight(true);
    setGenId(null);
    api
      .generate(config.key)
      .then((row) => { setGenId(row.id); load(); }) // placeholder shows on the next paint
      .catch((e) => { setGenInFlight(false); toast(`Generation failed to start: ${e.message}`); });
  }, [gen, genInFlight, config.key, load, toast]);
  const genOp = useAsyncOp(genInFlight, {
    pollFn: async () => { await api.syncStore(); load(); },
    everyMs: 2000,
    stallAfterMs: gen?.stallAfterMs ?? 8000,
  });
  // settle: the placeholder row is present AND its status left the generating value
  React.useEffect(() => {
    if (!genInFlight || !gen || !genId) return;
    const cur = rows?.find((r) => r.id === genId)?.[gen.statusField];
    const generating = gen.generating ?? "Generating";
    if (cur !== undefined && cur !== generating) {
      setGenInFlight(false);
      setGenId(null);
      toast(t("gen.ready", { label: config.labelOne }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, genInFlight, genId, gen]);
  // live sync: refetch when ANOTHER viewer/writer mutates this object (rev poll)
  usePollRev(() => api.rev(config.key).then((r) => r.rev), load, config.key);
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
    setView((state.view as string | undefined) ?? config.defaultView);
    setSelFilters((state.selFilters as Record<string, string[]> | undefined) ?? {});
    setFilters((state.filters as FilterCond[] | undefined) ?? []);
    const rest = { ...state };
    delete rest.q; delete rest.view; delete rest.selFilters; delete rest.filters;
    setViewState(rest);
  };
  const resetView = () => applyView({});
  const saveCurrentView = () => {
    if (!viewName.trim()) return;
    api
      .viewCreate({
        objectKey: config.key,
        name: viewName.trim(),
        layout: view,
        state: { q, view, selFilters, filters, ...viewState },
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
    const cols = activeFields(config.fields);
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    // shaped values flatten (money → "amount code"; lists → "a; b"; address/fullName joined) BEFORE quoting
    const csv = [cols.map((f) => f.key).join(","), ...chosen.map((r) => cols.map((f) => esc(csvCell(r[f.key], f.type))).join(","))].join("\n");
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

  const openMergeWith = (chosen: string[]) => {
    const ids = chosen.slice(0, 10);
    setMerging({ ids, winnerId: ids[0], fields: null });
    api.mergePreview(config.key, ids, ids[0]).then((r) => {
      setMerging((m) => (m && m.winnerId === ids[0] ? { ...m, fields: r.fields } : m));
    }).catch((e) => toast(e.message));
  };
  const openMerge = () => openMergeWith(selectedIds);

  // duplicate sweep dialog state (groups from the read-only server sweep)
  const [dupGroups, setDupGroups] = React.useState<DupGroup[] | null>(null);
  const openSweep = () => {
    api.duplicateGroups(config.key).then(setDupGroups).catch((e) => toast(e.message));
  };

  /* record-panel handoff: a "Review merge" click on the Possible-duplicates
     section lands here with the pair in sessionStorage — select it and (rights
     permitting) open the merge dialog preselected. Selection alone for viewers:
     the panel informs everyone, merge rights gate the dialog. */
  const pendingMergeDone = React.useRef(false);
  React.useEffect(() => {
    if (!rows || pendingMergeDone.current) return;
    const raw = sessionStorage.getItem("nx-pending-merge");
    if (!raw) return;
    pendingMergeDone.current = true;
    sessionStorage.removeItem("nx-pending-merge");
    try {
      const ids = (JSON.parse(raw) as string[]).filter((x) => rows.some((r) => r.id === x));
      if (ids.length >= 2) {
        setSelection(Object.fromEntries(ids.map((x) => [x, true])));
        if (canEdit && canDelete) openMergeWith(ids);
      }
    } catch { /* malformed handoff — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
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
    // shared draft pipeline: typed strings coerce (a number field's "50" saves as
    // 50, not a string the server rejects) and an unset kanban stage defaults
    const body = withStageDefault(config, coerceDraft(config.fields, draft, { defs: fieldTypeDefinitions }));
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

  // guided create: each wizard answer fills the field named by its question key,
  // through the SAME draft pipeline as the plain dialog (a text/long answer to a
  // richText field becomes a one-paragraph value; typed numbers coerce; an unset
  // kanban stage defaults).
  const createFromWizard = (answers: Ans) => {
    const raw: Record<string, unknown> = {};
    for (const qq of config.createWizard?.questions ?? []) raw[qq.key] = answers[qq.key];
    const body = withStageDefault(config, coerceDraft(config.fields, raw, { richText: textToBlocks, defs: fieldTypeDefinitions }));
    setWizardCreating(true);
    api
      .create(config.key, body)
      .then((row) => {
        setWizardCreating(false);
        setWizardOpen(false);
        toast(`${config.labelOne} created`);
        load();
        onOpen(row.id);
      })
      .catch((e) => {
        setWizardCreating(false);
        toast(`Create failed: ${e.message}`);
      });
  };

  return (
    <div>
      <div className="pageHead">
        <h1 className="pageTitle">{config.label}</h1>
        <span className="nxCount" data-testid="row-count">{rows ? `${rows.length}` : "…"}</span>
      </div>

      <div className="nxViewBar">
        {/* ONE search box: free-text narrows the list AND, in the same dropdown, offers
            "Field is Value" filters — the FilterBar owns both. Carries the list-search testid. */}
        <div style={{ flex: "0 1 360px", minWidth: 240 }}>
          <FilterBar fields={filterFields} value={filters} onChange={setFilters} search={q} onSearch={setQ} searchTestId="list-search" />
        </div>
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
        {/* the active view's own controls flank the switcher: side "lead" renders
            left of it (the table's Columns menu), side "trail" right of it
            (group-by / measure / rollup) — the definition owns the content */}
        {ViewToolbar && (
          <ViewToolbar object={config} users={users} viewConfig={viewConfig} viewState={viewState} onViewState={onViewState} side="lead" />
        )}
        {configuredViews.length > 1 && (
          <div className="viewSwitch" data-testid="view-switch">
            {configuredViews.map((v) => {
              const d = getViewDefinition(v.type);
              return (
                <button key={v.type} data-active={activeEntry.type === v.type} onClick={() => setView(v.type)}>
                  {d?.icon} {d?.label ?? v.type}
                </button>
              );
            })}
          </div>
        )}
        {ViewToolbar && (
          <ViewToolbar object={config} users={users} viewConfig={viewConfig} viewState={viewState} onViewState={onViewState} side="trail" />
        )}
        <Button size="md" variant="ghost" icon={<ArchiveRestore size={14} />} data-testid="trash-open" onClick={openTrash} aria-label="Open trash" />
        {canCreate && (
        <Button size="md" variant="ghost" icon={<Upload size={14} />} data-testid="import-open" onClick={() => setImportOpen(true)}>
          {t("import.open")}
        </Button>
        )}
        <Button size="md" variant="ghost" icon={<CopyCheck size={14} />} data-testid="dup-sweep-open" onClick={openSweep}>
          {t("dup.open")}
        </Button>
        {gen && canCreate && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Button
            size="md"
            variant="ghost"
            icon={<Sparkles size={14} />}
            data-testid="generate-record"
            onClick={fireGenerate}
            disabled={genInFlight}
          >
            {gen.label ?? t("gen.action", { label: config.labelOne.toLowerCase() })}
          </Button>
          {genInFlight && (
            <span
              data-testid="generate-status"
              data-stalled={genOp.stalled ? "1" : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--nx-text-meta)", color: "var(--nx-fg-faint)", whiteSpace: "nowrap" }}
            >
              <ThinkingDots label={t("gen.working")} />
              {genOp.stalled ? t("gen.stalled") : t("gen.working")}
            </span>
          )}
        </span>
        )}
        {canCreate && (
        <Button variant="primary" size="md" icon={<Plus size={14} />} data-testid="new-record" onClick={() => (config.createWizard ? setWizardOpen(true) : setCreating(true))}>
          New {config.labelOne.toLowerCase()}
        </Button>
        )}
      </div>

      <FilterChips fields={filterFields} value={filters} onChange={setFilters} />

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
      ) : !activeDef || viewError ? (
        /* a `views` entry naming an uninstalled type, or one its definition
           rejects, degrades to this chip — the rest of the list surface stands.
           nx-pop-in: the established chip entrance (spring ease, reduced-motion
           guarded by the motion.css blanket) */
        <div
          className="nxCard nx-pop-in"
          data-testid="view-unknown"
          style={{ padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 8, color: "var(--nx-fg-muted)", font: "var(--nx-text-meta)" }}
        >
          {viewError ?? t("views.notInstalled", { type: activeEntry.type })}
        </div>
      ) : (
        /* new view types may ship React.lazy components; the built-in three are
           static, so this fallback never paints for them */
        <React.Suspense
          fallback={
            <div className="nxCard" style={{ padding: 40, textAlign: "center", color: "var(--nx-fg-faint)" }} data-testid="list-loading">
              Loading {config.label.toLowerCase()}…
            </div>
          }
        >
          <activeDef.component
            object={config}
            rows={visibleRows}
            users={users}
            readOnly={!canEdit}
            viewConfig={viewConfig}
            viewState={viewState}
            onViewState={onViewState}
            onOpen={(id) => onOpen(id, visibleRows.map((r) => String(r.id)))}
            onPeek={(id) => onOpen(id, visibleRows.map((r) => String(r.id)))}
            onPatch={patch}
            /* a view's create affordance (the calendar's day-click) seeds the
               PLAIN create dialog — the wizard flow has no prefill seam */
            onCreateDraft={canCreate ? (prefill?: Record<string, unknown>) => { setDraft(prefill ?? {}); setCreating(true); } : undefined}
            selection={selection}
            onSelectionChange={setSelection}
            onCreate={
              canCreate
                ? (body) => api.create(config.key, body).then((row) => { load(); return row; })
                : undefined
            }
          />
        </React.Suspense>
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
                  <span style={{ flex: 1, fontWeight: 500 }}>{primaryLabel(r)}</span>
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

      {dupGroups !== null && (
        <Dialog
          open
          onOpenChange={(v) => { if (!v) setDupGroups(null); }}
          title={t("dup.title", { label: config.label.toLowerCase() })}
        >
          <div data-testid="dup-sweep-dialog" style={{ display: "grid", gap: 10, minWidth: 420 }}>
            {dupGroups.length === 0 && (
              <div data-testid="dup-sweep-empty" style={{ padding: 16, color: "var(--nx-fg-faint)" }}>
                {t("dup.none")}
              </div>
            )}
            {dupGroups.map((g, i) => (
              <div className="nxCard" key={g.ids.join(":")} data-testid={`dup-group-${i}`} style={{ padding: 12, display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {g.ids.map((x) => formatCell(rows?.find((r) => r.id === x)?.[primary.key], primary.type) || x).join("  ·  ")}
                </span>
                <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>{g.reasons.join(" · ")}</span>
                {canEdit && canDelete && (
                  <Button
                    size="sm"
                    icon={<GitMerge size={12} />}
                    data-testid={`dup-group-merge-${i}`}
                    style={{ justifySelf: "start" }}
                    onClick={() => {
                      setDupGroups(null);
                      setSelection(Object.fromEntries(g.ids.map((x) => [x, true])));
                      openMergeWith(g.ids);
                    }}
                  >
                    {t("dup.review")}
                  </Button>
                )}
              </div>
            ))}
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
                    <span>{r ? primaryLabel(r) : mid}</span>
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
                        <td style={{ padding: "5px 8px" }} data-testid={`merge-final-${f.key}`}>{csvCell(f.value, config.fields.find((x) => x.key === f.key)?.type ?? "text")}</td>
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
                  .map((r) => primaryLabel(r))
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

      {wizardOpen && config.createWizard && (
        <ModalOverlay
          testId="create-wizard"
          label={t("wizard.landingTitle", { label: config.labelOne.toLowerCase() })}
          onClose={() => setWizardOpen(false)}
        >
          <Wizard
            title={t("wizard.landingTitle", { label: config.labelOne.toLowerCase() })}
            questions={config.createWizard.questions}
            completing={wizardCreating}
            completeLabel={t("wizard.complete", { label: config.labelOne.toLowerCase() })}
            landing={{
              title: t("wizard.landingTitle", { label: config.labelOne.toLowerCase() }),
              hint: t("wizard.landingHint"),
              guidedLabel: t("wizard.guided"),
              guidedDesc: t("wizard.guidedDesc"),
              blankLabel: t("wizard.blank"),
              blankDesc: t("wizard.blankDesc", { label: config.labelOne.toLowerCase() }),
              onBlank: () => { setWizardOpen(false); setCreating(true); },
            }}
            onComplete={createFromWizard}
          />
        </ModalOverlay>
      )}

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={`New ${config.labelOne.toLowerCase()}`}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" data-testid="create-confirm" onClick={create} disabled={!draftHasPrimary}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activeFields(config.fields)
            .filter((f) => !["json", "array", "rating", "boolean"].includes(f.type) && !(f.type === "relation" && f.multiple))
            .slice(0, 6)
            .map((f) => (
              <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="nxMicro">{f.label}</span>
                {f.type === "relation" ? (
                  // saves the target's ID (grouped by type when polymorphic)
                  <select
                    className="nxInput"
                    value={typeof draft[f.key] === "object" && draft[f.key] !== null ? `${(draft[f.key] as { object: string }).object}:${(draft[f.key] as { id: string }).id}` : String(draft[f.key] ?? "")}
                    data-testid={`new-${f.key}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft((d) => ({
                        ...d,
                        [f.key]: !v ? "" : f.relationTargets ? { object: v.split(":")[0], id: v.split(":")[1] } : v,
                      }));
                    }}
                  >
                    <option value="">—</option>
                    {f.relationTargets ? (
                      [...new Set((relOpts[f.key] ?? []).map((o) => o.type))].map((t) => (
                        <optgroup key={t} label={(relOpts[f.key] ?? []).find((o) => o.type === t)?.typeLabel ?? t}>
                          {(relOpts[f.key] ?? []).filter((o) => o.type === t).map((o) => (
                            <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      (relOpts[f.key] ?? []).map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))
                    )}
                  </select>
                ) : f.type === "select" ? (
                  <select
                    className="nxInput"
                    value={String(draft[f.key] ?? optionValues(f.options)[0] ?? "")}
                    data-testid={`new-${f.key}`}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  >
                    {(f.options ?? []).map((raw) => { const o = normalizeOption(raw); return (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ); })}
                  </select>
                ) : f.type === "money" ? (
                  <MoneyField fieldKey={`new-${f.key}`} label={f.label} value={draft[f.key]} onSave={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                ) : f.type === "emails" || f.type === "phones" || f.type === "links" ? (
                  <ListField
                    fieldKey={`new-${f.key}`}
                    label={f.label}
                    value={draft[f.key]}
                    placeholder={f.type === "emails" ? "Add an email…" : f.type === "phones" ? "Add a phone…" : "Add a URL…"}
                    validate={listValidators[f.type](f.label)}
                    onSave={(vals) => setDraft((d) => ({ ...d, [f.key]: vals }))}
                  />
                ) : f.type === "address" ? (
                  <AddressField fieldKey={`new-${f.key}`} label={f.label} value={draft[f.key]} onSave={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                ) : f.type === "fullName" ? (
                  <FullNameField fieldKey={`new-${f.key}`} label={f.label} value={draft[f.key]} onSave={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                ) : (
                  <Input
                    data-testid={`new-${f.key}`}
                    value={String(draft[f.key] ?? "")}
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
