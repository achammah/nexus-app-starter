#!/usr/bin/env node
/* MCP server over the app's CONFIG + DATA — point an AI assistant at your data model.
   Read-only by design: five tools wrapping the same /api the UI uses. Zero-dep,
   newline-delimited JSON-RPC over stdio (the MCP stdio transport).

   Claude Code:     claude mcp add my-app -- node scripts/mcp-server.mjs
   Claude Desktop:  { "mcpServers": { "my-app": {
                       "command": "node",
                       "args": ["<abs path>/scripts/mcp-server.mjs"],
                       "env": { "NX_APP_URL": "http://localhost:4000" } } } }
   The app must be running (npm run serve). NX_APP_URL overrides the target. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfgFile = process.env.CONFIG_PATH || "starter.config.json";
const CONFIG = JSON.parse(readFileSync(path.isAbsolute(cfgFile) ? cfgFile : path.join(ROOT, cfgFile), "utf8"));
const BASE = process.env.NX_APP_URL || "http://localhost:4000";

const entityNames = CONFIG.objects.map((o) => o.key);

const TOOLS = [
  {
    name: "list_entities",
    description: `List the record types this app manages (with labels, view kinds, and row counts). App: ${CONFIG.app.name}.`,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "describe_entity",
    description: "Full schema of one entity: fields (type, options, relations, enrichment primitives), stage field, permissions block.",
    inputSchema: {
      type: "object",
      properties: { entity: { type: "string", enum: entityNames } },
      required: ["entity"],
      additionalProperties: false,
    },
  },
  {
    name: "query_records",
    description: "Search/filter an entity's rows. q matches any field; filterField+filterValue matches one field exactly.",
    inputSchema: {
      type: "object",
      properties: {
        entity: { type: "string", enum: entityNames },
        q: { type: "string" },
        filterField: { type: "string" },
        filterValue: { type: "string" },
        limit: { type: "number" },
      },
      required: ["entity"],
      additionalProperties: false,
    },
  },
  {
    name: "get_record",
    description: "One record by id, with its full field values.",
    inputSchema: {
      type: "object",
      properties: { entity: { type: "string", enum: entityNames }, id: { type: "string" } },
      required: ["entity", "id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_timeline",
    description: "A record's activity timeline (creation, edits, notes, calls/emails/meetings, files).",
    inputSchema: {
      type: "object",
      properties: { entity: { type: "string", enum: entityNames }, id: { type: "string" } },
      required: ["entity", "id"],
      additionalProperties: false,
    },
  },
];

async function get(pathname) {
  const res = await fetch(BASE + pathname, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${pathname} → ${res.status} (is the app running at ${BASE}?)`);
  return res.json();
}

async function callTool(name, args = {}) {
  if (name === "list_entities") {
    const out = [];
    for (const o of CONFIG.objects) {
      let count = null;
      try { count = (await get(`/api/objects/${o.key}`)).rows.length; } catch { /* app down → schema only */ }
      out.push({ key: o.key, label: o.label, defaultView: o.defaultView, stageField: o.stageField ?? null, rows: count });
    }
    return out;
  }
  const cfg = CONFIG.objects.find((o) => o.key === args.entity);
  if (!cfg) throw new Error(`unknown entity ${args.entity} (have: ${entityNames.join(", ")})`);
  if (name === "describe_entity") return cfg;
  if (name === "query_records") {
    const qs = new URLSearchParams();
    if (args.q) qs.set("q", args.q);
    if (args.filterField && args.filterValue !== undefined) {
      qs.set("filterField", args.filterField);
      qs.set("filterValue", String(args.filterValue));
    }
    const rows = (await get(`/api/objects/${cfg.key}?${qs}`)).rows;
    return rows.slice(0, Number(args.limit) > 0 ? Number(args.limit) : 50);
  }
  if (name === "get_record") return get(`/api/objects/${cfg.key}/${args.id}`);
  if (name === "get_timeline") return (await get(`/api/objects/${cfg.key}/${args.id}/timeline`)).events;
  throw new Error(`unknown tool ${name}`);
}

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const fail = (id, message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n");

createInterface({ input: process.stdin }).on("line", async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: `${CONFIG.app.slug}-mcp`, version: "1.0.0" },
      });
    } else if (method === "tools/list") {
      reply(id, { tools: TOOLS });
    } else if (method === "tools/call") {
      const result = await callTool(params.name, params.arguments);
      reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } else if (id !== undefined) {
      // unknown request → empty result keeps clients happy; notifications need nothing
      reply(id, {});
    }
  } catch (e) {
    if (id !== undefined) fail(id, String(e.message ?? e));
  }
});
