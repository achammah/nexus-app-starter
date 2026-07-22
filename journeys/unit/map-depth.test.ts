/* Unit tests for the map-depth pure cores (no browser, no maplibre):
   geomath (distance/area/containment/formatting), the size-by-field helpers in
   geo, the config → options mapping (mapConfig), and the basemap catalogue.
   Runs under node's test runner (`npm test`). */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haversine,
  pathLength,
  polygonArea,
  pointInPolygon,
  pointInCircle,
  circleRing,
  centroid,
  formatDistance,
  formatArea,
  formatDuration,
} from "../../src/ui/record-core/views/map/geomath.ts";
import {
  numericValue,
  sizeExtent,
  radiusFor,
  toFeatureCollection,
  splitRows,
  MARKER_DEFAULT_R,
  MARKER_MIN_R,
  MARKER_MAX_R,
} from "../../src/ui/record-core/views/map/geo.ts";
import {
  resolveMapOptions,
  activeBasemap,
  clustersOn,
  heatmapOn,
  clusterRadius,
  renderMode,
  pointsOn,
} from "../../src/ui/record-core/views/map/mapConfig.ts";
import {
  ALL_BASEMAPS,
  resolveOfferedBasemaps,
  basemapStyle,
  isDarkBasemap,
  basemapHasGlyphs,
} from "../../src/ui/record-core/views/map/basemaps.ts";

/* ── geomath ── */
test("haversine matches a known great-circle distance (Brussels→Amsterdam ≈ 173 km)", () => {
  const d = haversine([4.3517, 50.8503], [4.9041, 52.3676]);
  assert.ok(d > 168_000 && d < 178_000, `got ${Math.round(d)} m`);
  assert.equal(haversine([0, 0], [0, 0]), 0);
});

test("pathLength sums the legs; polygonArea is orientation-free and 0 under 3 points", () => {
  const pts: [number, number][] = [[0, 0], [0, 1], [1, 1]];
  assert.ok(Math.abs(pathLength(pts) - (haversine(pts[0], pts[1]) + haversine(pts[1], pts[2]))) < 1e-6);
  const sq: [number, number][] = [[4, 50], [5, 50], [5, 51], [4, 51]];
  const a = polygonArea(sq);
  assert.ok(a > 0, "a real box has positive area");
  assert.equal(polygonArea([...sq].reverse()).toFixed(2), a.toFixed(2)); // winding-independent
  assert.equal(polygonArea([[0, 0], [1, 1]]), 0); // < 3 points
});

test("pointInPolygon + pointInCircle bound membership", () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon([5, 5], square), true);
  assert.equal(pointInPolygon([15, 5], square), false);
  assert.equal(pointInPolygon([5, 5], [[0, 0], [10, 0]]), false); // degenerate ring
  const center: [number, number] = [4.35, 50.85];
  assert.equal(pointInCircle(center, center, 100), true);
  assert.equal(pointInCircle([5.5, 50.85], center, 1000), false); // ~80 km away
});

test("circleRing closes and approximates the radius", () => {
  const ring = circleRing([4, 50], 5000, 32);
  assert.equal(ring.length, 33); // steps+1, closed
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  // every vertex is ~5 km from the centre
  for (const v of ring) assert.ok(Math.abs(haversine([4, 50], v) - 5000) < 400);
});

test("centroid averages; formatters render human units", () => {
  assert.deepEqual(centroid([[0, 0], [2, 4]]), [1, 2]);
  assert.deepEqual(centroid([]), [0, 0]);
  assert.equal(formatDistance(340), "340 m");
  assert.equal(formatDistance(1250), "1.3 km");
  assert.equal(formatArea(8200), "8,200 m²");
  assert.equal(formatArea(3_400_000), "3.40 km²");
  assert.equal(formatDuration(90), "2 min");
  assert.equal(formatDuration(4800), "1 h 20 min");
});

/* ── geo size-by-field helpers ── */
test("numericValue reads plain numbers + money.amount, rejects the rest", () => {
  assert.equal(numericValue(42), 42);
  assert.equal(numericValue({ amount: 12500, code: "EUR" }), 12500);
  assert.equal(numericValue("42"), undefined);
  assert.equal(numericValue(Number.NaN), undefined);
  assert.equal(numericValue(null), undefined);
});

test("sizeExtent spans the numeric values; radiusFor scales inside the marker band", () => {
  const { located } = splitRows(
    [
      { id: "a", lat: 51, lng: 3, hc: 10 },
      { id: "b", lat: 52, lng: 4, hc: 110 },
      { id: "c", lat: 53, lng: 5 },
    ],
    "lat",
    "lng",
  );
  const ext = sizeExtent(located, "hc");
  assert.deepEqual(ext, { min: 10, max: 110 });
  assert.equal(radiusFor(10, ext), MARKER_MIN_R);
  assert.equal(radiusFor(110, ext), MARKER_MAX_R);
  assert.equal(radiusFor(undefined, ext), MARKER_DEFAULT_R);
  assert.equal(radiusFor(50, null), MARKER_DEFAULT_R);
  assert.equal(sizeExtent(located, undefined), null);
});

test("toFeatureCollection carries size + weight only when present", () => {
  const { located } = splitRows([{ id: "a", lat: 51, lng: 3, kind: "Office", hc: 20, rev: 5000 }], "lat", "lng");
  const fc = toFeatureCollection(located, "kind", "hc", "rev");
  assert.deepEqual(fc.features[0].properties, { id: "a", option: "Office", size: 20, weight: 5000 });
  // absent numeric → property omitted, not zeroed
  const { located: l2 } = splitRows([{ id: "b", lat: 51, lng: 3 }], "lat", "lng");
  assert.deepEqual(toFeatureCollection(l2, undefined, "hc").features[0].properties, { id: "b" });
});

/* ── mapConfig ── */
const objWith = (fields: { key: string; type?: string; primary?: boolean }[]) => ({
  key: "sites",
  label: "Sites",
  labelOne: "Site",
  defaultView: "map",
  fields: fields.map((f) => ({ label: f.key, type: "number", ...f })),
});

test("resolveMapOptions fills sensible defaults and honours overrides", () => {
  const o = objWith([
    { key: "name", type: "text", primary: true },
    { key: "lat" },
    { key: "lng" },
    { key: "kind", type: "select" },
    { key: "hc" },
  ]);
  const d = resolveMapOptions(o as never, {});
  assert.equal(d.latField, "lat");
  assert.equal(d.lngField, "lng");
  assert.deepEqual(d.basemaps, ALL_BASEMAPS);
  assert.equal(d.defaultBasemap, "streets");
  assert.equal(d.clustering.enabled, true);
  assert.equal(d.clustering.radius, 50);
  assert.equal(d.clustering.threshold, 25);
  assert.equal(d.heatmap.enabled, false);
  assert.deepEqual(d.tools, { draw: true, filterByArea: true, geocode: true, route: true, addPoint: true });
  assert.equal(d.legend, true);

  const c = resolveMapOptions(o as never, {
    colorField: "kind",
    sizeField: "hc",
    basemaps: ["dark", "satellite", "bogus"],
    defaultBasemap: "satellite",
    clustering: false,
    clusterRadius: 999,
    heatmap: true,
    geocode: false,
  });
  assert.equal(c.colorField, "kind");
  assert.equal(c.sizeField, "hc");
  assert.deepEqual(c.basemaps, ["dark", "satellite"]); // bogus dropped
  assert.equal(c.defaultBasemap, "satellite");
  assert.equal(c.clustering.enabled, false);
  assert.equal(c.clustering.radius, 100); // clamped to max
  assert.equal(c.heatmap.enabled, true);
  assert.equal(c.tools.geocode, false);
});

test("defaultBasemap falls back into the offered set", () => {
  const o = objWith([{ key: "lat" }, { key: "lng" }]);
  const c = resolveMapOptions(o as never, { basemaps: ["dark", "terrain"], defaultBasemap: "streets" });
  assert.equal(c.defaultBasemap, "dark"); // streets not offered → first offered
});

test("runtime resolvers: viewState overrides config, cluster radius clamps", () => {
  const o = objWith([{ key: "lat" }, { key: "lng" }]);
  const opts = resolveMapOptions(o as never, { clusterRadius: 55, heatmap: false });
  assert.equal(activeBasemap(opts, {}), "streets");
  assert.equal(activeBasemap(opts, { mapBasemap: "dark" }), "dark");
  assert.equal(activeBasemap(opts, { mapBasemap: "nope" }), "streets"); // not offered → default
  assert.equal(clustersOn(opts, {}), true);
  assert.equal(clustersOn(opts, { mapClusters: false }), false);
  assert.equal(heatmapOn(opts, {}), false);
  assert.equal(heatmapOn(opts, { mapHeatmap: true }), true);
  assert.equal(clusterRadius(opts, {}), 55);
  assert.equal(clusterRadius(opts, { clusterRadius: 200 }), 100); // clamped
  assert.equal(pointsOn({}), true);
  assert.equal(pointsOn({ mapPoints: false }), false);
});

test("renderMode: clusters only above threshold with points+clusters on", () => {
  const o = objWith([{ key: "lat" }, { key: "lng" }]);
  const opts = resolveMapOptions(o as never, { clusterThreshold: 25 });
  assert.deepEqual(renderMode(opts, {}, 10), { points: true, clusters: false, heatmap: false }); // few → markers
  assert.deepEqual(renderMode(opts, {}, 90), { points: true, clusters: true, heatmap: false }); // dense → cluster
  assert.deepEqual(renderMode(opts, { mapClusters: false }, 90), { points: true, clusters: false, heatmap: false });
  assert.deepEqual(renderMode(opts, { mapPoints: false, mapHeatmap: true }, 90), { points: false, clusters: false, heatmap: true });
});

/* ── basemaps ── */
test("basemap catalogue: offered-set hygiene, vector-vs-raster style, flags", () => {
  assert.deepEqual(resolveOfferedBasemaps(["dark", "dark", "bogus", "terrain"]), ["dark", "terrain"]); // dedupe + drop invalid
  assert.deepEqual(resolveOfferedBasemaps([]), ALL_BASEMAPS); // empty → all
  assert.deepEqual(resolveOfferedBasemaps("nope"), ALL_BASEMAPS);
  assert.equal(typeof basemapStyle("streets"), "string"); // vector = URL
  const sat = basemapStyle("satellite");
  assert.equal(typeof sat, "object"); // raster = inline StyleSpecification
  assert.equal((sat as { sources: { basemap: { type: string } } }).sources.basemap.type, "raster");
  assert.equal(isDarkBasemap("dark"), true);
  assert.equal(isDarkBasemap("satellite"), true);
  assert.equal(isDarkBasemap("streets"), false);
  assert.equal(basemapHasGlyphs("streets"), true);
  assert.equal(basemapHasGlyphs("satellite"), false); // raster ships no glyphs
});
