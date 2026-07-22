import * as React from "react";
import { LayoutGrid, FileText, CornerDownLeft, Zap } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/components/ui/command";
import { api, type AppConfig } from "./api";
import { formatCell } from "../ui/record-core/DataTable";
import { allNavPages } from "./pages";
import { t } from "./i18n";
import type { RecordRow } from "../ui/record-core/types";

/* ⌘K / Ctrl-K palette — jump to any object, page, or RECORD (live search across
   every configured object). The vendored shadcn command (cmdk) is the surface. */

export function CommandPalette({
  config,
  go,
  actions = [],
  intercept,
}: {
  config: AppConfig;
  go: (hash: string) => void;
  /* context actions (what's on screen decides): New record, trash, favorite, promote… */
  actions?: { id: string; label: string; run: () => void }[];
  /* consulted ONLY on the OPENING edge: palette open → self-toggle closes it (never
     yields); closed → intercept() true = another surface (the side panel) owns this
     Cmd/Ctrl+K and the palette stays closed */
  intercept?: () => boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ obj: string; row: RecordRow; name: string }[]>([]);
  // refs so the mount-once key listener sees live values without re-subscribing
  const openRef = React.useRef(open);
  openRef.current = open;
  const interceptRef = React.useRef(intercept);
  interceptRef.current = intercept;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) { setOpen(false); return; }
        if (interceptRef.current?.()) return;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open || q.trim().length < 2) {
      setHits([]);
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
      if (live) setHits(per.flat().slice(0, 12));
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, open, config.objects]);

  const jump = (hash: string) => {
    setOpen(false);
    setQ("");
    go(hash);
  };

  // when a palette action opens ANOTHER dialog, the palette's close-time focus
  // restore would steal focus out of the new dialog's trap (Escape then re-traps
  // instead of closing) — suppress the restore while an action is in flight
  const actionFired = React.useRef(false);
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("palette.placeholder")}
      onCloseAutoFocus={(e) => {
        if (actionFired.current) {
          e.preventDefault();
          actionFired.current = false;
        }
      }}
    >
      <CommandInput
        placeholder={t("palette.placeholder")}
        value={q}
        onValueChange={setQ}
        data-testid="palette-input"
      />
      <CommandList data-testid="palette-list">
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>
        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.label} action`}
                data-testid={`palette-act-${a.id}`}
                onSelect={() => {
                  actionFired.current = true;
                  setOpen(false);
                  setQ("");
                  // let this dialog's layer unwind before an action opens another
                  setTimeout(a.run, 0);
                }}
              >
                <Zap />
                <span>{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hits.length > 0 && (
          <CommandGroup heading={t("palette.records")}>
            {hits.map((h) => (
              <CommandItem
                key={`${h.obj}:${h.row.id}`}
                value={`${h.name} ${h.obj} ${h.row.id}`}
                data-testid={`palette-hit-${h.row.id}`}
                onSelect={() => jump(`#/o/${h.obj}/r/${h.row.id}`)}
              >
                <CornerDownLeft />
                <span>{h.name}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {config.objects.find((o) => o.key === h.obj)?.labelOne}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t("palette.objects")}>
          {config.objects.map((o) => (
            <CommandItem key={o.key} value={`${o.label} object`} onSelect={() => jump(`#/o/${o.key}`)}>
              <LayoutGrid />
              <span>{o.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {(() => {
          // customPages + config.pages[] as one Pages group, so ⌘K jumps to any page
          const pages = allNavPages(config);
          return pages.length > 0 ? (
            <CommandGroup heading={t("palette.pages")}>
              {pages.map((p) => (
                <CommandItem key={p.key} value={`${p.label} page`} onSelect={() => jump(`#/p/${p.key}`)}>
                  {p.icon ?? <FileText />}
                  <span>{p.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null;
        })()}
      </CommandList>
    </CommandDialog>
  );
}
