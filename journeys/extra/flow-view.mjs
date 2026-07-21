/* flow-view lane journeys — records-as-graph view on the flow-view fixture.
   Boots the fixture on the lane's band (5860-5869; the full suite pins the MAIN
   app to 5860, this fixture takes 5861, the generated 10k perf fixture 5862) and
   asserts VISIBLE outcomes: nodes/edges render from relations, drag survives
   reload, a node click/Enter opens the peek, the relation picker redraws the
   graph as hubs, an out-of-band API write lands as a node via the rev poll,
   config/empty states degrade gracefully, and the 10k fixture stays windowed.
   Lib-drawn DOM (edges, node wrappers, viewport) has no testid hook, so those
   few asserts select on xyflow's documented stable classes; everything ours
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

// a node wrapper's flow-space position (the inline translate is flow coords,
// independent of the viewport zoom — stable across reload when persisted)
const nodePos = (p, testid) =>
  p.locator(`[data-testid="${testid}"]`).evaluate((el) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.parentElement.style.transform ?? "");
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  });

export default [
  {
    name: "flow-renders", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-flow_tasks"]');
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        const nodes = await p.locator('[data-testid^="flow-node-ft_"]').count();
        assert(nodes === 7, `every fixture record renders as a node card (${nodes} of 7)`);
        // 7 dependsOn refs = 7 parent→child edges (lib-drawn, no testid hook)
        const edges = await p.locator(".react-flow__edge").count();
        assert(edges === 7, `the dependsOn relation draws record→record edges (${edges} of 7)`);
        assert((await p.locator('[data-testid="flow-minimap"] svg').count()) >= 1, "the minimap renders");
        await p.getByRole("button", { name: /zoom in/i }).waitFor();
        assert(true, "the zoom controls render");
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
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
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
    name: "flow-open-peek", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        await p.click('[data-testid="flow-node-ft_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        const name = await p.textContent('[data-testid="record-name"]');
        assert(name?.includes("Design schema"), `a node click peeks that record ("${name}")`);
        await shot(p, ROOT, "flow-node-peek");
        await p.click('[data-testid="peek-close"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { state: "detached" });
        // keyboard path: focus the node wrapper, Enter opens the same peek
        await p.locator('[data-testid="flow-node-ft_2"]').evaluate((el) => el.parentElement.focus());
        await p.keyboard.press("Enter");
        await p.waitForSelector('[data-testid="peek-panel"]');
        const name2 = await p.textContent('[data-testid="record-name"]');
        assert(name2?.includes("Build API"), `Enter on a focused node peeks it ("${name2}")`);
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "flow-hubs-live-rows", feature: "Flow view (records as node graph)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/flow_tasks`);
        await p.waitForSelector('[data-testid="flow-node-ft_1"]');
        // an EXTERNAL writer creates a row — it must land as a node via the rev
        // poll with no interaction (the store is per-boot, nothing to clean up)
        const created = await (await fetch(`${BASE}/api/objects/flow_tasks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Hotfix rollout", status: "Active", dependsOn: ["ft_2"] }),
        })).json();
        await p.waitForSelector(`[data-testid="flow-node-${created.id}"]`, { timeout: 12000 });
        assert(true, "an API-created record appears as a node via the rev poll, no interaction");
        const edges = await p.locator(".react-flow__edge").count();
        assert(edges === 8, `its dependsOn edge arrives with it (${edges} of 8)`);
        // relation picker: switch edges to the cross-object Owner relation → hubs
        await p.click('[data-testid="flow-relation-menu"]');
        await p.click('[data-testid="flow-relation-owner_ref"]');
        await p.waitForSelector('[data-testid="flow-hub-flow_people-fp_1"]');
        const hubText = await p.textContent('[data-testid="flow-hub-flow_people-fp_1"]');
        assert(hubText?.includes("Ada Cheng"), `a cross-object target renders as a labeled hub ("${hubText}")`);
        const hubs = await p.locator('[data-testid^="flow-hub-flow_people-"]').count();
        assert(hubs === 3, `one hub per distinct target (${hubs} of 3)`);
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
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
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
        await shot(p, ROOT, "flow-mobile");
        // tap-to-open is the mobile core interaction
        await p.tap('[data-testid="flow-node-ft_1"]');
        await p.waitForSelector('[data-testid="peek-panel"]');
        assert((await p.textContent('[data-testid="record-name"]'))?.includes("Design schema"),
          "at 390px a TAP on a node opens its record");
        await p.tap('[data-testid="peek-close"]');
        await p.waitForSelector('[data-testid="peek-panel"]', { state: "detached" });
        // touch zoom path: the controls are tappable and move the viewport
        const zBefore = await p.locator(".react-flow__viewport").evaluate((el) => el.style.transform);
        await p.getByRole("button", { name: /zoom in/i }).tap();
        await p.waitForFunction(
          (prev) => document.querySelector(".react-flow__viewport")?.style.transform !== prev,
          zBefore,
        );
        assert(true, "tapping the zoom control changes the viewport (touch zoom path)");
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
          views: [{ type: "table" }, { type: "flow", relationField: "parent" }],
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
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        const t0 = Date.now();
        await p.goto(`${PERF_BASE}/#/o/flow_perf`);
        await p.waitForSelector('[data-testid^="flow-node-fx_"]', { timeout: 30000 });
        const renderMs = Date.now() - t0;
        assert(renderMs < 30000, `10k-row graph reaches first painted nodes in ${renderMs}ms (< 30s)`);
        // windowing proof: the DOM holds a viewport WINDOW, not 10k node elements
        const domNodes = await p.locator(".react-flow__node").count();
        assert(domNodes > 0 && domNodes < 1500, `onlyRenderVisibleElements windows the DOM (${domNodes} of 10000 in the DOM)`);
        const t1 = Date.now();
        const first = p.locator('[data-testid^="flow-node-fx_"]').first();
        await first.click();
        await p.waitForSelector('[data-testid="peek-panel"]', { timeout: 5000 });
        assert(Date.now() - t1 < 5000, `node→peek stays responsive on the 10k fixture (${Date.now() - t1}ms)`);
        await shot(p, ROOT, "flow-perf-10k");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
