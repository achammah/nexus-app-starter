import * as React from "react";
import { api, type AppConfig, type TaskItem } from "./api";
import { useToast } from "./App";
import { RecordPage, type RelatedList } from "../ui/record-core/RecordPage";
import { RecordTasksBlock } from "./pages/Tasks";
import { formatCell } from "../ui/record-core/DataTable";
import type { FileMeta, ObjectConfig, RecordRow, TimelineEvent } from "../ui/record-core/types";
import { usePollRev } from "./usePollRev";
import { can, type Role } from "./permissions";
import { favHas, favToggle } from "./favorites";

export function RecordView({
  appConfig,
  config,
  id,
  role,
  sessionUser,
  onBack,
  go,
}: {
  appConfig: AppConfig;
  config: ObjectConfig;
  id: string;
  role?: Role;
  sessionUser?: string | null;
  onBack: () => void;
  go: (hash: string) => void;
}) {
  // own-aware: editOwn grants kick in on rows this user created (_createdBy)
  const toast = useToast();
  const [row, setRow] = React.useState<RecordRow | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [missing, setMissing] = React.useState(false);
  const [relationOptions, setRelationOptions] = React.useState<Record<string, string[]>>({});
  const [related, setRelated] = React.useState<RelatedList[]>([]);
  const [files, setFiles] = React.useState<FileMeta[]>([]);
  const [watchState, setWatchState] = React.useState<{ on: boolean; count: number }>({ on: false, count: 0 });
  const [mentionOptions, setMentionOptions] = React.useState<string[]>([]);
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const tasksOn = appConfig.features?.tasks !== false;
  const [fav, setFav] = React.useState(() => favHas(config.key, id));
  React.useEffect(() => setFav(favHas(config.key, id)), [config.key, id]);
  const primary = config.fields.find((f) => f.primary) ?? config.fields[0];

  const load = React.useCallback(() => {
    api.get(config.key, id).then(setRow).catch(() => setMissing(true));
    api.timeline(config.key, id).then(setTimeline).catch(() => {});
    api.files(config.key, id).then(setFiles).catch(() => {});
    if (tasksOn) api.tasks({ record: `${config.key}:${id}` }).then((r) => setTasks(r.tasks)).catch(() => {});
  }, [config.key, id, tasksOn]);

  React.useEffect(load, [load]);
  // live sync: another viewer's edits/comments/files appear without a manual reload
  usePollRev(config.key, load);
  React.useEffect(() => {
    api.usersDirectory().then(setMentionOptions).catch(() => {});
    if (sessionUser) api.watchers(config.key, id).then((w) => setWatchState({ on: w.me, count: w.count })).catch(() => {});
  }, [config.key, id, sessionUser]);

  // Relation OPTIONS: target object → its primary values (feeds the pickers).
  React.useEffect(() => {
    const rels = config.fields.filter((f) => f.type === "relation" && f.relation);
    rels.forEach((f) => {
      const target = appConfig.objects.find((o) => o.key === f.relation);
      if (!target) return;
      const tPrimary = target.fields.find((x) => x.primary) ?? target.fields[0];
      api
        .list(target.key)
        .then((rows) =>
          setRelationOptions((m) => ({ ...m, [f.key]: rows.map((r) => String(r[tPrimary.key] ?? r.id)) })),
        )
        .catch(() => {});
    });
  }, [appConfig, config]);

  // RELATED lists: every object with a relation field pointing AT this object,
  // filtered to rows whose value equals this record's primary value.
  React.useEffect(() => {
    if (!row) return;
    const mine = String(row[primary.key] ?? "");
    const reverse = appConfig.objects.flatMap((o) =>
      o.fields.filter((f) => f.type === "relation" && f.relation === config.key).map((f) => ({ o, f })),
    );
    Promise.all(
      reverse.map(async ({ o, f }) => {
        const oPrimary = o.fields.find((x) => x.primary) ?? o.fields[0];
        const meta = o.fields.find((x) => !x.primary && x.key !== f.key);
        const rows = (await api.list(o.key).catch(() => [] as RecordRow[])).filter(
          (r) => String(r[f.key] ?? "") === mine,
        );
        return {
          key: o.key,
          label: o.label,
          rows,
          primaryKey: oPrimary.key,
          metaKey: meta?.key,
          onOpen: (rid: string) => go(`#/o/${o.key}/r/${rid}`),
        } satisfies RelatedList;
      }),
    ).then(setRelated);
  }, [appConfig, config.key, row, primary.key, go]);

  if (missing)
    return (
      <div className="nxCard" style={{ padding: 32, textAlign: "center" }}>
        This {config.labelOne.toLowerCase()} no longer exists.
        <div style={{ marginTop: 10 }}>
          <button className="nxBtn nxBtn--secondary nxBtn--sm" onClick={onBack}>Back to {config.label}</button>
        </div>
      </div>
    );
  if (!row) return <div className="nxCard" style={{ padding: 40, textAlign: "center", color: "var(--nx-fg-faint)" }} data-testid="record-loading">Loading…</div>;
  const own = !!(sessionUser && row._createdBy === sessionUser);
  const readOnly = !can(role, config, "edit", { own });

  return (
    <>
    <RecordPage
      config={config}
      row={row}
      timeline={timeline}
      onBack={onBack}
      relationOptions={relationOptions}
      related={related}
      userOptions={appConfig.users ?? []}
      readOnly={readOnly}
      mentionOptions={mentionOptions}
      pin={{
        on: fav,
        onToggle: () => {
          const label = formatCell(row[primary.key], primary.type) || String(id);
          const on = favToggle(config.key, id, label);
          setFav(on);
          toast(on ? "Added to favorites" : "Removed from favorites");
        },
      }}
      watch={sessionUser ? {
        on: watchState.on,
        count: watchState.count,
        onToggle: (next) =>
          api.watch(config.key, id, next).then((r) => {
            setWatchState({ on: r.me, count: r.watchers });
            toast(next ? "Watching this record" : "Stopped watching");
          }).catch((e) => toast(e.message)),
      } : undefined}
      onOpenRelation={(target, value) => {
        // fresh mounts consume the sessionStorage handoff; a list that never
        // unmounted (peek was over it) gets the live event instead
        sessionStorage.setItem("nx-pending-q", value);
        go(`#/o/${target}`);
        setTimeout(() => window.dispatchEvent(new CustomEvent("nx-search", { detail: value })), 0);
      }}
      onCreateRelation={(fieldKey, title) => {
        // picker "Create …": born with just a title, attached at once, then opened
        // (in peek context `go` pushes it) so the rest fills in progressively
        const f = config.fields.find((x) => x.key === fieldKey);
        const target = appConfig.objects.find((o) => o.key === f?.relation);
        if (!f || !target) return;
        const tPrimary = target.fields.find((x) => x.primary) ?? target.fields[0];
        api.create(target.key, { [tPrimary.key]: title })
          .then((created) =>
            api.patch(config.key, id, { [f.key]: title }).then(() => {
              setRelationOptions((m) => ({ ...m, [fieldKey]: [...(m[fieldKey] ?? []), title] }));
              toast(`${target.labelOne} “${title}” created & linked`);
              load();
              go(`#/o/${target.key}/r/${created.id}`);
            }),
          )
          .catch((e) => toast(`Create failed: ${e.message}`));
      }}
      onPatch={(rid, patch) => {
        setRow((r) => (r ? { ...r, ...patch } : r)); // optimistic
        api
          .patch(config.key, rid, patch)
          .then(() => {
            toast("Saved");
            load(); // timeline gains the update event
          })
          .catch((e) => {
            toast(`Save failed: ${e.message}`);
            load();
          });
      }}
      onAddNote={(text) => {
        api
          .addNote(config.key, id, text)
          .then(() => {
            toast("Note added");
            load();
          })
          .catch((e) => toast(`Note failed: ${e.message}`));
      }}
      onLogActivity={(kind, text) => {
        api
          .addActivity(config.key, id, kind, text)
          .then(() => {
            toast(`${kind[0].toUpperCase()}${kind.slice(1)} logged`);
            load();
          })
          .catch((e) => toast(`Log failed: ${e.message}`));
      }}
      files={{
        list: files,
        downloadHref: (fileId) => api.fileHref(config.key, id, fileId),
        onUpload: (f) => {
          api
            .uploadFile(config.key, id, f)
            .then(() => {
              toast(`Uploaded ${f.name}`);
              load();
            })
            .catch((e) => toast(`Upload failed: ${e.message}`));
        },
      }}
      onEnrich={(fieldKey) => {
        const label = config.fields.find((f) => f.key === fieldKey)?.primitive?.label ?? "primitive";
        toast(`Running ${label}…`);
        api
          .enrich(config.key, id, fieldKey)
          .then(() => {
            toast("Enriched");
            load();
          })
          .catch((e) => toast(`Enrich failed: ${e.message}`));
      }}
    />
    {tasksOn && (
      <RecordTasksBlock
        objKey={config.key}
        id={id}
        tasks={tasks}
        users={mentionOptions}
        canManage={role !== "viewer"}
        onChanged={load}
      />
    )}
    </>
  );
}
