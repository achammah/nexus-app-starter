import * as React from "react";
import { LayoutGrid, FileText, CornerDownLeft } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/components/ui/command";
import { api, type AppConfig } from "./api";
import { customPages } from "./pages";
import { t } from "./i18n";
import type { RecordRow } from "../ui/record-core/types";

/* ⌘K / Ctrl-K palette — jump to any object, page, or RECORD (live search across
   every configured object). The vendored shadcn command (cmdk) is the surface. */

export function CommandPalette({
  config,
  go,
}: {
  config: AppConfig;
  go: (hash: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<{ obj: string; row: RecordRow; name: string }[]>([]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
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
            return rows.slice(0, 5).map((row) => ({ obj: o.key, row, name: String(row[primary.key] ?? row.id) }));
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t("palette.placeholder")}>
      <CommandInput
        placeholder={t("palette.placeholder")}
        value={q}
        onValueChange={setQ}
        data-testid="palette-input"
      />
      <CommandList data-testid="palette-list">
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>
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
        {customPages.length > 0 && (
          <CommandGroup heading={t("palette.pages")}>
            {customPages.map((p) => (
              <CommandItem key={p.key} value={`${p.label} page`} onSelect={() => jump(`#/p/${p.key}`)}>
                <FileText />
                <span>{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
