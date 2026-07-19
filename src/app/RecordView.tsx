import * as React from "react";
import { api } from "./api";
import { useToast } from "./App";
import { RecordPage } from "../ui/record-core/RecordPage";
import type { ObjectConfig, RecordRow, TimelineEvent } from "../ui/record-core/types";

export function RecordView({ config, id, onBack }: { config: ObjectConfig; id: string; onBack: () => void }) {
  const toast = useToast();
  const [row, setRow] = React.useState<RecordRow | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [missing, setMissing] = React.useState(false);

  const load = React.useCallback(() => {
    api.get(config.key, id).then(setRow).catch(() => setMissing(true));
    api.timeline(config.key, id).then(setTimeline).catch(() => {});
  }, [config.key, id]);

  React.useEffect(load, [load]);

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

  return (
    <RecordPage
      config={config}
      row={row}
      timeline={timeline}
      onBack={onBack}
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
    />
  );
}
