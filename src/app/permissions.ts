/* Client twin of server/permissions.mjs — SAME contract, used only to hide/disable
   affordances (the server is the real gate). Keep the two in sync; the permissions
   journey asserts both sides. */

import type { ObjectConfig } from "../ui/record-core/types";

export type Role = "owner" | "admin" | "member";
export type Action = "view" | "create" | "edit" | "delete" | "export";

export function can(role: Role | undefined, cfg: ObjectConfig & { permissions?: Record<string, Action[]> }, action: Action): boolean {
  const table = cfg.permissions;
  if (!table) return true;
  if (!role) return true; // auth disabled → open (matches the server gate)
  if (role === "owner") return true;
  return (table[role] ?? []).includes(action);
}
