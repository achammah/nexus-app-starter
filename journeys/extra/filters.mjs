/* filters lane journeys — advanced any-column filtering with removable chips,
   merged into the object list's ONE search box. Autoloaded by run.mjs
   (journeys/extra/*.mjs); runs against the main suite server (ctx.URLBASE) using
   the default config's companies (Industry select). Assertions are pollution-safe
   (earlier suite journeys mutate the seed) — they check narrowing + correctness,
   never a hardcoded row count. */

const rowsOf = (page) =>
  page.evaluate(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length);

export default [
  {
    name: "filter-add-narrow-persist",
    feature: "Advanced filters (any column · removable chips · unified search box)",
    async run(page, { URLBASE, assert }) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="list-search"]');
      const before = await rowsOf(page);
      assert(before >= 2, `companies list present (${before} rows)`);

      // the ONE search box also builds filters: typing a value surfaces
      // "Industry is Software" in the same dropdown — proving search + filter are unified
      await page.fill('[data-testid="list-search"]', "Software");
      await page.waitForSelector('[data-testid="filter-sug-value-industry"]', { timeout: 8000 });
      await page.click('[data-testid="filter-sug-value-industry"]');

      // a removable chip appears; the list narrows AND every remaining row is a Software company
      await page.waitForSelector('[data-testid="filter-chip-industry"]');
      await page.waitForFunction((n) => {
        const rows = [...document.querySelectorAll('[data-testid="table-companies"] tbody tr')];
        return rows.length > 0 && rows.length < n && rows.every((r) => r.textContent.includes("Software"));
      }, before);
      const narrowed = await rowsOf(page);
      assert(narrowed < before && narrowed >= 1, `Industry=Software narrows the list (${before} → ${narrowed}, all Software)`);

      // the filter (and its chip) survive a reload — persisted in the object's saved view
      await page.reload();
      await page.waitForSelector('[data-testid="filter-chip-industry"]');
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === n, narrowed);
      assert(true, "the active filter and its chip survive a reload");

      // removing the chip restores the full list
      await page.click('[data-testid="filter-remove-industry"]');
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === n, before);
      assert(true, "removing the chip restores the full list");
    },
  },
  {
    name: "filter-freetext-search",
    feature: "Advanced filters (unified search box keeps plain free-text)",
    async run(page, { URLBASE, assert }) {
      await page.goto(URLBASE + "/#/o/companies");
      await page.waitForSelector('[data-testid="list-search"]');
      const total = await rowsOf(page);
      // the same box still does plain free-text narrowing (no filter picked)
      await page.fill('[data-testid="list-search"]', "zzzznomatchzzzz");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === 0);
      assert(true, "free-text with no match empties the list");
      await page.fill('[data-testid="list-search"]', "");
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="table-companies"] tbody tr').length === n, total);
      assert(true, "clearing the search restores every row");
    },
  },
];
