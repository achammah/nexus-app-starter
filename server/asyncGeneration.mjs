/* fireAsyncGeneration — kick off an OFF-MACHINE generation that writes its result
   back to the warehouse asynchronously. Generalizes the generate-article pattern:
   create a placeholder record NOW (so the UI has something to navigate to and poll),
   make it durable, then fire a workflow webhook that will append the finished record
   as a `patch`/`create` event straight to the warehouse — the running app pulls it in
   via RemoteStore.sync(). No long request hang; the route returns 202 immediately.

   Contract (config/callback-driven — no object coupling):
     objectKey   — where the placeholder record lives
     placeholder — the initial field values (e.g. { title: "Generating…", state: "Generating" })
     webhookUrl  — the generation workflow's hook (from app config / env, no constant here)
     payload     — the webhook body: an object, or (created) => object (fold in created.id)
     emitEvent?  — emit `${objectKey}.created` for live listeners
   Returns the created (projected) row. If webhookUrl is unset, the placeholder is
   created but nothing fires (surfaced by the caller). */

export async function fireAsyncGeneration(store, { objectKey, placeholder, webhookUrl, payload, emitEvent }) {
  // 1) placeholder, immediately
  const created = store.project(objectKey, store.create(objectKey, { ...placeholder }));
  if (emitEvent) emitEvent(store, `${objectKey}.created`, { row: created });
  // 2) make the create durable BEFORE the webhook reads MAX(seq), so the webhook's
  //    write lands at a fresh seq (no collision with our own log)
  try { await store.flushNow?.(); } catch (e) { console.error("[async-gen] flush:", e.message); }
  // 3) fire the generation webhook (async — writes the record back as an event;
  //    the running app sync()s it in). Never awaited into the response.
  if (webhookUrl) {
    const body = typeof payload === "function" ? payload(created) : { ...payload, id: created.id };
    fetch(webhookUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch((e) => console.error("[async-gen] webhook POST failed:", e.message));
  } else {
    console.warn("[async-gen] webhookUrl unset — placeholder created, generation not fired");
  }
  return created;
}
