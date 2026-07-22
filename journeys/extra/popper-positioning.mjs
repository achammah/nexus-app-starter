/* popper-positioning lane — the regression proof for the Radix popper anchor fix.
   Before the fix every dropdown popper painted at the translate(0,-200%) placeholder
   (the anchor ref never registered, so floating-ui never computed a position): the menu
   was OPEN in the DOM but offscreen and unreachable by POINTER. The rest of the suite
   stayed green only because the other menu journeys keyboard-navigate (roving focus is
   geometry-free). This journey drives the columns menu the way a POINTER user does —
   open, then click a menu item at its rendered position — and asserts the popper is
   on-screen and the click takes effect. It fails if the popper regresses offscreen. */

export default [
  {
    name: "popper-pointer-reach", feature: "Radix popper positioning",
    async run(page, { URLBASE, assert }) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('th:has-text("Domain")');

      // open the columns menu by POINTER
      await page.click('[data-testid="columns-menu"]');
      await page.waitForSelector('[data-testid="col-toggle-domain"]');

      // REGRESSION ASSERT: the popper is positioned on-screen, not parked at the
      // translate(0,-200%) placeholder — read the open menu item's live geometry.
      const geo = await page.evaluate(() => {
        const wrap = document.querySelector('[data-radix-popper-content-wrapper]');
        const item = document.querySelector('[data-testid="col-toggle-domain"]');
        const r = item?.getBoundingClientRect();
        const cs = wrap ? getComputedStyle(wrap) : null;
        const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return {
          transform: cs?.transform ?? null,
          itemTop: r ? Math.round(r.top) : null,
          onScreen: !!r && r.top >= 0 && r.top < innerHeight && r.left >= 0 && r.left < innerWidth,
          pointerReaches: !!hit?.closest?.('[role="menu"]'),
        };
      });
      assert(geo.onScreen, `columns menu paints on-screen (item top=${geo.itemTop}px, transform=${geo.transform})`);
      assert(geo.pointerReaches, "a pointer at the menu item center lands inside the open menu");

      // POINTER-CLICK the item (impossible while the popper is offscreen) and prove the effect.
      // Each journey runs in its own browser context, so the toggled state does not leak.
      await page.click('[data-testid="col-toggle-domain"]');
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => ![...document.querySelectorAll("th")].some((t) => t.textContent?.includes("Domain")));
      assert(true, "pointer-clicking the menu item removes the Domain column");
    },
  },
];
