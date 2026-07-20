import * as React from "react";
import { ListChecks, Info } from "lucide-react";
import { api } from "../api";
import { SettingsTabs } from "../../ui/primitives/SettingsTabs";
import { EditableRuleList } from "../../ui/primitives/EditableRuleList";
import type { RecordRow } from "../../ui/record-core/types";

/* Settings — example composition of the two generic nexus-ui primitives:
   SettingsTabs (tab shell) + EditableRuleList (CRUD list). "Writing rules"
   demonstrates the live-record tab wired to a warehouse object; "About" is a
   plain static tab, proving the shell holds non-CRUD content too. Replace
   both with your own tabs — nothing here is nexus-ui, it's just wiring. */

const SEVERITY = [
  { value: "Critical", color: "var(--nx-danger)" },
  { value: "Important", color: "var(--nx-warn)" },
  { value: "Minor", color: "var(--nx-fg-muted)" },
];

export function SettingsPage() {
  return (
    <div style={{ padding: "32px clamp(20px,4vw,48px) 64px", maxWidth: 900 }}>
      <SettingsTabs
        defaultKey="writing"
        tabs={[
          { key: "writing", label: "Writing rules", icon: <ListChecks size={14} />, render: () => <WritingRules /> },
          { key: "about", label: "About", icon: <Info size={14} />, render: () => <About /> },
        ]}
      />
    </div>
  );
}

function WritingRules() {
  const [rows, setRows] = React.useState<RecordRow[] | null>(null);
  const load = React.useCallback(() => api.list("settings_rules").then(setRows).catch(() => setRows([])), []);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <EditableRuleList
      objectKey="settings_rules"
      rows={rows}
      textField="rule"
      severityField="severity"
      severityOptions={SEVERITY}
      activeField="active"
      placeholder="e.g. Never open with a rhetorical question."
      onCreate={(body) => api.create("settings_rules", body).then(load)}
      onPatch={(id, patch) => api.patch("settings_rules", id, patch).then(load)}
      onRemove={(id) => api.remove("settings_rules", id).then(load)}
    />
  );
}

function About() {
  return (
    <div style={{ color: "var(--nx-fg-muted)", fontSize: 14, lineHeight: 1.6, maxWidth: "60ch" }}>
      This tab renders static content — no object, no fetch. SettingsTabs doesn't
      care what a tab shows; it only owns the tab bar and which one is active.
    </div>
  );
}
