#!/usr/bin/env node
/* Pre-push mechanical sweeps (the starter twin of skills/shared/scripts/precheck.py):
   1. tsc -b (types) · 2. vite build (bundle) · 3. journeys stamp freshness.
   Run before every push; the deploy gate reads the artifacts these produce. */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

let fail = 0;
const step = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL ${name}\n${String(e.stdout ?? e.message).slice(0, 800)}`);
  }
};

step("typecheck (tsc -b)", () => execSync("npx tsc -b", { stdio: "pipe" }));
step("bundle (vite build)", () => execSync("npx vite build", { stdio: "pipe" }));
step("journeys stamp exists + fresh (<24h)", () => {
  if (!existsSync("journeys/.last-pass")) throw new Error("journeys/.last-pass missing — run `npm run journeys`");
  const age = Date.now() - statSync("journeys/.last-pass").mtimeMs;
  if (age > 24 * 3600 * 1000) throw new Error(`stamp is ${(age / 3600000).toFixed(1)}h old — re-run journeys`);
});

console.log(fail ? `\n${fail} precheck failure(s)` : "\nprecheck green");
process.exit(fail ? 1 : 0);
