import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../ui/components/ui/accordion";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "../../ui/components/ui/chart";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/components/ui/form";
import { Input } from "../../ui/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/components/ui/sheet";
import { Slider } from "../../ui/components/ui/slider";
import { Progress } from "../../ui/components/ui/progress";
import { Button } from "../../ui/primitives/Button";
import { Micro } from "../../ui/primitives/fields";
import { useToast } from "../App";
import { t } from "../i18n";

/* Kit demo — documentation by example: a LIVE page proving the pages registry and
   exercising the deeper vendored families (form+zod · chart · sheet · accordion ·
   slider→progress). Journeys assert its visible outcomes; it doubles as a visual
   regression surface for the token bridge. Delete freely in a real app. */

const schema = z.object({
  name: z.string().min(2, "Name needs at least 2 characters"),
  email: z.string().email("Enter a valid email"),
});

const chartData = [
  { month: "Feb", won: 32 }, { month: "Mar", won: 41 }, { month: "Apr", won: 38 },
  { month: "May", won: 56 }, { month: "Jun", won: 49 }, { month: "Jul", won: 64 },
];
const chartConfig = { won: { label: "Deals won", color: "var(--chart-1)" } } satisfies ChartConfig;

export function KitDemo() {
  const toast = useToast();
  const [level, setLevel] = React.useState(40);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
  });

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
      <div className="nxCard" style={{ padding: 16 }} data-testid="kit-form">
        <Micro>form + zod</Micro>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => toast(`Invited ${v.name}`))}
            style={{ display: "grid", gap: 12, marginTop: 10 }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Maya Verstraete" data-testid="kit-name" {...field} />
                  </FormControl>
                  <FormMessage data-testid="kit-name-error" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="maya@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button variant="primary" type="submit" data-testid="kit-submit">Send invite</Button>
          </form>
        </Form>
      </div>

      <div className="nxCard" style={{ padding: 16 }} data-testid="kit-chart">
        <Micro>chart (recharts on --chart-1)</Micro>
        <ChartContainer config={chartConfig} style={{ marginTop: 10, width: "100%", height: 180 }}>
          <AreaChart data={chartData} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area dataKey="won" type="monotone" fill="var(--color-won)" fillOpacity={0.25} stroke="var(--color-won)" />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="nxCard" style={{ padding: 16, display: "grid", gap: 14 }}>
        <div>
          <Micro>sheet (side panel)</Micro>
          <div style={{ marginTop: 10 }}>
            <Sheet>
              <SheetTrigger asChild>
                <Button data-testid="kit-sheet-open">Open side panel</Button>
              </SheetTrigger>
              <SheetContent data-testid="kit-sheet">
                <SheetHeader>
                  <SheetTitle>Record peek</SheetTitle>
                  <SheetDescription>
                    The ZOOM step without leaving the list — filters, previews, quick edits.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div>
          <Micro>slider → progress</Micro>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <Slider value={[level]} max={100} step={1} onValueChange={(v) => setLevel(v[0] ?? 0)} aria-label="Level" />
            <Progress value={level} data-testid="kit-progress" />
          </div>
        </div>
        <div>
          <Micro>accordion</Micro>
          <Accordion type="single" collapsible style={{ marginTop: 4 }}>
            <AccordionItem value="a">
              <AccordionTrigger data-testid="kit-acc-trigger">Why is this page here?</AccordionTrigger>
              <AccordionContent data-testid="kit-acc-content">
                Documentation by example: agents and humans see every deep family working
                against the token bridge before building with it.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div>
          <Micro>{t("kit.sheetTitle")}</Micro>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <span style={{ font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
              {t("kit.sheetBlurb")}
            </span>
            <Button data-testid="kit-sheet-open" onClick={() => (window.location.hash = "#/o/demo_sheet")}>
              {t("kit.sheetOpen")}
            </Button>
          </div>
        </div>
      </div>

      <div className="nxCard" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }} data-testid="kit-views">
        <Micro>{t("kit.views.label")}</Micro>
        <a className="nxRowLink" href="#/o/demo_showcase" data-testid="kit-views-gallery">
          {t("kit.views.gallery")}
        </a>
        <a className="nxRowLink" href="#/o/people" data-testid="kit-views-form">
          {t("kit.views.form")}
        </a>
      </div>
      {/* demo objects register HERE (hideInNav keeps the main nav clean) */}
      <div className="nxCard" style={{ padding: 16 }} data-testid="kit-map-demo">
        <Micro>map view (demo_places)</Micro>
        <p style={{ margin: "10px 0", font: "var(--nx-text-meta)", color: "var(--nx-fg-muted)" }}>
          Twelve fictional sites on the registry's map view: token pins tinted by a select
          field's option palette, record-card popups into the peek, and two records without
          coordinates proving the count chip.
        </p>
        <Button data-testid="kit-map-open" onClick={() => { location.hash = "#/o/demo_places"; }}>
          Open the map demo
        </Button>
      </div>
    </div>
  );
}
