/* Native warehouse driver — BigQuery through the Nexus marketplace connector.
   The store's command log persists as an append-only events table; the driver only
   knows three verbs: ensure (dataset+table DDL), load (ordered scan), append
   (batched inserts). Connector facts this code is built on (all first-hand):
     · execute route: POST {base}/api/public/v1/tools/{toolId}/execute
       body {action, input, credentialId} → {success, result}
     · run-query input {query, location} — location MUST match the dataset region
       (applies to DDL too); result envelope is a 3-element array [rows, {}, meta],
       rows live at INDEX 0
     · bigquery-insert-rows input {datasetId, tableId, rows} — rows is an ARRAY OF
       JSON STRINGS (each one stringified object keyed by column)
     · BigQuery INT64 comes back as a STRING through JSON — Number() on read
   Zero platform writes happen unless WAREHOUSE=bigquery is set. */

import { env } from "./env.mjs";

const BASE = env.NEXUS_BASE_URL || "https://api.nexusgpt.io";

async function execute(action, input) {
  if (!env.NEXUS_API_KEY) throw new Error("WAREHOUSE=bigquery needs NEXUS_API_KEY");
  const res = await fetch(`${BASE}/api/public/v1/tools/${env.WAREHOUSE_TOOL_ID}/execute`, {
    method: "POST",
    headers: { "api-key": env.NEXUS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ action, input, credentialId: env.WAREHOUSE_CREDENTIAL_ID }),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(`${action} → ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
  }
  // the REST route DOUBLE-WRAPS what the CLI shows: {success, data:{…, result}} —
  // parse data.result (falling back for single-wrapped mocks/futures)
  const payload = json?.data ?? json;
  if (payload?.success === false) {
    throw new Error(`${action} failed: ${JSON.stringify(payload?.error ?? payload).slice(0, 300)}`);
  }
  // the envelope can lie: upstream errors ride result.os[]
  const os = payload?.result?.os;
  if (Array.isArray(os)) {
    const errs = os.filter((o) => o?.k === "error" || o?.err);
    if (errs.length) throw new Error(`${action} upstream error: ${JSON.stringify(errs[0]).slice(0, 300)}`);
  }
  return payload.result;
}

const ident = (s) => {
  if (!/^[A-Za-z0-9_]+$/.test(s)) throw new Error(`unsafe identifier: ${s}`);
  return s;
};

export function bigqueryWarehouse() {
  const ds = ident(env.BQ_DATASET || "nx_app");
  const table = ident(env.BQ_TABLE || "events");
  const location = env.BQ_LOCATION || "EU";
  const qualified = env.BQ_PROJECT ? `\`${env.BQ_PROJECT}\`.${ds}` : ds;

  const runQuery = async (query) => {
    // [rows, {}, meta] — rows at index 0 (never .rows / .result). A query job can
    // answer with jobComplete:false and an EMPTY first page (measured live) —
    // retry until the job reports complete or rows arrive.
    for (let attempt = 0; ; attempt++) {
      const result = await execute("google_cloud-run-query", { query, location });
      const rows = Array.isArray(result) ? result[0] ?? [] : [];
      const meta = Array.isArray(result) ? result[2] ?? {} : {};
      const incomplete = meta.jobComplete === false || (rows.length === 0 && Number(meta.totalRows ?? 0) > 0);
      if (!incomplete || attempt >= 5) return rows;
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  return {
    kind: "bigquery",

    async ensure() {
      await runQuery(
        `CREATE SCHEMA IF NOT EXISTS ${qualified} OPTIONS(location="${location}")`,
      );
      await runQuery(
        `CREATE TABLE IF NOT EXISTS ${qualified}.${table} (seq INT64 NOT NULL, ts TIMESTAMP, op STRING NOT NULL, args STRING)`,
      );
    },

    /* full ordered scan — the command log replays from seq 1 at boot */
    async load() {
      const rows = await runQuery(
        `SELECT seq, op, args FROM ${qualified}.${table} ORDER BY seq`,
      );
      const parseArgs = (raw) => {
        if (!raw) return [];
        try {
          return JSON.parse(Buffer.from(String(raw), "base64").toString("utf8"));
        } catch {
          try { return JSON.parse(String(raw)); } catch { return null; } // foreign row → caller skips
        }
      };
      return rows
        .map((r) => ({
          seq: Number(r.seq),
          op: String(r.op),
          // args travel base64(JSON) — no SQL-escaping surface at all
          args: parseArgs(r.args),
          ts: r.ts, // dual-shape upstream (epoch string | {value}) — replay uses the logged args' own clocks
        }))
        .filter((e) => e.args !== null);
    },

    /* INSERT DML (not streaming inserts): DML commits are immediately visible to
       the next query, so a restart right after a write can NEVER miss the tail —
       streaming rows sit in a buffer that lags reads (measured live), which would
       let a fast reboot replay short and mint duplicate seqs. op is a bare
       [A-Za-z]+ method name; args ride as base64 — both safe as literals. */
    async append(events) {
      if (!events.length) return;
      const values = events.map((e) => {
        if (!/^[A-Za-z0-9_]+$/.test(e.op)) throw new Error(`unsafe op ${e.op}`);
        const b64 = Buffer.from(JSON.stringify(e.args), "utf8").toString("base64");
        return `(${Number(e.seq)}, TIMESTAMP '${new Date(e.ts).toISOString()}', '${e.op}', '${b64}')`;
      });
      await runQuery(
        `INSERT INTO ${qualified}.${table} (seq, ts, op, args) VALUES ${values.join(", ")}`,
      );
    },
  };
}
