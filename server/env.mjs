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
  // Full accounts mode: self-serve signup + verification/reset/deletion flows
  // (needs APP_SECRET; mail goes to the dev outbox until SMTP_URL is wired)
  AUTH_MODE: z.enum(["accounts"]).optional(),
  SMTP_URL: z.string().optional(),
  // job seam knobs: recurring digest interval + its mail target (both optional)
  DIGEST_EVERY_MS: z.coerce.number().int().positive().optional(),
  // trash retention in DAYS (fractional ok); 0/unset = keep trashed rows forever
  TRASH_RETENTION_DAYS: z.coerce.number().nonnegative().optional(),
  DIGEST_TO: z.string().optional(),
  // native warehouse persistence (the command-log data spine)
  WAREHOUSE: z.enum(["bigquery"]).optional(),
  WAREHOUSE_TOOL_ID: z.string().default("ad6256fb-9e6b-51c0-975d-e2124097082a"), // Google Cloud marketplace connector
  WAREHOUSE_CREDENTIAL_ID: z.string().optional(),
  BQ_PROJECT: z.string().optional(),
  BQ_DATASET: z.string().default("nx_app"),
  BQ_TABLE: z.string().default("events"),
  BQ_LOCATION: z.string().default("EU"),
  // one flag gates nav + page + API together ("0"/"false" disables)
  FEATURE_TEAMS: z.string().optional(),
  FEATURE_WEBHOOKS: z.string().optional(),
  FEATURE_THEME: z.string().optional(),
  FEATURE_APIKEYS: z.string().optional(),
  FEATURE_GALLERY: z.string().optional(),
  FEATURE_TASKS: z.string().optional(),
  FEATURE_SCHEMA: z.string().optional(),
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

if (env.WAREHOUSE === "bigquery" && !(env.NEXUS_API_KEY && env.WAREHOUSE_CREDENTIAL_ID)) {
  console.error("[env] WAREHOUSE=bigquery needs NEXUS_API_KEY + WAREHOUSE_CREDENTIAL_ID (see .env.example)");
  process.exit(1);
}

if ((env.AUTH_USERS || env.AUTH_MODE) && !env.APP_SECRET) {
  console.error("[env] AUTH_USERS/AUTH_MODE is set but APP_SECRET is missing — sessions cannot be signed. Set both or neither.");
  process.exit(1);
}

const flagOn = (v) => !(v === "0" || v === "false" || v === "off");
export const FEATURES = {
  teams: flagOn(env.FEATURE_TEAMS),
  webhooks: flagOn(env.FEATURE_WEBHOOKS),
  theme: flagOn(env.FEATURE_THEME),
  apikeys: flagOn(env.FEATURE_APIKEYS),
  tasks: flagOn(env.FEATURE_TASKS),
  schema: flagOn(env.FEATURE_SCHEMA),
  gallery: flagOn(env.FEATURE_GALLERY),
};

export const ACCOUNTS_ENABLED = Boolean(env.AUTH_MODE === "accounts" && env.APP_SECRET);
export const AUTH_ENABLED = Boolean((env.AUTH_USERS || ACCOUNTS_ENABLED) && env.APP_SECRET);
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
