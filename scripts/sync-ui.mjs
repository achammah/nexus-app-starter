#!/usr/bin/env node
/* Vendor nexus-ui SOURCE into src/ui (the shadcn model — the app owns its copy).
   Source: $NEXUS_UI_PATH, else a sibling checkout ../nexus-ui. Records the synced
   commit in src/ui/.ui-version so drift is visible. */

import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = process.env.NEXUS_UI_PATH || path.join(ROOT, "..", "nexus-ui");
const FROM = path.join(SRC, "src");
const TO = path.join(ROOT, "src", "ui");

if (!existsSync(FROM)) {
  console.error(`[sync-ui] nexus-ui source not found at ${FROM} — set NEXUS_UI_PATH`);
  process.exit(2);
}
rmSync(TO, { recursive: true, force: true });
cpSync(FROM, TO, { recursive: true });
let sha = "unknown";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: SRC }).toString().trim();
} catch { /* not a git checkout */ }
writeFileSync(path.join(TO, ".ui-version"), `nexus-ui @ ${sha} (${new Date().toISOString()})\n`);
console.log(`[sync-ui] vendored nexus-ui@${sha} → src/ui`);
