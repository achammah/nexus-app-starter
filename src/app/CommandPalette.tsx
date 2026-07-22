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
import { type AppConfig } from "./api";
import { allNavPages } from "./pages";
import { t } from "./i18n";
import { useRecordSearch } from "./useGlobalSearch";

/* THE unified search surface — ⌘K, and the top-bar search field opens it too.
   Searches RECORDS across every configured object plus the whole nav taxonomy
   (objects and pages, including config-declared document/map pages). The
   vendored shadcn command (cmdk) is the chrome. */

export function CommandPalette({
  config,
  go,
  actions = [],
  intercept,
  openSignal,
}: {
  config: AppConfig;
  go: (hash: string) => void;
  /* context actions (what's on screen decides): New record, trash, favorite, promote… */
  actions?: { id: string; label: string; run: () => void }[];
  /* consulted ONLY on the OPENING edge: palette open → self-toggle closes it (never
     yields); closed → intercept() true = another surface (the side panel) owns this
     Cmd/Ctrl+K and the palette stays closed */
  intercept?: () => boolean;
  /* external open request (the top-bar search): a NEW object each time, carrying an
     optional seed query so the first typed character isn't lost */
  openSignal?: { seed: string } | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
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

  // the top bar (and anything else) opens the palette through this signal
  React.useEffect(() => {
    if (!openSignal) return;
    setQ(openSignal.seed);
    setOpen(true);
  }, [openSignal]);

  const hits = useRecordSearch(config, q, open);

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
