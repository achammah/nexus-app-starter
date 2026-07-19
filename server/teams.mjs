/* Teams routes — membership, dual invitations (targeted email + shareable code),
   role management. Mounted under /api/teams by server.mjs; every route already sits
   behind the auth gate (a session exists). Design notes carried from production
   reference implementations:
     · inviting an existing member answers 409 EXPLICITLY (never a silent no-op)
     · an email invite pre-provisions a PENDING membership so the UI can show
       "invited, not yet joined" immediately; accepting flips it active
     · accept checks the SIGNED-IN address against the invite's address and names
       the mismatch instead of failing mutely
     · the last owner can neither leave nor be demoted */

import crypto from "node:crypto";
import { sendMail } from "./email.mjs";

const newCode = () => crypto.randomBytes(9).toString("base64url");

const inviteMail = (teamName, token) => ({
  subject: `You're invited to ${teamName}`,
  text: `You've been invited to join ${teamName}.\n\nOpen the app, sign in (or create an account with THIS address), then follow:\n/#/invite?token=${token}\n\nToken:\n${token}\n\nThe invitation expires in 7 days.`,
});

export async function handleTeams(req, res, url, readBody, send, store, session) {
  const parts = url.pathname.split("/").filter(Boolean); // ["api","teams",...]
  if (parts[1] !== "teams") return false;
  const me = session?.email;
  if (!me) { send(res, 401, { error: "sign in first" }); return true; }

  // GET /api/teams — my teams (+ my app-wide role)
  if (!parts[2] && req.method === "GET") {
    send(res, 200, { teams: store.teamsFor(me), role: store.roleFor(me) });
    return true;
  }

  // POST /api/teams {name}
  if (!parts[2] && req.method === "POST") {
    const { name } = await readBody(req);
    if (!String(name ?? "").trim()) { send(res, 400, { error: "name required" }); return true; }
    const team = store.teamAdd(String(name).trim(), me, newCode());
    send(res, 201, { ...team, role: "owner" });
    return true;
  }

  // POST /api/teams/join {code} — shareable-link path
  if (parts[2] === "join" && req.method === "POST") {
    const { code } = await readBody(req);
    const team = store.teamByCode(String(code ?? ""));
    if (!team) { send(res, 404, { error: "invalid join code" }); return true; }
    const existing = store.memberOf(team.id, me);
    if (existing?.status === "active") { send(res, 409, { error: "you are already a member" }); return true; }
    if (existing) existing.status = "active";
    else store.memberAdd(team.id, me, "member", "active");
    send(res, 200, { ok: true, team: { slug: team.slug, name: team.name } });
    return true;
  }

  // POST /api/teams/accept {token} — targeted-invite path
  if (parts[2] === "accept" && req.method === "POST") {
    const { token } = await readBody(req);
    const t = store.tokenTake(String(token ?? ""), "team-invite");
    if (!t) { send(res, 400, { error: "invalid or expired invitation" }); return true; }
    if (t.email !== me) {
      // put it back? no — single-use is the contract; name the mismatch instead
      const masked = t.email.replace(/^(.).*(@.*)$/, "$1***$2");
      send(res, 409, { error: `this invitation was issued for ${masked} — sign in with that address` });
      return true;
    }
    const teamId = t.teamId;
    const m = store.memberOf(teamId, me);
    if (m) m.status = "active";
    const team = (store.teams ?? []).find((x) => x.id === teamId);
    send(res, 200, { ok: true, team: team ? { slug: team.slug, name: team.name } : null });
    return true;
  }

  // /api/teams/:slug/...
  const team = store.teamBySlug(parts[2]);
  if (!team) { send(res, 404, { error: "unknown team" }); return true; }
  const myMembership = store.memberOf(team.id, me);
  if (!myMembership || myMembership.status !== "active") {
    send(res, 403, { error: "not a member of this team" });
    return true;
  }

  if (parts[3] === "members" && req.method === "GET") {
    send(res, 200, { members: store.memberList(team.id), inviteCode: myMembership.role === "member" ? undefined : team.inviteCode });
    return true;
  }

  if (parts[3] === "invites" && req.method === "POST") {
    if (myMembership.role === "member") { send(res, 403, { error: "admins and owners invite" }); return true; }
    const { email, role } = await readBody(req);
    const norm = String(email ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm)) { send(res, 400, { error: "a valid email is required" }); return true; }
    const existing = store.memberOf(team.id, norm);
    if (existing?.status === "active") { send(res, 409, { error: `${norm} is already a member` }); return true; }
    if (existing?.status === "pending") { send(res, 409, { error: `${norm} already has a pending invitation` }); return true; }
    const r = ["admin", "member"].includes(role) ? role : "member";
    store.memberAdd(team.id, norm, r, "pending");
    const t = store.tokenIssue({ kind: "team-invite", email: norm, ttlMinutes: 60 * 24 * 7, token: newCode() + newCode() });
    t.teamId = team.id;
    sendMail(store, { to: norm, kind: "team-invite", ...inviteMail(team.name, t.token) });
    send(res, 201, { ok: true, pending: norm, role: r });
    return true;
  }

  if (parts[3] === "members" && req.method === "PATCH") {
    if (myMembership.role !== "owner") { send(res, 403, { error: "only owners change roles" }); return true; }
    const { email, role } = await readBody(req);
    if (!["owner", "admin", "member"].includes(role)) { send(res, 400, { error: "role must be owner|admin|member" }); return true; }
    const target = store.memberOf(team.id, String(email ?? ""));
    if (!target) { send(res, 404, { error: "no such member" }); return true; }
    const owners = store.memberList(team.id).filter((m) => m.role === "owner" && m.status === "active");
    if (target.role === "owner" && role !== "owner" && owners.length === 1) {
      send(res, 409, { error: "a team needs at least one owner" });
      return true;
    }
    store.memberSetRole(team.id, target.email, role);
    send(res, 200, { ok: true });
    return true;
  }

  if (parts[3] === "members" && req.method === "DELETE") {
    const target = String(url.searchParams.get("email") ?? "").toLowerCase();
    const removingSelf = target === me;
    if (!removingSelf && myMembership.role !== "owner") { send(res, 403, { error: "only owners remove members" }); return true; }
    const m = store.memberOf(team.id, target);
    if (!m) { send(res, 404, { error: "no such member" }); return true; }
    const owners = store.memberList(team.id).filter((x) => x.role === "owner" && x.status === "active");
    if (m.role === "owner" && owners.length === 1) { send(res, 409, { error: "a team needs at least one owner" }); return true; }
    store.memberRemove(team.id, target);
    send(res, 200, { ok: true });
    return true;
  }

  send(res, 404, { error: "no route" });
  return true;
}
