import * as React from "react";
import { Eraser, RotateCcw, Table2 } from "lucide-react";
import type { IWorkbookData } from "@univerjs/core";
import { api } from "../api";
import { t } from "../i18n";
import { Button } from "../../ui/primitives/Button";
import { Tip } from "../../ui/primitives/fields";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import { LazyWorkbookSurface, isWorkbookSnapshot, seedWorkbook, workbookStoreKey } from "../../ui/blocks/workbook";

/* Spreadsheet page — a full Univer workbook as the page surface itself. Free-
   surface: the whole workbook persists as ONE snapshot under an app-state key (not
   record data), loaded here and autosaved on every edit. The page bleeds to the
   content edges (no card frame) and its controls (save state, reset, clear) ride
   inside the workbook's own toolbar row, so the only chrome above the grid is the
   app top bar + the sheet's single toolbar. The heavy engine is the
   LazyWorkbookSurface split, so this page adds ~0 to the eager bundle. */

const SAVE_DELAY = 700;

type Phase = "loading" | "empty" | "ready";

const skeleton = (
  <div className="nxWorkbookOverlay nxWorkbookOverlay--transparent" style={{ position: "static", height: "100%" }} data-testid="workbook-page-loading">
    <ThinkingDots label={t("page.spreadsheet.loading")} />
    <span className="nxWorkbookOverlayBody">{t("page.spreadsheet.loading")}</span>
  </div>
);

/* `pageKey` namespaces the stored workbook so several standalone spreadsheet pages
   coexist (the static "Spreadsheet" page and any config.pages[] { kind:"spreadsheet" }
   entry share this ONE component — the config-driven page is the same full surface). */
export function SpreadsheetPage({ pageKey = "spreadsheet" }: { pageKey?: string }) {
  const KEY = React.useMemo(() => workbookStoreKey(pageKey), [pageKey]);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [initial, setInitial] = React.useState<IWorkbookData | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");

  // one debouncer for the lifetime of the page: coalesce rapid edits into one write
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = React.useCallback((snap: IWorkbookData) => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.setState(KEY, snap).then(() => setSaveState("saved")).catch(() => setSaveState("idle"));
    }, SAVE_DELAY);
  }, [KEY]);
  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // load the stored workbook once: valid snapshot → mount · explicit null → empty ·
  // never-set/corrupt → seed the demo and persist it so a reload restores it
  React.useEffect(() => {
    let live = true;
    api.state().then((s) => {
      if (!live) return;
      const snap = s[KEY];
      if (isWorkbookSnapshot(snap)) { setInitial(snap); setPhase("ready"); }
      else if (snap === null) { setPhase("empty"); }
      else {
        const seed = seedWorkbook();
        setInitial(seed); setPhase("ready");
        api.setState(KEY, seed).catch(() => {});
      }
    }).catch(() => setPhase("empty"));
    return () => { live = false; };
  }, [KEY]);

  const mountSeed = React.useCallback(() => {
    const seed = seedWorkbook();
    setInitial(seed);
    setPhase("ready");
    setReloadNonce((n) => n + 1);
    setSaveState("saved");
    api.setState(KEY, seed).catch(() => {});
  }, [KEY]);

  const clearWorkbook = React.useCallback(() => {
    setPhase("empty");
    setInitial(null);
    api.setState(KEY, null).catch(() => {});
  }, [KEY]);

  // compact cluster for the workbook toolbar row: live save state + icon actions
  const bar = (
    <>
      <span className="nxWorkbookSave" data-state={saveState} data-testid="workbook-save">
        {saveState === "saving" ? <ThinkingDots label={t("page.spreadsheet.saving")} /> : null}
        {saveState === "saving" ? t("page.spreadsheet.saving") : saveState === "saved" ? t("page.spreadsheet.saved") : ""}
      </span>
      <Tip label={t("page.spreadsheet.reset")}>
        <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} aria-label={t("page.spreadsheet.reset")} data-testid="workbook-reset" onClick={mountSeed} />
      </Tip>
      <Tip label={t("page.spreadsheet.clear")}>
        <Button size="sm" variant="ghost" icon={<Eraser size={13} />} aria-label={t("page.spreadsheet.clear")} data-testid="workbook-clear" onClick={clearWorkbook} />
      </Tip>
    </>
  );

  return (
    <div className="pageBleed" data-testid="page-spreadsheet">
      {phase === "loading" && <div className="nxWorkbook nx-rise-in-sm">{skeleton}</div>}

      {phase === "empty" && (
        <div className="nxWorkbook nx-rise-in-sm">
          <div className="nxWorkbookOverlay" style={{ position: "static", height: "100%" }} data-testid="workbook-empty">
            <Table2 size={28} className="nxWorkbookOverlayIcon" />
            <span className="nxWorkbookOverlayTitle">{t("page.spreadsheet.emptyTitle")}</span>
            <span className="nxWorkbookOverlayBody">{t("page.spreadsheet.emptyBody")}</span>
            <Button icon={<Table2 size={14} />} data-testid="workbook-create" onClick={mountSeed}>
              {t("page.spreadsheet.create")}
            </Button>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <React.Suspense fallback={<div className="nxWorkbook nx-rise-in-sm">{skeleton}</div>}>
          <LazyWorkbookSurface
            value={initial}
            reloadNonce={reloadNonce}
            onChange={persist}
            actions={bar}
            data-testid="workbook-surface"
          />
        </React.Suspense>
      )}
    </div>
  );
}
