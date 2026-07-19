import * as React from "react";
import { Building2, Handshake, LayoutGrid, Moon, Sun, Users, Table2, Kanban } from "lucide-react";
import { api, type AppConfig } from "./api";
import { ObjectView } from "./ObjectView";
import { RecordView } from "./RecordView";
import { Button } from "../ui/primitives/Button";
import { Tip } from "../ui/primitives/fields";

/* Hash routes: #/o/<object> · #/o/<object>/r/<id>. Hand-rolled (no router dep). */
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

export function App() {
  const [config, setConfig] = React.useState<AppConfig | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [err, setErr] = React.useState<string | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const route = useHashRoute();

  const toast = React.useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

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
        if (!route.object) route.go(`#/o/${c.objects[0].key}`);
        c.objects.forEach((o) => api.list(o.key).then((rows) => setCounts((m) => ({ ...m, [o.key]: rows.length }))).catch(() => {}));
      })
      .catch((e) => setErr(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const cur = document.documentElement.dataset.theme
      ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("nx-theme", next);
  };

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

  return (
    <ToastCtx.Provider value={toast}>
      <div className="shell">
        <aside className="side">
          <div className="sideBrand">
            <span className="sideBrandMark">{config.app.name.slice(0, 1)}</span>
            <span className="sideBrandName" data-testid="app-name">{config.app.name}</span>
          </div>
          <div className="sideSection">
            <span className="nxMicro">Records</span>
            <nav className="sideNav" data-testid="nav">
              {config.objects.map((o) => (
                <button
                  key={o.key}
                  className={`navItem ${o.key === active.key && !route.recordId ? "navItem--active" : ""}`}
                  data-testid={`nav-${o.key}`}
                  onClick={() => route.go(`#/o/${o.key}`)}
                >
                  <span className="navIcon">{ICONS[o.icon ?? ""] ?? <LayoutGrid size={15} />}</span>
                  {o.label}
                  <span className="navCount">{counts[o.key] ?? ""}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="sideFoot">
            <span>v0.1 · starter</span>
          </div>
        </aside>

        <div className="main">
          <header className="top">
            <span className="crumb">
              <b>{active.label}</b>
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
              <span className="kbd">⏎</span>
            </label>
            <Tip label="Toggle theme">
              <Button variant="ghost" size="sm" aria-label="Toggle theme" data-testid="theme-toggle" onClick={toggleTheme}
                icon={<span style={{ display: "grid" }}><Sun size={14} className="sunIcon" /><span style={{ display: "none" }}><Moon size={14} /></span></span>} />
            </Tip>
          </header>

          <main className="content">
            {route.recordId ? (
              <RecordView config={active} id={route.recordId} onBack={() => route.go(`#/o/${active.key}`)} />
            ) : (
              <ObjectView
                key={active.key}
                config={active}
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
      </div>
    </ToastCtx.Provider>
  );
}
