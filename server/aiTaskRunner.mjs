/* runAiTask — run ONE Nexus AI task against a record in the BACKGROUND, write the
   result back, revert on failure. Generalizes the redline pattern: the caller owns
   what goes IN (buildInput) and what the parsed output DOES (applyOutput) — this
   module owns the platform call, the parse, the revert, and the change event.

   Fire-and-forget from a route: `void runAiTask(store, emitEvent, {…})`. It resolves
   even on failure (onFail reverts any transient state the route set beforehand), so a
   user who navigates away never strands the record.

   Contract (all config/callback-driven — no object coupling):
     taskId      — the AI task id (from app config / env, NEVER a constant here)
     objectKey   — the record's object key (for get/emit)
     recordId    — the record id
     buildInput(record, store) → the task's `input` object
     applyOutput(store, { parsed, record, recordId }) — write the result
     onFail?(store, { recordId, record, error }) — revert transient state
   The task-execute envelope: output at r.data.output ?? r.output; parsed if it's a
   JSON string. */

import { nexus } from "../src/lib/nexusClient.mjs";

const parseTaskOutput = (out) => (typeof out === "string" ? JSON.parse(out) : out) ?? {};

export async function runAiTask(store, emitEvent, { taskId, objectKey, recordId, buildInput, applyOutput, onFail, timeoutMs = 120000 }) {
  const record = store.get(objectKey, recordId);
  if (!record) return;
  try {
    const input = buildInput ? buildInput(record, store) : {};
    const r = await nexus(`/skills/tasks/${taskId}/execute`, { method: "POST", body: { input }, timeoutMs });
    const parsed = parseTaskOutput(r?.data?.output ?? r?.output);
    applyOutput(store, { parsed, record, recordId });
  } catch (err) {
    if (onFail) onFail(store, { recordId, record, error: err });
  }
  const row = store.project(objectKey, store.get(objectKey, recordId));
  if (emitEvent && row) emitEvent(store, `${objectKey}.updated`, { row });
}
