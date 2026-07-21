/* screenshot capture: drive the REAL app (docs object, which declares createWizard)
   through the guided create flow → wizard-landing / wizard-step / wizard-created. */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = "/Users/assem/Documents/GitHub/wt-wizapp";
const PORT = 5823;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, "_shots");

const env = { ...process.env, PORT: String(PORT) }; // default CONFIG = starter.config.json (docs has createWizard)
delete env.NEXUS_API_KEY;
const proc = spawn("node", [path.join(ROOT, "server", "server.mjs")], { stdio: "ignore", env });
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${BASE}/api/healthz`, { signal: AbortSignal.timeout(1500) }); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 350));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
try {
  await p.goto(`${BASE}/#/o/docs`);
  await p.waitForSelector('[data-testid="new-record"]');
  await p.click('[data-testid="new-record"]');
  await p.waitForSelector('[data-testid="wizard-landing"]');
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(SHOTS, "wizard-landing.png") });
  console.log("saved wizard-landing.png");

  await p.click('[data-testid="wizard-choose-guided"]');
  await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "1 / 3");
  await p.fill('[data-testid="wizard-input"]', "Weekly product update");
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOTS, "wizard-step.png") });
  console.log("saved wizard-step.png");

  await p.click('[data-testid="wizard-next"]');
  await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "2 / 3");
  await p.click('[data-testid="wizard-opt-In review"]');
  await p.waitForFunction(() => document.querySelector('[data-testid="wizard-count"]')?.textContent?.trim() === "3 / 3");
  await p.fill('[data-testid="wizard-input"]', "The rollout happens in three phases, each gated on the previous one landing cleanly.");
  await p.click('[data-testid="wizard-next"]');
  await p.waitForSelector('[data-testid="wizard-review"]');
  await p.click('[data-testid="wizard-complete"]');
  await p.waitForSelector('[data-testid="create-wizard"]', { state: "detached" });
  await p.waitForSelector('[data-testid="record-name"]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(SHOTS, "wizard-created.png") });
  console.log("saved wizard-created.png");
} catch (e) {
  console.log("SHOT ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  proc.kill();
}
