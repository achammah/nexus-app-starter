import * as React from "react";
import { CheckCircle2, Circle, Plus, Trash2, X } from "lucide-react";
import { api, type TaskItem, type TaskLink } from "../api";
import { useToast } from "../App";
import { t } from "../i18n";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro, Checkbox } from "../../ui/primitives/fields";

/* Tasks — cross-record to-dos (status, due, assignee, record links).
   One workspace-wide page grouped by due bucket, plus a per-record block
   (RecordTasksBlock below) showing the same data filtered to one record.
   Links carry a live label; label === null means the record was destroyed —
   the chip renders degraded and never navigates. */

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

type Bucket = "overdue" | "today" | "week" | "later" | "done";
const BUCKETS: Bucket[] = ["overdue", "today", "week", "later", "done"];
const bucketLabel: Record<Bucket, string> = {
  overdue: t("tasks.bucket.overdue"), today: t("tasks.bucket.today"),
  week: t("tasks.bucket.week"), later: t("tasks.bucket.later"), done: t("tasks.bucket.done"),
};

function bucketOf(tk: TaskItem, today: string, weekEnd: string): Bucket {
  if (tk.status === "done") return "done";
  if (!tk.due) return "later";
  if (tk.due < today) return "overdue";
  if (tk.due === today) return "today";
  if (tk.due <= weekEnd) return "week";
  return "later";
}

/* mine-first, then due-asc (no due last), then creation order */
function taskSort(a: TaskItem, b: TaskItem, me: string | null): number {
  if (me) {
    const am = a.assignee === me ? 0 : 1;
    const bm = b.assignee === me ? 0 : 1;
    if (am !== bm) return am - bm;
  }
  const ad = a.due ?? "9999-99-99";
  const bd = b.due ?? "9999-99-99";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

function DoneToggle({ task, testid, onToggle }: { task: TaskItem; testid: string; onToggle: () => void }) {
  const done = task.status === "done";
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={done ? "Reopen task" : "Complete task"}
      style={{ border: 0, background: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: done ? "var(--nx-accent)" : "var(--nx-fg-faint)" }}
      onClick={onToggle}
    >
      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
    </button>
  );
}

function DueBadge({ due, status }: { due: string | null; status: string }) {
  if (!due) return null;
  const today = ymd(new Date());
  const tone = status === "done" ? undefined : due < today ? "danger" : due === today ? "accent" : undefined;
  return <Badge tone={tone as never}>{due}</Badge>;
}

/* record chips: live links navigate; a dead link renders inert */
function LinkChips({ task }: { task: TaskItem }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {task.links.map((l) =>
        l.label ? (
          <button
            key={`${l.obj}:${l.id}`}
            type="button"
            className="nxOptChip"
            data-testid={`task-link-${task.id}-${l.id}`}
            style={{ background: "var(--nx-bg-sunken)", border: "1px solid var(--nx-border)", color: "var(--nx-fg-muted)", cursor: "pointer" }}
            onClick={() => { window.location.hash = `#/o/${l.obj}/r/${l.id}`; }}
          >
            {l.label}
          </button>
        ) : (
          <span
            key={`${l.obj}:${l.id}`}
            className="nxOptChip"
            data-testid={`task-link-dead-${task.id}-${l.id}`}
            style={{ background: "var(--nx-bg-sunken)", border: "1px dashed var(--nx-border)", color: "var(--nx-fg-faint)" }}
          >
            {l.objLabel} {t("tasks.deleted")}
          </span>
        ),
      )}
    </span>
  );
}

export function TasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [me, setMe] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<string[]>([]);
  const [role, setRole] = React.useState<string | undefined>(undefined);
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [fStatus, setFStatus] = React.useState("");
  const [fAssignee, setFAssignee] = React.useState("");
  const [fOverdue, setFOverdue] = React.useState(false);

  const load = React.useCallback(() => {
    api.tasks().then((r) => { setTasks(r.tasks); setMe(r.me); }).catch(() => {});
  }, []);
  React.useEffect(() => {
    load();
    api.usersDirectory().then(setUsers).catch(() => {});
    api.me().then((m) => setRole(m.role)).catch(() => {});
  }, [load]);

  const canManage = role !== "viewer";
  const today = ymd(new Date());
  const weekEnd = plusDays(7);

  const filtered = tasks
    .filter((tk) => (fStatus ? tk.status === fStatus : true))
    .filter((tk) => (fAssignee ? tk.assignee === fAssignee : true))
    .filter((tk) => (fOverdue ? bucketOf(tk, today, weekEnd) === "overdue" : true));
  const byBucket = new Map<Bucket, TaskItem[]>(BUCKETS.map((b) => [b, []]));
  for (const tk of filtered) byBucket.get(bucketOf(tk, today, weekEnd))!.push(tk);
  for (const list of byBucket.values()) list.sort((a, b) => taskSort(a, b, me));

  const create = () => {
    if (!title.trim()) return;
    api
      .taskCreate({ title: title.trim(), due: due || null, assignee: assignee || null })
      .then(() => { setTitle(""); setDue(""); setAssignee(""); load(); })
      .catch((e) => toast(e.message));
  };

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 820 }} data-testid="tasks-page">
      {canManage && (
        <div className="nxCard" style={{ padding: 18 }}>
          <Micro>{t("tasks.new")}</Micro>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Input
              placeholder={t("tasks.titlePlaceholder")}
              value={title}
              data-testid="tasks-new-title"
              style={{ flex: 1, minWidth: 200 }}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            />
            <input
              type="date"
              className="nxCellEdit"
              value={due}
              aria-label="Due date"
              data-testid="tasks-new-due"
              onChange={(e) => setDue(e.target.value)}
            />
            <select
              className="nxCellEdit"
              value={assignee}
              aria-label="Assignee"
              data-testid="tasks-new-assignee"
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button variant="primary" icon={<Plus size={13} />} data-testid="tasks-create" onClick={create}>
              {t("tasks.create")}
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select className="nxCellEdit" value={fStatus} aria-label="Filter by status" data-testid="tasks-filter-status" onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="todo">todo</option>
          <option value="doing">doing</option>
          <option value="done">done</option>
        </select>
        <select className="nxCellEdit" value={fAssignee} aria-label="Filter by assignee" data-testid="tasks-filter-assignee" onChange={(e) => setFAssignee(e.target.value)}>
          <option value="">Everyone</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", font: "var(--nx-text-meta)" }}>
          <Checkbox checked={fOverdue} data-testid="tasks-filter-overdue" onCheckedChange={(v) => setFOverdue(!!v)} />
          {t("tasks.bucket.overdue")}
        </label>
      </div>

      {filtered.length === 0 && (
        <div className="nxCard" style={{ padding: 24, color: "var(--nx-fg-faint)", textAlign: "center" }}>{t("tasks.none")}</div>
      )}
      {BUCKETS.map((b) => {
        const list = byBucket.get(b)!;
        if (list.length === 0) return null;
        return (
          <div className="nxCard" key={b} data-testid={`tasks-bucket-${b}`}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--nx-border)", display: "flex", justifyContent: "space-between" }}>
              <Micro>{bucketLabel[b]}</Micro>
              <span className="nxCount">{list.length}</span>
            </div>
            <div className="nxFieldList">
              {list.map((tk) => (
                <div className="nxFieldRow" key={tk.id} data-testid={`task-row-${tk.id}`} style={{ gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 8, alignItems: "center" }}>
                  <DoneToggle
                    task={tk}
                    testid={`task-done-${tk.id}`}
                    onToggle={() => {
                      if (!canManage) return;
                      api.taskPatch(tk.id, { status: tk.status === "done" ? "todo" : "done" }).then(load).catch((e) => toast(e.message));
                    }}
                  />
                  <span style={tk.status === "done" ? { textDecoration: "line-through", color: "var(--nx-fg-faint)" } : undefined}>
                    {tk.title}
                  </span>
                  <DueBadge due={tk.due} status={tk.status} />
                  {tk.assignee && <span className="nxFieldLabel">{tk.assignee}</span>}
                  <LinkChips task={tk} />
                  {canManage && (
                    <Button
                      variant="ghost" size="sm" icon={<Trash2 size={12} />}
                      aria-label="Delete task" data-testid={`task-del-${tk.id}`}
                      onClick={() => api.taskDelete(tk.id).then(load).catch((e) => toast(e.message))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Per-record tasks block — composed by RecordView BELOW the record grid
   (the record page component is vendored ui; composition stays app-side).
   The parent owns the data (one rev-poll refresh path); this block renders
   and fires the mutations, then asks the parent to reload. */
export function RecordTasksBlock({
  objKey,
  id,
  tasks,
  users,
  canManage,
  onChanged,
}: {
  objKey: string;
  id: string;
  tasks: TaskItem[];
  users: string[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const open = tasks.filter((tk) => tk.status !== "done");

  const add = () => {
    if (!title.trim()) return;
    api
      .taskCreate({ title: title.trim(), due: due || null, assignee: assignee || null, links: [{ obj: objKey, id }] })
      .then(() => { setTitle(""); setDue(""); setAssignee(""); toast("Task added"); onChanged(); })
      .catch((e) => toast(e.message));
  };
  const unlink = (tk: TaskItem) => {
    const links = tk.links
      .filter((l: TaskLink) => !(l.obj === objKey && l.id === id))
      .map((l: TaskLink) => ({ obj: l.obj, id: l.id }));
    api.taskPatch(tk.id, { links }).then(() => { toast("Task unlinked"); onChanged(); }).catch((e) => toast(e.message));
  };

  return (
    <div className="nxCard" style={{ marginTop: 14 }} data-testid="record-tasks">
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--nx-border)", display: "flex", justifyContent: "space-between" }}>
        <Micro>Tasks</Micro>
        <span className="nxCount" data-testid="record-tasks-count">{open.length}</span>
      </div>
      <div className="nxFieldList">
        {tasks.length === 0 && (
          <div style={{ padding: "10px 12px", color: "var(--nx-fg-faint)", font: "var(--nx-text-meta)" }}>{t("tasks.none")}</div>
        )}
        {tasks.map((tk) => (
          <div className="nxFieldRow" key={tk.id} data-testid={`rtask-row-${tk.id}`} style={{ gridTemplateColumns: "auto 1fr auto auto auto", gap: 8, alignItems: "center" }}>
            <DoneToggle
              task={tk}
              testid={`rtask-done-${tk.id}`}
              onToggle={() => {
                if (!canManage) return;
                api.taskPatch(tk.id, { status: tk.status === "done" ? "todo" : "done" }).then(onChanged).catch((e) => toast(e.message));
              }}
            />
            <span style={tk.status === "done" ? { textDecoration: "line-through", color: "var(--nx-fg-faint)" } : undefined}>{tk.title}</span>
            <DueBadge due={tk.due} status={tk.status} />
            {tk.assignee && <span className="nxFieldLabel">{tk.assignee}</span>}
            {canManage && (
              <Button
                variant="ghost" size="sm" icon={<X size={12} />}
                aria-label="Unlink task from this record" data-testid={`rtask-unlink-${tk.id}`}
                onClick={() => unlink(tk)}
              />
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--nx-border)", flexWrap: "wrap" }}>
          <Input
            placeholder={t("tasks.titlePlaceholder")}
            value={title}
            data-testid="rtask-title"
            style={{ flex: 1, minWidth: 160 }}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <input type="date" className="nxCellEdit" value={due} aria-label="Due date" data-testid="rtask-due" onChange={(e) => setDue(e.target.value)} />
          <select className="nxCellEdit" value={assignee} aria-label="Assignee" data-testid="rtask-assignee" onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <Button variant="primary" data-testid="rtask-add" onClick={add}>{t("tasks.add")}</Button>
        </div>
      )}
    </div>
  );
}
