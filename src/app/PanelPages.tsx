import * as React from "react";
import { CornerDownLeft, FileText, LayoutGrid, Search, Zap } from "lucide-react";
import { type AppConfig } from "./api";
import { t } from "./i18n";
import { allNavPages } from "./pages";
import { useRecordSearch, navMatches } from "./useGlobalSearch";

/* Panel pages beyond the record peek — the peek shell hosts a typed page STACK
   (record | search | actions); these components render the non-record pages. */

/* Search page: always-focused input, live cross-object results (same api.list(q)
   fan-out as the command palette), ↑↓ + Enter pushes the record on the SAME stack.
   Ladder: Escape clears text → pops the page → (in App) closes; Backspace on an
   empty field also pops. The query lives in App state so stepping back restores it. */
export function PanelSearch({
  config,
  q,
  onQ,
  onOpen,
  onGo,
  onPop,
}: {
  config: AppConfig;
  q: string;
  onQ: (v: string) => void;
  onOpen: (obj: string, id: string) => void;
  /* navigate to a page/object hit — the panel search covers the WHOLE app */
  onGo: (hash: string) => void;
  onPop: () => void;
}) {
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const recordHits = useRecordSearch(config, q);
  /* the SAME taxonomy the ⌘K palette lists — a page (handbook, map site, board…)
     is as findable here as a record; this surface is a search, not a record picker */
  const navHits = React.useMemo(() => {
    const pages = navMatches(allNavPages(config), q).map((p) => ({ kind: "page" as const, key: p.key, label: p.label, hash: `#/p/${p.key}` }));
    const objs = navMatches(config.objects.map((o) => ({ key: o.key, label: o.label })), q)
      .map((o) => ({ kind: "object" as const, key: o.key, label: o.label, hash: `#/o/${o.key}` }));
    return [...pages, ...objs].slice(0, 6);
  }, [config, q]);
  // ONE flat keyboard ring over both groups: records first, then pages/objects
  const hits = recordHits;
  const ringLen = hits.length + navHits.length;
  React.useEffect(() => { setSel(0); }, [q]);
  const openAt = (i: number) => {
    if (i < hits.length) { onOpen(hits[i].obj, hits[i].row.id); return; }
    const n = navHits[i - hits.length];
    if (n) onGo(n.hash);
  };
  // type labels only when the hits span more than one object (same-named records stay distinguishable)
  const spans = new Set(hits.map((h) => h.obj)).size > 1;
  return (
    <div className="panelSearch">
      <input
        ref={inputRef}
        className="nxCellEdit panelSearchInput"
        data-testid="panel-search-input"
        placeholder={t("search.everything")}
        value={q}
        onChange={(e) => onQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, Math.max(ringLen - 1, 0))); e.preventDefault(); return; }
          if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, 0)); e.preventDefault(); return; }
          if (e.key === "Enter" && sel < ringLen) { openAt(sel); e.preventDefault(); return; }
          if (e.key === "Escape") { e.preventDefault(); if (q) onQ(""); else onPop(); return; }
          if (e.key === "Backspace" && !q) { e.preventDefault(); onPop(); }
        }}
      />
      <div className="panelHits">
        {q.trim().length >= 2 && ringLen === 0 && <div className="panelEmpty">{t("panel.empty")}</div>}
        {hits.map((h, i) => (
          <button
            key={`${h.obj}:${h.row.id}`}
            className={`panelHit ${i === sel ? "panelHit--sel" : ""}`}
            data-testid={`panel-search-hit-${h.row.id}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => onOpen(h.obj, h.row.id)}
          >
            <CornerDownLeft size={13} />
            <span className="panelHitName">{h.name}</span>
            {spans && <span className="panelHitType">{config.objects.find((o) => o.key === h.obj)?.labelOne}</span>}
          </button>
        ))}
        {navHits.map((n, i) => (
          <button
            key={`${n.kind}:${n.key}`}
            className={`panelHit ${hits.length + i === sel ? "panelHit--sel" : ""}`}
            data-testid={`panel-search-nav-${n.key}`}
            onMouseEnter={() => setSel(hits.length + i)}
            onClick={() => onGo(n.hash)}
          >
            {n.kind === "page" ? <FileText size={13} /> : <LayoutGrid size={13} />}
            <span className="panelHitName">{n.label}</span>
            <span className="panelHitType">{n.kind === "page" ? t("palette.pages") : t("palette.objects")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Actions page: the SAME context-actions array the command palette renders (one
   source, two surfaces), plus the jump into the search page. */
export function PanelActions({
  actions,
  onSearch,
}: {
  actions: { id: string; label: string; run: () => void }[];
  onSearch: () => void;
}) {
  return (
    <nav className="panelActions">
      {actions.map((a) => (
        <button key={a.id} className="panelHit panelAction" data-testid={`panel-act-${a.id}`} onClick={a.run}>
          <Zap size={13} />
          <span className="panelHitName">{a.label}</span>
        </button>
      ))}
      <button className="panelHit panelAction" data-testid="panel-act-search" onClick={onSearch}>
        <Search size={13} />
        <span className="panelHitName">{t("panel.searchRecords")}</span>
      </button>
    </nav>
  );
}
