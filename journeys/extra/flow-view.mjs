/* flow-view lane journeys — the full-fidelity records-as-graph view. The v1
   basics run on `flow_tasks` (self-relation edges, drag persist, node detail,
   relation picker → hubs, empty/config states, 10k windowing). The DEPTH suite
   runs on the dense `flow_org` fixture (32-person, 7-department org chart) and
   asserts VISIBLE outcomes for every confirmed capability: switchable layouts,
   subflow grouping + collapse, per-field node shapes + colors, inline rename,
   the node-detail panel (typed edits that re-shape the node), drag-between-
   records-to-relate, hand-create, search-and-focus, and resize. Boots the fixture
   on the lane band (5860-5869; fixture 5861, the 10k perf fixture 5862).
   Lib-drawn DOM (edges, node wrappers, viewport, handles) has no testid hook, so
   those few asserts select on xyflow's documented stable classes; everything ours
   selects on testids. */

import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const PORT = 5861;
const BASE = `http://localhost:${PORT}`;
const PERF_PORT = 5862;
const PERF_BASE = `http://localhost:${PERF_PORT}`;

async function bootFixture(ROOT, { port = PORT, configPath = "journeys/fixtures/flow-view.config.json" } = {}) {
  const env = { ...process.env, PORT: String(port), CONFIG_PATH: configPath };
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

// lane screenshots land uncommitted in <worktree>/_shots/
const shot = (p, ROOT, name) => {
  mkdirSync(path.join(ROOT, "_shots"), { recursive: true });
  return p.screenshot({ path: path.join(ROOT, "_shots", `${name}.png`) });
};
const desktop = (page) => page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });

// a node wrapper's flow-space position (the inline translate is flow coords,
// independent of the viewport zoom — stable across reload when persisted)
const nodePos = (p, testid) =>
  p.locator(`[data-testid="${testid}"]`).evaluate((el) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.parentElement.style.transform ?? "");
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  });
// wait for every card's entrance stagger to settle before an evidence shot
const settle = (p) =>
  p.waitForFunction(() =>
    [...document.querySelectorAll('[data-testid^="flow-node-"]')].every((el) => getComputedStyle(el).opacity === "1"));
// a flow_org record's reportsTo id straight from the store (drag-to-relate proof)
const reportsTo = async (id) => {
  const r = await (await fetch(`${BASE}/api/objects/flow_org/${id}`)).json();
  return (r.data ?? r)?._refs?.reportsTo;
};

export default [
  {
    name: "flow-renders", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-flow_tasks"]');
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        const nodes = await p.locator('[data-testid^="flow-node-ft_"]').count();
        assert(nodes === 7, `every fixture record renders as a node card (${nodes} of 7)`);
        const edges = await p.locator(".react-flow__edge").count();
        assert(edges === 7, `the dependsOn relation draws record→record edges (${edges} of 7)`);
        assert((await p.locator('[data-testid="flow-minimap"] svg').count()) >= 1, "the minimap renders");
        await p.getByRole("button", { name: /zoom in/i }).waitFor();
        assert(true, "the zoom controls render");
        await settle(p);
        assert(true, "every card settles fully visible (entrance animation completed)");
        await shot(p, ROOT, "flow-graph-minimap");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-drag-persists", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-node-ft_7"]');
        const before = await nodePos(p, "flow-node-ft_7");
        const box = await p.locator('[data-testid="flow-node-ft_7"]').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        await p.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 80, { steps: 8 });
        await p.mouse.up();
        const after = await nodePos(p, "flow-node-ft_7");
        assert(before && after && (Math.abs(after.x - before.x) > 20 || Math.abs(after.y - before.y) > 20),
          `dragging moves the card in flow space (${JSON.stringify(before)} → ${JSON.stringify(after)})`);
        await shot(p, ROOT, "flow-dragged-node");
        await p.reload();
        await p.waitForSelector('[data-testid="flow-node-ft_7"]');
        const reloaded = await nodePos(p, "flow-node-ft_7");
        assert(reloaded && Math.abs(reloaded.x - after.x) < 2 && Math.abs(reloaded.y - after.y) < 2,
          `the dragged position survives reload (${JSON.stringify(reloaded)} ≈ ${JSON.stringify(after)})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-open-detail", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        // a click opens the rich node-detail panel (the confirmed click behaviour)
        await p.click('[data-testid="flow-node-ft_1"]');
        await p.waitForSelector('[data-testid="flow-detail-panel"]');
        const title = await p.textContent('[data-testid="flow-detail-title"]');
        assert(title?.includes("Design schema"), `a node click opens the detail panel for that record ("${title}")`);
        await shot(p, ROOT, "flow-node-detail");
        // the panel's Open action opens the host's full record peek
        await p.click('[data-testid="flow-detail-open"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        const name = await p.textContent('[data-testid="record-name"]');
        assert(name?.includes("Design schema"), `the detail panel opens the full record ("${name}")`);
        await p.click('[data-testid="peek-close"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { state: "detached" });
        // keyboard path: focus a node wrapper, Enter opens the same detail panel
        await p.locator('[data-testid="flow-node-ft_2"]').evaluate((el) => el.parentElement.focus());
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="flow-detail-panel"]');
        const title2 = await p.textContent('[data-testid="flow-detail-title"]');
        assert(title2?.includes("Build API"), `Enter on a focused node opens its detail ("${title2}")`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-hubs-live-rows", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        // an EXTERNAL writer creates a row — it must land as a node via the rev poll
        const created = await (await fetch(`${BASE}/api/objects/flow_tasks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Hotfix rollout", status: "Active", dependsOn: ["ft_2"] }),
        })).json();
        await p.waitForSelector(`[data-testid="flow-node-${created.id}"]`, { timeout: 12000 });
        assert(true, "an API-created record appears as a node via the rev poll, no interaction");
        const edges = await p.locator(".react-flow__edge").count();
        assert(edges === 8, `its dependsOn edge arrives with it (${edges} of 8)`);
        // relation picker: switch edges to the cross-object Owner relation → hubs.
        await p.focus('[data-testid="flow-relation-menu"]');
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="flow-relation-owner_ref"]');
        for (let i = 0; i < 6; i++) {
          if (await p.locator('[data-testid="flow-relation-owner_ref"][data-highlighted]').count()) break;
          await p.keyboard.press("ArrowDown");
        }
        await p.waitForSelector('[data-testid="flow-relation-owner_ref"][data-highlighted]');
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="flow-hub-flow_people-fp_1"]');
        const hubText = await p.textContent('[data-testid="flow-hub-flow_people-fp_1"]');
        assert(hubText?.includes("Ada Cheng"), `a cross-object target renders as a labeled hub ("${hubText}")`);
        await p.waitForFunction(
          () => document.querySelectorAll('[data-testid^="flow-hub-flow_people-"]').length === 3,
          undefined, { timeout: 5000 });
        assert(true, "one hub per distinct target (3 of 3 once the refit settles)");
        await p.waitForFunction(() =>
          [...document.querySelectorAll('[data-testid^="flow-hub-"], [data-testid^="flow-node-"]')].every(
            (el) => getComputedStyle(el).opacity === "1"));
        await shot(p, ROOT, "flow-hubs");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-states", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        // an object with NO relation field degrades to the plain-language chip
        await p.goto(`${BASE}/#/o/flow_plain`);
        await p.waitForSelector('[data-testid="table-flow_plain"] tbody tr');
        await p.click('[data-testid="view-switch"] button:has-text("Flow")');
        await p.waitForSelector('[data-testid="view-unknown"]');
        const chip = await p.textContent('[data-testid="view-unknown"]');
        assert(chip?.includes("no relation field"), `the config chip explains the miss in plain language ("${chip}")`);
        // zero rows → the designed empty state, not a bare canvas
        await p.goto(`${BASE}/#/o/flow_empty`);
        await p.waitForSelector('[data-testid="flow-empty"]');
        const empty = await p.textContent('[data-testid="flow-empty"]');
        assert(empty?.includes("Nothing to map yet"), "the empty state renders designed copy");
        await p.waitForFunction(() => {
          const el = document.querySelector('[data-testid="flow-empty"]');
          return el && getComputedStyle(el).opacity === "1";
        });
        await shot(p, ROOT, "flow-states");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-mobile", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-flow_tasks"]');
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        await settle(p);
        await shot(p, ROOT, "flow-mobile");
        // tap-to-open → the detail panel becomes a bottom sheet
        await p.tap('[data-testid="flow-node-ft_1"]');
        await p.waitForSelector('[data-testid="flow-detail-panel"]');
        assert((await p.textContent('[data-testid="flow-detail-title"]'))?.includes("Design schema"),
          "at 390px a TAP on a node opens its detail sheet");
        await shot(p, ROOT, "flow-mobile-detail");
        await p.tap('[data-testid="flow-detail-close"]');
        await p.waitForSelector('[data-testid="flow-detail-panel"]', { state: "detached" });
        // touch zoom path: the controls are tappable and move the viewport
        const zBefore = await p.locator(".react-flow__viewport").evaluate((el) => el.style.transform);
        await p.getByRole("button", { name: /zoom in/i }).tap();
        await p.waitForFunction(
          (prev) => document.querySelector(".react-flow__viewport")?.style.transform !== prev, zBefore);
        assert(true, "tapping the zoom control changes the viewport (touch zoom path)");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },

  /* ---------------- DEPTH suite (flow_org — the dense demo) ---------------- */
  {
    name: "flow-depth-layouts", feature: "Flow depth — layouts + demo density",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-flow_org"]');
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        const nodes = await p.locator('[data-testid^="flow-node-p"]').count();
        assert(nodes === 32, `dense demo: 32 people render as nodes (${nodes} of 32)`);
        const edges = await p.locator(".react-flow__edge").count();
        assert(edges === 45, `reportsTo + collaboratesWith draw two edge types (${edges} of 45)`);
        await settle(p);
        await shot(p, ROOT, "depth-org-hierarchy");
        // switch layouts and prove the graph re-lays out (a node's flow-space moves)
        const h = await nodePos(p, "flow-node-p10");
        await p.click('[data-testid="flow-layout-force"]');
        await p.waitForTimeout(1300);
        const f = await nodePos(p, "flow-node-p10");
        assert(f && (Math.abs(f.x - h.x) > 30 || Math.abs(f.y - h.y) > 30),
          `Force re-lays out the graph (${JSON.stringify(h)} → ${JSON.stringify(f)})`);
        await shot(p, ROOT, "depth-org-force");
        await p.click('[data-testid="flow-layout-grid"]');
        await p.waitForTimeout(900);
        const g = await nodePos(p, "flow-node-p10");
        assert(g && (Math.abs(g.x - f.x) > 30 || Math.abs(g.y - f.y) > 30),
          `Grid re-lays out again (${JSON.stringify(f)} → ${JSON.stringify(g)})`);
        await shot(p, ROOT, "depth-org-grid");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-shapes-colors", feature: "Flow depth — per-type shapes + colors",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        const shape = (id) => p.getAttribute(`[data-testid="flow-node-${id}"]`, "data-shape");
        assert((await shape("p1")) === "hexagon", `an Exec node takes the hexagon shape (p1 = ${await shape("p1")})`);
        assert((await shape("p3")) === "diamond", `a Director node takes the diamond shape (p3 = ${await shape("p3")})`);
        assert((await shape("p6")) === "rounded", `an IC node takes the rounded shape (p6 = ${await shape("p6")})`);
        const accent = await p.getAttribute('[data-testid="flow-node-p3"]', "data-accent");
        assert(accent === "1", `nodes carry a department color accent (p3 data-accent=${accent})`);
        // zoom into a cluster so the shapes + colors read at card scale
        const wrap = await p.locator('[data-testid="flow-flow_org"]').boundingBox();
        await p.mouse.move(wrap.x + wrap.width / 2, wrap.y + wrap.height / 2);
        for (let i = 0; i < 2; i++) await p.mouse.wheel(0, -420);
        await p.waitForTimeout(500);
        await shot(p, ROOT, "depth-org-shapes-colors");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-grouping", feature: "Flow depth — subflow grouping + collapse",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        await p.click('[data-testid="flow-group-toggle"]');
        await p.waitForSelector('[data-testid="flow-group-Engineering"]');
        const containers = await p.locator('[data-testid^="flow-group-"]:not([data-testid*="toggle"])').count();
        assert(containers === 7, `grouping folds records into one subflow per department (${containers} of 7)`);
        await settle(p);
        await shot(p, ROOT, "depth-org-grouped");
        // collapse Engineering → its members hide, the container stays
        const before = await p.locator('[data-testid^="flow-node-p"]').count();
        await p.click('[data-testid="flow-group-toggle-Engineering"]');
        await p.waitForTimeout(600);
        const after = await p.locator('[data-testid^="flow-node-p"]').count();
        assert(after < before, `collapsing Engineering hides its members (${before} → ${after} cards)`);
        assert((await p.locator('[data-testid="flow-group-Engineering"]').count()) === 1,
          "the collapsed group container stays as a header");
        await shot(p, ROOT, "depth-org-collapsed");
        // expand restores them
        await p.click('[data-testid="flow-group-toggle-Engineering"]');
        await p.waitForTimeout(600);
        const back = await p.locator('[data-testid^="flow-node-p"]').count();
        assert(back === before, `expanding restores the members (${back} of ${before})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-inline-rename", feature: "Flow depth — inline rename on the node",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p6"]');
        await p.dblclick('[data-testid="flow-node-p6"] .nxKTitle');
        await p.waitForSelector('[data-testid="flow-node-edit-p6"]');
        await p.fill('[data-testid="flow-node-edit-p6"]', "Liam O'Brien-Vega");
        await p.press('[data-testid="flow-node-edit-p6"]', "Enter");
        await p.waitForFunction(() =>
          document.querySelector('[data-testid="flow-node-p6"]')?.textContent?.includes("O'Brien-Vega"), undefined, { timeout: 6000 });
        assert(true, "double-click renames the record on its node");
        await shot(p, ROOT, "depth-org-rename");
        // persisted through the store
        await p.reload();
        await p.waitForSelector('[data-testid="flow-node-p6"]');
        const reloaded = await p.textContent('[data-testid="flow-node-p6"]');
        assert(reloaded?.includes("O'Brien-Vega"), `the rename persisted (${reloaded})`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-detail-edit", feature: "Flow depth — typed edit in the detail panel",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p8"]');
        const shape0 = await p.getAttribute('[data-testid="flow-node-p8"]', "data-shape");
        assert(shape0 === "rounded", `p8 starts as an IC (rounded) node (${shape0})`);
        await p.click('[data-testid="flow-node-p8"]');
        await p.waitForSelector('[data-testid="flow-detail-panel"]');
        // change the Level select → the field drives the node SHAPE, so it re-shapes live
        await p.selectOption('[data-testid="flow-detail-level"]', "Director");
        await p.waitForFunction(() =>
          document.querySelector('[data-testid="flow-node-p8"]')?.getAttribute("data-shape") === "diamond",
          undefined, { timeout: 8000 });
        assert(true, "editing Level in the panel re-shapes the node live (rounded → diamond)");
        await shot(p, ROOT, "depth-org-detail-edit");
        // persisted through the store
        await p.reload();
        await p.waitForSelector('[data-testid="flow-node-p8"]');
        assert((await p.getAttribute('[data-testid="flow-node-p8"]', "data-shape")) === "diamond",
          "the typed edit persisted through the store");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-drag-relate", feature: "Flow depth — drag between records to relate",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        assert((await p.getAttribute('[data-testid="flow-flow_org"]', "data-connectable")) === "1",
          "the self-relation view exposes connectable handles");
        // zoom so the handles are hittable and endpoints sit inside the canvas
        const wrap = await p.locator('[data-testid="flow-flow_org"]').boundingBox();
        await p.mouse.move(wrap.x + wrap.width / 2, wrap.y + wrap.height / 2);
        for (let i = 0; i < 2; i++) await p.mouse.wheel(0, -450);
        await p.waitForTimeout(500);
        const safe = { l: wrap.x + 40, r: wrap.x + wrap.width - 40, t: wrap.y + 90, b: wrap.y + wrap.height - 40 };
        const hs = await p.evaluate(() =>
          [...document.querySelectorAll(".react-flow__node-record")].map((el) => {
            const b = el.getBoundingClientRect();
            const s = el.querySelector(".react-flow__handle.source")?.getBoundingClientRect();
            const t = el.querySelector(".react-flow__handle.target")?.getBoundingClientRect();
            return { id: el.getAttribute("data-id"),
              c: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
              src: s && { x: s.x + s.width / 2, y: s.y + s.height / 2 },
              tgt: t && { x: t.x + t.width / 2, y: t.y + t.height / 2 } };
          }));
        const inSafe = (pt) => pt && pt.x > safe.l && pt.x < safe.r && pt.y > safe.t && pt.y < safe.b;
        const A = hs.find((n) => inSafe(n.src) && inSafe(n.c));
        let B = null;
        for (const n of hs) { if (n.id !== A.id && inSafe(n.tgt) && (await reportsTo(n.id)) !== A.id) { B = n; break; } }
        assert(A && B, `found a hittable source (${A?.id}) and an unlinked target (${B?.id})`);
        const before = await reportsTo(B.id);
        // hover the source node so its connect handles reveal, then grab + drag
        await p.mouse.move(A.c.x, A.c.y);
        await p.waitForTimeout(150);
        await p.mouse.move(A.src.x, A.src.y);
        await p.mouse.down();
        await p.mouse.move(A.src.x, A.src.y + 8, { steps: 3 });
        await p.mouse.move(B.tgt.x, B.tgt.y, { steps: 18 });
        await p.mouse.up();
        await p.waitForTimeout(900);
        const after = await reportsTo(B.id);
        assert(after === A.id && after !== before,
          `dragging from ${A.id} to ${B.id} wrote the relation in the store (reportsTo ${before} → ${after})`);
        await shot(p, ROOT, "depth-org-relate");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-multiselect", feature: "Flow depth — multi-select + bulk move",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        const wrap = await p.locator('[data-testid="flow-flow_org"]').boundingBox();
        // two nodes fully left of where the detail panel opens
        const ids = await p.evaluate((w) => [...document.querySelectorAll(".react-flow__node-record")]
          .map((el) => ({ id: el.getAttribute("data-id"), b: el.getBoundingClientRect() }))
          .filter(({ b }) => b.left > w.x + 40 && b.right < w.x + w.width - 380 && b.top > w.y + 110 && b.bottom < w.y + w.height - 60)
          .map((n) => n.id).slice(0, 2), wrap);
        assert(ids.length === 2, `found two nodes to multi-select (${ids})`);
        const posOf = (id) => p.locator(`[data-testid="flow-node-${id}"]`).evaluate((el) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.parentElement.style.transform ?? ""); return m ? { x: +m[1], y: +m[2] } : null; });
        const a0 = await posOf(ids[0]), b0 = await posOf(ids[1]);
        await p.click(`[data-testid="flow-node-${ids[0]}"]`);
        await p.keyboard.down("Shift");
        await p.click(`[data-testid="flow-node-${ids[1]}"]`);
        await p.keyboard.up("Shift");
        assert((await p.locator(".react-flow__node.selected").count()) >= 2, "shift-click selects multiple nodes");
        const bx = await p.locator(`[data-testid="flow-node-${ids[0]}"]`).boundingBox();
        await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2);
        await p.mouse.down();
        await p.mouse.move(bx.x + bx.width / 2 + 120, bx.y + bx.height / 2 + 90, { steps: 10 });
        await p.mouse.up();
        await p.waitForTimeout(400);
        const a1 = await posOf(ids[0]), b1 = await posOf(ids[1]);
        assert(a1 && b1 && Math.abs(a1.x - a0.x) > 20 && Math.abs(b1.x - b0.x) > 20,
          `dragging one moves the whole selection (${ids[0]} + ${ids[1]})`);
        await shot(p, ROOT, "depth-org-multiselect");
        await p.reload();
        await p.waitForSelector(`[data-testid="flow-node-${ids[0]}"]`);
        const a2 = await posOf(ids[0]);
        assert(a2 && Math.abs(a2.x - a1.x) < 3, "the bulk move persists through reload");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-add-node", feature: "Flow depth — hand-create a node",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        const before = await p.locator(".react-flow__node-record").count();
        await p.click('[data-testid="flow-add-node"]');
        await p.waitForSelector('[data-testid="create-confirm"]');
        await p.click('[data-testid="create-confirm"]');
        await p.waitForSelector('[data-testid="create-confirm"]', { state: "detached" });
        await p.waitForFunction(
          (n) => document.querySelectorAll(".react-flow__node-record").length > n, before, { timeout: 12000 });
        const after = await p.locator(".react-flow__node-record").count();
        assert(after > before, `hand-creating adds a node to the graph (${before} → ${after})`);
        await shot(p, ROOT, "depth-org-add-node");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-search", feature: "Flow depth — search and focus",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        await p.fill('[data-testid="flow-search"]', "Nadia");
        await p.waitForTimeout(300);
        const dim = await p.locator(".react-flow__node.nxDim").count();
        const match = await p.locator(".react-flow__node.nxMatch").count();
        assert(match >= 1 && dim >= 1, `search highlights matches and dims the rest (${match} matched, ${dim} dimmed)`);
        await p.press('[data-testid="flow-search"]', "Enter");
        await p.waitForTimeout(700);
        await shot(p, ROOT, "depth-org-search");
        await p.click('[data-testid="flow-search-clear"]');
        await p.waitForTimeout(300);
        assert((await p.locator(".react-flow__node.nxDim").count()) === 0, "clearing search restores every node");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-resize", feature: "Flow depth — resize a node",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        const wrap = await p.locator('[data-testid="flow-flow_org"]').boundingBox();
        // moderate zoom keeps the node fully on-canvas; anchor left of the detail panel
        const zoomIn = async () => { await p.mouse.move(wrap.x + wrap.width / 2, wrap.y + wrap.height / 2); for (let i = 0; i < 2; i++) await p.mouse.wheel(0, -430); await p.waitForTimeout(400); };
        await zoomIn();
        // pick a record node whose box sits fully inside the canvas, near the left third
        const pickId = () => p.evaluate((w) => {
          const safe = { l: w.x + 30, r: w.x + w.width - 360, t: w.y + 100, b: w.y + w.height - 60 };
          const ax = w.x + w.width * 0.32, ay = w.y + w.height * 0.5;
          return [...document.querySelectorAll(".react-flow__node-record")]
            .map((el) => { const b = el.getBoundingClientRect(); return { id: el.getAttribute("data-id"), b }; })
            .filter(({ b }) => b.left > safe.l && b.right < safe.r && b.top > safe.t && b.bottom < safe.b && b.width > 100)
            .map((n) => ({ id: n.id, d: Math.hypot(n.b.x + n.b.width / 2 - ax, n.b.y + n.b.height / 2 - ay) }))
            .sort((a, b) => a.d - b.d)[0]?.id;
        }, wrap);
        const id = await pickId();
        assert(id, `found a fully-on-canvas node to resize (${id})`);
        const sel = `.react-flow__node-record[data-id="${id}"]`;
        const w0 = await p.locator(sel).evaluate((el) => el.getBoundingClientRect().width);
        await p.click(`[data-testid="flow-node-${id}"]`); // select → reveal the resizer
        await p.waitForSelector(`${sel} .react-flow__resize-control.bottom.right`);
        const h = await p.locator(`${sel} .react-flow__resize-control.bottom.right`).boundingBox();
        await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
        await p.mouse.down();
        await p.mouse.move(h.x + h.width / 2 + 90, h.y + h.height / 2 + 40, { steps: 12 });
        await p.mouse.up();
        await p.waitForTimeout(400);
        const w1 = await p.locator(sel).evaluate((el) => el.getBoundingClientRect().width);
        assert(w1 > w0 + 20, `dragging the resize handle grows the node (${Math.round(w0)} → ${Math.round(w1)}px)`);
        await shot(p, ROOT, "depth-org-resize");
        // persisted through the view state (flowSizes)
        await p.reload();
        await p.waitForSelector(sel);
        await zoomIn();
        const w2 = await p.locator(sel).evaluate((el) => el.getBoundingClientRect().width);
        assert(w2 > w0 + 20, `the resized dimensions survive reload (${Math.round(w2)}px)`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-depth-mobile", feature: "Flow depth — mobile 390px",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 780 }, hasTouch: true });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_org`);
        await p.waitForSelector('[data-testid="flow-node-p1"]');
        await settle(p);
        assert((await p.locator('[data-testid="flow-toolbar"]').count()) === 1, "the on-canvas toolbar renders at 390px");
        await shot(p, ROOT, "depth-org-mobile");
        // tap a node → the detail bottom sheet
        await p.tap('[data-testid="flow-node-p1"]');
        await p.waitForSelector('[data-testid="flow-detail-panel"]');
        assert((await p.textContent('[data-testid="flow-detail-title"]'))?.includes("Dana Whitfield"),
          "a tap opens the detail bottom sheet");
        await shot(p, ROOT, "depth-org-mobile-detail");
        await p.tap('[data-testid="flow-detail-close"]');
        // layout switch works by touch
        await p.tap('[data-testid="flow-layout-grid"]');
        await p.waitForTimeout(700);
        assert((await p.getAttribute('[data-testid="flow-flow_org"]', "data-layout")) === "grid",
          "the layout switcher works by touch");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-perf-10k", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      // generate a 10k-row self-relation fixture (8-ary tree by direct ids)
      const rows = [];
      for (let i = 0; i < 10000; i++) {
        const r = { id: `fx_${i}`, name: `Node ${i}` };
        if (i > 0) r.parent = `fx_${Math.floor((i - 1) / 8)}`;
        rows.push(r);
      }
      const cfg = {
        app: { name: "Flow Perf Fixture", slug: "flow-perf-fixture" },
        theme: {},
        users: ["you"],
        objects: [{
          key: "flow_perf", label: "Perf nodes", labelOne: "Perf node", icon: "list-checks",
          defaultView: "flow",
          // depth features off on the 10k path (keeps the windowing measurement clean)
          views: [{ type: "table" }, { type: "flow", relationField: "parent", handEdit: false, edgeDraw: false, animated: false, nodeDetail: false }],
          fields: [
            { key: "name", label: "Name", type: "text", primary: true, width: 220 },
            { key: "parent", label: "Parent", type: "relation", relation: "flow_perf", width: 180 },
          ],
          sampleRows: rows,
        }],
      };
      const cfgPath = path.join(os.tmpdir(), `flow-perf-${Date.now()}.config.json`);
      writeFileSync(cfgPath, JSON.stringify(cfg));
      const proc = await bootFixture(ROOT, { port: PERF_PORT, configPath: cfgPath });
      try {
        const ctx = await desktop(page);
        const p = await ctx.newPage();
        const t0 = Date.now();
        await p.goto(`${PERF_BASE}/#/o/flow_perf`);
        await p.waitForSelector('[data-testid^="flow-node-fx_"]', { timeout: 30000 });
        const renderMs = Date.now() - t0;
        assert(renderMs < 30000, `10k-row graph reaches first painted nodes in ${renderMs}ms (< 30s)`);
        const atFit = await p.locator(".react-flow__node").count();
        const box = await p.locator('[data-testid="flow-flow_perf"]').boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 10; i++) await p.mouse.wheel(0, -600);
        await p.waitForFunction(
          (prev) => document.querySelectorAll(".react-flow__node").length < Math.min(prev, 800),
          atFit, { timeout: 10000 });
        const windowed = await p.locator(".react-flow__node").count();
        assert(windowed > 0 && windowed < 800, `onlyRenderVisibleElements windows the DOM at working zoom (${windowed} in the DOM, ${atFit} at fit-all, 10000 rows)`);
        const t1 = Date.now();
        await p.locator('[data-testid^="flow-node-fx_"]').first().click();
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 5000 });
        assert(Date.now() - t1 < 5000, `node→peek stays responsive on the 10k fixture (${Date.now() - t1}ms)`);
        await shot(p, ROOT, "flow-perf-10k");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
