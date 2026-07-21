/* Mobile lane journeys — the phone chrome end to end at a 390px viewport. Each boots the
   app on the mobile fixture (a copilot block + a hideInNav object + seeded rows) so the
   bottom tab bar, the config-driven go-to chords, the shortcuts overlay, and the review
   banner are all exercised as VISIBLE outcomes. Band 5800-5809 (the suite pins the main
   app to 5800; these lanes take 5801-5803). */

import path from "node:path";
import { spawn } from "node:child_process";

const MOBILE = { width: 390, height: 844 };

async function bootApp(ROOT, port) {
  const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(port), CONFIG_PATH: "journeys/fixtures/mobile.config.json" },
  });
  for (let i = 0; i < 24; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/healthz`, { signal: AbortSignal.timeout(1500) })).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return proc;
}

export default [
  {
    name: "mobile-tabbar", feature: "Mobile bottom tab bar (config-driven, hideInNav, copilot tab)",
    async run(page, { ROOT, assert }) {
      const port = 5801;
      const proc = await bootApp(ROOT, port);
      const B = `http://localhost:${port}`;
      try {
        const ctx = await page.context().browser().newContext({ viewport: MOBILE });
        const p = await ctx.newPage();
        await p.goto(`${B}/#/o/companies`);
        await p.waitForSelector('[data-testid="mobile-nav"]');
        // the bar renders off config.objects, honouring hideInNav
        assert((await p.locator('[data-testid="mnav-companies"]').count()) === 1, "companies tab present");
        assert((await p.locator('[data-testid="mnav-people"]').count()) === 1, "people tab present");
        assert((await p.locator('[data-testid="mnav-deals"]').count()) === 1, "deals tab present");
        assert((await p.locator('[data-testid="mnav-audit"]').count()) === 0, "hideInNav object (audit) is ABSENT from the tab bar");
        // a Copilot tab because config.copilot is set
        assert((await p.locator('[data-testid="mnav-copilot"]').count()) === 1, "copilot tab present (config.copilot set)");
        // it NAVIGATES
        await p.click('[data-testid="mnav-deals"]');
        await p.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
        assert(true, "tapping the Deals tab switches the list");
        // no horizontal page scroll at 390px with the fixed bar present
        const hs = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        assert(!hs, "no horizontal page scroll at 390px with the tab bar");
        // the copilot tab toggles the dock open
        await p.click('[data-testid="mnav-copilot"]');
        await p.waitForSelector('[data-testid="copilot-dock"].is-open');
        assert(true, "the Copilot tab opens the copilot dock");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "mobile-shortcuts", feature: "Shortcuts overlay (?) + config-driven go-to chords",
    async run(page, { ROOT, assert }) {
      const port = 5802;
      const proc = await bootApp(ROOT, port);
      const B = `http://localhost:${port}`;
      try {
        const ctx = await page.context().browser().newContext({ viewport: MOBILE });
        const p = await ctx.newPage();
        await p.goto(`${B}/#/o/companies`);
        await p.waitForSelector('[data-testid="mobile-nav"]');
        // `?` opens the shortcuts help
        await p.keyboard.press("?");
        await p.waitForSelector('[data-testid="shortcuts-overlay"]');
        const txt = (await p.textContent('[data-testid="shortcuts-overlay"]')) ?? "";
        assert(/Command palette/i.test(txt), "core shortcuts listed (Command palette)");
        assert(/Go to Companies/i.test(txt), "app go-to chord listed from config (Go to Companies)");
        // Escape closes it (the overlay owns Escape while open)
        await p.keyboard.press("Escape");
        await p.waitForSelector('[data-testid="shortcuts-overlay"]', { state: "detached" });
        assert(true, "Escape closes the shortcuts overlay");
        // the config-driven go-to chord: `g` then `d` jumps to Deals
        await p.keyboard.press("g");
        await p.keyboard.press("d");
        await p.waitForFunction(() => document.querySelector(".pageTitle")?.textContent?.includes("Deals"));
        assert(true, "the `g d` go-to chord navigates via config.goChords");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
  {
    name: "mobile-review", feature: "Mobile review banner (steps a record set with prev/next/act)",
    async run(page, { ROOT, assert }) {
      const port = 5803;
      const proc = await bootApp(ROOT, port);
      const B = `http://localhost:${port}`;
      try {
        const ctx = await page.context().browser().newContext({ viewport: MOBILE });
        const p = await ctx.newPage();
        await p.goto(`${B}/#/o/companies`);
        await p.waitForSelector(".nxRowLink");
        // open the first record → a full-screen peek carrying the 3-record set
        await p.click("tbody tr:first-child .nxRowLink");
        await p.waitForSelector('[data-testid="peek-panel"]');
        await p.waitForSelector('[data-testid="review-banner"]');
        const pos1 = (await p.textContent('[data-testid="review-pos"]')) ?? "";
        assert(/1\s*\/\s*3/.test(pos1), `the banner shows position 1 of 3 (${pos1})`);
        const name1 = await p.textContent('[data-testid="record-name"]');
        // next → position advances AND the record changes
        await p.click('[data-testid="review-next"]');
        await p.waitForFunction(() => /2\s*\/\s*3/.test(document.querySelector('[data-testid="review-pos"]')?.textContent ?? ""));
        const name2 = await p.textContent('[data-testid="record-name"]');
        assert(!!name2 && name2 !== name1, `stepping next changes the record (${name1} -> ${name2})`);
        // prev → back to the first record
        await p.click('[data-testid="review-prev"]');
        await p.waitForFunction(() => /1\s*\/\s*3/.test(document.querySelector('[data-testid="review-pos"]')?.textContent ?? ""));
        assert((await p.textContent('[data-testid="record-name"]')) === name1, "stepping back restores the first record");
        // act → promote the current record to its full page (the peek closes)
        await p.click('[data-testid="review-open"]');
        await p.waitForFunction(() => /\/r\//.test(window.location.hash));
        await p.waitForSelector('[data-testid="peek-panel"]', { state: "detached" });
        assert(true, "the Open action promotes the record to a full page");
        await ctx.close();
      } finally {
        proc.kill();
      }
    },
  },
];
