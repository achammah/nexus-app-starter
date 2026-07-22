# TESTING — the journey harness

Two layers, both run from the repo root:

| Layer | Command | What it is |
|---|---|---|
| Journeys | `npm run journeys` | Playwright drives the running app as a USER and asserts VISIBLE outcomes |
| Units | `npm test` | `node --test journeys/unit/*.test.ts` — pure logic (config resolvers, layout math, cell formatting); no browser, no build |

A journey asserts something a user can see — a row appears, a value changes, a card moves
to another column, a busy state resolves. "The API returned 200" is not a visible outcome
and does not count as coverage.

## Running the suite

```bash
npm run journeys                       # boots a server if nothing answers, drives everything
npm test                               # unit tests only (fast, no browser)
npm run precheck                       # tsc -b + vite build + stamp freshness — before EVERY push
```

Exit codes: `0` all green · `1` any FAIL · `3` BLOCKED (no browser, or the target surface
is unreachable). BLOCKED is never a silent pass.

### Targeting a surface — `JOURNEY_URL`

| Env | Default | Effect |
|---|---|---|
| `JOURNEY_URL` | `http://localhost:4000` | the base URL every journey drives |
| `JOURNEY_SURFACE` | `local` | the label written into the artifacts (`local` / `hosted`) |

The runner probes `JOURNEY_URL/api/healthz` first. If the surface answers, **the runner
uses it as-is** — it does not start anything. If it does not answer: with
`JOURNEY_SURFACE=local` the runner boots `server/server.mjs` itself and waits up to ~8s;
with any other surface label it exits `3 BLOCKED` rather than booting something.

> ‼ **Point `JOURNEY_URL` at a port you own.** The runner reuses whatever is already
> listening, and journeys mutate data (they create, edit, delete and restore records).
> The default `:4000` is the plain `npm run serve` port — if a preview or demo instance
> is running there, an unqualified `npm run journeys` will drive and mutate it. Always
> pin both the server and the target into your own port range:
>
> ```bash
> PORT=5901 JOURNEY_URL=http://localhost:5901 npm run journeys
> ```
>
> On macOS, avoid **5000** and **7000** (ControlCenter/AirPlay listen there — the runner
> reports "server failed to boot") and **5060/5061** (Chromium refuses them, `ERR_UNSAFE_PORT`).

The BASE suite additionally boots fixture servers on fixed ports (4600–4915) for
config-fixture journeys, so two full-suite runs on one machine cross-kill each other.
Take the machine lock first (`CONTRIBUTING-AGENTS.md` §"Full-suite runs on a shared machine").

## What a run writes

| Artifact | Written when |
|---|---|
| `docs/COVERAGE.md` | every run — one verdict row per journey, latest run only |
| `docs/feature-manifest.md` `Last verified` | per PASSING journey, matched by its `feature` string |
| `journeys/.last-pass` | only when EVERY journey passes |
| `.playwright-mcp/journey-<name>.png` | one full-page screenshot per journey |

Never hand-edit `Last verified` or `.last-pass` — `npm run precheck` fails a stamp older
than 24h, and the deploy gate reads these artifacts.

## Writing a journey

```bash
npm run generate journey invoice-flow -- --feature "Invoices board"
```

Every `journeys/extra/*.mjs` file is auto-loaded (sorted) and default-exports an array of
journeys. Built-in journeys live inline in `journeys/run.mjs`.

```js
export default [
  {
    name: "invoice-stage-move",
    feature: "Invoices board",          // MUST equal the docs/feature-manifest.md row
    async run(page, { URLBASE, assert, ROOT }) {
      await page.goto(URLBASE + "/#/o/invoices");
      await page.waitForSelector('[data-testid="board-invoices"]');

      const before = await page.textContent('[data-testid="column-Sent"] [data-testid="count"]');
      await page.click('[data-testid="card-inv_1"]');
      await page.click('[data-testid="stage-option-Sent"]');

      // assert the VISIBLE outcome, then prove it persisted
      await page.waitForFunction(
        (n) => document.querySelector('[data-testid="column-Sent"] [data-testid="count"]').textContent !== n,
        before,
      );
      assert(true, "moving a deal to Sent moves its card into the Sent column");
      await page.reload();
      await page.waitForSelector('[data-testid="column-Sent"] [data-testid="card-inv_1"]');
      assert(true, "the move survives a reload");
    },
  },
];
```

Rules that keep the suite trustworthy:

- **`feature` matches a manifest row exactly** — that string is how `Last verified` finds
  its row.
- **Assert visible outcomes.** Each `assert(cond, label)` label lands in `COVERAGE.md`, so
  write labels as sentences describing what a user sees.
- **Select on `data-testid` or visible text**, never CSS classes. Every interactive
  element carries a kebab-case `data-testid` shaped `<surface>-<thing>[-<id>]`
  (`trash-restore-co_1`, `peek-pos`).
- **Clean up.** The whole suite runs against ONE shared app: create what you assert on,
  and restore or destroy it afterwards. A journey must leave the seed state it found.
- **Do not hardcode row counts** when earlier journeys mutate the same object — assert
  narrowing and correctness instead (`before > after && every row matches`).
- **Cover mobile** for any surface a user touches: a 390x664 pass exercising the core
  interaction by touch.
- A journey needing its own config boots its own server on a fixture:
  `spawn("node", ["server/server.mjs"], { env: { ...process.env, PORT: "4700", CONFIG_PATH: "journeys/fixtures/<x>.config.json" } })`.
  Fixtures live in `journeys/fixtures/`.

### The harness self-check

Before any journey runs, the harness asserts that a bogus selector FAILS. If that check
ever passes, the runner itself is broken (wrong surface, dead page) and the suite is not
proving anything.

## Unit tests

Pure logic gets a `journeys/unit/<name>.test.ts` under node's own runner — no browser, no
build. They import the vendored source directly:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry } from "../../src/ui/record-core/views/resolve.ts";

test("buildRegistry folds glob modules into a type-keyed map", () => {
  const defs = buildRegistry({ "./table/definition.tsx": { default: def("table") } });
  assert.deepEqual(Object.keys(defs), ["table"]);
});
```

Config→options resolvers, layout math, cell formatting and geo/date math all belong here;
they are far cheaper than a browser journey and they catch the same class of bug. The
browser journey then proves the user-visible half.

## Testing against a deployed app

```bash
JOURNEY_SURFACE=hosted JOURNEY_URL=https://<app-host> npm run journeys
```

The runner will not boot anything for a non-local surface: unreachable → exit 3. Journeys
mutate data, so run this against a staging deployment, never a production one carrying
real records.
