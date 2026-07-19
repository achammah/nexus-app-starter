/* Env validation — fail FAST with a table, never half-boot (a partial env half-breaks:
   UI fine, API 500 — the measured class). Zod-validated once at boot; import { env }
   everywhere server-side. Copy .env.example to start. */

import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  // Alternate app definition (e.g. journeys/fixtures/coverage.config.json) — repo-root-relative
  CONFIG_PATH: z.string().optional(),
  // Auth seam (both or neither): "email:password,email2:pass2" + a cookie-signing secret
  AUTH_USERS: z.string().optional(),
  APP_SECRET: z.string().min(16, "APP_SECRET must be ≥16 chars").optional(),
  // Nexus platform (server-side only — never reaches the browser)
  NEXUS_API_KEY: z.string().startsWith("nxs_").optional(),
  NEXUS_BASE_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] INVALID environment — fix and reboot:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}
export const env = parsed.data;

if (env.AUTH_USERS && !env.APP_SECRET) {
  console.error("[env] AUTH_USERS is set but APP_SECRET is missing — sessions cannot be signed. Set both or neither.");
  process.exit(1);
}

export const AUTH_ENABLED = Boolean(env.AUTH_USERS && env.APP_SECRET);
export const USERS = new Map(
  (env.AUTH_USERS ?? "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      return [pair.slice(0, i).toLowerCase(), pair.slice(i + 1)];
    }),
);
