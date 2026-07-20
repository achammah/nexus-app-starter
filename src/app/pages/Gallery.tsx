import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Check, Copy, Moon, Paintbrush, RotateCcw, Sun } from "lucide-react";
import catalog from "../gallery.catalog.json";
import uiVersionRaw from "../../ui/.ui-version?raw";
import { skinToCss, type Skin } from "../../ui/skins/skin";
import { skinPresets } from "../../ui/skins/presets";
import { useToast } from "../App";
import { Button } from "../../ui/primitives/Button";
import { Input, Badge, Micro, Checkbox, Tip } from "../../ui/primitives/fields";
import { Dialog } from "../../ui/primitives/overlays";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/components/ui/accordion";
import { Calendar } from "../../ui/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/components/ui/chart";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/components/ui/sheet";
import { DataTable, formatCell } from "../../ui/record-core/DataTable";
import { KanbanBoard } from "../../ui/record-core/KanbanBoard";
import { RecordPage } from "../../ui/record-core/RecordPage";
import type { FieldType, ObjectConfig, RecordRow, TimelineEvent } from "../../ui/record-core/types";
import { Wizard, ModalOverlay, ChipListInput, SourcesInput, type Ans, type Q, type Sources } from "../../ui/blocks/wizard";

/* Gallery — the component catalog as a LIVE page: primitives, a curated
   vendored subset, the full inventory (committed snapshot of the library's
   catalog.json — the footer compares its stamp against src/ui/.ui-version and
   turns into a warning when they diverge), record-core in miniature on LOCAL
   rows (never /api), every field type's read + edit states, and a skin bar
   that repaints it all instantly.

   Skin previews deliberately do NOT use applySkin(): applySkin caches to
   localStorage("nx-skin-css") for pre-paint injection on the next boot, which
   would make a preview sticky and clobber the Theme page's state. The preview
   compiles the same engine's skinToCss() into a separate #nx-skin-preview tag
   (re-appended last in <head>, so it wins the cascade) and removes it on
   reset AND on unmount — nothing persists, the app skin is never displaced. */

const PREVIEW_TAG = "nx-skin-preview";
function setPreviewSkin(skin: Skin | null) {
  let el = document.getElementById(PREVIEW_TAG) as HTMLStyleElement | null;
  if (!skin) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = PREVIEW_TAG;
  }
  document.head.appendChild(el); // (re-)append LAST — must sit after #nx-skin
  el.textContent = skinToCss(skin);
}

/* ---- fictional local data (this page works on an empty app) ---- */

const MINI_CONFIG: ObjectConfig = {
  key: "g_deals",
  label: "Demo deals",
  labelOne: "Demo deal",
  defaultView: "table",
  stageField: "stage",
  fields: [
    { key: "name", label: "Name", type: "text", primary: true },
    { key: "stage", label: "Stage", type: "select", options: ["Open", "Won"] },
    { key: "amount", label: "Amount", type: "currency" },
    { key: "owner", label: "Owner", type: "text" },
  ],
} as ObjectConfig;

const MINI_ROWS: RecordRow[] = [
  { id: "gd_1", name: "Harbor expansion", stage: "Open", amount: 18000, owner: "Maya" },
  { id: "gd_2", name: "Skyline renewal", stage: "Won", amount: 32000, owner: "Jonas" },
  { id: "gd_3", name: "Delta onboarding", stage: "Open", amount: 9000, owner: "Ines" },
  { id: "gd_4", name: "Quartz rollout", stage: "Won", amount: 41000, owner: "Maya" },
];

/* every FieldType with a fictional value — READ renders via formatCell, EDIT
   via the mini RecordPage below (its config carries the same list) */
const FIELD_SAMPLES: { type: FieldType; label: string; value: unknown; options?: string[]; relation?: string; scale?: number }[] = [
  { type: "text", label: "Text", value: "Northwind Analytics" },
  { type: "longText", label: "Long text", value: "A paragraph-sized note about the account, wrapping freely." },
  { type: "number", label: "Number", value: 42 },
  { type: "currency", label: "Currency", value: 12500 },
  { type: "money", label: "Money", value: { amount: 12500, code: "EUR" } },
  { type: "boolean", label: "Boolean", value: true },
  { type: "rating", label: "Rating", value: 4, scale: 5 },
  { type: "select", label: "Select", value: "Growth", options: ["Seed", "Growth", "Scale"] },
  { type: "multiselect", label: "Multiselect", value: ["Champion", "Technical"], options: ["Champion", "Technical", "Finance"] },
  { type: "array", label: "Array (tags)", value: ["priority", "emea"] },
  { type: "date", label: "Date", value: "2026-08-14" },
  { type: "dateTime", label: "Date-time", value: "2026-08-14T09:30:00.000Z" },
  { type: "email", label: "Email", value: "maya@northwind.example" },
  { type: "emails", label: "Emails (list)", value: ["maya@northwind.example", "ops@northwind.example"] },
  { type: "phones", label: "Phones (list)", value: ["+32 470 12 34 56"] },
  { type: "url", label: "URL", value: "https://northwind.example" },
  { type: "links", label: "Links (list)", value: ["https://northwind.example/docs"] },
  { type: "user", label: "User", value: "Maya Verstraete" },
  { type: "relation", label: "Relation", value: "Acme Industries", relation: "g_orgs" },
  { type: "fullName", label: "Full name", value: { first: "Maya", last: "Verstraete" } },
  { type: "address", label: "Address", value: { street: "12 Quai des Péniches", city: "Brussels" } },
  { type: "json", label: "JSON", value: { plan: "growth", seats: 12 } },
];

const FIELDS_CONFIG: ObjectConfig = {
  key: "g_profile",
  label: "Field showcase",
  labelOne: "Profile",
  defaultView: "table",
  fields: FIELD_SAMPLES.map((s, i) => ({
    key: `f${i}_${s.type}`,
    label: s.label,
    type: s.type,
    ...(i === 0 ? { primary: true } : {}),
    ...(s.options ? { options: s.options } : {}),
    ...(s.relation ? { relation: s.relation } : {}),
    ...(s.scale ? { scale: s.scale } : {}),
  })),
} as ObjectConfig;

const FIELDS_ROW: RecordRow = Object.fromEntries([
  ["id", "gp_1"],
  ...FIELD_SAMPLES.map((s, i) => [`f${i}_${s.type}`, s.value]),
]) as RecordRow;

/* wizard demo — a small fictional brief (never the blog's QUESTIONS/compile) */
const WIZARD_QUESTIONS: Q[] = [
  { key: "kind", label: "What are we drafting?", hint: "Picks the shape of the output.", kind: "select", options: ["Announcement", "How-to guide", "Release note"], required: true },
  { key: "ask", label: "What's the ask?", hint: "The topic, in your words.", kind: "text", placeholder: "e.g. Launch the v2 API", required: true },
  { key: "audience", label: "Extra context", hint: "Optional — anything the drafter should know.", kind: "long", placeholder: "e.g. Keep it under 200 words" },
  { key: "tags", label: "Tags", hint: "Add each as its own chip.", kind: "list", placeholder: "e.g. api", suggest: ["api", "beta", "internal"] },
  { key: "sources", label: "Source material", hint: "Links or docs the drafter should read.", kind: "sources" },
];

const chartData = [
  { month: "Feb", won: 32 }, { month: "Mar", won: 41 }, { month: "Apr", won: 38 },
  { month: "May", won: 56 }, { month: "Jun", won: 49 }, { month: "Jul", won: 64 },
];
const chartConfig = { won: { label: "Deals won", color: "var(--chart-1)" } } satisfies ChartConfig;

const SECTIONS = [
  { id: "gallery-primitives", label: "Primitives" },
  { id: "gallery-shadcn", label: "Vendored kit" },
  { id: "gallery-inventory", label: "Inventory" },
  { id: "gallery-recordcore", label: "Record core" },
  { id: "gallery-fields", label: "Field types" },
  { id: "gallery-wizard", label: "Wizard" },
];

function Section({ id, title, importPath, children }: { id: string; title: string; importPath: string; children: React.ReactNode }) {
  const toast = useToast();
  return (
    <section className="nxCard" id={id} data-testid={id} style={{ padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Micro>{title}</Micro>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          data-testid={`${id}-import`}
          title="Copy import path"
          onClick={() => navigator.clipboard?.writeText(importPath).then(() => toast("Import path copied")).catch(() => {})}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-s)", background: "var(--nx-bg-sunken)", padding: "2px 8px", cursor: "pointer", font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}
        >
          <code>{importPath}</code> <Copy size={11} />
        </button>
      </div>
      {children}
    </section>
  );
}

export function GalleryPage() {
  const toast = useToast();
  const [previewName, setPreviewName] = React.useState<string | null>(null);
  const [miniRows, setMiniRows] = React.useState<RecordRow[]>(MINI_ROWS);
  const [miniSelection, setMiniSelection] = React.useState<Record<string, boolean>>({});
  const [fieldsRow, setFieldsRow] = React.useState<RecordRow>(FIELDS_ROW);
  const [fieldsTimeline, setFieldsTimeline] = React.useState<TimelineEvent[]>([
    { id: "gtl_1", ts: "2026-07-18T10:00:00.000Z", kind: "created", summary: "Created", actor: "you" } as TimelineEvent,
  ]);
  const [wizardModalOpen, setWizardModalOpen] = React.useState(false);
  const [wizardCompleting, setWizardCompleting] = React.useState(false);
  const [wizardBlankBusy, setWizardBlankBusy] = React.useState(false);
  const [chipDemo, setChipDemo] = React.useState<string[]>(["priority"]);
  const [sourcesDemo, setSourcesDemo] = React.useState<Sources>({ urls: [], docs: [] });

  const completeWizard = (answers: Ans) => {
    setWizardCompleting(true);
    setTimeout(() => {
      setWizardCompleting(false);
      setWizardModalOpen(false);
      toast(`Drafting "${String(answers.ask ?? "untitled")}" (local sandbox)`);
    }, 400);
  };
  const startBlank = () => {
    setWizardBlankBusy(true);
    setTimeout(() => {
      setWizardBlankBusy(false);
      setWizardModalOpen(false);
      toast("Blank draft started (local sandbox)");
    }, 400);
  };

  // leaving the page can never leak a preview: unmount removes the tag
  React.useEffect(() => () => setPreviewSkin(null), []);

  const pickSkin = (name: string) => {
    setPreviewName(name);
    setPreviewSkin(skinPresets[name]);
  };
  const resetSkin = () => {
    setPreviewName(null);
    setPreviewSkin(null);
  };
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("nx-theme", next);
  };

  const stale = catalog.uiVersion !== uiVersionRaw.trim();
  const patchLocal = (id: string, patch: Record<string, unknown>) =>
    setMiniRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="nxCard" data-testid="gallery-skins" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 5 }}>
        <Micro>Skin</Micro>
        {Object.keys(skinPresets).map((name) => (
          <Button key={name} size="sm" variant={previewName === name ? "primary" : "secondary"} icon={previewName === name ? <Check size={12} /> : <Paintbrush size={12} />} data-testid={`gallery-skin-${name}`} onClick={() => pickSkin(name)}>
            {name}
          </Button>
        ))}
        <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} data-testid="gallery-skin-reset" onClick={resetSkin}>
          App skin
        </Button>
        <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-faint)" }}>
          Previews only — nothing persists; leaving the page resets.
        </span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" data-testid="gallery-theme-toggle" onClick={toggleTheme} icon={<span style={{ display: "inline-flex" }}><Sun size={13} className="sunIcon" /></span>} aria-label="Toggle light/dark">
          <Moon size={13} />
        </Button>
        <span data-testid="gallery-toc" style={{ display: "inline-flex", gap: 4 }}>
          {SECTIONS.map((s) => (
            <Button key={s.id} size="sm" variant="ghost" data-testid={`gallery-toc-${s.id}`} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {s.label}
            </Button>
          ))}
        </span>
      </div>

      <Section id="gallery-primitives" title="Primitives — the house APIs" importPath="src/ui/primitives/{Button,fields,overlays}.tsx">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm" busy>Busy</Button>
          <Button variant="secondary" size="sm" icon={<Paintbrush size={12} />}>With icon</Button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Input placeholder="Input" style={{ maxWidth: 180 }} />
          <Input placeholder="Invalid input" invalid style={{ maxWidth: 180 }} />
          <Badge>neutral</Badge>
          <Badge tone="accent" dot>accent</Badge>
          <Badge tone="ok">ok</Badge>
          <Badge tone="warn">warn</Badge>
          <Badge tone="danger">danger</Badge>
          <Micro>Micro eyebrow</Micro>
          <Checkbox checked onCheckedChange={() => {}} />
          <Tip label="A tooltip via the Tip wrapper">
            <Button size="sm" variant="ghost">Hover me</Button>
          </Tip>
        </div>
      </Section>

      <Section id="gallery-shadcn" title="Vendored kit — curated live subset" importPath="src/ui/components/ui/*.tsx">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>dialog · sheet · dropdown</Micro>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <GalleryDialog />
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="secondary" data-testid="gallery-sheet-open">Sheet</Button>
                </SheetTrigger>
                <SheetContent data-testid="gallery-sheet">
                  <SheetHeader>
                    <SheetTitle>Side panel</SheetTitle>
                    <SheetDescription>The ZOOM step without leaving the list.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" data-testid="gallery-dropdown-open">Dropdown</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => toast("Edited")}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast("Duplicated")}>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast("Archived")}>Archive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Micro>command</Micro>
            <Command style={{ border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-m)" }} data-testid="gallery-command">
              <CommandInput placeholder="Type to filter…" />
              <CommandList style={{ maxHeight: 140 }}>
                <CommandEmpty>No match.</CommandEmpty>
                <CommandGroup heading="Records">
                  {["Northwind Analytics", "Aurora Freight", "Meridian Supply"].map((n) => (
                    <CommandItem key={n} onSelect={() => toast(`Picked ${n}`)}>{n}</CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>calendar</Micro>
            <Calendar mode="single" month={new Date(2026, 6, 1)} selected={new Date(2026, 6, 15)} data-testid="gallery-calendar" />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>accordion</Micro>
            <Accordion type="single" collapsible data-testid="gallery-accordion">
              <AccordionItem value="a">
                <AccordionTrigger>What repaints on a skin switch?</AccordionTrigger>
                <AccordionContent>Everything — the vendored kit reads the same tokens through the shadcn bridge.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Where do house opinions live?</AccordionTrigger>
                <AccordionContent>In src/ui/primitives wrappers — never in edits to the vendored files.</AccordionContent>
              </AccordionItem>
            </Accordion>
            <Micro>chart</Micro>
            <ChartContainer config={chartConfig} style={{ minHeight: 120 }} data-testid="gallery-chart">
              <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="won" type="natural" fill="var(--chart-1)" fillOpacity={0.25} stroke="var(--chart-1)" />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </Section>

      <Section id="gallery-inventory" title={`Inventory — all ${catalog.count} library entries`} importPath="src/ui (see each row)">
        <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-s)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", font: "var(--nx-text-meta)" }}>
            <thead>
              <tr style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--nx-bg-raised)" }}>
                <th style={{ padding: "6px 10px" }}>Component</th>
                <th style={{ padding: "6px 10px" }}>Kind</th>
                <th style={{ padding: "6px 10px" }}>Import</th>
                <th style={{ padding: "6px 10px" }}>When to use</th>
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((it) => (
                <tr key={it.name} style={{ borderTop: "1px solid var(--nx-border)", verticalAlign: "top" }}>
                  <td style={{ padding: "5px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{it.name}</td>
                  <td style={{ padding: "5px 10px" }}><Badge>{it.kind}</Badge></td>
                  <td style={{ padding: "5px 10px" }}>
                    <button
                      type="button"
                      title="Copy import path"
                      onClick={() => navigator.clipboard?.writeText(it.import).then(() => toast("Import path copied")).catch(() => {})}
                      style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "var(--nx-fg-muted)", textAlign: "left" }}
                    >
                      <code>{it.import}</code>
                    </button>
                  </td>
                  <td style={{ padding: "5px 10px", color: "var(--nx-fg-muted)" }}>{it.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          data-testid="gallery-inventory-stamp"
          data-stale={String(stale)}
          style={stale
            ? { font: "var(--nx-text-meta)", color: "var(--nx-warn)", background: "var(--nx-warn-soft)", padding: "6px 10px", borderRadius: "var(--nx-radius-s)" }
            : { font: "var(--nx-text-meta)", color: "var(--nx-fg-faint)" }}
        >
          {stale
            ? `Snapshot is STALE: src/ui is at "${uiVersionRaw.trim()}" but this inventory was captured at "${catalog.uiVersion}" — refresh src/app/gallery.catalog.json from nexus-ui docs/catalog.json.`
            : `Inventory snapshot: vendored ${catalog.vendoredAt.slice(0, 10)} · ${catalog.uiVersion} (matches the live src/ui copy).`}
        </div>
      </Section>

      <Section id="gallery-recordcore" title="Record core in miniature — local rows, no /api" importPath="src/ui/record-core/{DataTable,KanbanBoard}.tsx">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Micro>DataTable — the keyboard grid is live (↑↓/jk · x · Enter · type-to-edit)</Micro>
            <DataTable
              config={MINI_CONFIG}
              rows={miniRows}
              onOpen={() => toast("Local sandbox — rows have no record page")}
              onPeek={() => toast("Local sandbox — rows have no record page")}
              onPatch={patchLocal}
              selection={miniSelection}
              onSelectionChange={setMiniSelection}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Micro>KanbanBoard — two columns from the select field</Micro>
            <KanbanBoard
              config={MINI_CONFIG}
              rows={miniRows}
              onPatch={patchLocal}
              onOpen={() => toast("Local sandbox — rows have no record page")}
              groupField="stage"
            />
          </div>
        </div>
      </Section>

      <Section id="gallery-fields" title="Every field type — read + edit states" importPath="src/ui/record-core/types.ts (FieldType)">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <Micro>Read state — formatCell per type</Micro>
            <div style={{ border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-s)", overflow: "hidden" }}>
              {FIELD_SAMPLES.map((s) => (
                <div key={s.type} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, padding: "5px 10px", borderTop: "1px solid var(--nx-border)", font: "var(--nx-text-meta)" }}>
                  <code>{s.type}</code>
                  <span>{formatCell(s.value, s.type) || "—"}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <Micro>Edit state — a RecordPage frame over the same types (local, incl. composites)</Micro>
            <div style={{ border: "1px solid var(--nx-border)", borderRadius: "var(--nx-radius-m)", padding: 8, maxHeight: 560, overflow: "auto" }}>
              <RecordPage
                config={FIELDS_CONFIG}
                row={fieldsRow}
                timeline={fieldsTimeline}
                onBack={() => {}}
                relationOptions={{ [FIELDS_CONFIG.fields.find((f) => f.type === "relation")?.key ?? ""]: ["Acme Industries", "Globex", "Initech"] }}
                userOptions={["Maya Verstraete", "Jonas Peeters", "Ines Laurent"]}
                onPatch={(_, patch) => {
                  setFieldsRow((r) => ({ ...r, ...patch }));
                  toast("Saved locally");
                }}
                onAddNote={(text) => {
                  setFieldsTimeline((tl) => [
                    { id: `gtl_${tl.length + 1}`, ts: new Date().toISOString(), kind: "note", summary: text, actor: "you" } as TimelineEvent,
                    ...tl,
                  ]);
                }}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section id="gallery-wizard" title="Wizard — config-driven multi-step block" importPath="src/ui/blocks/wizard">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>Wizard + ModalOverlay — guided-vs-blank landing, 5 kinds, review, complete</Micro>
            <Button size="sm" variant="secondary" data-testid="gallery-wizard-open" onClick={() => setWizardModalOpen(true)}>
              Open wizard
            </Button>
            {wizardModalOpen && (
              <ModalOverlay testId="gallery-wizard-modal" label="Wizard demo" onClose={() => setWizardModalOpen(false)}>
                <Wizard
                  title="Draft builder"
                  completeLabel="Generate draft"
                  completing={wizardCompleting}
                  landing={{
                    eyebrow: "New draft",
                    title: "How do you want to start?",
                    hint: "Answer a few questions, or start from a blank draft.",
                    guidedLabel: "Guided draft",
                    guidedDesc: "A short brief (kind, ask, tags, sources), then generate.",
                    blankLabel: wizardBlankBusy ? "Creating…" : "Blank draft",
                    blankDesc: "Skip the brief and start empty.",
                    blankBusy: wizardBlankBusy,
                    onBlank: startBlank,
                  }}
                  questions={WIZARD_QUESTIONS}
                  onComplete={completeWizard}
                />
              </ModalOverlay>
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>ChipListInput — standalone</Micro>
            <ChipListInput value={chipDemo} onChange={setChipDemo} placeholder="Add a tag…" suggestions={["priority", "emea", "champion"]} testIdPrefix="gallery-chip" />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <Micro>SourcesInput — standalone</Micro>
            <SourcesInput urls={sourcesDemo.urls} docs={sourcesDemo.docs} onChange={setSourcesDemo} testIdPrefix="gallery-src" />
          </div>
        </div>
      </Section>
    </div>
  );
}

function GalleryDialog() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" data-testid="gallery-dialog-open" onClick={() => setOpen(true)}>Dialog</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="A focused task"
        footer={<Button variant="primary" onClick={() => setOpen(false)}>Done</Button>}
      >
        <div data-testid="gallery-dialog" style={{ display: "grid", gap: 8 }}>
          The house Dialog wrapper: title + footer over the vendored dialog.
          <Input placeholder="It holds ordinary content" />
        </div>
      </Dialog>
    </>
  );
}
