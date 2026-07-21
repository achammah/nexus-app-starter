/* map-view lane journeys — the registry `map` view: token pins, record-card
   popups into the peek, the without-location chip, GL clustering at scale, and
   offline degradation. EVERY context aborts non-localhost requests (tile/style
   hosts), so runs are deterministic with no network AND exercise the designed
   fallback (background-only style) — assertions read DOM and the container's
   GL-state mirror (data-map-*), never tile pixels.
   Demo journeys drive the MAIN app (demo_places); cluster/misconfig journeys
   boot journeys/fixtures/map-perf.config.json on the lane band (5881/5882). */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};

/* external requests (OpenFreeMap style + tiles) abort — offline-deterministic */
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
        lat: Math.round((36 + rand() * 24) * 10000) / 10000,   // 36..60
        lng: Math.round((-10 + rand() * 35) * 10000) / 10000,  // -10..25
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

export default [
  {
    name: "map-markers-render", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      const markers = await p.locator('[data-testid^="map-marker-pl_"]').count();
      assert(markers === 10, `one pin per record with coords (${markers} of 10)`);
      const chip = await p.textContent('[data-testid="map-without-location"]');
      assert(chip?.includes("2 without location"), `the corner chip counts coordless records (${chip})`);
      const tiles = await p.getAttribute('[data-testid="map-demo_places"]', "data-map-tiles");
      assert(tiles === "fallback", "with tile hosts unreachable the map degrades to the token fallback style and still renders every pin");
      assert((await p.locator('[data-testid="map-tiles-fallback"]').count()) === 1, "the tiles-unavailable chip names the degradation");
      await shot(p, ROOT, "map-markers");
      await ctx.close();
    },
  },
  {
    name: "map-popup-open", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert, ROOT }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.click('[data-testid="map-marker-pl_1"]');
      await p.waitForSelector('[data-testid="map-popup"]');
      const popup = await p.textContent('[data-testid="map-popup"]');
      assert(popup?.includes("Aurora Works Ghent"), `the popup card shows the record title (${popup?.slice(0, 60)})`);
      assert(popup?.includes("Office") && popup?.includes("Ghent"), "the popup card shows the two configured meta fields (kind chip + city)");
      await shot(p, ROOT, "map-popup");
      await p.click('[data-testid="map-popup-open"]');
      await p.waitForSelector('[data-testid="peek-panel"]');
      // the peek panel mounts before its record detail resolves — wait for the
      // title to land, not just for the panel element
      await p.waitForFunction(
        (t) => document.querySelector('[data-testid="peek-panel"]')?.textContent?.includes(t),
        "Aurora Works Ghent",
        { timeout: 10000 },
      );
      assert(true, "popup Open lands on the record peek");
      await ctx.close();
    },
  },
  {
    name: "map-empty-state", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.fill('[data-testid="list-search"]', "zzz-no-such-place");
      await p.waitForSelector('[data-testid="map-empty"]', { timeout: 10000 });
      const empty = await p.textContent('[data-testid="map-empty"]');
      assert(empty?.includes("No records"), `the designed empty state shows when the filter clears the map (${empty})`);
      await p.fill('[data-testid="list-search"]', "");
      await p.waitForSelector('[data-testid="map-marker-pl_1"]', { timeout: 10000 });
      assert(true, "clearing the search restores the pins (journey leaves the state it found)");
      await ctx.close();
    },
  },
  {
    name: "map-keyboard-path", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      await p.focus('[data-testid="map-marker-pl_2"]');
      await p.keyboard.press("Enter");
      await p.waitForSelector('[data-testid="map-popup"]');
      assert(true, "Enter on a focused pin opens the popup");
      // the popup's Open button takes focus on open — Enter follows through to the peek
      await p.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "map-popup-open");
      await p.keyboard.press("Enter");
      await p.waitForSelector('[data-testid="peek-panel"]');
      // the peek record detail loads async — assert the title lands, not the mount
      await p.waitForFunction(
        (t) => document.querySelector('[data-testid="peek-panel"]')?.textContent?.includes(t),
        "Nordwind Depot Antwerp",
        { timeout: 10000 },
      );
      assert(true, "keyboard-only pin → popup → Open reaches the record peek");
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
      // Hamburg sits far NE of the Benelux cluster — the one pin guaranteed
      // un-occluded at 390px fit-bounds, so the tap hit-tests cleanly
      await p.tap('[data-testid="map-marker-pl_6"]');
      await p.waitForSelector('[data-testid="map-popup"]');
      await shot(p, ROOT, "map-mobile");
      await p.tap('[data-testid="map-popup-open"]');
      await p.waitForSelector('[data-testid="peek-panel"]');
      assert(true, "at 390px the map renders and TAP pin → popup → Open completes the core interaction");
      await ctx.close();
    },
  },
  {
    name: "map-live-update", feature: "Map view (records on a map)",
    async run(page, { URLBASE, assert }) {
      const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
      await abortExternal(ctx);
      const p = await ctx.newPage();
      await openMap(p, URLBASE, "demo_places");
      assert((await p.locator('[data-testid^="map-marker-pl_"]').count()) === 10, "baseline: 10 pins before the external write");
      // an external writer creates a record — the rev poll must land it with no reload
      const res = await fetch(`${URLBASE}/api/objects/demo_places`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Live Probe Site", kind: "Office", city: "Namur", lat: 50.4674, lng: 4.872 }),
      });
      if (!res.ok) throw new Error(`create → ${res.status}`);
      const row = await res.json();
      try {
        await p.waitForSelector(`[data-testid="map-marker-${row.id}"]`, { timeout: 15000 });
        assert(true, "a record created by an external writer appears as a pin via the rev poll — no reload");
      } finally {
        // leave the seed state as found
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
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        await abortExternal(ctx);
        const p = await ctx.newPage();
        const t0 = Date.now();
        await openMap(p, BASE, "places_perf");
        const readyMs = Date.now() - t0;
        assert(readyMs < 15000, `10k-row map reaches ready in ${readyMs}ms (< 15000)`);
        const mode = await p.getAttribute('[data-testid="map-places_perf"]', "data-map-mode");
        assert(mode === "cluster", `past the threshold the view renders GL clusters (mode=${mode})`);
        await p.waitForFunction(
          () => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-clusters")) > 0,
          { timeout: 10000 },
        );
        assert(true, "cluster circles render (GL state mirrored on data-map-clusters)");
        await shot(p, ROOT, "map-clustered");
        // cluster click → expansion zoom: probe a few positions around center (densest area)
        const before = Number(await p.getAttribute('[data-testid="map-places_perf"]', "data-map-zoom"));
        const box = await p.locator('[data-testid="map-places_perf"] canvas').first().boundingBox();
        let zoomed = false;
        for (const [fx, fy] of [[0.5, 0.5], [0.42, 0.42], [0.58, 0.58], [0.5, 0.35]]) {
          await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
          try {
            await p.waitForFunction(
              (b) => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-zoom")) > b + 0.5,
              before,
              { timeout: 2500 },
            );
            zoomed = true;
            break;
          } catch { /* empty water — try the next spot */ }
        }
        assert(zoomed, `clicking a cluster zooms toward its expansion (zoom ${before} → ${await p.getAttribute('[data-testid="map-places_perf"]', "data-map-zoom")})`);
        // zoom back out — clusters re-form (the visible clustering transition)
        for (let i = 0; i < 5; i++) await p.click(".maplibregl-ctrl-zoom-out");
        await p.waitForFunction(
          () => Number(document.querySelector('[data-testid="map-places_perf"]')?.getAttribute("data-map-clusters")) > 0,
          { timeout: 10000 },
        );
        assert(true, "zooming out re-forms cluster circles");
        const chip = await p.textContent('[data-testid="map-without-location"]').catch(() => null);
        assert(chip === null, "all 10k seeded rows carry coords — no without-location chip");
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
      const env = { ...process.env, PORT: String(PORT), CONFIG_PATH: "journeys/fixtures/map-perf.config.json" };
      const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
      try {
        for (let i = 0; i < 24; i++) {
          try {
            const r = await fetch(`${BASE}/api/healthz`, { signal: AbortSignal.timeout(1500) });
            if (r.ok) break;
          } catch { /* booting */ }
          await new Promise((r) => setTimeout(r, 350));
        }
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
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
