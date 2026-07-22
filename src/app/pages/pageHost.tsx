import * as React from "react";
import { api, type AppConfig, type PageConfig } from "../api";
import { t } from "../i18n";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import { SpreadsheetPage } from "./Spreadsheet";

/* ConfigPageHost — the generic host for a config-declared page (config.pages[]).
   It resolves `kind` → an already-built view/field component wired to either a
   per-page CONTENT STORE (free-surface: whiteboard | flow | spreadsheet) or the
   AGGREGATED record set across `source` (map | calendar). Adding a page is pure
   config — this dispatcher is the only code the platform runs for any of them.

   The heavy bodies (excalidraw / xyflow / maplibre / fullcalendar) ship as lazy
   chunks so an app that declares no such page pays ~0 eager bytes; the spreadsheet
   body already splits the Univer engine behind its own lazy surface. */

const LazyWhiteboardPage = React.lazy(() => import("./WhiteboardPage"));
const LazyFlowPage = React.lazy(() => import("./FlowPage"));
const LazyAggregatePage = React.lazy(() => import("./AggregatePage"));

const PageLoading = ({ label }: { label: string }) => (
  <div className="pageBleed" data-testid="config-page-loading">
    <div className="nxPageLoading nx-rise-in-sm">
      <ThinkingDots label={label} />
      <span>{label}</span>
    </div>
  </div>
);

export function ConfigPageHost({
  page,
  config,
  openRecord,
  go,
}: {
  page: PageConfig;
  config: AppConfig;
  /* open a record in the app's side-peek (aggregate pages route a marker click here) */
  openRecord: (obj: string, id: string) => void;
  go: (hash: string) => void;
}) {
  return (
    <React.Suspense fallback={<PageLoading label={t("page.generic.loading")} />}>
      {page.kind === "spreadsheet" ? (
        <SpreadsheetPage pageKey={page.key} />
      ) : page.kind === "whiteboard" ? (
        <LazyWhiteboardPage page={page} />
      ) : page.kind === "flow" ? (
        <LazyFlowPage page={page} />
      ) : (
        <LazyAggregatePage page={page} config={config} openRecord={openRecord} go={go} />
      )}
    </React.Suspense>
  );
}

/* ---- shared per-page content store (the app_state / data-spine seam) ----
   A free-surface page persists ONE document under a namespaced app-state key (the
   SpreadsheetPage precedent): loaded once on mount, seeded with a rich demo when
   never-set, and autosaved (debounced) on change. External-writer-tolerant per the
   data-spine rule — a write is one key, never a whole-state snapshot, so another
   writer's rows survive. Namespaces keep several pages of the same kind apart. */

export const wbDocKey = (pageKey: string) => `wbpage:${pageKey}`;
export const flowDocKey = (pageKey: string) => `flowpage:${pageKey}`;
export const flowViewKey = (pageKey: string) => `flowview:${pageKey}`;
export const pageViewKey = (pageKey: string) => `pageview:${pageKey}`;

export type DocSaveState = "idle" | "saving" | "saved";

export function usePageDoc<T>(
  storeKey: string,
  isValid: (x: unknown) => x is T,
  makeSeed: () => T,
) {
  const [phase, setPhase] = React.useState<"loading" | "ready">("loading");
  const [initial, setInitial] = React.useState<T | null>(null);
  const [saveState, setSaveState] = React.useState<DocSaveState>("idle");
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // one debouncer for the page lifetime: coalesce rapid edits into one write
  const save = React.useCallback(
    (next: T) => {
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        api.setState(storeKey, next).then(() => setSaveState("saved")).catch(() => setSaveState("idle"));
      }, 700);
    },
    [storeKey],
  );
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reseed = React.useCallback(() => {
    const s = makeSeed();
    setInitial(s);
    setReloadNonce((n) => n + 1);
    setSaveState("saved");
    api.setState(storeKey, s).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  // load once: valid stored doc → mount · else seed the demo + persist so a reload
  // restores it (never-set OR corrupt both recover to a rich starting board)
  React.useEffect(() => {
    let live = true;
    api.state().then((s) => {
      if (!live) return;
      const v = s[storeKey];
      if (isValid(v)) { setInitial(v); setPhase("ready"); }
      else {
        const seed = makeSeed();
        setInitial(seed);
        setPhase("ready");
        api.setState(storeKey, seed).catch(() => {});
      }
    }).catch(() => {
      if (!live) return;
      setInitial(makeSeed());
      setPhase("ready");
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  return { phase, initial, reloadNonce, save, saveState, reseed };
}
