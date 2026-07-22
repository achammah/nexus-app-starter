import * as React from "react";
import { api, type AppConfig, type PageConfig } from "../api";
import { t } from "../i18n";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import { getViewDefinition } from "../../ui/record-core/views/registry";
import type { ObjectConfig, RecordRow, SelectOption, OptionColor } from "../../ui/record-core/types";
import { activeFields } from "../../ui/record-core/options";
import { inferCoordFields } from "../../ui/record-core/views/map/geo";
import { firstDateField } from "../../ui/record-core/views/calendar/events";
import { pageViewKey } from "./pageHost";

/* Aggregate page — every record ACROSS one or more `source` objects on ONE surface
   (every deal + every session on a single calendar; every site on a single map). The
   config.pages[] { kind:"map"|"calendar", source } host. It reuses the same full
   MapView / CalendarView the record view uses — a first-class page, not a reduced
   embed. Lazy chunk (maplibre / fullcalendar are heavy).

   SINGLE source → the object's REAL config drives the surface (its tuned map/calendar
   view, full editing). MULTIPLE sources → records normalize onto canonical fields and
   color BY SOURCE, so heterogeneous objects share one surface; open routes to the real
   record, and a reschedule/edit writes back through the real object. Create is OFF on
   an aggregate (which object would it create into?) — the surface is view + open + edit;
   creating routes to the object's own page. */

const SRC_COLORS: OptionColor[] = ["blue", "green", "orange", "purple", "teal", "pink", "red", "yellow"];

type Decoded = { obj: string; id: string };
interface AggModel {
  object: ObjectConfig;
  viewConfig: Record<string, unknown>;
  rows: RecordRow[];
  decode: (synthId: string) => Decoded | null;
  /* map a synthetic patch (canonical keys) → the real object + record + real-field patch */
  translate: (synthId: string, patch: Record<string, unknown>) => { obj: string; id: string; realPatch: Record<string, unknown> } | null;
}

/* per-source field mapping resolved from the object's own configured view (falls back
   to inference), so an aggregate reads each object exactly as its record view would */
function mapMapping(obj: ObjectConfig) {
  const v = obj.views?.find((x) => x.type === "map");
  const inf = inferCoordFields(obj);
  const primary = obj.fields.find((f) => f.primary) ?? obj.fields[0];
  return {
    lat: (typeof v?.latField === "string" ? v.latField : undefined) ?? inf.latField,
    lng: (typeof v?.lngField === "string" ? v.lngField : undefined) ?? inf.lngField,
    title: (typeof v?.titleField === "string" ? v.titleField : undefined) ?? primary?.key,
  };
}
function calMapping(obj: ObjectConfig) {
  const v = obj.views?.find((x) => x.type === "calendar");
  const primary = obj.fields.find((f) => f.primary) ?? obj.fields[0];
  return {
    start: (typeof v?.startDateField === "string" ? v.startDateField : undefined) ?? firstDateField(activeFields(obj.fields))?.key,
    end: typeof v?.endDateField === "string" ? v.endDateField : undefined,
    title: (typeof v?.titleField === "string" ? v.titleField : undefined) ?? primary?.key,
  };
}

export default function AggregatePage({
  page,
  config,
  openRecord,
}: {
  page: PageConfig;
  config: AppConfig;
  openRecord: (obj: string, id: string) => void;
  go: (hash: string) => void;
}) {
  const kind = page.kind as "map" | "calendar";
  const sources = React.useMemo(
    () => (Array.isArray(page.source) ? page.source : page.source ? [page.source] : []).filter((k) => config.objects.some((o) => o.key === k)),
    [page.source, config.objects],
  );
  const objects = React.useMemo(
    () => sources.map((k) => config.objects.find((o) => o.key === k)!).filter(Boolean),
    [sources, config.objects],
  );
  const single = objects.length === 1;
  const def = getViewDefinition(kind);

  const [rowsByObj, setRowsByObj] = React.useState<Record<string, RecordRow[]> | null>(null);
  const load = React.useCallback(() => {
    if (sources.length === 0) { setRowsByObj({}); return; }
    Promise.all(sources.map((k) => api.list(k).then((rs) => [k, rs] as const).catch(() => [k, [] as RecordRow[]] as const)))
      .then((pairs) => setRowsByObj(Object.fromEntries(pairs)));
  }, [sources]);
  React.useEffect(load, [load]);
  // live-refresh when another writer changes a source (rev poll) + on tab refocus
  React.useEffect(() => {
    let alive = true;
    const revs: Record<string, number> = {};
    const tick = async () => {
      for (const k of sources) {
        try { const { rev } = await api.rev(k); if (revs[k] !== undefined && revs[k] !== rev) { load(); } revs[k] = rev; } catch { /* ignore */ }
      }
    };
    const id = setInterval(() => { if (alive) tick(); }, 4000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [sources, load]);

  // viewState persists per page (basemap/zoom/layers/calView) to app_state
  const VKEY = pageViewKey(page.key);
  const [viewState, setViewStateRaw] = React.useState<Record<string, unknown>>({});
  const vsTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    let live = true;
    api.state().then((s) => { if (live) { const vs = s[VKEY]; setViewStateRaw(vs && typeof vs === "object" && !Array.isArray(vs) ? (vs as Record<string, unknown>) : {}); } }).catch(() => {});
    return () => { live = false; };
  }, [VKEY]);
  const onViewState = React.useCallback((patch: Record<string, unknown>) => {
    setViewStateRaw((vs) => {
      const next = { ...vs, ...patch };
      if (vsTimer.current) clearTimeout(vsTimer.current);
      vsTimer.current = setTimeout(() => { api.setState(VKEY, next).catch(() => {}); }, 500);
      return next;
    });
  }, [VKEY]);
  React.useEffect(() => () => { if (vsTimer.current) clearTimeout(vsTimer.current); }, []);

  // optimistic local write (applies the REAL patch to the source row) + persist
  const patchLocal = React.useCallback((obj: string, id: string, realPatch: Record<string, unknown>) => {
    setRowsByObj((m) => (m ? { ...m, [obj]: (m[obj] ?? []).map((r) => (String(r.id) === id ? { ...r, ...realPatch } : r)) } : m));
  }, []);

  const model = React.useMemo<AggModel | null>(() => {
    if (!def || objects.length === 0 || !rowsByObj) return null;

    if (single) {
      const obj = objects[0];
      const own = obj.views?.find((v) => v.type === kind) ?? {};
      const { type: _t, ...ownEntry } = own as Record<string, unknown>;
      const entry = { ...ownEntry, ...(page.view ?? {}) };
      const viewConfig = { ...(def.defaultConfig?.(obj) ?? {}), ...entry };
      return {
        object: obj,
        viewConfig,
        rows: rowsByObj[obj.key] ?? [],
        decode: (id) => ({ obj: obj.key, id }),
        translate: (id, patch) => ({ obj: obj.key, id, realPatch: patch }),
      };
    }

    // ---- multi-source: canonical synthetic object + normalized rows ----
    const srcOption = (o: ObjectConfig, i: number): SelectOption => ({ value: o.key, label: o.label, color: SRC_COLORS[i % SRC_COLORS.length] });
    const srcField = { key: "__src", label: "Source", type: "select" as const, options: objects.map(srcOption) };

    if (kind === "map") {
      const maps = objects.map(mapMapping);
      const fields = [
        { key: "__title", label: "Title", type: "text" as const, primary: true },
        { key: "__lat", label: "Latitude", type: "number" as const },
        { key: "__lng", label: "Longitude", type: "number" as const },
        srcField,
      ];
      const object: ObjectConfig = { key: `__agg_${page.key}`, label: page.label, labelOne: "Record", defaultView: "map", fields };
      const entry = { latField: "__lat", lngField: "__lng", titleField: "__title", colorField: "__src", legend: true, addPoint: false, clustering: true, ...(page.view ?? {}) };
      const rows: RecordRow[] = [];
      objects.forEach((o, i) => {
        const mp = maps[i];
        for (const r of rowsByObj[o.key] ?? []) {
          const lat = mp.lat ? r[mp.lat] : undefined;
          const lng = mp.lng ? r[mp.lng] : undefined;
          rows.push({ ...r, id: `${o.key}::${r.id}`, __title: mp.title ? r[mp.title] : r.id, __lat: lat, __lng: lng, __src: o.key });
        }
      });
      const decode = (sid: string): Decoded | null => { const i = sid.indexOf("::"); return i < 0 ? null : { obj: sid.slice(0, i), id: sid.slice(i + 2) }; };
      const translate = (sid: string, patch: Record<string, unknown>) => {
        const d = decode(sid); if (!d) return null;
        const mp = mapMapping(config.objects.find((o) => o.key === d.obj)!);
        const realPatch: Record<string, unknown> = {};
        if ("__lat" in patch && mp.lat) realPatch[mp.lat] = patch.__lat;
        if ("__lng" in patch && mp.lng) realPatch[mp.lng] = patch.__lng;
        if ("__title" in patch && mp.title) realPatch[mp.title] = patch.__title;
        return { obj: d.obj, id: d.id, realPatch };
      };
      return { object, viewConfig: { ...(def.defaultConfig?.(object) ?? {}), ...entry }, rows, decode, translate };
    }

    // calendar
    const cals = objects.map(calMapping);
    const fields = [
      { key: "__title", label: "Title", type: "text" as const, primary: true },
      { key: "__start", label: "Start", type: "dateTime" as const },
      { key: "__end", label: "End", type: "dateTime" as const },
      srcField,
    ];
    const object: ObjectConfig = { key: `__agg_${page.key}`, label: page.label, labelOne: "Record", defaultView: "calendar", fields };
    const entry = { startDateField: "__start", endDateField: "__end", titleField: "__title", colorField: "__src", editable: true, selectable: false, ...(page.view ?? {}) };
    const rows: RecordRow[] = [];
    objects.forEach((o, i) => {
      const cm = cals[i];
      for (const r of rowsByObj[o.key] ?? []) {
        rows.push({ ...r, id: `${o.key}::${r.id}`, __title: cm.title ? r[cm.title] : r.id, __start: cm.start ? r[cm.start] : undefined, __end: cm.end ? r[cm.end] : undefined, __src: o.key });
      }
    });
    const decode = (sid: string): Decoded | null => { const i = sid.indexOf("::"); return i < 0 ? null : { obj: sid.slice(0, i), id: sid.slice(i + 2) }; };
    const translate = (sid: string, patch: Record<string, unknown>) => {
      const d = decode(sid); if (!d) return null;
      const cm = calMapping(config.objects.find((o) => o.key === d.obj)!);
      const realPatch: Record<string, unknown> = {};
      if ("__start" in patch && cm.start) realPatch[cm.start] = patch.__start;
      if ("__end" in patch && cm.end) realPatch[cm.end] = patch.__end;
      if ("__title" in patch && cm.title) realPatch[cm.title] = patch.__title;
      return { obj: d.obj, id: d.id, realPatch };
    };
    return { object, viewConfig: { ...(def.defaultConfig?.(object) ?? {}), ...entry }, rows, decode, translate };
  }, [def, objects, rowsByObj, single, kind, page.key, page.label, page.view, config.objects]);

  const onOpen = React.useCallback((id: string) => { const d = model?.decode(id); if (d) openRecord(d.obj, d.id); }, [model, openRecord]);
  const onPatch = React.useCallback((id: string, patch: Record<string, unknown>) => {
    const tr = model?.translate(id, patch); if (!tr || Object.keys(tr.realPatch).length === 0) return;
    patchLocal(tr.obj, tr.id, tr.realPatch);
    api.patch(tr.obj, tr.id, tr.realPatch).catch(() => load());
  }, [model, patchLocal, load]);
  const onDelete = React.useCallback((id: string) => {
    const d = model?.decode(id); if (!d) return;
    api.remove(d.obj, d.id).then(() => load()).catch(() => load());
  }, [model, load]);
  const [selection, setSelection] = React.useState<Record<string, boolean>>({});
  const noop = React.useCallback(() => {}, []);

  const viewError = model && def?.validateConfig?.(model.object, model.viewConfig);

  return (
    <div className="pageBleed nxCanvasPage" data-testid={`page-aggregate-${page.key}`}>
      <div className="nxPageBar" data-testid="aggregate-page-bar">
        <span className="nxPageBarTitle">{page.label}</span>
        <span className="nxSpacer" style={{ flex: 1 }} />
        <span className="nxPageBarMeta" data-testid="aggregate-count">
          {model ? t("page.aggregate.count", { n: model.rows.length, src: objects.map((o) => o.label).join(" + ") }) : ""}
        </span>
      </div>
      {sources.length === 0 ? (
        <div className="nxPageLoading" data-testid="aggregate-no-source"><span>{t("page.aggregate.noSource")}</span></div>
      ) : rowsByObj === null || !model || !def ? (
        <div className="nxPageLoading nx-rise-in-sm" data-testid="aggregate-loading">
          <ThinkingDots label={t("page.generic.loading")} />
          <span>{t("page.generic.loading")}</span>
        </div>
      ) : viewError ? (
        <div className="nxCard nx-pop-in" data-testid="aggregate-view-error" style={{ margin: 16, padding: "10px 14px", color: "var(--nx-fg-muted)", font: "var(--nx-text-meta)" }}>
          {viewError}
        </div>
      ) : (
        <div className={`nxCanvasPageBody${kind === "calendar" ? " nxCanvasPageBody--scroll" : ""}`}>
          <React.Suspense fallback={<div className="nxPageLoading"><ThinkingDots label={t("page.generic.loading")} /></div>}>
            <def.component
              object={model.object}
              rows={model.rows}
              users={config.users ?? []}
              readOnly={false}
              viewConfig={model.viewConfig}
              viewState={viewState}
              onViewState={onViewState}
              onOpen={onOpen}
              onPeek={onOpen}
              onPatch={onPatch}
              onDelete={onDelete}
              selection={selection}
              onSelectionChange={setSelection}
            />
          </React.Suspense>
        </div>
      )}
    </div>
  );
}
