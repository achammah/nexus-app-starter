import * as React from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronLeft, ChevronRight, Handshake, LayoutGrid, Maximize2, Menu, Moon, RefreshCw, Sun, Users, Table2, Kanban, X, Zap, Sparkles } from "lucide-react";
import { api, type AppConfig } from "./api";
import { favList, favToggle, type Fav } from "./favorites";
import { formatCell } from "../ui/record-core/DataTable";
import { Star } from "lucide-react";
import { applySkin, type Skin } from "../ui/skins/skin";
import { skinPresets } from "../ui/skins/presets";
import { ObjectView } from "./ObjectView";
import { RecordView } from "./RecordView";
import { customPages } from "./pages";
import { CommandPalette } from "./CommandPalette";
import { PanelSearch, PanelActions } from "./PanelPages";
import { t } from "./i18n";
import { ChatDock } from "./ChatDock";
import { Copilot } from "./Copilot";
import { CopilotToggle } from "../ui/blocks/copilot";
import { ShortcutsOverlay, MobileReviewBanner, type ShortcutGroup } from "../ui/blocks/mobile";
import { Login } from "./Login";
import { Button } from "../ui/primitives/Button";
import { Tip } from "../ui/primitives/fields";
import { ThinkingDots } from "../ui/primitives/ThinkingDots";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/components/ui/dropdown-menu";

/* Hash routes: #/o/<object> · #/o/<object>/r/<id> · #/p/<page>. Hand-rolled (no router dep). */
function useHashRoute() {
  const [hash, setHash] = React.useState(window.location.hash || "#/");
  React.useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const [path, query = ""] = hash.split("?");
  const parts = path.replace(/^#\//, "").split("/").filter(Boolean);
  return {
    object: parts[0] === "o" ? parts[1] : undefined,
    recordId: parts[2] === "r" ? parts[3] : undefined,
    page: parts[0] === "p" ? parts[1] : undefined,
    // the peek ROOT rides the URL (?peek=<id>) — reload/share restores it
    peekId: new URLSearchParams(query).get("peek") ?? undefined,
    go: (h: string) => (window.location.hash = h),
  };
}

const ICONS: Record<string, React.ReactNode> = {
  "building-2": <Building2 size={15} />,
  users: <Users size={15} />,
  handshake: <Handshake size={15} />,
};

/* One panel, several page kinds: the record peek plus ephemeral search/actions
   pages, all entries in the same stack (one back/crumbs/Escape model). */
export type PanelPage =
  | { kind: "record"; obj: string; id: string }
  | { kind: "search" }
  | { kind: "actions" };

type Toast = { id: number; text: string };
const ToastCtx = React.createContext<(text: string) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

/* Live-sync affordance — pulls external warehouse writes (an async generation's finished
   record, or any out-of-process writer) into the running app via api.syncStore(), which the
   object list then picks up on its rev poll. ThinkingDots while in-flight; a brief status word
   after ("synced N" / "up to date"), then back to rest. Manual by design — a surface that fires
   async work polls on its own (see the Generate action + useAsyncOp). No-warehouse app: always
   "up to date". */
function SyncButton() {
  const [syncing, setSyncing] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const doSync = React.useCallback(() => {
    setSyncing(true);
    setStatus(null);
    api.syncStore()
      .then((r) => setStatus(r.applied > 0 ? t("sync.applied", { n: r.applied }) : t("sync.upToDate")))
      .catch(() => setStatus(t("sync.failed")))
      .finally(() => setSyncing(false));
  }, []);
  // clear the status word after a few seconds so the toolbar returns to rest
  React.useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(id);
  }, [status]);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Tip label={t("sync.tip")}>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("sync.now")}
          data-testid="sync-now"
          onClick={doSync}
          disabled={syncing}
          icon={<RefreshCw size={14} />}
        />
      </Tip>
      {syncing ? (
        <ThinkingDots label={t("sync.now")} />
      ) : status ? (
        <span data-testid="sync-status" style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-faint)", whiteSpace: "nowrap" }}>
          {status}
        </span>
      ) : null}
    </span>
  );
}

/* Skin resolution ladder: inline object > preset name > accent shortcut. */
function resolveSkin(c: AppConfig | null): Skin | undefined {
  if (!c) return undefined;
  return (
    c.theme?.skin ??
    (c.theme?.skinPreset ? skinPresets[c.theme.skinPreset] : undefined) ??
    (c.theme?.accent ? { name: "accent", brand: { primary: c.theme.accent } } : undefined)
  );
}

export function App() {
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  // favorites shelf: device-local pins; re-reads on the nx-favs event
  const [favs, setFavs] = React.useState<Fav[]>(() => favList());
  React.useEffect(() => {
    const onFavs = () => setFavs(favList());
    window.addEventListener("nx-favs", onFavs);
    window.addEventListener("storage", onFavs);
    return () => {
      window.removeEventListener("nx-favs", onFavs);
      window.removeEventListener("storage", onFavs);
    };
  }, []);
  // mobile nav drawer: burger (≤768px, both nav modes) opens a left Sheet
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // copilot side-panel (renders only when config.copilot is present)
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  // keyboard-shortcuts help overlay (toggled by `?`)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  /* ---- side peek: one right-edge panel hosting a typed page STACK — records
     (the peek proper), search, and actions all push onto the same navigation
     history (crumbs/back/Escape ladder). The list stays behind. Only a RECORD
     root rides the URL; search/actions pages are ephemeral (in-memory), so a
     reload lands on the record root or closed — never a stale search page. ---- */
  const [peek, setPeek] = React.useState<{ stack: PanelPage[]; set: string[] } | null>(null);
  // the search page's query lives HERE so stepping back from a pushed record restores it
  const [panelQ, setPanelQ] = React.useState("");
  const openPeek = React.useCallback((obj: string, id: string, set: string[] = []) => {
    setPeek({ stack: [{ kind: "record", obj, id }], set });
    // root in the URL: reload and share both land back on this peek
    const h = `#/o/${obj}?peek=${id}`;
    if (window.location.hash !== h) window.history.replaceState(null, "", h);
  }, []);
  const pushPeek = React.useCallback((obj: string, id: string) => setPeek((p) => (p ? { ...p, stack: [...p.stack, { kind: "record", obj, id }] } : { stack: [{ kind: "record", obj, id }], set: [] })), []);
  // ephemeral pages (search/actions): push onto the open panel, or open the panel with
  // the page as root; pushing the page already on top is a no-op (no dup stacking)
  const pushPanel = React.useCallback((page: Extract<PanelPage, { kind: "search" | "actions" }>) => {
    setPeek((p) => {
      if (!p) return { stack: [page], set: [] };
      if (p.stack[p.stack.length - 1].kind === page.kind) return p;
      return { ...p, stack: [...p.stack, page] };
    });
  }, []);
  const popPeek = React.useCallback(() => setPeek((p) => {
    if (p && p.stack.length > 1) return { ...p, stack: p.stack.slice(0, -1) };
    const root = p?.stack[0];
    if (root?.kind === "record") window.history.replaceState(null, "", `#/o/${root.obj}`);
    return null;
  }), []);
  const closePeek = React.useCallback(() => {
    setPeek((p) => {
      const root = p?.stack[0];
      if (root?.kind === "record") window.history.replaceState(null, "", `#/o/${root.obj}`);
      return null;
    });
  }, []);
  // Escape ladder: an editor blurs first; then pop one level; then close.
  // The drawer sits above the ladder — while it's open, Escape belongs to it (Radix).
  React.useEffect(() => {
    if (!peek || drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { t.blur(); e.preventDefault(); return; }
      popPeek();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek, popPeek, drawerOpen]);

  const [err, setErr] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  // auth gate: null = probing · {enabled,accounts,user} = known
  const [auth, setAuth] = React.useState<{ enabled: boolean; accounts?: boolean; user: string | null; verified?: boolean; role?: "owner" | "admin" | "member" | "viewer" } | null>(null);
  const [teams, setTeams] = React.useState<{ slug: string; name: string; role: string }[]>([]);
  const [activeTeam, setActiveTeam] = React.useState<string | null>(localStorage.getItem("nx-team"));
  const route = useHashRoute();

  const probeAuth = React.useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setAuth)
      .catch(() => setAuth({ enabled: false, user: null }));
  }, []);
  React.useEffect(probeAuth, [probeAuth]);
  // team context: load my teams once signed in; default the active team to the first
  React.useEffect(() => {
    if (!auth?.user) return;
    api.teams().then((r) => {
      setTeams(r.teams);
      const stored = localStorage.getItem("nx-team");
      const valid = r.teams.some((t) => t.slug === stored);
      const next = valid ? stored : r.teams[0]?.slug ?? null;
      if (next !== stored) {
        if (next) localStorage.setItem("nx-team", next);
        else localStorage.removeItem("nx-team");
      }
      setActiveTeam(next);
    }).catch(() => {});
  }, [auth?.user]);

  React.useEffect(() => {
    if (route.peekId && route.object) {
      setPeek((p) => {
        const root = p?.stack[0];
        return root?.kind === "record" && root.id === route.peekId
          ? p
          : { stack: [{ kind: "record", obj: route.object as string, id: route.peekId as string }], set: p?.set ?? [] };
      });
    } else {
      setPeek(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.object, route.page, route.recordId, route.peekId]);

  /* `/` opens the panel's SEARCH page — after yielding to everything that owns the
     key: (1) a consumer that already handled it (the grid's type-to-edit prevents
     default), (2) modified presses, (3) focused inputs/editors, (4) any open Radix
     layer (palette, dialogs, nav drawer), (5) a focused table CELL (the grid owns
     printables there even when it swallows nothing). Row focus is navigation, not
     typing — it deliberately does NOT block. */
  const peekRef = React.useRef(peek);
  peekRef.current = peek;
  React.useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"], [role="dialog"]')) return;
      if (document.querySelector("td[data-cell-focus]")) return;
      e.preventDefault();
      // a FRESH panel starts with a clean query; pushing onto an open one keeps it
      if (!peekRef.current) setPanelQ("");
      setPeek((p) => {
        if (!p) return { stack: [{ kind: "search" }], set: [] };
        if (p.stack[p.stack.length - 1].kind === "search") return p;
        return { ...p, stack: [...p.stack, { kind: "search" }] };
      });
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  /* copilot shortcuts (only while the feature is configured): ⌘/Ctrl+I toggles it
     (safe — modified); bare `c` opens it, but yields to typing/editors/dialogs/cells
     exactly like `/`; Escape closes it (handled here, above the peek ladder). */
  const copilotOnRef = React.useRef(false);
  copilotOnRef.current = !!config?.copilot;
  React.useEffect(() => {
    const typingOrLayer = (el: HTMLElement | null) =>
      (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) ||
      !!document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"], [role="dialog"]') ||
      !!document.querySelector("td[data-cell-focus]");
    const onKey = (e: KeyboardEvent) => {
      if (!copilotOnRef.current) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) { e.preventDefault(); setCopilotOpen((o) => !o); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (e.key === "Escape") { setCopilotOpen((o) => (o ? false : o)); return; }
      if (e.key === "c" && !typingOrLayer(e.target as HTMLElement | null)) { e.preventDefault(); setCopilotOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* keyboard-nav layer: `?` opens the shortcuts help; `g` then a key jumps via the
     config-driven goChords map; `n` starts a new record. All yield to typing, editors,
     open dialogs/sheets, and focused grid cells — like the `/` and `c` handlers. Runs in
     capture so a resolved `g`-chord wins over any bare single-key shortcut for that key. */
  const goChordsRef = React.useRef<Record<string, string> | undefined>(undefined);
  goChordsRef.current = config?.app.goChords;
  React.useEffect(() => {
    let chordUntil = 0; // a pending `g` chord stays live until this timestamp
    const busy = (el: HTMLElement | null) =>
      (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) ||
      !!document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"], [role="dialog"]') ||
      !!document.querySelector("td[data-cell-focus]");
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (busy(e.target as HTMLElement | null)) return;
      if (chordUntil && Date.now() < chordUntil) {
        chordUntil = 0;
        const dest = goChordsRef.current?.[e.key];
        if (dest) { e.preventDefault(); e.stopPropagation(); window.location.hash = dest; }
        return;
      }
      chordUntil = 0;
      if (e.key === "?") { e.preventDefault(); setShortcutsOpen(true); return; }
      if (e.key === "g" && goChordsRef.current) { e.preventDefault(); chordUntil = Date.now() + 1200; return; }
      if (e.key === "n") { e.preventDefault(); window.dispatchEvent(new Event("nx-new-record")); return; }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const toast = React.useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  // mail deep links that can arrive while SIGNED IN: email verification + account
  // deletion — handled on mount AND on hash changes (a link click in an open app)
  const handledToken = React.useRef<string | null>(null);
  React.useEffect(() => {
    const handle = () => {
      const verify = window.location.hash.match(/#\/verify\?token=([^&]+)/);
      const del = window.location.hash.match(/#\/delete\?token=([^&]+)/);
      const inv = window.location.hash.match(/#\/invite\?token=([^&]+)/);
      const hit = verify ? (["/api/auth/verify", verify[1], "Email verified"] as const)
        : del ? (["/api/auth/delete-confirm", del[1], "Account deleted"] as const)
        : inv ? (["/api/teams/accept", inv[1], "Invitation accepted"] as const) : null;
      if (!hit || handledToken.current === hit[1]) return;
      handledToken.current = hit[1];
      fetch(hit[0], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: hit[1] }) })
        .then((r) => {
          toast(r.ok ? hit[2] : "That link is invalid or expired");
          window.location.hash = "#/";
          probeAuth();
        })
        .catch(() => toast("Network error"));
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, [toast, probeAuth]);

  // Stable identity (functional update + no-op when unchanged) — an inline arrow here
  // recreates the child's load callback every render and spins a refetch/re-render
  // loop (rows detach mid-interaction; measured by the first journey run).
  const onCount = React.useCallback(
    (key: string, n: number) => setCounts((m) => (m[key] === n ? m : { ...m, [key]: n })),
    [],
  );

  React.useEffect(() => {
    api
      .config()
      .then((c) => {
        setConfig(c);
        document.title = c.app.name;
        const skin = resolveSkin(c);
        if (skin) applySkin(skin);
        // a runtime skin saved from /p/theme (app_state) overrides the config skin
        api.state().then((s) => {
          const saved = s["theme:skin"] as Skin | null | undefined;
          if (saved) applySkin(saved);
        }).catch(() => {});
        if (!route.object && !route.page && !/^#\/(reset|verify|delete|invite)\?/.test(window.location.hash)) {
          route.go(c.objects[0] ? `#/o/${c.objects[0].key}` : customPages[0] ? `#/p/${customPages[0].key}` : "#/");
        }
        c.objects.forEach((o) => api.list(o.key).then((rows) => setCounts((m) => ({ ...m, [o.key]: rows.length }))).catch(() => {}));
      })
      .catch((e) => setErr(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("nx-theme", next);
  };

  if (auth?.enabled && !auth.user && config)
    return <Login appName={config.app.name} accounts={auth.accounts} onDone={probeAuth} />;
  if (err)
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--nx-danger)" }}>
        <div className="nxCard" style={{ padding: 24 }}>
          <b>Backend unreachable</b>
          <div style={{ color: "var(--nx-fg-muted)", marginTop: 6 }}>{err} — is `npm run serve` up?</div>
        </div>
      </div>
    );
  if (!config) return <div className="content" data-testid="loading">Loading…</div>;

  const active = config.objects.find((o) => o.key === route.object) ?? config.objects[0];
  const logo = resolveSkin(config)?.logo;
  // team-scoped objects act under the PER-TEAM role; others under the app-wide one
  const activeTeamRole = teams.find((t) => t.slug === activeTeam)?.role as
    | "owner" | "admin" | "member" | "viewer" | undefined;
  const roleFor = (o: typeof active) => (o.teamScoped && auth?.enabled ? activeTeamRole ?? "viewer" : auth?.role);

  /* ---- nav chrome: one knob (config app.nav), three surfaces (sidebar · top bar ·
     mobile drawer) sharing the same item/search renderers so they can't drift ---- */
  const navMode = config.app.nav ?? "side";
  const visiblePages = customPages.filter((p) => (config.features as Record<string, boolean> | undefined)?.[p.key] !== false);
  // every drawer path closes the drawer — including a click on the CURRENT object (no route change)
  const goNav = (h: string) => { route.go(h); setDrawerOpen(false); };
  const brand = (
    <div className="sideBrand">
      <span
        className="sideBrandMark"
        data-testid="brand-mark"
        style={logo?.markBg ? { background: logo.markBg, color: logo.markFg ?? "#ffffff", boxShadow: "none" } : undefined}
      >
        {logo?.url ? <img src={logo.url} alt="" style={{ width: 18, height: 18 }} /> : logo?.mark ?? config.app.name.slice(0, 1)}
      </span>
      <span className="sideBrandName" data-testid="app-name">
        {logo?.wordmark ?? config.app.name}
        {logo?.wordmarkAccent ? <> <b>{logo.wordmarkAccent}</b></> : null}
      </span>
    </div>
  );
  const burger = (
    <button className="navItem navBurger" data-testid="nav-burger" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
      <Menu size={16} />
    </button>
  );
  // the drawer search mirrors the topbar exactly: go to the active object's LIST first,
  // THEN dispatch — a bare event dispatch does nothing visible from a record/custom page
  const searchBox = (inDrawer?: boolean) => (
    <label className={inDrawer ? "topSearch drawerSearch" : "topSearch"} data-testid={inDrawer ? undefined : "global-search"}>
      <input
        placeholder={`Search ${active.label.toLowerCase()}…`}
        data-testid={inDrawer ? "drawer-search" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = (e.target as HTMLInputElement).value;
            route.go(`#/o/${active.key}`);
            window.dispatchEvent(new CustomEvent("nx-search", { detail: v }));
            if (inDrawer) setDrawerOpen(false);
          }
        }}
      />
      {!inDrawer && <span className="kbd">⌘K</span>}
    </label>
  );
  const navButtons = (prefix: "" | "drawer-") => (
    <>
      {config.objects.filter((o) => !o.hideInNav).map((o) => (
        <button
          key={o.key}
          className={`navItem ${o.key === active.key && !route.recordId && !route.page ? "navItem--active" : ""}`}
          data-testid={`${prefix}nav-${o.key}`}
          onClick={() => (prefix ? goNav(`#/o/${o.key}`) : route.go(`#/o/${o.key}`))}
        >
          <span className="navIcon">{ICONS[o.icon ?? ""] ?? <LayoutGrid size={15} />}</span>
          {o.label}
          <span className="navCount">{counts[o.key] ?? ""}</span>
        </button>
      ))}
      {visiblePages.map((p) => (
        <button
          key={p.key}
          className={`navItem ${route.page === p.key ? "navItem--active" : ""}`}
          data-testid={`${prefix}nav-p-${p.key}`}
          onClick={() => (prefix ? goNav(`#/p/${p.key}`) : route.go(`#/p/${p.key}`))}
        >
          <span className="navIcon">{p.icon ?? <LayoutGrid size={15} />}</span>
          {p.label}
        </button>
      ))}
    </>
  );
  const copilotToggle = config.copilot ? (
    <CopilotToggle
      open={copilotOpen}
      onToggle={() => setCopilotOpen((o) => !o)}
      label={config.copilot.title ?? "Copilot"}
      kbd="⌘I"
    />
  ) : null;
  const themeButton = (
    <Tip label="Toggle theme">
      <Button variant="ghost" size="sm" aria-label="Toggle theme" data-testid="theme-toggle" onClick={toggleTheme}
        icon={<span style={{ display: "grid" }}><Sun size={14} className="sunIcon" /><span style={{ display: "none" }}><Moon size={14} /></span></span>} />
    </Tip>
  );

  /* context actions — ONE source feeding two surfaces (the ⌘K palette and the
     panel's actions page). They follow what's on screen: the deepest RECORD page
     in the panel stack (an actions/search page on top still targets the record
     beneath it), else the full record page, else the list. */
  const curRec = peek
    ? [...peek.stack].reverse().find((p): p is Extract<PanelPage, { kind: "record" }> => p.kind === "record") ?? null
    : route.recordId ? { kind: "record" as const, obj: active.key, id: route.recordId } : null;
  const contextActions: { id: string; label: string; run: () => void }[] = [];
  if (curRec) {
    const recCfg = config.objects.find((o) => o.key === curRec.obj);
    if (peek) contextActions.push({ id: "promote", label: "Open full page", run: () => route.go(`#/o/${curRec.obj}/r/${curRec.id}`) });
    contextActions.push({
      id: "fav",
      label: favs.some((f) => f.obj === curRec.obj && f.id === curRec.id) ? "Remove from favorites" : "Add to favorites",
      run: () => {
        const primary = recCfg?.fields.find((f) => f.primary) ?? recCfg?.fields[0];
        api.get(curRec.obj, curRec.id)
          .then((r) => favToggle(curRec.obj, curRec.id, (primary ? formatCell(r[primary.key], primary.type) : "") || String(curRec.id)))
          .catch(() => {});
      },
    });
  } else if (!route.page) {
    contextActions.push({ id: "new", label: `New ${active.labelOne.toLowerCase()}`, run: () => window.dispatchEvent(new Event("nx-new-record")) });
    contextActions.push({ id: "trash", label: "Open trash", run: () => window.dispatchEvent(new Event("nx-open-trash")) });
  }
  // ⌘K over an OPEN panel goes to the panel's actions page (the palette consults
  // this only on its opening edge); a second ⌘K on the actions page pops it back
  const paletteIntercept = () => {
    const p = peekRef.current;
    if (!p) return false;
    if (p.stack[p.stack.length - 1].kind === "actions") popPeek();
    else pushPanel({ kind: "actions" });
    return true;
  };

  /* shortcuts help content — a Core group (the shell's own keys) + an App group built
     from config (the go-to chords + new-record). Only what's actually wired is listed. */
  const shortcutGroups: ShortcutGroup[] = (() => {
    const core: ShortcutGroup["items"] = [
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["/"], label: "Search" },
      ...(config.copilot ? [{ keys: ["⌘", "I"], label: "Toggle copilot" }, { keys: ["C"], label: "Open copilot" }] : []),
      { keys: ["↑", "↓"], label: "Move between rows" },
      { keys: ["J", "K"], label: "Move between rows (vim)" },
      { keys: ["Enter"], label: "Open the focused row" },
      { keys: ["?"], label: "Toggle this help" },
      { keys: ["Esc"], label: "Close / go back" },
    ];
    const app: ShortcutGroup["items"] = [];
    for (const [k, dest] of Object.entries(config.app.goChords ?? {})) {
      const mo = dest.match(/^#\/o\/([^/?]+)/);
      const mp = dest.match(/^#\/p\/([^/?]+)/);
      const label = mo ? (config.objects.find((o) => o.key === mo[1])?.label ?? mo[1])
        : mp ? (customPages.find((p) => p.key === mp[1])?.label ?? mp[1])
        : dest;
      app.push({ keys: ["G", "then", k.toUpperCase()], label: `Go to ${label}` });
    }
    app.push({ keys: ["N"], label: `New ${active.labelOne.toLowerCase()}` });
    return [{ title: "Core", items: core }, { title: "App", items: app }];
  })();

  return (
    <ToastCtx.Provider value={toast}>
      <div className={`shell${navMode === "top" ? " shell--top" : ""}${copilotOpen ? " shell--copilot" : ""}`}>
        {navMode === "top" && (
          <header className="topNav" data-testid="nav-top">
            {burger}
            {brand}
            <nav className="topNavItems">{navButtons("")}</nav>
            <span style={{ flex: 1 }} />
            <div className="topNavTools">
              {favs.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="navItem topNavFavs" data-testid="topnav-favs">
                      <span className="navIcon"><Star size={13} /></span>
                      Favorites
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {favs.map((f) => (
                      <DropdownMenuItem key={`${f.obj}:${f.id}`} data-testid={`fav-link-${f.id}`} onSelect={() => route.go(`#/o/${f.obj}/r/${f.id}`)}>
                        {f.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {teams.length > 0 && (
                <select
                  className="nxCellEdit topNavTeam"
                  data-testid="team-switch"
                  value={activeTeam ?? ""}
                  onChange={(e) => {
                    localStorage.setItem("nx-team", e.target.value);
                    setActiveTeam(e.target.value);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name} · {t.role}</option>
                  ))}
                </select>
              )}
              {config.demo && (
                <span
                  data-testid="demo-badge"
                  title="Seeded fictional rows — replace via starter.config.json or the API"
                  style={{
                    font: "var(--nx-text-meta)", fontWeight: 600, borderRadius: 999, padding: "1px 8px",
                    background: "var(--nx-warn-soft, var(--nx-accent-soft))", color: "var(--nx-warn, var(--nx-accent))",
                  }}
                >
                  Demo data
                </span>
              )}
              {searchBox()}
            </div>
            {copilotToggle}
            <SyncButton />
            {themeButton}
            {auth?.user && (
              <button
                className="navItem topNavSignout"
                data-testid="logout"
                onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(probeAuth)}
              >
                Sign out
              </button>
            )}
          </header>
        )}
        {navMode === "side" && (
        <aside className="side">
          {brand}
          {teams.length > 0 && (
            <select
              className="nxCellEdit sideTeam"
              data-testid="team-switch"
              value={activeTeam ?? ""}
              style={{ margin: "0 8px", width: "calc(100% - 16px)", background: "var(--nx-chrome-active-bg)", color: "var(--nx-chrome-fg)", borderColor: "var(--nx-chrome-border)" }}
              onChange={(e) => {
                localStorage.setItem("nx-team", e.target.value);
                setActiveTeam(e.target.value);
              }}
            >
              {teams.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name} · {t.role}</option>
              ))}
            </select>
          )}
          <div className="sideSection">
            <span className="nxMicro">Records</span>
            <nav className="sideNav" data-testid="nav">
              {navButtons("")}
              {burger}
            </nav>
          </div>
          {favs.length > 0 && (
            <div className="sideSection sideFavs" data-testid="fav-shelf">
              <span className="nxMicro">Favorites</span>
              <nav className="sideNav">
                {favs.map((f) => (
                  <button
                    key={`${f.obj}:${f.id}`}
                    className={`navItem ${route.recordId === f.id ? "navItem--active" : ""}`}
                    data-testid={`fav-link-${f.id}`}
                    onClick={() => route.go(`#/o/${f.obj}/r/${f.id}`)}
                  >
                    <span className="navIcon"><Star size={13} /></span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
          <div className="sideFoot">
            <span>v0.2 · starter</span>
            {config.demo && (
              <span
                data-testid="demo-badge"
                title="Seeded fictional rows — replace via starter.config.json or the API"
                style={{
                  font: "var(--nx-text-meta)", fontWeight: 600, borderRadius: 999, padding: "1px 8px",
                  background: "var(--nx-warn-soft, var(--nx-accent-soft))", color: "var(--nx-warn, var(--nx-accent))",
                }}
              >
                Demo data
              </span>
            )}
            {auth?.user && (
              <button
                className="navItem"
                style={{ width: "auto", marginLeft: "auto", padding: "2px 8px" }}
                data-testid="logout"
                onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(probeAuth)}
              >
                Sign out
              </button>
            )}
          </div>
        </aside>
        )}

        <div className="main">
          {navMode === "side" && (
            <header className="top">
              <span className="crumb">
                <b>{route.page ? customPages.find((p) => p.key === route.page)?.label ?? route.page : active.label}</b>
                {route.recordId && <span>/ record</span>}
              </span>
              {searchBox()}
              {copilotToggle}
              <SyncButton />
              {themeButton}
            </header>
          )}

          <main className="content">
            {route.page ? (
              (() => {
                const P = customPages.find((p) => p.key === route.page)?.component;
                return P ? <P /> : <div className="nxCard" style={{ padding: 32 }}>Unknown page.</div>;
              })()
            ) : route.recordId ? (
              <RecordView
                /* keyed per record: tab choice + draft text must never leak
                   from one record's page into another's */
                key={`${active.key}:${route.recordId}:${activeTeam ?? ""}`}
                role={roleFor(active)}
                sessionUser={auth?.user}
                appConfig={config}
                config={active}
                id={route.recordId}
                onBack={() => route.go(`#/o/${active.key}`)}
                go={route.go}
              />
            ) : (
              <ObjectView
                key={`${active.key}:${activeTeam ?? ""}`}
                appConfig={config}
                config={active}
                role={roleFor(active)}
                users={config.users ?? []}
                onOpen={(id, set) =>
                  // every record opens in the right-side panel by default (a document gets a
                  // WIDE panel — see peekPanel--doc); `openIn: "page"` forces a full page instead
                  (active.openIn ?? "peek") === "page"
                    ? route.go(`#/o/${active.key}/r/${id}`)
                    : openPeek(active.key, id, set ?? [])
                }
                onCountChange={onCount}
                viewIcons={{ table: <Table2 size={13} />, kanban: <Kanban size={13} /> }}
              />
            )}
          </main>
        </div>

        {peek && (() => {
          const top = peek.stack[peek.stack.length - 1];
          const cfg = top.kind === "record" ? config.objects.find((o) => o.key === top.obj) : undefined;
          if (top.kind === "record" && !cfg) return null;
          const root = peek.stack[0];
          // record-to-record paging exists only on a lone RECORD root
          const rootIdx = root.kind === "record" ? peek.set.indexOf(root.id) : -1;
          const canPage = peek.stack.length === 1 && root.kind === "record" && rootIdx >= 0 && peek.set.length > 1;
          const step = (d: number) => {
            if (root.kind !== "record") return;
            const next = peek.set[(rootIdx + d + peek.set.length) % peek.set.length];
            openPeek(root.obj, next, peek.set);
          };
          const isDocPeek = top.kind === "record" && cfg?.recordLayout === "document";
          return (
            <>
            <div className={`peekPanel${isDocPeek ? " peekPanel--doc" : ""}${canPage && root.kind === "record" ? " peekPanel--paged" : ""}`} data-testid="peek-panel" data-doc-peek={String(!!isDocPeek)}>
              <div className="peekHead">
                {peek.stack.length > 1 && (
                  <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} aria-label="Back one page" data-testid="peek-back" onClick={popPeek} />
                )}
                <span className="peekCrumbs" data-testid="peek-crumbs">
                  {peek.stack.map((s, i) => {
                    const label = s.kind === "record"
                      ? config.objects.find((o) => o.key === s.obj)?.labelOne ?? s.obj
                      : s.kind === "search" ? t("panel.search") : t("panel.actions");
                    return <span key={`${s.kind}:${i}`} className="peekCrumb">{label}</span>;
                  })}
                </span>
                <span className="nxSpacer" style={{ flex: 1 }} />
                {canPage && (
                  <span className="peekPager">
                    <Button variant="ghost" size="sm" icon={<ChevronLeft size={13} />} aria-label="Previous record" data-testid="peek-prev" onClick={() => step(-1)} />
                    <span data-testid="peek-pos">{rootIdx + 1} of {peek.set.length}</span>
                    <Button variant="ghost" size="sm" icon={<ChevronRight size={13} />} aria-label="Next record" data-testid="peek-next" onClick={() => step(1)} />
                  </span>
                )}
                {top.kind === "record" && (
                  <>
                    <Tip label={t("panel.actions")}>
                      <Button variant="ghost" size="sm" icon={<Zap size={13} />} aria-label="Actions" data-testid="peek-actions"
                        onClick={() => pushPanel({ kind: "actions" })} />
                    </Tip>
                    <Tip label="Open full page">
                      <Button variant="ghost" size="sm" icon={<Maximize2 size={13} />} aria-label="Open full page" data-testid="peek-promote"
                        onClick={() => route.go(`#/o/${top.obj}/r/${top.id}`)} />
                    </Tip>
                  </>
                )}
                <Button variant="ghost" size="sm" icon={<X size={14} />} aria-label="Close panel" data-testid="peek-close" onClick={closePeek} />
              </div>
              <div className="peekBody">
                {top.kind === "record" && cfg ? (
                  <RecordView
                    key={`peek:${top.obj}:${top.id}:${activeTeam ?? ""}`}
                    role={roleFor(cfg)}
                    sessionUser={auth?.user}
                    appConfig={config}
                    config={cfg}
                    id={top.id}
                    onBack={popPeek}
                    go={(hash) => {
                      const m = hash.match(/^#\/o\/([^/]+)\/r\/([^/?]+)/);
                      if (m) pushPeek(m[1], m[2]);
                      else { setPeek(null); route.go(hash); }
                    }}
                  />
                ) : top.kind === "search" ? (
                  <PanelSearch
                    config={config}
                    q={panelQ}
                    onQ={setPanelQ}
                    onOpen={(obj, id) => pushPeek(obj, id)}
                    onPop={popPeek}
                  />
                ) : (
                  <PanelActions actions={contextActions} onSearch={() => pushPanel({ kind: "search" })} />
                )}
              </div>
            </div>
            {/* mobile twin of the desktop peek pager: step the record SET one at a time.
                Hidden ≥769px (the head pager takes over there). */}
            {canPage && root.kind === "record" && (
              <MobileReviewBanner
                index={rootIdx}
                total={peek.set.length}
                title={config.objects.find((o) => o.key === root.obj)?.labelOne}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                actions={[{ label: "Open", testid: "review-open", onClick: () => route.go(`#/o/${root.obj}/r/${root.id}`) }]}
              />
            )}
            </>
          );
        })()}

        <div className="toastWrap" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id} data-testid="toast">{t.text}</div>
          ))}
        </div>

        {/* mobile bottom tab bar — primary navigation on phones: one tab per
            config.objects (honours hideInNav) plus a Copilot tab when configured. A bounded
            bar beats a crowded one, so utility + custom pages stay in the burger/drawer
            (which also keeps favorites/team/sign-out). Hidden on desktop. */}
        <nav className="mobileNav" data-testid="mobile-nav">
          {config.objects.filter((o) => !o.hideInNav).map((o) => (
            <button
              key={o.key}
              className={`mnItem${o.key === active.key && !route.page && !copilotOpen ? " mnItem--active" : ""}`}
              data-testid={`mnav-${o.key}`}
              onClick={() => { setCopilotOpen(false); route.go(`#/o/${o.key}`); }}
            >
              <span className="mnIcon">{ICONS[o.icon ?? ""] ?? <LayoutGrid size={18} />}</span>
              <span className="mnLabel">{o.label}</span>
            </button>
          ))}
          {config.copilot && (
            <button
              className={`mnItem${copilotOpen ? " mnItem--active" : ""}`}
              data-testid="mnav-copilot"
              onClick={() => setCopilotOpen((o) => !o)}
            >
              <span className="mnIcon"><Sparkles size={18} /></span>
              <span className="mnLabel">{config.copilot.title ?? "Copilot"}</span>
            </button>
          )}
        </nav>

        {/* mobile nav drawer — everything the sidebar holds, behind the burger */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="navDrawer" data-testid="nav-drawer">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>Navigate to any object, page, or favorite.</SheetDescription>
            </SheetHeader>
            <div className="drawerBody">
              {searchBox(true)}
              <nav className="sideNav">{navButtons("drawer-")}</nav>
              {favs.length > 0 && (
                <div className="drawerSection">
                  <span className="nxMicro">Favorites</span>
                  <nav className="sideNav">
                    {favs.map((f) => (
                      <button
                        key={`${f.obj}:${f.id}`}
                        className="navItem"
                        data-testid={`drawer-fav-${f.id}`}
                        onClick={() => goNav(`#/o/${f.obj}/r/${f.id}`)}
                      >
                        <span className="navIcon"><Star size={13} /></span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              )}
              {teams.length > 0 && (
                <select
                  className="nxCellEdit drawerTeam"
                  data-testid="drawer-team-switch"
                  value={activeTeam ?? ""}
                  onChange={(e) => {
                    localStorage.setItem("nx-team", e.target.value);
                    setActiveTeam(e.target.value);
                  }}
                >
                  {teams.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name} · {t.role}</option>
                  ))}
                </select>
              )}
              {auth?.user && (
                <button
                  className="navItem"
                  data-testid="drawer-signout"
                  onClick={() => {
                    setDrawerOpen(false);
                    fetch("/api/auth/logout", { method: "POST" }).then(probeAuth);
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <CommandPalette config={config} go={route.go} actions={contextActions} intercept={paletteIntercept} />
        {/* copilot supersedes the iframe ChatDock; ChatDock is the fallback when the
            copilot block is absent but a chat.embedUrl is configured */}
        {config.copilot
          ? <Copilot open={copilotOpen} onClose={() => setCopilotOpen(false)} config={config} />
          : <ChatDock embedUrl={config.chat?.embedUrl} />}
        {shortcutsOpen && (
          <ShortcutsOverlay groups={shortcutGroups} onClose={() => setShortcutsOpen(false)} />
        )}
      </div>
    </ToastCtx.Provider>
  );
}
