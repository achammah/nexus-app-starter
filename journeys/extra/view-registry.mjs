/* view-registry lane journeys — config-declared view tabs served by the
   self-registering view registry. Boots the view-registry fixture on the lane's
   port band (5840-5849; the full suite pins the MAIN app to 5840, this fixture
   takes 5841) and asserts VISIBLE outcomes:
     (a) an object configured with two views shows EXACTLY those switcher tabs,
         labels from the installed registry definitions (config says "kanban",
         the tab reads "Board") — no tab for a view the config leaves out;
     (b) switching views persists across a reload (nx-view);
     (c) a `views` entry naming an UNINSTALLED type renders its tab and, when
         selected, a graceful "not installed" chip — never a crash, and the
         other tabs keep working;
     (d) mobile (390x664, touch): the switcher renders and a TAP switches to
         the board. */

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 5841;
const BASE = `http://localhost:${PORT}`;

async function bootFixture(ROOT) {
  const env = { ...process.env, PORT: String(PORT), CONFIG_PATH: "journeys/fixtures/view-registry.config.json" };
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(`${BASE}/api/healthz`, { signal: AbortSignal.timeout(1500) });
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

export default [
  {
    name: "view-registry-tabs", feature: "View registry (config-driven views per object)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        await p.waitForSelector('[data-testid="table-projects"] tbody tr');
        await p.waitForSelector('[data-testid="view-switch"]');
        const tabs = p.locator('[data-testid="view-switch"] button');
        assert((await tabs.count()) === 2, `the switcher shows EXACTLY the two configured views (${await tabs.count()})`);
        assert((await tabs.allTextContents()).join("|").includes("Table"), "the table tab carries the registry label");
        assert((await tabs.allTextContents()).join("|").includes("Board"), 'config says "kanban" — the tab reads the definition label "Board"');
        assert((await p.locator('[data-testid="view-switch"] button:has-text("Chart")').count()) === 0, "no tab for a view the config leaves out");
        await shot(p, ROOT, "view-registry-tabs");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "view-registry-persist", feature: "View registry (config-driven views per object)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        await p.waitForSelector('[data-testid="view-switch"]');
        await p.click('[data-testid="view-switch"] button:has-text("Board")');
        await p.waitForSelector('[data-testid="kanban-projects"]');
        assert((await p.locator('[data-testid="col-Active"] [data-testid="card-pr_1"]').count()) === 1, "the board renders the seeded card in its stage column");
        await p.reload();
        await p.waitForSelector('[data-testid="kanban-projects"]');
        const active = await p.getAttribute('[data-testid="view-switch"] button:has-text("Board")', "data-active");
        assert(active === "true", "the chosen view survives reload (Board tab active)");
        await shot(p, ROOT, "view-registry-persist");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "view-registry-unknown", feature: "View registry (config-driven views per object)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 1360, height: 900 } });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/notes_x`);
        await p.waitForSelector('[data-testid="table-notes_x"] tbody tr');
        await p.click('[data-testid="view-switch"] button:has-text("timeline")');
        await p.waitForSelector('[data-testid="view-unknown"]');
        const chip = await p.textContent('[data-testid="view-unknown"]');
        assert(chip?.includes("timeline"), `the not-installed chip names the missing type (${chip})`);
        // the chip enters via nx-pop-in — wait for the entrance to settle so the
        // evidence screenshot shows the chip, not an early transparent frame
        await p.waitForFunction(() => {
          const el = document.querySelector('[data-testid="view-unknown"]');
          return el && getComputedStyle(el).opacity === "1";
        });
        assert(true, "the chip settles fully visible (entrance animation completed)");
        await shot(p, ROOT, "view-registry-unknown");
        // the surface stands: the other tab still works
        await p.click('[data-testid="view-switch"] button:has-text("Table")');
        await p.waitForSelector('[data-testid="table-notes_x"] tbody tr');
        assert(true, "switching back to an installed view recovers the list");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
  {
    name: "view-registry-mobile", feature: "View registry (config-driven views per object)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 664 }, hasTouch: true });
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/projects`);
        await p.waitForSelector('[data-testid="table-projects"] tbody tr');
        await p.waitForSelector('[data-testid="view-switch"]');
        await p.tap('[data-testid="view-switch"] button:has-text("Board")');
        await p.waitForSelector('[data-testid="kanban-projects"]');
        assert(true, "at 390px the switcher renders and a TAP lands on the board");
        await shot(p, ROOT, "view-registry-mobile");
        await ctx.close();
      } finally { proc.kill(); }
    },
  },
];
