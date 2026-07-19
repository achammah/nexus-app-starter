import * as React from "react";
import { CornerDownLeft, Search, Zap } from "lucide-react";
import { api, type AppConfig } from "./api";
import { formatCell } from "../ui/record-core/DataTable";
import { t } from "./i18n";
import type { RecordRow } from "../ui/record-core/types";

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
  onPop,
}: {
  config: AppConfig;
  q: string;
  onQ: (v: string) => void;
  onOpen: (obj: string, id: string) => void;
  onPop: () => void;
}) {
  const [hits, setHits] = React.useState<{ obj: string; row: RecordRow; name: string }[]>([]);
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  React.useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setSel(0);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const per = await Promise.all(
        config.objects.map(async (o) => {
          const primary = o.fields.find((f) => f.primary) ?? o.fields[0];
          try {
            const rows = await api.list(o.key, { q: q.trim() });
            return rows.slice(0, 5).map((row) => ({ obj: o.key, row, name: formatCell(row[primary.key], primary.type) || String(row.id) }));
          } catch {
            return [];
          }
        }),
      );
      if (live) {
        setHits(per.flat().slice(0, 12));
        setSel(0);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, config.objects]);
  // type labels only when the hits span more than one object (same-named records stay distinguishable)
  const spans = new Set(hits.map((h) => h.obj)).size > 1;
  return (
    <div className="panelSearch">
      <input
        ref={inputRef}
        className="nxCellEdit panelSearchInput"
        data-testid="panel-search-input"
        placeholder={t("panel.searchPlaceholder")}
        value={q}
        onChange={(e) => onQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, Math.max(hits.length - 1, 0))); e.preventDefault(); return; }
          if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, 0)); e.preventDefault(); return; }
          if (e.key === "Enter" && hits[sel]) { onOpen(hits[sel].obj, hits[sel].row.id); e.preventDefault(); return; }
          if (e.key === "Escape") { e.preventDefault(); if (q) onQ(""); else onPop(); return; }
          if (e.key === "Backspace" && !q) { e.preventDefault(); onPop(); }
        }}
      />
      <div className="panelHits">
        {q.trim().length >= 2 && hits.length === 0 && <div className="panelEmpty">{t("panel.empty")}</div>}
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
