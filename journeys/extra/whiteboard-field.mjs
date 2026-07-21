/* whiteboard lane journeys — the whiteboard FIELD type (excalidraw canvas per record).
   Append-only (loaded by run.mjs from journeys/extra/*.mjs). Each journey boots its
   fixture on the lane's port band (5870-5879) in a FRESH browser context, drives the
   surface as a USER, and asserts VISIBLE outcomes that survive reload.
   Draw mechanics (measured): toolbar tools are hidden radio inputs → force-click via
   dispatched click on the input; keyboard tool shortcuts do not reach an embedded
   canvas; the properties island covers the canvas's left ~30% while a tool is armed,
   so all scripted drawing stays right of x=0.4. */

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const PORT = 5870;       // fixture app
const PERF_PORT = 5871;  // 10k-row fixture
const WH_PORT = 5872;    // WAREHOUSE=local variant
const BASE = (port) => `http://localhost:${port}`;

/* Load-tolerant budgets. Excalidraw is a heavy lazy chunk (editor + font machinery)
   and the draw→debounce(700ms)→store-write→chip chain is compute-heavy; under a
   busy machine (many parallel agents) fixed short timeouts starve and flake. These
   budgets are generous CEILINGS, not expected durations — a green run still resolves
   in well under a second; the ceiling only absorbs contention. Persistence is proven
   on the DETERMINISTIC signal (the saved field value, polled) rather than a fixed
   selector timeout, so the assertion cannot race the save chain. */
const MOUNT_TIMEOUT = 60000;  // excalidraw editor mount
const SAVE_BUDGET = 30000;    // scene-commit + store persist

async function bootFixture(ROOT, { port = PORT, config = "journeys/fixtures/whiteboard.config.json", env = {} } = {}) {
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(port), CONFIG_PATH: config, ...env },
  });
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE(port)}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

/* fresh, isolated context per journey. Desktop journeys take a TALL viewport:
   the document-layout canvas block sits below a 720px fold, and mouse coords are
   viewport-relative — drawing needs the whole block on screen. */
async function openPage(page, url, ctxOpts = {}) {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, ...ctxOpts });
  const p = await ctx.newPage();
  await p.goto(url);
  return { ctx, p };
}

/* excalidraw toolbar tools are visually-hidden radio inputs; the icon div
   intercepts pointer events, so activate through the input directly */
async function pickTool(p, key) {
  await p.locator(`.excalidraw [data-testid="toolbar-${key}"]`).click({ force: true });
  await p.waitForTimeout(120);
}

async function canvasBox(p, fieldKey) {
  const host = p.locator(`[data-testid="field-${fieldKey}"] .nxWbCanvas`);
  await host.waitFor({ timeout: MOUNT_TIMEOUT });
  await host.scrollIntoViewIfNeeded(); // mouse coords are viewport-relative
  await p.waitForTimeout(150);
  const box = await host.boundingBox();
  if (!box) throw new Error("canvas box not measurable");
  return box;
}

async function drawRect(p, box, x1 = 0.45, y1 = 0.2, x2 = 0.62, y2 = 0.45) {
  const cx = (f) => box.x + box.width * f;
  const cy = (f) => box.y + box.height * f;
  await p.mouse.move(cx(x1), cy(y1));
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await p.mouse.move(cx(x1) + ((cx(x2) - cx(x1)) * i) / 10, cy(y1) + ((cy(y2) - cy(y1)) * i) / 10);
  }
  await p.mouse.up();
}

const sketchCount = async (port, obj, id, field) => {
  const row = await (await fetch(`${BASE(port)}/api/objects/${obj}/${id}`)).json();
  const v = row[field];
  return Array.isArray(v?.elements) ? v.elements.length : v === null || v === undefined ? null : -1;
};

/* Deterministic persist gate: poll the SAVED field value until its element count
   matches, instead of racing a fixed chip timeout. Returns true on match, false if
   the budget expires (the caller asserts on it). This is the load-tolerant proof of
   persistence — the stored value is the ground truth, not a transient UI state. */
const waitForCount = async (port, obj, id, field, expected, budgetMs = SAVE_BUDGET) => {
  const deadline = Date.now() + budgetMs;
  let last;
  do {
    last = await sketchCount(port, obj, id, field);
    if (last === expected) return true;
    await new Promise((r) => setTimeout(r, 400));
  } while (Date.now() < deadline);
  return false;
};

export default [
  {
    name: "whiteboard-canvas-mounts", feature: "Whiteboard field (canvas on records)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        // DOCUMENT layout: the whiteboard renders as its own full-width block after the hero
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches/r/sk_1`);
        await p.waitForSelector('[data-testid="record-name"]', { timeout: 10000 });
        await p.waitForSelector('[data-testid="fieldblock-sketch"]', { timeout: 10000 });
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        assert(true, "document layout: excalidraw mounts inside the sketch field block");
        const blockBox = await p.locator('[data-testid="fieldblock-sketch"]').boundingBox();
        assert(!!blockBox && blockBox.width > 500, `the canvas block is full-width (${Math.round(blockBox?.width ?? 0)}px)`);
        // live theme flip: the canvas FOLLOWS without a reload
        await p.click('[data-testid="theme-toggle"]');
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw.theme--dark', { timeout: 5000 });
        assert(true, "live dark-flip: the mounted canvas adopts theme--dark");
        await p.click('[data-testid="theme-toggle"]'); // restore
        await p.waitForFunction(() => !document.querySelector(".excalidraw.theme--dark"), null, { timeout: 5000 });
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-document-layout.png"), fullPage: true });

        // STANDARD layout: opening a board card peeks the record; the whiteboard
        // breaks out as a block inside the peek
        await p.goto(`${BASE(PORT)}/#/o/boards`);
        await p.waitForSelector('[data-testid="kanban-boards"]');
        await p.click('[data-testid="card-bd_1"]');
        await p.waitForSelector('[data-testid="peek-panel"] [data-testid="fieldblock-diagram"]', { timeout: 10000 });
        await p.waitForSelector('[data-testid="peek-panel"] [data-testid="field-diagram"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        assert(true, "standard layout: the whiteboard block mounts inside the side peek");
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-standard-peek.png"), fullPage: true });
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "whiteboard-draw-persists", feature: "Whiteboard draw persists (warehouse round trip)",
    async run(page, { assert, ROOT }) {
      // the §4c variant: the field's one-patch save path rides the logged store op,
      // proven on the file-backed local warehouse
      const whFile = path.join("/tmp", `wb-l3-warehouse-${Date.now()}.jsonl`);
      const proc = await bootFixture(ROOT, { port: WH_PORT, env: { WAREHOUSE: "local", WAREHOUSE_LOCAL_PATH: whFile } });
      try {
        const { ctx, p } = await openPage(page, `${BASE(WH_PORT)}/#/o/sketches/r/sk_2`);
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        await p.waitForTimeout(600);
        assert((await sketchCount(WH_PORT, "sketches", "sk_2", "sketch")) === null, "sk_2 starts with no scene");
        const box = await canvasBox(p, "sketch");
        await pickTool(p, "rectangle");
        await drawRect(p, box);
        // deterministic persist gate (load-tolerant): the stored value is the ground
        // truth, so the assertion never races the draw→debounce→store-write chain
        assert(await waitForCount(WH_PORT, "sketches", "sk_2", "sketch", 1), "the drawn element persisted through the store (1 element)");
        // the Saved chip is the UI echo of that persist (generous budget under load)
        await p.waitForSelector('[data-testid="whiteboard-save-sketch"][data-state="saved"]', { timeout: SAVE_BUDGET });
        assert(true, "debounced save surfaces the Saved status chip");
        await p.reload();
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        assert(await waitForCount(WH_PORT, "sketches", "sk_2", "sketch", 1), "the scene survives a reload on the warehouse-backed store");
        await ctx.close();
      } finally {
        proc.kill();
        try { rmSync(whFile, { force: true }); } catch { /* fixture cleanup */ }
      }
    },
  },
  {
    name: "whiteboard-table-thumbnail", feature: "Whiteboard cell thumbnails",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches`);
        await p.waitForSelector('[data-testid="table-sketches"] tbody tr');
        // seeded scene → an actual SVG thumbnail hydrates in the cell
        await p.waitForSelector('[data-testid="cell-sk_1-sketch"] .nxWbThumb[data-ready] svg', { timeout: 15000 });
        assert(true, "the seeded record's cell shows a real SVG thumbnail");
        // empty scene → the static glyph, no svg
        const emptySvg = await p.locator('[data-testid="cell-sk_2-sketch"] svg:not(.lucide)').count();
        const glyph = await p.locator('[data-testid="cell-sk_2-sketch"] .nxWbThumb--empty').count();
        assert(emptySvg === 0 && glyph === 1, "an empty scene renders the subtle canvas glyph, never an export");
        // the list page never mounts the editor
        assert((await p.locator(".excalidraw").count()) === 0, "no excalidraw editor DOM on the list page");
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-table-thumbnails.png"), fullPage: true });

        // kanban: the card's meta slot renders the thumbnail through the same cell contract
        await p.goto(`${BASE(PORT)}/#/o/boards`);
        await p.waitForSelector('[data-testid="kanban-boards"]');
        await p.waitForSelector('[data-testid="card-bd_1"] .nxWbThumb[data-ready] svg', { timeout: 15000 });
        assert(true, "the kanban card shows the scene thumbnail in its meta");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    // BINDING: the record page live-syncs via usePollRev; a rev-poll firing mid-edit
    // must NOT clobber the local canvas (seed-once-by-row-id owns the live scene).
    name: "whiteboard-poll-safety", feature: "Whiteboard concurrent-poll safety",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches/r/sk_1`);
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        await p.waitForTimeout(600);
        const box = await canvasBox(p, "sketch");
        await pickTool(p, "rectangle");
        await drawRect(p, box, 0.44, 0.55, 0.56, 0.7);
        await p.waitForSelector('[data-testid="whiteboard-save-sketch"][data-state="saved"]', { timeout: SAVE_BUDGET });
        assert(await waitForCount(PORT, "sketches", "sk_1", "sketch", 5), "local draw saved (4 seeded + 1 = 5)");
        // an external writer REPLACES the scene and renames the record (bumps rev)
        await p.request.patch(`${BASE(PORT)}/api/objects/sketches/sk_1`, {
          data: { title: "Externally Renamed", sketch: { elements: [] } },
        });
        await p.waitForFunction(
          () => document.querySelector('[data-testid="record-name"]')?.textContent?.includes("Externally Renamed"),
          null, { timeout: 10000 },
        );
        assert(true, "a concurrent rev-poll re-renders the record (header renamed)");
        // …but the mounted canvas kept the LOCAL scene: the next draw saves local+1,
        // not the externally-emptied scene+1
        await pickTool(p, "ellipse");
        await drawRect(p, box, 0.66, 0.55, 0.8, 0.7);
        await p.waitForSelector('[data-testid="whiteboard-save-sketch"][data-state="saved"]', { timeout: SAVE_BUDGET });
        assert(await waitForCount(PORT, "sketches", "sk_1", "sketch", 6), "the polled overwrite did not clobber the live canvas (6 = 5 local + 1)");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "whiteboard-mobile-tap-to-edit", feature: "Whiteboard mobile tap-to-edit",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches/r/sk_1`, {
          viewport: { width: 390, height: 664 }, hasTouch: true,
        });
        await p.waitForSelector('[data-testid="fieldblock-sketch"]', { timeout: 10000 });
        // resting state: preview + Edit affordance, no live canvas, no page scroll trap
        await p.waitForSelector('[data-testid="wb-edit-sketch"]', { timeout: 10000 });
        assert((await p.locator(".excalidraw").count()) === 0, "at rest on mobile there is NO live canvas in the flow");
        const hs = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        assert(!hs, "no horizontal page scroll at 390px");
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-mobile-rest.png"), fullPage: true });
        // tap opens the fullscreen editor overlay
        await p.locator('[data-testid="wb-edit-sketch"]').tap();
        await p.waitForSelector('[data-testid="wb-overlay-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        assert(true, "tapping Edit opens the fullscreen canvas overlay");
        await p.waitForTimeout(600);
        // draw inside the overlay (pointer pipeline; touch drag is excalidraw-native)
        const box = await p.locator('[data-testid="wb-overlay-sketch"] .nxWbOverlayBody').boundingBox();
        await pickTool(p, "rectangle");
        await drawRect(p, box, 0.5, 0.35, 0.75, 0.55);
        await p.waitForSelector('[data-testid="whiteboard-save-sketch"][data-state="saved"]', { timeout: SAVE_BUDGET });
        assert(await waitForCount(PORT, "sketches", "sk_1", "sketch", 5), "the shape drawn in the overlay saved (4 seeded + 1)");
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-mobile-overlay.png"), fullPage: false });
        // Done closes the overlay and returns to the preview
        await p.locator('[data-testid="wb-done-sketch"]').tap();
        await p.waitForFunction(() => !document.querySelector('[data-testid="wb-overlay-sketch"]'), null, { timeout: 5000 });
        await p.waitForSelector('[data-testid="wb-edit-sketch"]', { timeout: 5000 });
        assert(true, "Done returns to the resting preview");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "whiteboard-keyboard-a11y", feature: "Whiteboard keyboard + announcements",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches/r/sk_1`);
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        // the block is a labeled group
        const role = await p.getAttribute('[data-testid="field-sketch"]', "role");
        const label = await p.getAttribute('[data-testid="field-sketch"]', "aria-label");
        assert(role === "group" && !!label, `the canvas block is a labeled region (role=${role}, label=${label})`);
        // a keyboard path reaches the canvas surface
        let reached = false;
        for (let i = 0; i < 60 && !reached; i++) {
          await p.keyboard.press("Tab");
          reached = await p.evaluate(() => !!document.activeElement?.closest?.(".excalidraw"));
        }
        assert(reached, "Tab reaches focusable controls inside the canvas");
        // the save-state chip announces via role=status
        await p.waitForTimeout(400);
        const box = await canvasBox(p, "sketch");
        await pickTool(p, "rectangle");
        await drawRect(p, box, 0.44, 0.55, 0.56, 0.68);
        await p.waitForSelector('[data-testid="whiteboard-save-sketch"]', { timeout: SAVE_BUDGET });
        const chipRole = await p.getAttribute('[data-testid="whiteboard-save-sketch"]', "role");
        assert(chipRole === "status", "the Saving/Saved chip announces as role=status");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "whiteboard-10k-perf", feature: "Whiteboard thumbnails at 10k rows",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT, { port: PERF_PORT, config: "journeys/fixtures/whiteboard-perf.config.json" });
      try {
        const { ctx, p } = await openPage(page, "about:blank");
        // drop REAL scenes (the fixture's editor-drawn diagram) onto a dozen visible
        // rows — the other 9,988 stay empty glyphs, the realistic mix
        const fixture = JSON.parse(
          await import("node:fs/promises").then((fs) => fs.readFile(path.join(ROOT, "journeys", "fixtures", "whiteboard.config.json"), "utf8")),
        );
        const demo = fixture.objects.find((o) => o.key === "boards").sampleRows.find((r) => r.id === "bd_1").diagram;
        await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            p.request.patch(`${BASE(PERF_PORT)}/api/objects/sheets/sh_${i + 1}`, { data: { diagram: demo } }),
          ),
        );
        const t0 = Date.now();
        await p.goto(`${BASE(PERF_PORT)}/#/o/sheets`);
        await p.waitForSelector('[data-testid="table-sheets"] tbody tr', { timeout: 20000 });
        const renderMs = Date.now() - t0;
        assert(renderMs < 10000, `10k-row table first-renders in sane time (${renderMs}ms)`);
        const domRows = await p.locator('[data-testid="table-sheets"] tbody tr').count();
        assert(domRows < 300, `the DOM renders a WINDOW, not 10k rows (${domRows} in DOM)`);
        // a visible seeded-scene row hydrates its thumbnail
        await p.waitForSelector('[data-testid="cell-sh_1-diagram"] .nxWbThumb[data-ready] svg', { timeout: 15000 });
        assert(true, "a visible scene cell hydrates its SVG thumbnail on the 10k table");
        // scrolling the window stays live to the far end
        await p.evaluate(() => { const w = document.querySelector('[data-testid="table-sheets"]'); w.scrollTop = w.scrollHeight; });
        await p.waitForSelector('[data-testid="row-sh_10000"]', { timeout: 10000 });
        assert(true, "scroll reaches row 10000 through the virtual window");
        await p.screenshot({ path: path.join(ROOT, "_shots", "wb-10k-perf.png"), fullPage: false });
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "whiteboard-invalid-value", feature: "Whiteboard invalid-value state",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        // sk_3 is seeded with a corrupt (non-scene) value — imported/legacy data class
        const { ctx, p } = await openPage(page, `${BASE(PORT)}/#/o/sketches/r/sk_3`);
        await p.waitForSelector('[data-testid="wb-invalid-sketch"]', { timeout: 10000 });
        assert(true, "a non-scene value renders the designed invalid state, never a crash");
        assert((await p.locator(".excalidraw").count()) === 0, "no editor mounts over an unreadable value");
        // the reset is an explicit, labeled action — and only then does the canvas appear
        await p.click('[data-testid="wb-reset-sketch"]');
        await p.waitForSelector('[data-testid="field-sketch"] .excalidraw', { timeout: MOUNT_TIMEOUT });
        assert(await waitForCount(PORT, "sketches", "sk_3", "sketch", 0), "reset wrote an empty scene through the store");
        // the table cell for the corrupt sibling never crashed either
        await p.goto(`${BASE(PORT)}/#/o/sketches`);
        await p.waitForSelector('[data-testid="table-sketches"] tbody tr');
        assert(true, "the list renders with formerly-corrupt values present");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    // the SHIPPED demo: starter.config.json's docs object carries the seeded scene
    name: "whiteboard-demo-seed", feature: "Whiteboard field (canvas on records)",
    async run(page, { assert }) {
      const URLBASE = process.env.JOURNEY_URL || "http://localhost:4000";
      await page.goto(URLBASE + "/#/o/docs");
      await page.waitForSelector('[data-testid="table-docs"] tbody tr');
      await page.waitForSelector('[data-testid="cell-doc_1-sketch"] .nxWbThumb[data-ready] svg', { timeout: 15000 });
      assert(true, "the shipped docs demo seeds a real scene: its thumbnail renders in the main app");
    },
  },
];
