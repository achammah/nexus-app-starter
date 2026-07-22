import * as React from "react";
import { api } from "../api";
import { t } from "../i18n";
import { ThinkingDots } from "../../ui/primitives/ThinkingDots";
import {
  LazyViewer3DSurface,
  viewer3dStoreKey,
  isViewer3dSnapshot,
  seedScene,
  type Viewer3DSnapshot,
} from "../../ui/blocks/viewer3d";

/* 3D viewer page — an object viewer (orbit / spin / hotspots) or a 3D floor plan,
   as the page surface itself. Free-surface: the scene persists as ONE snapshot under
   an app-state key. Mirrors the Spreadsheet / Document / Presentation / ESign
   precedent (workbookStoreKey … → viewer3dStoreKey). The three.js engine is lazy,
   so an app declaring no 3D page pays ~0 eager bytes. */

const SAVE_DELAY = 700;
type Phase = "loading" | "ready";

/* `pageKey` namespaces the stored scene so several 3D pages coexist; `scene`
   picks which demo seeds an unset page ("vehicle" | "floorplan"). */
export function Viewer3DPage({
  pageKey = "viewer3d",
  demoSeed = true,
  scene = "vehicle",
}: { pageKey?: string; demoSeed?: boolean; scene?: "vehicle" | "floorplan" }) {
  const KEY = React.useMemo(() => viewer3dStoreKey(pageKey), [pageKey]);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [initial, setInitial] = React.useState<Viewer3DSnapshot | null>(null);
  const [reloadNonce] = React.useState(0);

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = React.useCallback((snap: Viewer3DSnapshot) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { api.setState(KEY, snap).catch(() => {}); }, SAVE_DELAY);
  }, [KEY]);
  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  React.useEffect(() => {
    let live = true;
    api.state().then((s) => {
      if (!live) return;
      const snap = s[KEY];
      if (isViewer3dSnapshot(snap)) { setInitial(snap); }
      else {
        const seed = seedScene(scene);
        setInitial(seed);
        if (demoSeed) api.setState(KEY, seed).catch(() => {});
      }
      setPhase("ready");
    }).catch(() => { setInitial(seedScene(scene)); setPhase("ready"); });
    return () => { live = false; };
  }, [KEY, demoSeed, scene]);

  const loading = (
    <div className="nx-rise-in-sm" style={{ padding: 24 }}>
      <ThinkingDots label={t("page.generic.loading")} />
    </div>
  );

  if (phase === "loading") {
    return <div className="pageBleed" data-testid="page-viewer3d">{loading}</div>;
  }

  return (
    <div className="pageBleed" data-testid="page-viewer3d">
      {/* three.js ships behind the lazy split — Suspense keeps the page responsive
         while the engine chunk loads */}
      <React.Suspense fallback={loading}>
        <LazyViewer3DSurface value={initial} onChange={persist} reloadNonce={reloadNonce} />
      </React.Suspense>
    </div>
  );
}

export default Viewer3DPage;
