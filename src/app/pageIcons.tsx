import * as React from "react";
import {
  BarChart3, Boxes, Building2, CalendarClock, CalendarDays, Compass, Database, FileText,
  Flag, FolderTree, Gauge, Globe, Image, KanbanSquare, Layers, LayoutDashboard, LayoutGrid,
  List, Map, MapPin, Network, NotebookPen, PenTool, PieChart, Presentation, Settings2, Shapes,
  Sparkles, Star, Table2, Target, Users2, Workflow,
} from "lucide-react";
import type { PageKind } from "./api";

/* Config pages declare their icon as a NAME (JSON is stringly-typed), so the shell
   resolves that name → a lucide node. A curated set (the codebase's existing pattern —
   see App.tsx ICONS) keeps the bundle tree-shaken: only these icons ship, not lucide's
   whole registry. Names match on a normalized key (case + separators stripped), so
   "pen-tool", "PenTool" and "pentool" all resolve. Unknown name → the kind's default
   → a neutral page glyph. Extend the map to offer more names. */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/* name → node. Keys are the normalized form; several aliases may map to one icon. */
const ICONS: Record<string, React.ReactNode> = {
  // the five page kinds, first-class
  pentool: <PenTool size={15} />,
  network: <Network size={15} />,
  workflow: <Workflow size={15} />,
  table2: <Table2 size={15} />,
  map: <Map size={15} />,
  mappin: <MapPin size={15} />,
  calendardays: <CalendarDays size={15} />,
  calendarclock: <CalendarClock size={15} />,
  // common page glyphs
  layoutdashboard: <LayoutDashboard size={15} />,
  layoutgrid: <LayoutGrid size={15} />,
  gauge: <Gauge size={15} />,
  foldertree: <FolderTree size={15} />,
  list: <List size={15} />,
  kanbansquare: <KanbanSquare size={15} />,
  users2: <Users2 size={15} />,
  users: <Users2 size={15} />,
  building2: <Building2 size={15} />,
  building: <Building2 size={15} />,
  settings2: <Settings2 size={15} />,
  settings: <Settings2 size={15} />,
  star: <Star size={15} />,
  sparkles: <Sparkles size={15} />,
  filetext: <FileText size={15} />,
  image: <Image size={15} />,
  barchart3: <BarChart3 size={15} />,
  barchart: <BarChart3 size={15} />,
  piechart: <PieChart size={15} />,
  globe: <Globe size={15} />,
  compass: <Compass size={15} />,
  target: <Target size={15} />,
  flag: <Flag size={15} />,
  layers: <Layers size={15} />,
  boxes: <Boxes size={15} />,
  database: <Database size={15} />,
  shapes: <Shapes size={15} />,
  notebookpen: <NotebookPen size={15} />,
  presentation: <Presentation size={15} />,
};

/* each kind's default glyph — used when a page declares no icon, or names an
   unknown one. Keeps every page legible in the nav out of the box. */
const KIND_ICON: Record<PageKind, React.ReactNode> = {
  whiteboard: <PenTool size={15} />,
  flow: <Network size={15} />,
  spreadsheet: <Table2 size={15} />,
  map: <Map size={15} />,
  calendar: <CalendarDays size={15} />,
  document: <FileText size={15} />,
  viewer3d: <Boxes size={15} />,
};

export function pageIcon(name: string | undefined, kind?: PageKind): React.ReactNode {
  if (name) {
    const hit = ICONS[norm(name)];
    if (hit) return hit;
  }
  if (kind && KIND_ICON[kind]) return KIND_ICON[kind];
  return <LayoutGrid size={15} />;
}
