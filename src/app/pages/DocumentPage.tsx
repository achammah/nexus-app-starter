import * as React from "react";
import { api } from "../api";
import { t } from "../i18n";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import { PageWorkspace, pageStoreKey, isPageStore, seedPageStore, type PageStore } from "../../ui/blocks/document";

/* Document page — a full Notion-style page WORKSPACE as the page surface itself.
   Free-surface: the whole workspace (nested pages + their blocks) persists as ONE
   PageStore blob under an app-state key, loaded here and autosaved on every edit.
   Mirrors the SpreadsheetPage precedent (workbookStoreKey → pageStoreKey). The heavy
   editor I/O (docx/mammoth) is lazy inside the editor; PageWorkspace itself is light. */

const SAVE_DELAY = 700;
type Phase = "loading" | "ready";

/* `pageKey` namespaces the stored workspace so several standalone document pages
   coexist (a config.pages[] { kind:"document" } entry shares this ONE component). */
export function DocumentPage({ pageKey = "document", demoSeed = true }: { pageKey?: string; demoSeed?: boolean }) {
  const KEY = React.useMemo(() => pageStoreKey(pageKey), [pageKey]);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [initial, setInitial] = React.useState<PageStore | null>(null);
  const [reloadNonce] = React.useState(0);

  // one debouncer for the page lifetime: coalesce rapid edits into one write
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = React.useCallback((store: PageStore) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { api.setState(KEY, store).catch(() => {}); }, SAVE_DELAY);
  }, [KEY]);
  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // load the stored workspace once: valid store → mount · never-set → seed the nested
  // demo workspace (demoSeed) and persist it so a reload restores it.
  React.useEffect(() => {
    let live = true;
    api.state().then((s) => {
      if (!live) return;
      const snap = s[KEY];
      if (isPageStore(snap)) { setInitial(snap); }
      else {
        const seed = seedPageStore();
        setInitial(seed);
        if (demoSeed) api.setState(KEY, seed).catch(() => {});
      }
      setPhase("ready");
    }).catch(() => { setInitial(seedPageStore()); setPhase("ready"); });
    return () => { live = false; };
  }, [KEY, demoSeed]);

  if (phase === "loading") {
    return (
      <div className="pageBleed" data-testid="page-document">
        <div className="nx-rise-in-sm" style={{ padding: 24 }}>
          <ThinkingDots label={t("page.generic.loading")} />
        </div>
      </div>
    );
  }

  /* --nx-doc-inset feeds the workspace's generic self-bound formula
     (max-height: calc(100dvh - var(--nx-doc-inset))) the exact topbar+padding inset,
     so the document forms a real scroll container with the last line above the fold.
     Without it the surface self-bounds to the full viewport (still scrolls, last line
     under the fold). 92px ≈ this app's topbar + page padding. */
  return (
    <div className="pageBleed" data-testid="page-document" style={{ ["--nx-doc-inset" as string]: "92px" } as React.CSSProperties}>
      {/* cmdK:false — the app shell owns ⌘K (the unified "Search everything" palette).
         Without this the workspace binds its OWN ⌘K page-switcher too, so ⌘K opened
         two stacked palettes on this page. One unified search, per the product intent. */}
      <PageWorkspace value={initial} onChange={persist} reloadNonce={reloadNonce} config={{ cmdK: false }} />
    </div>
  );
}

export default DocumentPage;
