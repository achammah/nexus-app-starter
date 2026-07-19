/* Runtime schema editing — the /api/schema surface over the store's three
   logged schema ops. The config FILE stays the immutable seed; these routes
   only ever touch the live store (command-log persisted). Management is
   owner/admin, mirroring API keys; with auth off the caller is owner. v1 is
   deliberately non-destructive: no object delete, no field hard-delete —
   retire (isActive:false) is the lifecycle lever. */

export async function handleSchema(req, res, url, readBody, send, store, role) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","schema",...]
  if (parts[1] !== "schema") return false;

  if (!["owner", "admin"].includes(role)) {
    send(res, 403, { error: `your role (${role}) cannot edit the schema` });
    return true;
  }

  // GET /api/schema — the page's single fetch: live (merged) objects + caller state
  if (!parts[2] && req.method === "GET") {
    send(res, 200, { enabled: true, role, objects: store.config.objects });
    return true;
  }

  // POST /api/schema/objects — add an object (born with its primary field)
  if (parts[2] === "objects" && !parts[3] && req.method === "POST") {
    const obj = store.schemaObjectAdd(await readBody(req));
    send(res, 201, obj);
    return true;
  }

  // POST /api/schema/objects/:key/fields — add a field
  if (parts[2] === "objects" && parts[3] && parts[4] === "fields" && !parts[5] && req.method === "POST") {
    const field = store.schemaFieldAdd(parts[3], await readBody(req));
    send(res, 201, field);
    return true;
  }

  // PATCH /api/schema/objects/:key/fields/:fieldKey — edit / retire / re-activate
  if (parts[2] === "objects" && parts[3] && parts[4] === "fields" && parts[5] && req.method === "PATCH") {
    const field = store.schemaFieldUpdate(parts[3], parts[5], await readBody(req));
    send(res, 200, field);
    return true;
  }

  send(res, 404, { error: "no schema route" });
  return true;
}
