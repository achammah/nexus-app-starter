/* Client twin of server/permissions.mjs — SAME contract, used only to hide/disable
   affordances (the server is the real gate). Keep the two in sync; the permissions
   journeys assert both sides. */

import type { ObjectConfig } from "../ui/record-core/types";

export type Role = "owner" | "admin" | "member" | "viewer";
export type Action = "view" | "create" | "edit" | "delete" | "restore" | "destroy" | "export";

export function can(
  role: Role | undefined,
  cfg: ObjectConfig & { permissions?: Record<string, string[]> },
  action: Action,
  ctx: { own?: boolean } = {},
): boolean {
  const table = cfg.permissions;
  if (!table) return true;
  if (!role) return true; // auth disabled → open (matches the server gate)
  if (role === "owner") return true;
  const granted = table[role] ?? [];
  if (granted.includes(action)) return true;
  if ((action === "edit" || action === "delete") && ctx.own && granted.includes(`${action}Own`)) return true;
  if (action === "restore" && (granted.includes("delete") || (ctx.own && granted.includes("deleteOwn")))) return true;
  if (action === "destroy" && ctx.own && granted.includes("destroyOwn")) return true;
  return false;
}
