/* Unit tests for the map view's pure geo core (src/ui/record-core/views/map/geo.ts):
   coordinate-field inference, validity (0 IS a coordinate), the located/without
   split, GeoJSON shape, bounds math, and the definition's default/validate logic.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLUSTER_THRESHOLD,
  boundsOf,
  inferCoordFields,
  isValidLat,
  isValidLng,
  mapDefaultConfig,
  mapValidateConfig,
  splitRows,
  toFeatureCollection,
} from "../../src/ui/record-core/views/map/geo.ts";

const obj = (fields: { key: string; label?: string; type?: string; primary?: boolean; isActive?: boolean }[]) => ({
  key: "places",
  label: "Places",
  labelOne: "Place",
  defaultView: "table",
  fields: fields.map((f) => ({ label: f.key, type: "number", ...f })),
});

test("inferCoordFields finds lat/lng by key across the name variants", () => {
  assert.deepEqual(inferCoordFields(obj([{ key: "lat" }, { key: "lng" }])), { latField: "lat", lngField: "lng" });
  assert.deepEqual(inferCoordFields(obj([{ key: "latitude" }, { key: "longitude" }])), { latField: "latitude", lngField: "longitude" });
  assert.deepEqual(inferCoordFields(obj([{ key: "y" }, { key: "lon" }])).lngField, "lon");
});

test("inference falls back to labels, skips non-number and inactive fields", () => {
  const byLabel = obj([{ key: "a", label: "Latitude" }, { key: "b", label: "Longitude" }]);
  assert.deepEqual(inferCoordFields(byLabel), { latField: "a", lngField: "b" });
  const textLat = obj([{ key: "lat", type: "text" }, { key: "lng" }]);
  assert.equal(inferCoordFields(textLat).latField, undefined);
  const inactive = obj([{ key: "lat", isActive: false }, { key: "lng" }]);
  assert.equal(inferCoordFields(inactive).latField, undefined);
});

test("0 is a VALID coordinate; range and type bound validity", () => {
  assert.equal(isValidLat(0), true);
  assert.equal(isValidLng(0), true);
  assert.equal(isValidLat(90), true);
  assert.equal(isValidLat(90.1), false);
  assert.equal(isValidLng(-180), true);
  assert.equal(isValidLng(-180.1), false);
  assert.equal(isValidLat("51"), false);
  assert.equal(isValidLat(null), false);
  assert.equal(isValidLat(Number.NaN), false);
});

test("splitRows keeps 0,0 and counts every non-plottable row", () => {
  const rows = [
    { id: "a", lat: 51.05, lng: 3.72 },
    { id: "b", lat: 0, lng: 0 },
    { id: "c", lat: null, lng: 3 },
    { id: "d" },
    { id: "e", lat: 95, lng: 3 },
  ];
  const { located, withoutLocation } = splitRows(rows, "lat", "lng");
  assert.deepEqual(located.map((l) => l.row.id), ["a", "b"]);
  assert.equal(withoutLocation, 3);
});

test("toFeatureCollection emits [lng, lat] order and carries id + color option", () => {
  const { located } = splitRows([{ id: "a", lat: 51, lng: 3.7, kind: "Office" }], "lat", "lng");
  const fc = toFeatureCollection(located, "kind");
  assert.equal(fc.features.length, 1);
  assert.deepEqual(fc.features[0].geometry.coordinates, [3.7, 51]);
  assert.deepEqual(fc.features[0].properties, { id: "a", option: "Office" });
  const bare = toFeatureCollection(located);
  assert.deepEqual(bare.features[0].properties, { id: "a" });
});

test("boundsOf spans min/max and is null when empty", () => {
  assert.equal(boundsOf([]), null);
  const { located } = splitRows(
    [
      { id: "a", lat: 51, lng: 3 },
      { id: "b", lat: 48, lng: 10 },
      { id: "c", lat: 53, lng: -1 },
    ],
    "lat",
    "lng",
  );
  assert.deepEqual(boundsOf(located), [[-1, 48], [10, 53]]);
});

test("mapDefaultConfig infers coords and titles on the primary", () => {
  const o = obj([{ key: "name", type: "text", primary: true }, { key: "lat" }, { key: "lng" }]);
  assert.deepEqual(mapDefaultConfig(o), { latField: "lat", lngField: "lng", titleField: "name" });
});

test("mapValidateConfig names what is missing or mistyped; a sound config passes", () => {
  const o = obj([{ key: "name", type: "text", primary: true }, { key: "lat" }, { key: "lng" }, { key: "kind", type: "select" }]);
  assert.match(mapValidateConfig(o, {}) ?? "", /latField and lngField/);
  assert.match(mapValidateConfig(obj([{ key: "name", type: "text", primary: true }]), {}) ?? "", /no pair of number fields/);
  assert.match(mapValidateConfig(o, { latField: "name", lngField: "lng" }) ?? "", /not a number field/);
  assert.match(mapValidateConfig(o, { latField: "lat", lngField: "lat" }) ?? "", /two different fields/);
  assert.match(mapValidateConfig(o, { latField: "lat", lngField: "lng", colorField: "name" }) ?? "", /not a select field/);
  assert.match(mapValidateConfig(o, { latField: "lat", lngField: "lng", titleField: "ghost" }) ?? "", /not a field/);
  assert.equal(mapValidateConfig(o, { latField: "lat", lngField: "lng", colorField: "kind" }), null);
});

test("the cluster threshold is a bounded constant, not a knob", () => {
  assert.equal(typeof CLUSTER_THRESHOLD, "number");
  assert.ok(CLUSTER_THRESHOLD > 0 && CLUSTER_THRESHOLD < 1000);
});
