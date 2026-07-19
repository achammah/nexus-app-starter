/* RemoteStore — the in-memory Store wrapped in a COMMAND LOG persisted to the org
   warehouse (server/warehouse.mjs). Every domain mutation records {seq, ts, op,
   args}; boot replays the log over the deterministic seed, so the same ids and
   counters come back and restarts lose nothing. Timestamps replay true via the
   store's injectable clock (_nowOverride).

   What is logged: DOMAIN state (records, timeline, notes/activities, files,
   app_state, users, tokens, teams/members, watchers, webhooks, outbox).
   What is NOT: the job queue and webhook delivery logs — operational, rebuilt by
   running; a restart drops pending jobs (documented in RECIPES).

   Flush model: buffered, batched every ~400ms, retried with backoff on failure —
   local reads/writes never wait on the warehouse. Single-writer by design. */

import { Store } from "./store.mjs";

const LOGGED_OPS = [
  "create", "patch", "remove",
  "addNote", "addActivity", "fileAdd", "enrich",
  "stateAppend",
  "userAdd", "userVerify", "userSetHash", "userSoftDelete",
  "tokenIssue", "tokenTake", "tokenBind",
  "teamAdd", "memberAdd", "memberActivate", "memberSetRole", "memberRemove", "teamEvent",
  "watchToggle",
  "webhookAdd", "webhookUpdate", "webhookRemove",
  "apiKeyAdd", "apiKeyRevoke",
  "restoreRow", "destroyRow", "mergeRows",
  "viewAdd", "viewUpdate", "viewRemove",
  "outboxAdd",
];

export class RemoteStore extends Store {
  constructor(config, warehouse) {
    super(config);
    this._wh = warehouse;
    this._seq = 0;
    this._buffer = [];
    this._flushTimer = null;
    this._flushBackoffMs = 0;
    this._replaying = false;
    this.ready = this._boot();
  }

  async _boot() {
    await this._wh.ensure();
    const events = await this._wh.load();
    this._replaying = true;
    try {
      for (const e of events) {
        this._seq = Math.max(this._seq, e.seq);
        const [whenIso, args] = [e.args?.[0], e.args?.slice(1)];
        // every logged call is stored as [isoClock, ...originalArgs]
        this._nowOverride = whenIso;
        try {
          this[e.op](...args);
        } catch (err) {
          console.error(`[warehouse] replay skipped seq ${e.seq} (${e.op}): ${err.message}`);
        }
      }
    } finally {
      this._nowOverride = null;
      this._replaying = false;
    }
    console.log(`[warehouse] ${this._wh.kind}: replayed ${events.length} events (seq ${this._seq})`);
  }

  _log(op, args) {
    const e = { seq: ++this._seq, ts: new Date().toISOString(), op, args: [new Date().toISOString(), ...args] };
    this._buffer.push(e);
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), 400);
      this._flushTimer.unref?.();
    }
  }

  async _flush() {
    this._flushTimer = null;
    if (this._buffer.length === 0) return;
    const batch = this._buffer.splice(0, 200);
    try {
      await this._wh.append(batch);
      this._flushBackoffMs = 0;
      if (this._buffer.length) this._flush();
    } catch (err) {
      // put the batch back IN ORDER and retry with backoff — never drop events
      this._buffer.unshift(...batch);
      this._flushBackoffMs = Math.min((this._flushBackoffMs || 1000) * 2, 30000);
      console.error(`[warehouse] flush failed (retry in ${this._flushBackoffMs}ms): ${err.message}`);
      this._flushTimer = setTimeout(() => this._flush(), this._flushBackoffMs);
      this._flushTimer.unref?.();
    }
  }

  /* drain for tests/shutdown */
  async flushNow() {
    while (this._buffer.length) {
      if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
      await this._flush();
    }
  }
}

for (const op of LOGGED_OPS) {
  const orig = Store.prototype[op];
  if (typeof orig !== "function") throw new Error(`store-remote: unknown op ${op}`);
  RemoteStore.prototype[op] = function (...args) {
    // reentrancy guard: a logged op calling another logged op (teamAdd → memberAdd)
    // logs ONLY the outer call — replaying the outer reproduces the inner
    if (this._replaying || this._inOp) return orig.apply(this, args);
    this._inOp = true;
    try {
      const result = orig.apply(this, args);
      this._log(op, args);
      return result;
    } finally {
      this._inOp = false;
    }
  };
}
