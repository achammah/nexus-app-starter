#!/usr/bin/env node
/* Archetype 1/2 close-out: register this app as a Nexus CUSTOM_MANIFEST tool, then
   verify with ONE real execute (R#27 — registration without an executed action is
   not "wired"). Usage: node scripts/register-as-tool.mjs <appId> */

import { execSync } from "node:child_process";

const appId = process.argv[2];
if (!appId) {
  console.error("usage: node scripts/register-as-tool.mjs <appId>   (full UUID — short ids 500)");
  process.exit(2);
}
const sh = (c) => execSync(c, { encoding: "utf8" });

const reg = sh(`nexus vibe app register-as-tool ${appId} --json 2>&1`);
console.log(reg.slice(0, 400));
let toolId;
try {
  const j = JSON.parse(reg.slice(reg.indexOf("{")));
  toolId = j?.data?.toolId ?? j?.toolId ?? j?.data?.id ?? j?.id;
} catch { /* fallthrough */ }
if (!toolId) {
  console.error("could not parse toolId from the registration response — verify manually (nexus external-tool list)");
  process.exit(1);
}
console.log(`registered as tool ${toolId} — verifying with one real execute (healthz action if exposed)…`);
const out = sh(`nexus external-tool execute ${toolId} --action healthz --input '{}' --json 2>&1 || true`);
console.log(out.slice(0, 400));
console.log("verify the result above shows a real response (not just success:true) before attaching anywhere.");
