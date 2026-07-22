import * as React from "react";
import { RotateCcw } from "lucide-react";
import { api, type PageConfig } from "../api";
import { t } from "../i18n";
import { Button } from "../../ui/primitives/Button";
import { Tip } from "../../ui/primitives/fields";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import FlowView from "../../ui/record-core/views/flow/FlowView";
import type { ObjectConfig, RecordRow } from "../../ui/record-core/types";
import { flowDocKey, flowViewKey } from "./pageHost";

/* Free-surface flow page — a standalone node graph whose nodes are STORED CONTENT
   (not records): the same full-fidelity FlowView the record view uses, driven by an
   in-memory record-store adapter over a per-page app-state document. Create nodes,
   drag, draw edges (a self-relation), inline-rename, open the node detail panel,
   switch layouts, search — every FlowView capability, backed by app_state instead of
   the record store. This is the config.pages[] { kind:"flow" } host; a lazy chunk
   (xyflow is heavy). The node document persists external-writer-tolerant (one key). */

interface FlowNodeRow extends RecordRow {
  title: string;
  kind: string;
  note?: string;
  connectsTo: string[];
}
interface FlowDoc { nodes: FlowNodeRow[] }
const isFlowDoc = (x: unknown): x is FlowDoc =>
  !!x && typeof x === "object" && Array.isArray((x as FlowDoc).nodes);

/* the synthetic object powering the graph: a self-relation (`connectsTo`) supplies
   the edges — FlowView's edge-draw wires source→target by writing this field. Colors
   + per-type shapes come from the `kind` select. Every capability is config-declared,
   overridable via page.view (client tailors layouts / detail fields / animation). */
function flowObject(page: PageConfig): ObjectConfig {
  const key = `__flow_${page.key}`;
  return {
    key,
    label: page.label,
    labelOne: "Node",
    defaultView: "flow",
    fields: [
      { key: "title", label: "Title", type: "text", primary: true },
      {
        key: "kind", label: "Type", type: "select",
        options: [
          { value: "System", color: "blue" },
          { value: "Service", color: "purple" },
          { value: "Data store", color: "green" },
          { value: "Queue", color: "yellow" },
          { value: "External", color: "orange" },
        ],
      },
      { key: "note", label: "Note", type: "longText" },
      { key: "connectsTo", label: "Connects to", type: "relation", relation: key, multiple: true },
    ],
    views: [
      {
        type: "flow",
        relationField: "connectsTo",
        nodeColorField: "kind",
        nodeShapeField: "kind",
        detailFields: ["kind", "note"],
        enabledLayouts: ["hierarchical", "force", "grid"],
        defaultLayout: "force",
        edgeStyle: "smoothstep",
        animated: true,
        edgeLabels: false,
        handEdit: true,
        edgeDraw: true,
        nodeDetail: true,
        ...(page.view ?? {}),
      },
    ],
  };
}

/* seed a dense, realistic architecture map: nodes + directed links (from → to,
   modelled as the target's `connectsTo`, so FlowView draws source→target). */
function seedSystemMap(): FlowDoc {
  const N: [string, string, string][] = [
    ["web", "Web app", "System"], ["cdn", "CDN edge", "System"], ["mobile", "Mobile app", "System"],
    ["api", "API gateway", "Service"], ["auth", "Auth service", "Service"], ["billing", "Billing service", "Service"],
    ["notif", "Notification svc", "Service"], ["search", "Search service", "Service"], ["worker", "Async worker", "Service"],
    ["pg", "Postgres", "Data store"], ["redis", "Redis cache", "Data store"], ["s3", "Object store", "Data store"],
    ["es", "Elastic index", "Data store"], ["dw", "Data warehouse", "Data store"],
    ["queue", "Event queue", "Queue"],
    ["stripe", "Stripe", "External"], ["sendgrid", "SendGrid", "External"], ["maps", "Maps API", "External"],
  ];
  const nodes: FlowNodeRow[] = N.map(([id, title, kind]) => ({ id, title, kind, note: "", connectsTo: [] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const link = (from: string, to: string) => byId.get(to)?.connectsTo.push(from);
  const E: [string, string][] = [
    ["web", "api"], ["mobile", "api"], ["web", "cdn"], ["cdn", "s3"],
    ["api", "auth"], ["api", "billing"], ["api", "notif"], ["api", "search"], ["api", "worker"], ["api", "maps"],
    ["auth", "pg"], ["auth", "redis"], ["billing", "pg"], ["billing", "stripe"],
    ["notif", "queue"], ["notif", "sendgrid"], ["search", "es"], ["worker", "queue"], ["worker", "pg"], ["worker", "dw"],
    ["queue", "worker"], ["worker", "s3"],
  ];
  E.forEach(([f, tgt]) => link(f, tgt));
  // a couple of notes so the detail panel opens on real content
  byId.get("api")!.note = "Public edge. Rate-limited, auth-checked. Fans out to the domain services.";
  byId.get("billing")!.note = "Owns invoices + subscriptions. Calls Stripe; writes to Postgres.";
  return { nodes };
}

const newId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* a genuinely NEW page (no demoSeed) opens on a single starter node, not the demo
   graph — so the canvas + its add-node/edge-draw tools render (FlowView's zero-row
   empty state has no add affordance), while never cloning the System Map demo. */
const emptyFlowDoc = (title: string): FlowDoc => ({ nodes: [{ id: newId(), title, kind: "System", note: "", connectsTo: [] }] });

export default function FlowPage({ page }: { page: PageConfig }) {
  const KEY = flowDocKey(page.key);
  const VKEY = flowViewKey(page.key);
  const object = React.useMemo(() => flowObject(page), [page]);
  const viewConfig = React.useMemo(() => {
    const { type: _t, ...entry } = object.views![0];
    return entry as Record<string, unknown>;
  }, [object]);

  const [doc, setDoc] = React.useState<FlowDoc | null>(null);
  const [viewState, setViewStateRaw] = React.useState<Record<string, unknown>>({});
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");

  const docTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const vsTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistDoc = React.useCallback((next: FlowDoc) => {
    setSaveState("saving");
    if (docTimer.current) clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => {
      api.setState(KEY, next).then(() => setSaveState("saved")).catch(() => setSaveState("idle"));
    }, 550);
  }, [KEY]);
  const persistVs = React.useCallback((next: Record<string, unknown>) => {
    if (vsTimer.current) clearTimeout(vsTimer.current);
    vsTimer.current = setTimeout(() => { api.setState(VKEY, next).catch(() => {}); }, 550);
  }, [VKEY]);
  React.useEffect(() => () => {
    if (docTimer.current) clearTimeout(docTimer.current);
    if (vsTimer.current) clearTimeout(vsTimer.current);
  }, []);

  // load once: stored doc → live · never-set/corrupt → seed the demo map + persist
  React.useEffect(() => {
    let live = true;
    api.state().then((s) => {
      if (!live) return;
      const d = s[KEY];
      if (isFlowDoc(d)) setDoc(d);
      else { const seed = page.demoSeed ? seedSystemMap() : emptyFlowDoc(page.label); setDoc(seed); api.setState(KEY, seed).catch(() => {}); }
      const vs = s[VKEY];
      setViewStateRaw(vs && typeof vs === "object" && !Array.isArray(vs) ? (vs as Record<string, unknown>) : {});
    }).catch(() => { if (live) setDoc(page.demoSeed ? seedSystemMap() : emptyFlowDoc(page.label)); });
    return () => { live = false; };
  }, [KEY, VKEY, page.demoSeed, page.label]);

  // rows for FlowView: the graph draws edges from `_refs` (the id decoration the record
  // API would add), so mirror `connectsTo` into `_refs` here — that is what makes
  // edge-draw + the derived graph work over an in-memory store.
  const rows = React.useMemo<RecordRow[]>(
    () => (doc?.nodes ?? []).map((n) => ({ ...n, _refs: { connectsTo: n.connectsTo ?? [] } })),
    [doc],
  );

  const mutate = React.useCallback((fn: (nodes: FlowNodeRow[]) => FlowNodeRow[]) => {
    setDoc((d) => { const next = { nodes: fn(d?.nodes ?? []) }; persistDoc(next); return next; });
  }, [persistDoc]);

  const onCreate = React.useCallback((body: Record<string, unknown>) => {
    const row: FlowNodeRow = {
      id: newId(),
      title: typeof body.title === "string" && body.title ? body.title : "New node",
      kind: typeof body.kind === "string" && body.kind ? body.kind : "System",
      note: "",
      connectsTo: [],
    };
    mutate((nodes) => [...nodes, row]);
    return Promise.resolve({ ...row, _refs: { connectsTo: [] } } as RecordRow);
  }, [mutate]);

  const onPatch = React.useCallback((id: string, patch: Record<string, unknown>) => {
    mutate((nodes) => nodes.map((n) => (n.id === id ? { ...n, ...patch } as FlowNodeRow : n)));
  }, [mutate]);

  const onDelete = React.useCallback((id: string) => {
    mutate((nodes) => nodes.filter((n) => n.id !== id).map((n) => ({ ...n, connectsTo: (n.connectsTo ?? []).filter((x) => x !== id) })));
    setSelection((s) => { const { [id]: _drop, ...rest } = s; return rest; });
  }, [mutate]);

  const onViewState = React.useCallback((patch: Record<string, unknown>) => {
    setViewStateRaw((vs) => { const next = { ...vs, ...patch }; persistVs(next); return next; });
  }, [persistVs]);

  const reset = React.useCallback(() => {
    const seed = page.demoSeed ? seedSystemMap() : emptyFlowDoc(page.label);
    setDoc(seed); setViewStateRaw({}); setSelection({});
    persistDoc(seed); persistVs({});
  }, [persistDoc, persistVs, page.demoSeed, page.label]);

  const noop = React.useCallback(() => {}, []);

  const bar = (
    <div className="nxPageBar" data-testid="flow-page-bar">
      <span className="nxPageBarTitle">{page.label}</span>
      <span className="nxSpacer" style={{ flex: 1 }} />
      <span className="nxWorkbookSave" data-state={saveState} data-testid="flow-page-save">
        {saveState === "saving" ? <ThinkingDots label={t("page.saving")} /> : null}
        {saveState === "saving" ? t("page.saving") : saveState === "saved" ? t("page.saved") : ""}
      </span>
      <Tip label={t("page.flow.reset")}>
        <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} aria-label={t("page.flow.reset")} data-testid="flow-page-reset" onClick={reset} />
      </Tip>
    </div>
  );

  return (
    <div className="pageBleed nxCanvasPage" data-testid={`page-flow-${page.key}`}>
      {bar}
      {doc === null ? (
        <div className="nxPageLoading nx-rise-in-sm" data-testid="flow-page-loading">
          <ThinkingDots label={t("page.generic.loading")} />
          <span>{t("page.generic.loading")}</span>
        </div>
      ) : (
        <div className="nxCanvasPageBody">
          <FlowView
            object={object}
            rows={rows}
            users={[]}
            readOnly={false}
            viewConfig={viewConfig}
            viewState={viewState}
            onViewState={onViewState}
            onOpen={noop}
            onPeek={noop}
            onPatch={onPatch}
            onCreate={onCreate}
            onDelete={onDelete}
            selection={selection}
            onSelectionChange={setSelection}
          />
        </div>
      )}
    </div>
  );
}
