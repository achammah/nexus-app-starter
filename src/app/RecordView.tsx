import * as React from "react";
import { api, type AppConfig, type DupCandidate, type TaskItem } from "./api";
import { useToast } from "./App";
import { t } from "./i18n";
import { RecordPage, type RelatedList } from "../ui/record-core/RecordPage";
import { RecordTasksBlock } from "./pages/Tasks";
import { formatCell } from "../ui/record-core/DataTable";
import type { FileMeta, ObjectConfig, RecordRow, RelationItem, TimelineEvent } from "../ui/record-core/types";
import { rowRefs } from "../ui/record-core/types";
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
  const [relationItems, setRelationItems] = React.useState<Record<string, RelationItem[]>>({});
  const [related, setRelated] = React.useState<RelatedList[]>([]);
  const [dups, setDups] = React.useState<DupCandidate[]>([]);
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
    api.duplicatesFor(config.key, id).then(setDups).catch(() => {});
    if (tasksOn) api.tasks({ record: `${config.key}:${id}` }).then((r) => setTasks(r.tasks)).catch(() => {});
  }, [config.key, id, tasksOn]);

  React.useEffect(load, [load]);
  // live sync: another viewer's edits/comments/files appear without a manual reload
  usePollRev(config.key, load);
  React.useEffect(() => {
    api.usersDirectory().then(setMentionOptions).catch(() => {});
    if (sessionUser) api.watchers(config.key, id).then((w) => setWatchState({ on: w.me, count: w.count })).catch(() => {});
  }, [config.key, id, sessionUser]);

  // Relation ITEMS: target object(s) → {id, label} pairs (feeds identity-aware
  // pickers; the label comes from the target's primary via formatCell, so a
  // fullName-primary target lists as its joined name — never [object Object]).
  React.useEffect(() => {
    const rels = config.fields.filter((f) => f.type === "relation");
    rels.forEach((f) => {
      const targetKeys = f.relationTargets ?? (f.relation ? [f.relation] : []);
      Promise.all(
        targetKeys.map(async (tKey) => {
          const target = appConfig.objects.find((o) => o.key === tKey);
          if (!target) return [] as RelationItem[];
          const tPrimary = target.fields.find((x) => x.primary) ?? target.fields[0];
          const rows = await api.list(target.key).catch(() => [] as RecordRow[]);
          return rows.map((r) => ({
            id: r.id,
            label: formatCell(r[tPrimary.key], tPrimary.type) || r.id,
            type: tKey,
            typeLabel: target.labelOne,
          }));
        }),
      )
        .then((lists) => setRelationItems((m) => ({ ...m, [f.key]: lists.flat() })))
        .catch(() => {});
    });
  }, [appConfig, config]);

  // RELATED lists: every object with a relation field pointing AT this object
  // (single, many, or polymorphic), matched by STABLE ID via the rows' _refs —
  // a dangling label still matches by text as a fallback. Sections take the
  // field's inverseLabel when the config names one.
  React.useEffect(() => {
    if (!row) return;
    const mine = formatCell(row[primary.key], primary.type);
    const reverse = appConfig.objects.flatMap((o) =>
      o.fields
        .filter((f) => f.type === "relation" && (f.relation === config.key || f.relationTargets?.includes(config.key)))
        .map((f) => ({ o, f })),
    );
    const pointsAtMe = (r: RecordRow, f: (typeof reverse)[number]["f"]) => {
      const ref = rowRefs(r)[f.key];
      if (Array.isArray(ref))
        return ref.some((x) => (typeof x === "object" && x !== null ? (x as { object: string; id: string }).object === config.key && (x as { id: string }).id === id : x === id));
      if (typeof ref === "object" && ref !== null) return ref.object === config.key && ref.id === id;
      if (typeof ref === "string") return ref === id;
      return mine !== "" && String(r[f.key] ?? "") === mine; // dangling-label fallback
    };
    Promise.all(
      reverse.map(async ({ o, f }) => {
        const oPrimary = o.fields.find((x) => x.primary) ?? o.fields[0];
        const meta = o.fields.find((x) => !x.primary && x.key !== f.key);
        const rows = (await api.list(o.key).catch(() => [] as RecordRow[])).filter((r) => pointsAtMe(r, f));
        return {
          key: o.key,
          fieldKey: f.key,
          label: f.inverseLabel ?? o.label,
          rows,
          primaryKey: oPrimary.key,
          metaKey: meta?.key,
          onOpen: (rid: string) => go(`#/o/${o.key}/r/${rid}`),
        };
      }),
    ).then((lists) => {
      // an object pointing here through TWO fields gets suffixed section keys;
      // the common single-field case keeps its historical `related-<object>` testid
      const byObj = new Map<string, number>();
      for (const l of lists) byObj.set(l.key, (byObj.get(l.key) ?? 0) + 1);
      setRelated(lists.map(({ fieldKey, ...l }) => ((byObj.get(l.key) ?? 0) > 1 ? { ...l, key: `${l.key}-${fieldKey}` } : l) satisfies RelatedList));
    });
  }, [appConfig, config.key, row, primary.key, primary.type, id, go]);

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

  /* "Possible duplicates" — a SYNTHETIC related section (no library surface):
     candidate name in the primary slot, the matched rules + the action in the
     meta slot, so the row announces what its single click does. Clicking hands
     the pair to the list (nx-pending-merge) where the existing merge dialog
     opens preselected; the panel only INFORMS — merge rights gate the dialog. */
  const dupSection: RelatedList = {
    key: "duplicates",
    label: t("dup.panelTitle"),
    rows: dups.map((d) => ({ id: d.id, name: d.name, why: `${d.reasons.join(" · ")} · ${t("dup.review")}` })),
    primaryKey: "name",
    metaKey: "why",
    onOpen: (rid) => {
      sessionStorage.setItem("nx-pending-merge", JSON.stringify([id, rid]));
      go(`#/o/${config.key}`);
    },
  };

  return (
    <>
    <RecordPage
      config={config}
      row={row}
      timeline={timeline}
      onBack={onBack}
      relationItems={relationItems}
      related={dups.length ? [...related, dupSection] : related}
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
            // attach by the new record's ID — the stable link (labels are projection)
            api.patch(config.key, id, { [f.key]: created.id }).then(() => {
              setRelationItems((m) => ({
                ...m,
                [fieldKey]: [...(m[fieldKey] ?? []), { id: created.id, label: title, type: target.key, typeLabel: target.labelOne }],
              }));
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
