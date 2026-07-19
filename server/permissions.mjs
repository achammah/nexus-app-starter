/* Permissions — ONE small table drives both sides. An object's config MAY carry:
     "permissions": { "admin": ["view","create","edit","delete","export"],
                      "member": ["view"] }
   Roles come from team membership (owner > admin > member); owners always pass.
   NO permissions block on an object → every action allowed (back-compatible).
   The client twin (src/app/permissions.ts) implements the same contract for
   affordance hiding — the SERVER is the actual gate; journeys assert both. */

export const ACTIONS = ["view", "create", "edit", "delete", "export"];

export function can(role, objectCfg, action) {
  const table = objectCfg?.permissions;
  if (!table) return true;
  if (role === "owner") return true;
  return (table[role] ?? []).includes(action);
}
