import * as React from "react";

/* Custom pages — the "any product" extension point.
   The record-core (objects in starter.config.json) is ONE surface family; anything
   else a product needs (dashboard, run console, settings, wizard, doc viewer…) is a
   PAGE registered here. Nav renders objects THEN pages; routes are #/p/<key>.
   A page is ordinary React — the full vendored shadcn kit (src/ui/components/ui/*),
   the primitives wrappers, tokens, and the /api client are all available.

   Example:
     import { LayoutDashboard } from "lucide-react";
     import { Overview } from "./pages/Overview";
     export const customPages: PageDef[] = [
       { key: "overview", label: "Overview", icon: <LayoutDashboard size={15} />, component: Overview },
     ];
*/

export interface PageDef {
  key: string;
  label: string;
  icon?: React.ReactNode;
  component: React.ComponentType;
}

import type { AppConfig, PageConfig } from "./api";
import { pageIcon } from "./pageIcons";

/* A nav entry, resolved for rendering. Static customPages and config-declared
   config.pages[] entries share this shape so the sidebar / drawer / top bar /
   ⌘K palette / breadcrumb all iterate ONE list and can't drift. */
export interface NavPage {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /* set for config.pages[] entries (a generic host renders them); absent for the
     hand-written customPages (their `component` renders instead) */
  config?: PageConfig;
}

/* customPages (static) + config.pages[] (runtime) as one ordered nav list —
   the generalization: adding a config.pages[] entry adds a nav item with no code.
   Config-page icons resolve from their string name (or the kind's default). */
export function allNavPages(config: Pick<AppConfig, "pages">): NavPage[] {
  const statics: NavPage[] = customPages.map((p) => ({ key: p.key, label: p.label, icon: p.icon }));
  const declared: NavPage[] = (config.pages ?? []).map((p) => ({
    key: p.key,
    label: p.label,
    icon: pageIcon(p.icon, p.kind),
    config: p,
  }));
  return [...statics, ...declared];
}

/* the config.pages[] entry for a route key (null for a static customPage / object) */
export function configPageFor(config: Pick<AppConfig, "pages">, key: string | undefined): PageConfig | null {
  if (!key) return null;
  return (config.pages ?? []).find((p) => p.key === key) ?? null;
}

import { Boxes, Database, KeyRound, ListTodo, Palette, Settings2, Shapes, Table2, Users2, Webhook } from "lucide-react";
import { ApiKeysPage } from "./pages/ApiKeys";
import { GalleryPage } from "./pages/Gallery";
import { KitDemo } from "./pages/KitDemo";
import { SchemaPage } from "./pages/Schema";
import { SettingsPage } from "./pages/Settings";
import { SpreadsheetPage } from "./pages/Spreadsheet";
import { TasksPage } from "./pages/Tasks";
import { TeamPage } from "./pages/Team";
import { ThemePage } from "./pages/Theme";
import { WebhooksPage } from "./pages/Webhooks";

export const customPages: PageDef[] = [
  { key: "spreadsheet", label: "Spreadsheet", icon: <Table2 size={15} />, component: SpreadsheetPage },
  { key: "tasks", label: "Tasks", icon: <ListTodo size={15} />, component: TasksPage },
  { key: "team", label: "Team", icon: <Users2 size={15} />, component: TeamPage },
  { key: "webhooks", label: "Webhooks", icon: <Webhook size={15} />, component: WebhooksPage },
  { key: "apikeys", label: "API keys", icon: <KeyRound size={15} />, component: ApiKeysPage },
  { key: "schema", label: "Schema", icon: <Database size={15} />, component: SchemaPage },
  { key: "theme", label: "Theme", icon: <Palette size={15} />, component: ThemePage },
  { key: "gallery", label: "Gallery", icon: <Shapes size={15} />, component: GalleryPage },
  { key: "settings", label: "Settings", icon: <Settings2 size={15} />, component: SettingsPage },
  // The kit demo proves this registry AND shows the deep component families live.
  // Real apps replace it with their own pages (or delete it).
  { key: "kit", label: "Kit demo", icon: <Boxes size={15} />, component: KitDemo },
  // generate:pages — scripts/generate.mjs appends registrations above this line; keep it.
];
