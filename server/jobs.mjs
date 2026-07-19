/* Job seam — a store-backed queue + a 1s scheduler tick. One small handler per job
   type (the whole seam stays auditable); enqueue is idempotency-key aware; failures
   retry with backoff (3 attempts). Single-process by design — swap the store for a
   DB-backed queue (jobs table + SKIP LOCKED or LISTEN/NOTIFY) when the app runs
   more than one instance; the handler registry and call sites don't change.

   Shipped job types:
     digest             — per-object row counts → app_state["digest:latest"] (+ mail
                          to DIGEST_TO when set): the cron/rollup reference
     webhook-deliver    — signed POST to a registered endpoint (see webhooks.mjs)
     notify-subscribers — outbox mail to a record's watchers (minus the actor) */

import crypto from "node:crypto";
import { sendMail } from "./email.mjs";
import { env } from "./env.mjs";

const RETRY_MS = 30_000;
const MAX_ATTEMPTS = 3;

export const handlers = {
  async digest(store) {
    const counts = Object.fromEntries(
      Object.entries(store.rows).map(([k, rows]) => [k, rows.length]),
    );
    const payload = { counts, at: new Date().toISOString() };
    store.stateAppend("digest:latest", payload);
    if (env.DIGEST_TO) {
      sendMail(store, {
        to: env.DIGEST_TO, kind: "digest",
        subject: "Your data digest",
        text: Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join("\n"),
      });
    }
    return payload;
  },

  async "webhook-deliver"(store, { webhookId, event, payload }) {
    const hook = (store.webhooks ?? []).find((w) => w.id === webhookId);
    if (!hook || !hook.active) return { skipped: true };
    const body = JSON.stringify({ event, payload, ts: new Date().toISOString() });
    const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    let code = 0, error = null;
    try {
      const res = await fetch(hook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-nx-event": event, "x-nx-signature": `sha256=${signature}` },
        body,
        signal: AbortSignal.timeout(5000),
      });
      code = res.status;
      if (!res.ok) error = `endpoint answered ${res.status}`;
    } catch (e) {
      error = String(e.message ?? e);
    }
    (store.deliveries ??= []).push({
      id: `d_${++store.n}`, webhookId, event, code, error,
      status: error ? "failed" : "delivered", ts: new Date().toISOString(),
    });
    if (error) throw new Error(error); // let the queue retry
    return { code };
  },

  async "notify-subscribers"(store, { objectKey, id, summary, actor }) {
    const sub = (store.subscribers ?? []).find((s) => s.objectKey === objectKey && s.id === id);
    if (!sub) return { notified: 0 };
    const cfg = store.config.objects.find((o) => o.key === objectKey);
    const row = store.get(objectKey, id);
    const primary = cfg?.fields.find((f) => f.primary) ?? cfg?.fields[0];
    const name = String(row?.[primary?.key] ?? id);
    const targets = sub.emails.filter((e) => e !== actor);
    for (const to of targets) {
      sendMail(store, {
        to, kind: "record-activity",
        subject: `Activity on ${name}`,
        text: `${summary}\n\nRecord: ${name} (${cfg?.labelOne ?? objectKey})\nOpen: /#/o/${objectKey}/r/${id}\n\nYou get this because you watch this record.`,
      });
    }
    return { notified: targets.length };
  },

  /* retention sweep — permanently destroys trashed rows past TRASH_RETENTION_DAYS */
  async "trash-sweep"(store, { days }) {
    const destroyed = store.trashSweep(days);
    return { destroyed };
  },
};

export function enqueue(store, type, payload = {}, { runAt, idempotencyKey } = {}) {
  if (!handlers[type]) throw new Error(`unknown job type ${type}`);
  if (idempotencyKey) {
    const dup = (store.jobs ?? []).find((j) => j.idempotencyKey === idempotencyKey && (j.status === "queued" || j.status === "running"));
    if (dup) return dup;
  }
  const job = {
    id: `j_${++store.n}`, type, payload, idempotencyKey: idempotencyKey ?? null,
    status: "queued", attempts: 0, lastError: null,
    runAt: runAt ?? Date.now(), createdAt: new Date().toISOString(), finishedAt: null,
  };
  (store.jobs ??= []).push(job);
  return job;
}

export function startScheduler(store) {
  const tick = async () => {
    const due = (store.jobs ?? []).filter((j) => j.status === "queued" && j.runAt <= Date.now());
    for (const job of due) {
      job.status = "running";
      job.attempts += 1;
      try {
        job.result = await handlers[job.type](store, job.payload);
        job.status = "done";
        job.finishedAt = new Date().toISOString();
      } catch (e) {
        job.lastError = String(e.message ?? e);
        if (job.attempts >= MAX_ATTEMPTS) {
          job.status = "failed";
          job.finishedAt = new Date().toISOString();
        } else {
          job.status = "queued";
          job.runAt = Date.now() + RETRY_MS * job.attempts;
        }
      }
    }
    // interval jobs re-arm themselves (DIGEST_EVERY_MS keeps the demo observable)
    if (env.TRASH_RETENTION_DAYS > 0 && !(store.jobs ?? []).some((j) => j.type === "trash-sweep" && (j.status === "queued" || j.status === "running"))) {
      const cadence = Math.min(Math.max(env.TRASH_RETENTION_DAYS * 86_400_000 / 2, 1000), 6 * 3600_000);
      enqueue(store, "trash-sweep", { days: env.TRASH_RETENTION_DAYS }, { runAt: Date.now() + cadence, idempotencyKey: "trash-sweep-interval" });
    }
    if (env.DIGEST_EVERY_MS && !(store.jobs ?? []).some((j) => j.type === "digest" && (j.status === "queued" || j.status === "running"))) {
      enqueue(store, "digest", {}, { runAt: Date.now() + Number(env.DIGEST_EVERY_MS), idempotencyKey: "digest-interval" });
    }
  };
  const t = setInterval(() => { tick().catch((e) => console.error("[jobs]", e)); }, 1000);
  t.unref?.();
  return t;
}
