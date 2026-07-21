/* Unit tests for the flow view's pure core (src/ui/record-core/views/flow/):
   graph derivation from _refs (self edges, hubs, dangling refs), relation
   resolution, drag-position persistence shapes, and the layout strategies.
   Runs under node's own test runner (`npm test`) — no browser, no build. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGraph,
  cardMetaFields,
  positionsFor,
  positionsPatch,
  relationFields,
  resolveLabelField,
  resolveRelation,
} from "../../src/ui/record-core/views/flow/graph.ts";
import { bfsGrid, DAGRE_MAX_NODES, layoutGraph } from "../../src/ui/record-core/views/flow/layout.ts";

const tasksObj = {
  key: "tasks", label: "Tasks", labelOne: "Task", defaultView: "flow",
  fields: [
    { key: "name", label: "Name", type: "text", primary: true },
    { key: "status", label: "Status", type: "select", options: ["Open", "Done"] },
    { key: "dependsOn", label: "Depends on", type: "relation", relation: "tasks", multiple: true },
    { key: "owner", label: "Owner", type: "relation", relation: "people" },
    { key: "old", label: "Old", type: "relation", relation: "tasks", isActive: false },
  ],
};

test("relationFields keeps active relation fields only", () => {
  assert.deepEqual(relationFields(tasksObj).map((f) => f.key), ["dependsOn", "owner"]);
});

test("resolveRelation: runtime pick → instance config → first relation; stale picks fall through", () => {
  assert.equal(resolveRelation(tasksObj, {}, {}), "dependsOn");
  assert.equal(resolveRelation(tasksObj, { relationField: "owner" }, {}), "owner");
  assert.equal(resolveRelation(tasksObj, { relationField: "owner" }, { flowRel: "dependsOn" }), "dependsOn");
  assert.equal(resolveRelation(tasksObj, { relationField: "owner" }, { flowRel: "gone" }), "owner");
});

test("resolveLabelField: configured field, else the primary", () => {
  assert.equal(resolveLabelField(tasksObj, {}).key, "name");
  assert.equal(resolveLabelField(tasksObj, { labelField: "status" }).key, "status");
  assert.equal(resolveLabelField(tasksObj, { labelField: "nope" }).key, "name");
});

test("cardMetaFields: first 2 non-primary active fields, excluding the active relation", () => {
  assert.deepEqual(cardMetaFields(tasksObj, "dependsOn").map((f) => f.key), ["status", "owner"]);
  assert.deepEqual(cardMetaFields(tasksObj, "owner").map((f) => f.key), ["status", "dependsOn"]);
});

test("self-relation: parent→child edges, only inside the row set, self-loops and dangling refs skipped", () => {
  const rows = [
    { id: "a", name: "A" },
    { id: "b", name: "B", dependsOn: ["A"], _refs: { dependsOn: ["a"] } },
    { id: "c", name: "C", dependsOn: ["A", "B"], _refs: { dependsOn: ["a", "b"] } },
    // target outside the (filtered) set → no edge; self-loop → no edge
    { id: "d", name: "D", dependsOn: ["Gone", "D"], _refs: { dependsOn: ["zz", "d"] } },
    // dangling label: no _refs entry at all → no edge
    { id: "e", name: "E", dependsOn: ["Never resolved"] },
  ];
  const g = buildGraph(tasksObj, rows, "dependsOn");
  assert.equal(g.nodes.length, 5);
  assert.deepEqual(
    g.edges.map((e) => `${e.source}>${e.target}`).sort(),
    ["a>b", "a>c", "b>c"],
  );
});

test("cross-object relation: one hub per distinct target, counts and projected labels", () => {
  const rows = [
    { id: "a", name: "A", owner: "Ada", _refs: { owner: "p1" } },
    { id: "b", name: "B", owner: "Ada", _refs: { owner: "p1" } },
    { id: "c", name: "C", owner: "Malik", _refs: { owner: "p2" } },
    { id: "d", name: "D" },
  ];
  const g = buildGraph(tasksObj, rows, "owner");
  const hubs = g.nodes.filter((n) => n.kind === "hub");
  assert.deepEqual(
    hubs.map((h) => `${h.id}|${h.label}|${h.count}`).sort(),
    ["hub:people:p1|Ada|2", "hub:people:p2|Malik|1"],
  );
  assert.deepEqual(
    g.edges.map((e) => `${e.source}>${e.target}`).sort(),
    ["hub:people:p1>a", "hub:people:p1>b", "hub:people:p2>c"],
  );
});

test("polymorphic refs draw hubs namespaced per target object", () => {
  const polyObj = {
    key: "notes", label: "Notes", labelOne: "Note", defaultView: "flow",
    fields: [
      { key: "title", label: "Title", type: "text", primary: true },
      { key: "about", label: "About", type: "relation", relationTargets: ["people", "companies"] },
    ],
  };
  const rows = [
    { id: "n1", title: "N1", about: "Ada", _refs: { about: { object: "people", id: "p1" } } },
    { id: "n2", title: "N2", about: "Acme", _refs: { about: { object: "companies", id: "c1" } } },
  ];
  const g = buildGraph(polyObj, rows, "about");
  assert.deepEqual(
    g.nodes.filter((n) => n.kind === "hub").map((h) => h.id).sort(),
    ["hub:companies:c1", "hub:people:p1"],
  );
});

test("positions persist per relation and merge per node", () => {
  const s1 = positionsPatch({}, "dependsOn", { a: { x: 1, y: 2 } });
  const s2 = { ...s1, ...positionsPatch(s1, "dependsOn", { b: { x: 3, y: 4 } }) };
  const s3 = { ...s2, ...positionsPatch(s2, "owner", { a: { x: 9, y: 9 } }) };
  assert.deepEqual(positionsFor(s3, "dependsOn"), { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  assert.deepEqual(positionsFor(s3, "owner"), { a: { x: 9, y: 9 } });
  assert.deepEqual(positionsFor({}, "dependsOn"), {});
});

test("dagre lane: every node positioned, parents rank above children", () => {
  const nodes = [
    { kind: "record", id: "root", row: { id: "root" } },
    { kind: "record", id: "kid", row: { id: "kid" } },
    { kind: "record", id: "island", row: { id: "island" } },
  ];
  const pos = layoutGraph(nodes, [{ id: "e1", source: "root", target: "kid" }]);
  assert.equal(Object.keys(pos).length, 3);
  assert.ok(pos.root.y < pos.kid.y, `parent above child (${pos.root.y} < ${pos.kid.y})`);
});

test("BFS-rank lane: parents above children, islands band below, cycles still position", () => {
  const nodes = ["a", "b", "c", "x", "y", "lone"].map((id) => ({ kind: "record", id, row: { id } }));
  const edges = [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "c" },
    { id: "e3", source: "x", target: "y" }, // cycle
    { id: "e4", source: "y", target: "x" },
  ];
  const pos = bfsGrid(nodes, edges);
  assert.equal(Object.keys(pos).length, 6);
  assert.ok(pos.a.y < pos.b.y && pos.b.y < pos.c.y, "chain ranks descend");
  assert.ok(pos.lone.y > pos.c.y, "an edge-less island lands in the last band");
});

test("layout strategy switches past the measured dagre cutoff", () => {
  const many = Array.from({ length: DAGRE_MAX_NODES + 1 }, (_, i) => ({
    kind: "record" as const, id: `n${i}`, row: { id: `n${i}` },
  }));
  const edges = many.slice(1).map((n, i) => ({ id: `e${i}`, source: `n${Math.floor(i / 8)}`, target: n.id }));
  const t0 = Date.now();
  const pos = layoutGraph(many, edges);
  const ms = Date.now() - t0;
  assert.equal(Object.keys(pos).length, many.length);
  assert.ok(ms < 1000, `past the cutoff the BFS grid stays fast (${ms}ms)`);
});
