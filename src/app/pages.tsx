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

export const customPages: PageDef[] = [];
