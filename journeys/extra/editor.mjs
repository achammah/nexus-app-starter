/* editor lane journeys — the richText field type (NotionEditor).
   Append-only (loaded by run.mjs from journeys/extra/*.mjs). Each journey boots
   the editor fixture on the lane's port band (5550-5599), drives the record page
   as a USER, and asserts a VISIBLE outcome that survives reload.
   Band note: 5550 avoids the reserved traps (5000/5060/5061/7000). */

import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 5550;
const BASE = `http://localhost:${PORT}`;

async function bootFixture(ROOT) {
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(PORT), CONFIG_PATH: "journeys/fixtures/editor.config.json" },
  });
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(`${BASE}/api/healthz`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) break;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

/* Open a doc record page in a fresh browser context, editor mounted. */
async function openDoc(page, id) {
  const ctx = await page.context().browser().newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/#/o/docs/r/${id}`);
  await p.waitForSelector('[data-testid="record-name"]', { timeout: 8000 });
  return { ctx, p };
}

/* Deterministic HTML5 drag-reorder: React state (grabId/drag) updates between the
   grip mousedown → dragstart → dragover → drop, so each step is a separate evaluate
   with a tick in between (a single synchronous dispatch sees stale `drag` state). */
async function dragReorder(p, fromId, toId, pos) {
  await p.evaluate((fromId) => {
    window.__dt = new DataTransfer();
    document.querySelector(`[data-testid="block-${fromId}"] .ne-h-grip`)
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  }, fromId);
  await p.waitForTimeout(60); // React applies draggable + grabId
  await p.evaluate((fromId) => {
    const src = document.querySelector(`[data-testid="block-${fromId}"]`);
    const r = src.getBoundingClientRect();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: r.left + 5, clientY: r.top + 5 }));
  }, fromId);
  await p.waitForTimeout(60); // drag state set
  for (const type of ["dragover", "drop"]) {
    await p.evaluate(({ toId, pos, type }) => {
      const tgt = document.querySelector(`[data-testid="block-${toId}"]`);
      const r = tgt.getBoundingClientRect();
      const y = pos === "before" ? r.top + 2 : r.bottom - 2;
      tgt.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: r.left + 5, clientY: y }));
    }, { toId, pos, type });
    await p.waitForTimeout(60); // drag.overId/pos set before drop; commit after drop
  }
}

const blockOrder = (p) =>
  p.$$eval('.ne-root [data-testid^="block-ed"]', (els) => els.map((e) => e.getAttribute("data-testid")));

export default [
  {
    name: "richtext-slash-transform", feature: "Rich-text editor (richText field)",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openDoc(page, "d_1");
        // editor renders the seeded blocks
        await p.waitForSelector('[data-testid="edit-ed1"]');
        assert((await p.locator('[data-testid="edit-ed1"]').textContent())?.includes("three phases"), "editor renders the seeded Block[]");
        // type into the block, then "/" (after a space) opens the slash menu
        await p.locator('[data-testid="edit-ed1"]').click();
        await p.keyboard.press("End");
        await p.keyboard.type(" /");
        await p.waitForSelector('[data-testid="slash-menu"]');
        assert(true, '"/" opens the slash menu');
        // transform p → h1
        await p.click('[data-testid="slash-h1"]');
        await p.waitForSelector('h1[data-testid="edit-ed1"]');
        assert(true, "slash command transforms the block p → h1");
        // debounced save lands (700ms) → the save-state chip reads "Saved"
        await p.waitForSelector('[data-testid="richtext-save-body"][data-state="saved"]', { timeout: 4000 });
        assert(true, "debounced save surfaces a 'Saved' status");
        // reload: the transform + text survive
        await p.reload();
        await p.waitForSelector('h1[data-testid="edit-ed1"]', { timeout: 8000 });
        assert((await p.locator('h1[data-testid="edit-ed1"]').textContent())?.includes("three phases"), "the h1 transform + text survive a reload");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "richtext-drag-reorder", feature: "Rich-text editor drag-reorder",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openDoc(page, "d_1");
        await p.waitForSelector('[data-testid="block-ed1"]');
        const before = await blockOrder(p);
        assert(before.join(",") === "block-ed1,block-ed2,block-ed3", `seeded order (${before.join(",")})`);
        // drag ed3 to BEFORE ed1
        await dragReorder(p, "ed3", "ed1", "before");
        await p.waitForFunction(() => {
          const ids = [...document.querySelectorAll('.ne-root [data-testid^="block-ed"]')].map((e) => e.getAttribute("data-testid"));
          return ids[0] === "block-ed3";
        }, { timeout: 4000 });
        const after = await blockOrder(p);
        assert(after[0] === "block-ed3", `drag moved ed3 to the top (${after.join(",")})`);
        // debounced save, then reload: order persists
        await p.waitForSelector('[data-testid="richtext-save-body"][data-state="saved"]', { timeout: 4000 });
        await p.reload();
        await p.waitForSelector('[data-testid="block-ed3"]', { timeout: 8000 });
        const reloaded = await blockOrder(p);
        assert(reloaded[0] === "block-ed3", `reordered order persists across reload (${reloaded.join(",")})`);
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    // BINDING: the record page live-syncs via usePollRev; a rev-poll firing mid-edit
    // must NOT clobber in-progress local block edits (seed-once-by-row-id owns the live
    // doc). Prove it: local edit → an EXTERNAL writer overwrites the body + renames the
    // record (bumps rev) → the poll fires (header updates) → the local edit survives.
    name: "richtext-poll-safety", feature: "Rich-text concurrent-poll safety",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const { ctx, p } = await openDoc(page, "d_1");
        await p.waitForSelector('[data-testid="edit-ed2"]');
        // local edit into ed2, saved
        await p.locator('[data-testid="edit-ed2"]').click();
        await p.keyboard.press("End");
        await p.keyboard.type(" LOCAL-EDIT");
        await p.waitForSelector('[data-testid="richtext-save-body"][data-state="saved"]', { timeout: 4000 });
        // another writer overwrites the body AND renames the record (bumps rev)
        await p.request.patch(`${BASE}/api/objects/docs/d_1`, {
          data: {
            title: "Externally Renamed",
            body: [
              { id: "ed1", type: "p", text: "The rollout happens in three phases." },
              { id: "ed2", type: "p", text: "SERVER OVERWRITE" },
              { id: "ed3", type: "p", text: "Phase two opens the waitlist." },
            ],
          },
        });
        // the poll (usePollRev, 4s) fires → the header adopts the external rename
        await p.waitForFunction(
          () => document.querySelector('[data-testid="record-name"]')?.textContent?.includes("Externally Renamed"),
          { timeout: 8000 },
        );
        assert(true, "a concurrent rev-poll re-renders the record (header renamed)");
        // …but the in-progress editor edit is NOT clobbered by the polled server body
        const ed2 = await p.locator('[data-testid="edit-ed2"]').textContent();
        assert(ed2?.includes("LOCAL-EDIT"), `local edit survives the poll (${JSON.stringify(ed2)})`);
        assert(!ed2?.includes("SERVER OVERWRITE"), "the polled server body did not overwrite the live document");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "richtext-table-preview", feature: "Rich-text table preview",
    async run(page, { assert, ROOT }) {
      const proc = await bootFixture(ROOT);
      try {
        const ctx = await page.context().browser().newContext();
        const p = await ctx.newPage();
        await p.goto(`${BASE}/#/o/docs`);
        await p.waitForSelector('[data-testid="table-docs"] tbody tr');
        // the richText cell shows readable plain text (not [object Object] / raw JSON)
        const cell = await p.locator('[data-testid="cell-d_1-body"]').textContent();
        assert(!!cell && cell.includes("three phases"), `table cell previews real text (${JSON.stringify(cell)})`);
        assert(!cell.includes("[object Object]") && !cell.includes('"type"'), "preview is prose, not object/JSON dump");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
];
