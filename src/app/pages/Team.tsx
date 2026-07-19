import * as React from "react";
import { Copy, Plus, UserPlus } from "lucide-react";
import { api } from "../api";
import { useToast } from "../App";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro } from "../../ui/primitives/fields";

/* Team settings — membership, dual invitations (targeted mail + shareable code),
   role management. Requires the auth seam; renders a notice when auth is off. */

type Me = { enabled: boolean; accounts?: boolean; user: string | null; role?: string };
type Team = { slug: string; name: string; role: string };
type Member = { email: string; role: string; status: string };
type TeamEvent = { id: string; kind: string; summary: string; ts: string };

export function TeamPage() {
  const toast = useToast();
  const [me, setMe] = React.useState<Me | null>(null);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [inviteCode, setInviteCode] = React.useState<string | undefined>();
  const [newTeam, setNewTeam] = React.useState("");
  const [invEmail, setInvEmail] = React.useState("");
  const [invRole, setInvRole] = React.useState("member");
  const [joinCode, setJoinCode] = React.useState("");
  const [activity, setActivity] = React.useState<TeamEvent[]>([]);

  const loadTeams = React.useCallback(() => {
    api.teams().then((r) => {
      setTeams(r.teams);
      setActive((a) => a ?? r.teams[0]?.slug ?? null);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(setMe).catch(() => setMe(null));
    loadTeams();
  }, [loadTeams]);

  const loadMembers = React.useCallback(() => {
    if (!active) return;
    api.teamMembers(active).then((r) => {
      setMembers(r.members);
      setInviteCode(r.inviteCode);
    }).catch(() => {});
    api.teamActivity(active).then((r) => setActivity(r.events)).catch(() => {});
  }, [active]);
  React.useEffect(loadMembers, [loadMembers]);

  if (me && !me.enabled)
    return (
      <div className="nxCard" style={{ padding: 28 }}>
        <b>Teams need the auth seam.</b>
        <p style={{ color: "var(--nx-fg-muted)", marginBottom: 0 }}>
          Set <code>AUTH_MODE=accounts</code> (or <code>AUTH_USERS</code>) + <code>APP_SECRET</code> — see .env.example — then invite people here.
        </p>
      </div>
    );

  const myRole = teams.find((t) => t.slug === active)?.role;

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      <div className="nxCard" style={{ padding: 18 }}>
        <Micro>Your teams</Micro>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
          {teams.length === 0 && <span style={{ color: "var(--nx-fg-faint)" }}>None yet — create one below.</span>}
          {teams.map((t) => (
            <button
              key={t.slug}
              type="button"
              className="nxSegBtn"
              style={{ border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-s)" }}
              data-active={t.slug === active}
              data-testid={`team-${t.slug}`}
              onClick={() => setActive(t.slug)}
            >
              {t.name} <Badge>{t.role}</Badge>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Input placeholder="New team name…" value={newTeam} data-testid="team-create-name" onChange={(e) => setNewTeam(e.target.value)} />
          <Button
            variant="primary" icon={<Plus size={13} />} data-testid="team-create-go"
            onClick={() => {
              if (!newTeam.trim()) return;
              api.teamCreate(newTeam.trim()).then((t) => {
                toast(`Team ${t.name} created`);
                setNewTeam("");
                setActive(t.slug);
                loadTeams();
              }).catch((e) => toast(e.message));
            }}
          >
            Create
          </Button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Input placeholder="Have a join code?" value={joinCode} data-testid="team-code-input" onChange={(e) => setJoinCode(e.target.value)} />
          <Button
            data-testid="team-join-go"
            onClick={() => {
              if (!joinCode.trim()) return;
              api.teamJoin(joinCode.trim()).then((r) => {
                toast(`Joined ${r.team.name}`);
                setJoinCode("");
                setActive(r.team.slug);
                loadTeams();
              }).catch((e) => toast(e.message));
            }}
          >
            Join
          </Button>
        </div>
      </div>

      {active && (
        <div className="nxCard" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Micro>Members</Micro>
            <span className="nxSpacer" style={{ flex: 1 }} />
            {inviteCode && (
              <Button
                size="sm" icon={<Copy size={12} />} data-testid="team-join-code"
                onClick={() => {
                  navigator.clipboard?.writeText(inviteCode).catch(() => {});
                  toast(`Join code copied: ${inviteCode}`);
                }}
              >
                Copy join code
              </Button>
            )}
          </div>
          <div className="nxFieldList">
            {members.map((m) => (
              <div className="nxFieldRow" key={m.email} data-testid={`member-row-${m.email}`} style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</span>
                <Badge tone={m.status === "pending" ? "warn" : undefined}>{m.status}</Badge>
                {myRole === "owner" ? (
                  <select
                    className="nxCellEdit"
                    style={{ width: 110 }}
                    value={m.role}
                    data-testid={`team-role-${m.email}`}
                    onChange={(e) =>
                      api.teamSetRole(active, m.email, e.target.value).then(loadMembers).catch((err) => toast(err.message))
                    }
                  >
                    {["owner", "admin", "member", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Badge>{m.role}</Badge>
                )}
                {myRole === "owner" && m.email !== me?.user ? (
                  <Button size="sm" variant="ghost" data-testid={`team-remove-${m.email}`}
                    onClick={() => api.teamRemove(active, m.email).then(loadMembers).catch((err) => toast(err.message))}>
                    Remove
                  </Button>
                ) : <span />}
              </div>
            ))}
          </div>
          {myRole !== "member" && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Input placeholder="person@company.com" value={invEmail} data-testid="team-invite-email" onChange={(e) => setInvEmail(e.target.value)} />
              <select className="nxCellEdit" style={{ width: 110 }} value={invRole} data-testid="team-invite-role" onChange={(e) => setInvRole(e.target.value)}>
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="viewer">viewer</option>
              </select>
              <Button
                variant="primary" icon={<UserPlus size={13} />} data-testid="team-invite-go"
                onClick={() => {
                  api.teamInvite(active, invEmail.trim(), invRole).then(() => {
                    toast(`Invitation sent to ${invEmail.trim()}`);
                    setInvEmail("");
                    loadMembers();
                  }).catch((e) => toast(e.message));
                }}
              >
                Invite
              </Button>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Micro>Activity</Micro>
            <div className="nxFieldList" data-testid="team-activity" style={{ marginTop: 6 }}>
              {activity.length === 0 && <div style={{ padding: 8, color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>Nothing yet.</div>}
              {activity.map((ev) => (
                <div className="nxFieldRow" key={ev.id} style={{ gridTemplateColumns: "auto 1fr auto" }}>
                  <Badge>{ev.kind}</Badge>
                  <span style={{ font: "var(--nx-text-meta)" }}>{ev.summary}</span>
                  <span className="nxFieldLabel">{new Date(ev.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
