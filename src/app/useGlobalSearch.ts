import * as React from "react";
import { api, type AppConfig } from "./api";
import { formatCell } from "../ui/record-core/DataTable";
import type { RecordRow } from "../ui/record-core/types";

/* ONE search implementation behind every search surface (top bar → ⌘K palette,
   the `/` panel search). Surfaces differ in chrome, never in what they can find:
   RECORDS across every configured object, plus the nav taxonomy (objects, pages)
   which each surface renders itself. */

export type RecordHit = { obj: string; row: RecordRow; name: string };

/** Debounced cross-object record search. `active=false` parks it (closed surface). */
export function useRecordSearch(config: AppConfig, q: string, active = true): RecordHit[] {
  const [hits, setHits] = React.useState<RecordHit[]>([]);
  const objects = config.objects;
  React.useEffect(() => {
    if (!active || q.trim().length < 2) {
      setHits([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const per = await Promise.all(
        objects.map(async (o) => {
          const primary = o.fields.find((f) => f.primary) ?? o.fields[0];
          try {
            const rows = await api.list(o.key, { q: q.trim() });
            return rows.slice(0, 5).map((row) => ({
              obj: o.key,
              row,
              name: formatCell(row[primary.key], primary.type) || String(row.id),
            }));
          } catch {
            return [];
          }
        }),
      );
      if (live) setHits(per.flat().slice(0, 12));
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, active, objects]);
  return hits;
}

/** Substring match used by the surfaces that don't get cmdk's own filtering. */
export function navMatches<T extends { label: string; key: string }>(items: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return items.filter((i) => i.label.toLowerCase().includes(s) || i.key.toLowerCase().includes(s));
}
