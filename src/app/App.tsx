import * as React from "react";
import { Building2, Handshake, LayoutGrid, Moon, Sun, Users, Table2, Kanban } from "lucide-react";
import { api, type AppConfig } from "./api";
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

/* Hash routes: #/o/<object> · #/o/<object>/r/<id> · #/p/<page>. Hand-rolled (no router dep). */
function useHashRoute() {
  const [hash, setHash] = React.useState(window.location.hash || "#/");
  React.useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
  return {
    object: parts[0] === "o" ? parts[1] : undefined,
    recordId: parts[2] === "r" ? parts[3] : undefined,
    page: parts[0] === "p" ? parts[1] : undefined,
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

  return (
    <ToastCtx.Provider value={toast}>
      <div className="shell">
        <aside className="side">
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
          {teams.length > 0 && (
            <select
              className="nxCellEdit"
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
              {config.objects.map((o) => (
                <button
                  key={o.key}
                  className={`navItem ${o.key === active.key && !route.recordId && !route.page ? "navItem--active" : ""}`}
                  data-testid={`nav-${o.key}`}
                  onClick={() => route.go(`#/o/${o.key}`)}
                >
                  <span className="navIcon">{ICONS[o.icon ?? ""] ?? <LayoutGrid size={15} />}</span>
                  {o.label}
                  <span className="navCount">{counts[o.key] ?? ""}</span>
                </button>
              ))}
              {customPages.filter((p) => (config.features as Record<string, boolean> | undefined)?.[p.key] !== false).map((p) => (
                <button
                  key={p.key}
                  className={`navItem ${route.page === p.key ? "navItem--active" : ""}`}
                  data-testid={`nav-p-${p.key}`}
                  onClick={() => route.go(`#/p/${p.key}`)}
                >
                  <span className="navIcon">{p.icon ?? <LayoutGrid size={15} />}</span>
                  {p.label}
                </button>
              ))}
            </nav>
          </div>
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

        <div className="main">
          <header className="top">
            <span className="crumb">
              <b>{route.page ? customPages.find((p) => p.key === route.page)?.label ?? route.page : active.label}</b>
              {route.recordId && <span>/ record</span>}
            </span>
            <label className="topSearch" data-testid="global-search">
              <input
                placeholder={`Search ${active.label.toLowerCase()}…`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value;
                    route.go(`#/o/${active.key}`);
                    window.dispatchEvent(new CustomEvent("nx-search", { detail: v }));
                  }
                }}
              />
              <span className="kbd">⌘K</span>
            </label>
            <Tip label="Toggle theme">
              <Button variant="ghost" size="sm" aria-label="Toggle theme" data-testid="theme-toggle" onClick={toggleTheme}
                icon={<span style={{ display: "grid" }}><Sun size={14} className="sunIcon" /><span style={{ display: "none" }}><Moon size={14} /></span></span>} />
            </Tip>
          </header>

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
                onOpen={(id) => route.go(`#/o/${active.key}/r/${id}`)}
                onCountChange={onCount}
                viewIcons={{ table: <Table2 size={13} />, kanban: <Kanban size={13} /> }}
              />
            )}
          </main>
        </div>

        <div className="toastWrap" aria-live="polite">
          {toasts.map((t) => (
            <div className="toast" key={t.id} data-testid="toast">{t.text}</div>
          ))}
        </div>

        <CommandPalette config={config} go={route.go} />
        <ChatDock embedUrl={config.chat?.embedUrl} />
      </div>
    </ToastCtx.Provider>
  );
}
