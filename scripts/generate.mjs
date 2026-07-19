#!/usr/bin/env node
/* Living generator (`npm run generate`) — scaffolding as an ONGOING capability,
   not a one-time init. Non-interactive by design (flags only) so agents can
   invoke it headlessly. Templates for pages live in scripts/templates/*.tpl —
   edit them once and every future generate uses your version.

   npm run generate object Gadget -- --key gadgets \
     --fields "name:text:primary,status:select:Prototype|Testing|Shipped,owner:user" \
     [--seed 5] [--config starter.config.json] [--dry]
   npm run generate page Reports
   npm run generate journey my-flow -- --feature "My feature row"

   Field spec: key:type[:extra] — extra is "primary" (any type), "A|B|C" options
   (select/multiselect), or the target object key (relation). */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [kind, rawName, ...rest] = process.argv.slice(2);

const flags = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const k = rest[i].slice(2);
    const v = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
    flags[k] = v;
  }
}

function die(msg) {
  console.error(`[generate] ${msg}`);
  process.exit(1);
}
if (!kind || !rawName) die("usage: generate <object|page|journey> <Name> [--flags]");

const pascal = rawName.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
const kebab = rawName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

if (kind === "object") {
  const cfgFlag = flags.config || "starter.config.json";
  const cfgPath = path.isAbsolute(cfgFlag) ? cfgFlag : path.join(ROOT, cfgFlag);
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const key = flags.key || `${kebab}s`;
  if (cfg.objects.some((o) => o.key === key)) die(`object "${key}" already exists in ${cfgFlag}`);

  const specs = (flags.fields || "name:text:primary,stage:select:New|In progress|Done").split(",");
  const fields = specs.map((spec) => {
    const [fkey, type, extra] = spec.split(":").map((s) => s.trim());
    if (!fkey || !type) die(`bad field spec "${spec}" (key:type[:extra])`);
    const f = { key: fkey, label: fkey.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()), type };
    if (extra === "primary") f.primary = true;
    else if (extra && (type === "select" || type === "multiselect")) f.options = extra.split("|");
    else if (extra && type === "relation") f.relation = extra;
    return f;
  });
  if (!fields.some((f) => f.primary)) fields[0].primary = true;
  for (const f of fields) {
    if (f.type === "relation" && f.relation && !cfg.objects.some((o) => o.key === f.relation))
      die(`relation target "${f.relation}" not found (targets must exist before pointers)`);
  }
  const stage = fields.find((f) => f.type === "select" && f.options);
  const object = {
    key,
    label: pascal.endsWith("s") ? pascal : `${pascal}s`,
    labelOne: pascal,
    icon: "layout-grid",
    fields,
    ...(stage ? { stageField: stage.key } : {}),
    defaultView: stage ? "kanban" : "table",
    seedCount: Number(flags.seed ?? 5),
  };
  if (flags.dry) {
    console.log(JSON.stringify(object, null, 2));
    process.exit(0);
  }
  cfg.objects.push(object);
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  if (cfgFlag === "starter.config.json") {
    execFileSync("node", [path.join(ROOT, "scripts", "gen-model.mjs")], { stdio: "inherit" });
  }
  console.log(`[generate] object "${key}" → ${cfgFlag} (${fields.length} fields${stage ? `, board on ${stage.key}` : ""}, ${object.seedCount} seeded rows)`);
  console.log(`[generate] next: add a manifest row + a journey (npm run generate journey ${key}-basics -- --feature "<row>")`);
} else if (kind === "page") {
  const tplPath = path.join(ROOT, "scripts", "templates", "page.tsx.tpl");
  const outPath = path.join(ROOT, "src", "app", "pages", `${pascal}.tsx`);
  if (existsSync(outPath)) die(`${outPath} already exists`);
  const body = readFileSync(tplPath, "utf8").replaceAll("__NAME__", pascal).replaceAll("__KEY__", flags.key || kebab).replaceAll("__LABEL__", rawName);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, body);
  // auto-register at the marker
  const regPath = path.join(ROOT, "src", "app", "pages.tsx");
  const reg = readFileSync(regPath, "utf8");
  const marker = "  // generate:pages";
  if (!reg.includes(marker)) die("marker '// generate:pages' missing from src/app/pages.tsx — register manually");
  const line = `  { key: "${flags.key || kebab}", label: "${rawName}", component: ${pascal} },\n`;
  const imp = `import { ${pascal} } from "./pages/${pascal}";\n`;
  writeFileSync(regPath, imp + reg.replace(marker, line + marker));
  console.log(`[generate] page → ${outPath} + registered (#/p/${flags.key || kebab}); template: scripts/templates/page.tsx.tpl`);
} else if (kind === "journey") {
  const dir = path.join(ROOT, "journeys", "extra");
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${kebab}.mjs`);
  if (existsSync(outPath)) die(`${outPath} already exists`);
  const feature = flags.feature || `TODO feature row for ${rawName}`;
  writeFileSync(
    outPath,
    `/* Generated journey skeleton — assert VISIBLE outcomes, never bare 200s.
   The feature string must EXACTLY match a docs/feature-manifest.md row. */
export default [
  {
    name: ${JSON.stringify(kebab)}, feature: ${JSON.stringify(feature)},
    async run(page, { URLBASE, assert }) {
      await page.goto(URLBASE + "/#/");
      // TODO: drive the click path from the manifest row and assert its VISIBLE outcome
      assert(false, "journey not written yet");
    },
  },
];
`,
  );
  console.log(`[generate] journey skeleton → ${outPath} (add the matching manifest row)`);
} else {
  die(`unknown kind "${kind}" (object|page|journey)`);
}
