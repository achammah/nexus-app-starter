/* map-view lane journeys — the `map` view taken to Google-Maps depth: a dense
   demo (102 located rows across Western Europe → GL clustering + heatmap), the
   basemap switcher, layer toggles, cluster-radius control, color/size legend,
   draw/measure + filter-by-area, search + (offline mock) geocode, route between
   records, and click-to-add.
   EVERY context aborts non-localhost requests (tile/style hosts), so runs are
   deterministic with no network AND exercise the designed fallback (token-only
   canvas): assertions read DOM + the container's GL-state mirror (data-map-*),
   never tile pixels. The geocode/route seam is a LOCAL mock (no network), so it
   works on this offline path. Demo journeys drive the MAIN app (demo_places);
   cluster-scale/misconfig boot journeys/fixtures/map-perf.config.json on the lane
   band (5881/5882). */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};

/* external requests (basemap styles + tiles) abort — offline-deterministic */
const abortExternal = (ctx) =>
  ctx.route((url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1", (r) => r.abort());

const openMap = async (p, base, objectKey) => {
  await p.goto(`${base}/#/o/${objectKey}`);
  await p.waitForSelector(`[data-testid="map-${objectKey}"]`);
  await p.waitForFunction(
    (key) => document.querySelector(`[data-testid="map-${key}"]`)?.getAttribute("data-map-ready") === "1",
    objectKey,
    { timeout: 20000 },
  );
};

const attr = (p, key, name) => p.getAttribute(`[data-testid="map-${key}"]`, name);

/* click the map canvas at a fractional position (draw/measure paths) */
const clickCanvas = async (p, key, fx, fy) => {
  const box = await p.locator(`[data-testid="map-${key}"] canvas`).first().boundingBox();
  await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
};

/* narrow the plotted set via the host list-search → drops below the cluster
   threshold → real DOM markers to click/focus */
const hostSearch = async (p, key, term) => {
  await p.fill('[data-testid="list-search"]', term);
  await p.waitForSelector(`[data-testid="map-${key}"] [data-testid^="map-marker-"]`, { timeout: 10000 });
};

async function bootFixture(ROOT, port) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: "journeys/fixtures/map-perf.config.json" };
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

/* deterministic PRNG — the 10k perf rows are the same every run */
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

async function seed10k(base) {
  const rand = mulberry32(42);
  for (let batch = 0; batch < 5; batch++) {
    const rows = [];
    for (let i = 0; i < 2000; i++) {
      const n = batch * 2000 + i;
      rows.push({
        name: `Site ${n}`,
        lat: Math.round((36 + rand() * 24) * 10000) / 10000,
        lng: Math.round((-10 + rand() * 35) * 10000) / 10000,
      });
    }
    const r = await fetch(`${base}/api/objects/places_perf/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!r.ok) throw new Error(`import batch ${batch} → ${r.status}`);
  }
}

const wide = (page) => page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });

export default [
  {
    name: "map-dense-clusters", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      assert((await attr(p, "demo_places", "data-map-mode")) === "cluster", "102 located rows render as GL clusters (dense demo, not scattered pins)");
      await p.waitForFunction(() => Number(document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-clusters")) > 0, { timeout: 10000 });
      assert(true, "cluster circles render (GL state mirrored on data-map-clusters)");
      assert((await attr(p, "demo_places", "data-map-tiles")) === "fallback", "tiles unreachable → token fallback canvas, clustering still renders");
      const legend = await p.textContent('[data-testid="map-legend"]');
      assert(legend?.includes("Kind") && legend?.includes("Office") && legend?.includes("Headcount"), `legend shows color options + the size field (${legend?.slice(0, 60)})`);
      const chip = await p.textContent('[data-testid="map-without-location"]');
      assert(chip?.includes("5 without location"), `the corner chip counts coordless records (${chip})`);
      await shot(p, ROOT, "map-dense");
      await ctx.close();
    },
  },
  {
    name: "map-spiderfy", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      // turn clustering off → 100+ individual pins; the dense metros collide, so
      // colliding groups fan onto a ring with leader lines (no unreadable stacks)
      await p.click('[data-testid="map-layers-btn"]');
      await p.click('[data-testid="map-layer-clusters"]');
      await p.click('[data-testid="map-layers-btn"]');
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-mode") === "markers", { timeout: 8000 });
      await p.waitForFunction(() => document.querySelectorAll('[data-testid="map-demo_places"] .nxMapLeader').length > 0, { timeout: 8000 });
      const leaders = await p.locator('[data-testid="map-demo_places"] .nxMapLeader').count();
      assert(leaders > 0, `colliding pins spiderfy out with leader lines instead of stacking (${leaders} fanned)`);
      await shot(p, ROOT, "map-spiderfy");
      await ctx.close();
    },
  },
  {
    name: "map-search-open", feature: "Map view geocode + search",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.fill('[data-testid="map-search"]', "Aurora");
      await p.waitForSelector('[data-testid="map-search-result-pl_1"]', { timeout: 8000 });
      await p.click('[data-testid="map-search-result-pl_1"]');
      await p.waitForSelector('[data-testid="map-popup"]');
      const popup = await p.textContent('[data-testid="map-popup"]');
      assert(popup?.includes("Aurora Works Ghent"), `map search flies to the record + opens its card (${popup?.slice(0, 50)})`);
      await shot(p, ROOT, "map-search");
      await p.click('[data-testid="map-popup-open"]');
      await p.waitForSelector('[data-testid="peek-panel"]');
      await p.waitForFunction((t) => document.querySelector('[data-testid="peek-panel"]')?.textContent?.includes(t), "Aurora Works Ghent", { timeout: 10000 });
      assert(true, "popup Open lands on the record peek");
      await ctx.close();
    },
  },
  {
    name: "map-geocode", feature: "Map view geocode + search",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.fill('[data-testid="map-search"]', "Paris");
      await p.waitForSelector('[data-testid="map-geocode-result-g0"]', { timeout: 8000 });
      const label = await p.textContent('[data-testid="map-geocode-result-g0"]');
      assert(label?.includes("Paris"), `the (offline mock) geocoder returns an address match (${label?.slice(0, 40)})`);
      await p.click('[data-testid="map-geocode-result-g0"]');
      await p.waitForSelector('[data-testid="map-search-pin"]', { timeout: 8000 });
      assert(true, "picking a geocode result flies the map + drops a search pin");
      await shot(p, ROOT, "map-geocode");
      await ctx.close();
    },
  },
  {
    name: "map-basemap-switch", feature: "Map view basemaps",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      assert((await attr(p, "demo_places", "data-map-basemap")) === "streets", "default basemap is streets");
      // open once, assert the switcher offers all five basemaps
      await p.click('[data-testid="map-basemap-btn"]');
      await p.waitForSelector('[data-testid="map-basemap-satellite"]', { timeout: 6000 });
      for (const id of ["streets", "light", "dark", "satellite", "terrain"]) {
        assert((await p.locator(`[data-testid="map-basemap-${id}"]`).count()) === 1, `the switcher offers ${id}`);
      }
      await p.click('[data-testid="map-basemap-satellite"]');
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-basemap") === "satellite", { timeout: 8000 });
      assert(true, "picking Satellite switches the basemap");
      // reopen AFTER the menu fully closes, pick Dark
      await p.waitForSelector('[data-testid="map-basemap-satellite"]', { state: "detached", timeout: 6000 });
      await p.click('[data-testid="map-basemap-btn"]');
      await p.waitForSelector('[data-testid="map-basemap-dark"]', { timeout: 6000 });
      await p.click('[data-testid="map-basemap-dark"]');
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-basemap") === "dark", { timeout: 8000 });
      assert(true, "switching again to Dark applies (data-map-basemap=dark)");
      await shot(p, ROOT, "map-basemap-dark");
      await ctx.close();
    },
  },
  {
    name: "map-layers-heatmap", feature: "Map view layers + heatmap",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-layers-btn"]');
      await p.waitForSelector('[data-testid="map-layers-panel"]');
      await p.click('[data-testid="map-layer-heatmap"]');
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-heatmap") === "1", { timeout: 8000 });
      assert(true, "the Heatmap toggle turns the heatmap layer on (data-map-heatmap=1)");
      await shot(p, ROOT, "map-heatmap");
      await p.click('[data-testid="map-layer-points"]');
      await p.waitForFunction(() => {
        const el = document.querySelector('[data-testid="map-demo_places"]');
        return el?.getAttribute("data-map-points") === "0" && el?.getAttribute("data-map-mode") === "heatmap";
      }, { timeout: 8000 });
      assert(true, "turning Points off leaves a heatmap-only view (data-map-mode=heatmap)");
      await ctx.close();
    },
  },
  {
    name: "map-cluster-radius", feature: "Map view layers + heatmap",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      const before = await attr(p, "demo_places", "data-map-clusterradius");
      await p.click('[data-testid="map-layers-btn"]');
      await p.waitForSelector('[data-testid="map-cluster-radius"]');
      await p.focus('[data-testid="map-cluster-radius"]');
      for (let i = 0; i < 3; i++) await p.press('[data-testid="map-cluster-radius"]', "ArrowRight");
      await p.waitForFunction((b) => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-clusterradius") !== b, before, { timeout: 8000 });
      const after = await attr(p, "demo_places", "data-map-clusterradius");
      assert(Number(after) > Number(before), `the cluster-radius control re-clusters live (${before}px → ${after}px)`);
      assert((await attr(p, "demo_places", "data-map-mode")) === "cluster", "clusters still render after the radius change");
      await ctx.close();
    },
  },
  {
    name: "map-draw-measure", feature: "Map view draw + measure",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-draw-line"]');
      assert((await attr(p, "demo_places", "data-map-drawmode")) === "line", "the ruler tool enters line-measure mode");
      await clickCanvas(p, "demo_places", 0.32, 0.4);
      await clickCanvas(p, "demo_places", 0.66, 0.62);
      await p.waitForFunction(() => (document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-measure") || "") !== "", { timeout: 8000 });
      const measure = await attr(p, "demo_places", "data-map-measure");
      assert(/\d/.test(measure ?? ""), `two clicks measure a real distance (${measure})`);
      await p.waitForSelector('[data-testid="map-measure-readout"]');
      await shot(p, ROOT, "map-measure");
      await ctx.close();
    },
  },
  {
    name: "map-draw-area-filter", feature: "Map view draw + measure",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-draw-polygon"]');
      for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]) await clickCanvas(p, "demo_places", fx, fy);
      await p.waitForSelector('[data-testid="map-draw-finish"]');
      await p.click('[data-testid="map-draw-finish"]');
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-area") === "1", { timeout: 8000 });
      await p.waitForSelector('[data-testid="map-inarea-chip"]');
      const inArea = Number(await attr(p, "demo_places", "data-map-inarea"));
      assert(inArea > 5, `the drawn polygon filters the plotted records to those inside (${inArea} in area)`);
      await shot(p, ROOT, "map-area-filter");
      await p.click('[data-testid="map-inarea-clear"]');
      await p.waitForFunction(() => (document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-inarea") || "") === "", { timeout: 8000 });
      assert(true, "clearing the area filter restores the full set");
      await ctx.close();
    },
  },
  {
    name: "map-draw-circle", feature: "Map view draw + measure",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-draw-circle"]');
      await clickCanvas(p, "demo_places", 0.5, 0.5);
      await clickCanvas(p, "demo_places", 0.68, 0.5);
      await p.waitForFunction(() => document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-area") === "1", { timeout: 8000 });
      const readout = await p.textContent('[data-testid="map-area-readout"]');
      assert(/r\s/.test(readout ?? "") && /\d/.test(readout ?? ""), `the radius tool reports area + radius (${readout})`);
      await ctx.close();
    },
  },
  {
    name: "map-add-point", feature: "Map view add point",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-addpoint-btn"]');
      await p.waitForSelector('[data-testid="map-draw-hint"]');
      await clickCanvas(p, "demo_places", 0.5, 0.45);
      // the click opens the host create dialog seeded with the clicked coordinates
      // (the review surface — no silent create)
      await p.waitForSelector('[data-testid="create-confirm"]', { timeout: 8000 });
      assert(true, "clicking in add-point mode opens the create dialog seeded at the location (review surface, no silent write)");
      await p.keyboard.press("Escape");
      await ctx.close();
    },
  },
  {
    name: "map-route", feature: "Map view route",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await hostSearch(p, "demo_places", "Hamburg"); // Hamburg cluster → DOM markers to click
      await p.click('[data-testid="map-route-btn"]');
      // the Hamburg pins sit close together and spiderfy fans them into an
      // overlapping ring — dispatchEvent fires each SPECIFIC marker's handler
      // (a coordinate click would hit-test to whichever pin is topmost)
      const markers = p.locator('[data-testid="map-demo_places"] [data-testid^="map-marker-"]');
      await markers.nth(0).dispatchEvent("click");
      await markers.nth(1).dispatchEvent("click");
      await p.waitForFunction(() => (document.querySelector('[data-testid="map-demo_places"]')?.getAttribute("data-map-route") || "") !== "", { timeout: 8000 });
      const km = Number(await attr(p, "demo_places", "data-map-route"));
      assert(km > 0, `routing between two records draws a path with a distance (${km} m)`);
      await p.waitForSelector('[data-testid="map-route-readout"]');
      await shot(p, ROOT, "map-route");
      await ctx.close();
    },
  },
  {
    name: "map-keyboard-path", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await hostSearch(p, "demo_places", "Hamburg");
      const first = p.locator('[data-testid="map-demo_places"] [data-testid^="map-marker-"]').first();
      const label = await first.getAttribute("aria-label");
      await first.focus();
      await p.keyboard.press("Enter");
      await p.waitForSelector('[data-testid="map-popup"]');
      await p.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "map-popup-open");
      await p.keyboard.press("Enter");
      await p.waitForSelector('[data-testid="peek-panel"]');
      await p.waitForFunction((t) => document.querySelector('[data-testid="peek-panel"]')?.textContent?.includes(t), label, { timeout: 10000 });
      assert(true, `keyboard-only pin → popup → Open reaches the record peek (${label})`);
      await ctx.close();
    },
  },
  {
    name: "map-mobile-touch", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      assert((await attr(p, "demo_places", "data-map-mode")) === "cluster", "at 390px the dense map still clusters");
      // MAP-FIRST at phone width: the page title/header collapses so the map is the
      // surface (its own search + controls carry navigation)
      assert(!(await p.locator(".pageHead").isVisible().catch(() => false)), "at 390px the page-head collapses — map-first, not a widget under a full header");
      // the always-visible map search opens a record without a hover-only affordance
      await p.fill('[data-testid="map-search"]', "Aurora");
      await p.waitForSelector('[data-testid="map-search-result-pl_1"]', { timeout: 8000 });
      await p.click('[data-testid="map-search-result-pl_1"]');
      await p.waitForSelector('[data-testid="map-popup"]');
      await shot(p, ROOT, "map-mobile");
      await p.click('[data-testid="map-popup-open"]');
      await p.waitForSelector('[data-testid="peek-panel"]');
      assert(true, "at 390px map search → popup → Open completes the core interaction by touch");
      await ctx.close();
    },
  },
  {
    name: "map-empty-state", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.fill('[data-testid="list-search"]', "zzz-no-such-place");
      await p.waitForSelector('[data-testid="map-empty"]', { timeout: 10000 });
      const empty = await p.textContent('[data-testid="map-empty"]');
      assert(empty?.includes("No records"), `the designed empty state shows when the filter clears the map (${empty})`);
      await ctx.close();
    },
  },
  {
    name: "map-live-update", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await wide(page);
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      // an external writer creates a record; the rev poll must land it. Narrow to
      // its unique name so it renders as a DOM marker regardless of clustering.
      const res = await fetch(`${URLBASE}/api/objects/demo_places`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Zephyrus Live Probe", kind: "Office", city: "Namur", headcount: 12, revenue: 300000, lat: 50.4674, lng: 4.872 }),
      });
      if (!res.ok) throw new Error(`create → ${res.status}`);
      const row = await res.json();
      try {
        await p.fill('[data-testid="list-search"]', "Zephyrus Live Probe");
        await p.waitForSelector(`[data-testid="map-marker-${row.id}"]`, { timeout: 15000 });
        assert(true, "a record created by an external writer appears via the rev poll — no reload");
      } finally {
        await fetch(`${URLBASE}/api/objects/demo_places/${row.id}`, { method: "DELETE" });
        await fetch(`${URLBASE}/api/objects/demo_places/${row.id}/destroy`, { method: "DELETE" });
      }
      await ctx.close();
    },
  },
  {
    name: "map-cluster-scale", feature: "Map view clustering at scale (10k)",
    async run(page, { assert, ROOT }) {
      const PORT = 5881;
      const BASE = `http://localhost:${PORT}`;
      const proc = await bootFixture(ROOT, PORT);
      try {
        await seed10k(BASE);
        const ctx = await wide(page);
        await abortExternal(ctx);
        const p = await ctx.newPage();
        const t0 = Date.now();
        await openMap(p, BASE, "places_perf");
        const readyMs = Date.now() - t0;
        assert(readyMs < 15000, `10k-row map reaches ready in ${readyMs}ms (< 15000)`);
        assert((await attr(p, "places_perf", "data-map-mode")) === "cluster", "past the threshold the view renders GL clusters");
        await p.waitForFunction(() => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-clusters")) > 0, { timeout: 10000 });
        assert(true, "cluster circles render (GL state mirrored on data-map-clusters)");
        await shot(p, ROOT, "map-clustered");
        const before = Number(await attr(p, "places_perf", "data-map-zoom"));
        const box = await p.locator('[data-testid="map-places_perf"] canvas').first().boundingBox();
        let zoomed = false;
        for (const [fx, fy] of [[0.5, 0.5], [0.42, 0.42], [0.58, 0.58], [0.5, 0.35]]) {
          await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
          try {
            await p.waitForFunction((b) => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-zoom")) > b + 0.5, before, { timeout: 2500 });
            zoomed = true;
            break;
          } catch { /* empty water — try the next spot */ }
        }
        assert(zoomed, `clicking a cluster zooms toward its expansion (zoom ${before} → ${await attr(p, "places_perf", "data-map-zoom")})`);
        for (let i = 0; i < 5; i++) await p.click(".maplibregl-ctrl-zoom-out");
        await p.waitForFunction(() => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-clusters")) > 0, { timeout: 10000 });
        assert(true, "zooming out re-forms cluster circles");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "map-misconfig-chip", feature: "Map view (records on a map)",
    async run(page, { assert, ROOT }) {
      const PORT = 5882;
      const BASE = `http://localhost:${PORT}`;
      const proc = await bootFixture(ROOT, PORT);
      try {
        const ctx = await wide(page);
        await abortExternal(ctx);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/sites_nocoords`);
        await p.waitForSelector('[data-testid="table-sites_nocoords"] tbody tr');
        await p.click('[data-testid="view-switch"] button:has-text("Map")');
        await p.waitForSelector('[data-testid="view-unknown"]');
        const chip = await p.textContent('[data-testid="view-unknown"]');
        assert(chip?.includes("no pair of number fields"), `the misconfig chip names what is missing (${chip})`);
        await p.click('[data-testid="view-switch"] button:has-text("Table")');
        await p.waitForSelector('[data-testid="table-sites_nocoords"] tbody tr');
        assert(true, "the rest of the list surface stands — the table tab keeps working");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
];
