/* Local file-backed warehouse — the offline twin of the BigQuery driver (warehouse.mjs).
   Implements the SAME command-log contract (ensure/load/loadSince/append) against a single
   append-only JSON-lines file, so RemoteStore + sync() run with NO external infra (node
   built-ins only). This is what makes the async-generation + live-sync UX demoable offline:
   an out-of-process writer (the mock generation webhook in server.mjs) appends a finished-
   record event to the file, and RemoteStore.sync() pulls it into the running app — exactly
   the external-writer catch-up the BigQuery spine does in production.

   Set WAREHOUSE=local (optionally WAREHOUSE_LOCAL_PATH; default .warehouse-local.jsonl in cwd).
   Boilerplate/demo scope: one file, last-writer-wins append, no cross-process lock — the
   BigQuery driver is the production spine. Each event is one JSON line {seq,ts,op,args}; a
   torn/foreign line is skipped rather than aborting the scan (mirrors the BigQuery _read guard). */

import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env.mjs";

export function localWarehouse() {
  const file = env.WAREHOUSE_LOCAL_PATH || path.join(process.cwd(), ".warehouse-local.jsonl");

  const readAll = () => {
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter((e) => e && e.op); // skip a torn/foreign line, don't abort the scan
  };
  const shape = (e) => ({ seq: Number(e.seq), op: String(e.op), args: e.args, ts: e.ts });
  const bySeq = (a, b) => a.seq - b.seq;

  return {
    kind: "local",

    async ensure() {
      const dir = path.dirname(file);
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      if (!existsSync(file)) writeFileSync(file, "");
    },

    /* full ordered scan — the command log replays from seq 1 at boot */
    async load() {
      return readAll().map(shape).sort(bySeq);
    },

    /* incremental scan — events an external writer appended after our in-memory _seq.
       Powers RemoteStore.sync(). */
    async loadSince(seq) {
      const n = Number(seq) || 0;
      return readAll().filter((e) => Number(e.seq) > n).map(shape).sort(bySeq);
    },

    /* append-only: one JSON object per line (no read-modify-write, so a second writer
       never clobbers the first's events) */
    async append(events) {
      if (!events.length) return;
      const lines = events
        .map((e) => JSON.stringify({ seq: Number(e.seq), ts: e.ts, op: String(e.op), args: e.args }))
        .join("\n") + "\n";
      appendFileSync(file, lines);
    },
  };
}
