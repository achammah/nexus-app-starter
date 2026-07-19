/* Permissions — ONE small table drives both sides. An object's config MAY carry:
     "permissions": { "admin":  ["view","create","edit","delete","export"],
                      "member": ["view","create","editOwn","deleteOwn"],
                      "viewer": ["view"] }
   Roles (owner > admin > member > viewer) come from team membership; owners always
   pass. `editOwn`/`deleteOwn` grant the action only on rows the caller created
   (rows are stamped `_createdBy` when accounts are on). NO permissions block on an
   object → every action allowed (back-compatible).
   The client twin (src/app/permissions.ts) implements the same contract for
   affordance hiding — the SERVER is the actual gate; journeys assert both. */

export const ACTIONS = ["view", "create", "edit", "delete", "restore", "destroy", "export"];
export const ROLES = ["owner", "admin", "member", "viewer"];

export function can(role, objectCfg, action, ctx = {}) {
  const table = objectCfg?.permissions;
  if (!table) return true;
  if (role === "owner") return true;
  const granted = table[role] ?? [];
  if (granted.includes(action)) return true;
  // own-row grants: editOwn/deleteOwn apply when the caller created the row
  if ((action === "edit" || action === "delete") && ctx.own && granted.includes(`${action}Own`)) return true;
  // trash split: restore rides the delete grant (undoing what you may do);
  // destroy is PERMANENT and must be granted explicitly
  if (action === "restore" && (granted.includes("delete") || (ctx.own && granted.includes("deleteOwn")))) return true;
  if (action === "destroy" && ctx.own && granted.includes("destroyOwn")) return true;
  return false;
}
