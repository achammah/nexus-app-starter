import * as React from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronLeft, ChevronRight, Handshake, LayoutGrid, Maximize2, Menu, Moon, Sun, Users, Table2, Kanban, X } from "lucide-react";
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
import { ChatDock } from "./ChatDock";
import { Login } from "./Login";
import { Button } from "../ui/primitives/Button";
import { Tip } from "../ui/primitives/fields";
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

type Toast = { id: number; text: string };
const ToastCtx = React.createContext<(text: string) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

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
  /* ---- side peek: one right-edge panel, records stack onto it (open a related
     record → push; Escape/back → pop; empty → close). The list stays behind. ---- */
  const [peek, setPeek] = React.useState<{ stack: { obj: string; id: string }[]; set: string[] } | null>(null);
  const openPeek = React.useCallback((obj: string, id: string, set: string[] = []) => {
    setPeek({ stack: [{ obj, id }], set });
    // root in the URL: reload and share both land back on this peek
    const h = `#/o/${obj}?peek=${id}`;
    if (window.location.hash !== h) window.history.replaceState(null, "", h);
  }, []);
  const pushPeek = React.useCallback((obj: string, id: string) => setPeek((p) => (p ? { ...p, stack: [...p.stack, { obj, id }] } : { stack: [{ obj, id }], set: [] })), []);
  const popPeek = React.useCallback(() => setPeek((p) => {
    if (p && p.stack.length > 1) return { ...p, stack: p.stack.slice(0, -1) };
    const root = p?.stack[0];
    if (root) window.history.replaceState(null, "", `#/o/${root.obj}`);
    return null;
  }), []);
  const closePeek = React.useCallback(() => {
    setPeek((p) => {
      const root = p?.stack[0];
      if (root) window.history.replaceState(null, "", `#/o/${root.obj}`);
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
      setPeek((p) => (p && p.stack[0]?.id === route.peekId ? p : { stack: [{ obj: route.object as string, id: route.peekId as string }], set: p?.set ?? [] }));
    } else {
      setPeek(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.object, route.page, route.recordId, route.peekId]);

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
      {config.objects.map((o) => (
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
  const themeButton = (
    <Tip label="Toggle theme">
      <Button variant="ghost" size="sm" aria-label="Toggle theme" data-testid="theme-toggle" onClick={toggleTheme}
        icon={<span style={{ display: "grid" }}><Sun size={14} className="sunIcon" /><span style={{ display: "none" }}><Moon size={14} /></span></span>} />
    </Tip>
  );

  // palette actions follow what's on screen: a record (peek or full page) beats the list
  const curRec = peek ? peek.stack[peek.stack.length - 1] : route.recordId ? { obj: active.key, id: route.recordId } : null;
  const paletteActions: { id: string; label: string; run: () => void }[] = [];
  if (curRec) {
    const recCfg = config.objects.find((o) => o.key === curRec.obj);
    if (peek) paletteActions.push({ id: "promote", label: "Open full page", run: () => route.go(`#/o/${curRec.obj}/r/${curRec.id}`) });
    paletteActions.push({
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
    paletteActions.push({ id: "new", label: `New ${active.labelOne.toLowerCase()}`, run: () => window.dispatchEvent(new Event("nx-new-record")) });
    paletteActions.push({ id: "trash", label: "Open trash", run: () => window.dispatchEvent(new Event("nx-open-trash")) });
  }

  return (
    <ToastCtx.Provider value={toast}>
      <div className={`shell${navMode === "top" ? " shell--top" : ""}`}>
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
                config={active}
                role={roleFor(active)}
                users={config.users ?? []}
                onOpen={(id, set) =>
                  active.openIn === "page" ? route.go(`#/o/${active.key}/r/${id}`) : openPeek(active.key, id, set ?? [])
                }
                onCountChange={onCount}
                viewIcons={{ table: <Table2 size={13} />, kanban: <Kanban size={13} /> }}
              />
            )}
          </main>
        </div>

        {peek && (() => {
          const top = peek.stack[peek.stack.length - 1];
          const cfg = config.objects.find((o) => o.key === top.obj);
          if (!cfg) return null;
          const rootIdx = peek.set.indexOf(peek.stack[0].id);
          const canPage = peek.stack.length === 1 && rootIdx >= 0 && peek.set.length > 1;
          const step = (d: number) => {
            const next = peek.set[(rootIdx + d + peek.set.length) % peek.set.length];
            openPeek(peek.stack[0].obj, next, peek.set);
          };
          return (
            <div className="peekPanel" data-testid="peek-panel">
              <div className="peekHead">
                {peek.stack.length > 1 && (
                  <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} aria-label="Back one record" data-testid="peek-back" onClick={popPeek} />
                )}
                <span className="peekCrumbs" data-testid="peek-crumbs">
                  {peek.stack.map((s, i) => {
                    const c = config.objects.find((o) => o.key === s.obj);
                    return <span key={`${s.obj}:${s.id}:${i}`} className="peekCrumb">{c?.labelOne ?? s.obj}</span>;
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
                <Tip label="Open full page">
                  <Button variant="ghost" size="sm" icon={<Maximize2 size={13} />} aria-label="Open full page" data-testid="peek-promote"
                    onClick={() => route.go(`#/o/${top.obj}/r/${top.id}`)} />
                </Tip>
                <Button variant="ghost" size="sm" icon={<X size={14} />} aria-label="Close panel" data-testid="peek-close" onClick={closePeek} />
              </div>
              <div className="peekBody">
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
              </div>
            </div>
          );
        })()}

        <div className="toastWrap" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id} data-testid="toast">{t.text}</div>
          ))}
        </div>

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

        <CommandPalette config={config} go={route.go} actions={paletteActions} />
        <ChatDock embedUrl={config.chat?.embedUrl} />
      </div>
    </ToastCtx.Provider>
  );
}
