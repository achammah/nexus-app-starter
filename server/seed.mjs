/* Config-driven seed — the CONFIG is the whole app, demo data included.
   Per object: `sampleRows` in the config wins (curated, journey-stable ids
   `<obj2char>_<n>`); absent → a deterministic typed generator fills `seedCount`
   (default 6) rows with FICTIONAL values. Relations resolve to the target object's
   primary values so link cells and pickers work out of the box. */

const FIRST = ["Maya", "Jonas", "Lena", "Karim", "Sofia", "Tom", "Anouk", "Erik", "Nadia", "Pieter", "Iris", "Marco"];
const LAST = ["Verstraete", "Peeters", "Dubois", "El Amrani", "Marchetti", "Janssens", "de Vries", "Lindqvist", "Haddad", "Bakker", "Novak", "Costa"];
const WORDS = ["Bright", "Nord", "Cargo", "Veld", "Meridian", "Pixel", "Green", "Tidal", "Atlas", "Silver", "Cedar", "Quartz"];
const CITY = ["Ghent", "Antwerp", "Rotterdam", "Leuven", "Brussels", "Lille", "Utrecht", "Hamburg"];

const optVal = (o) => (typeof o === "string" ? o : o.value);

/* Relative demo-date tokens — a sampleRow string value resolved at SEED TIME so a
   demo (the calendar especially) always lands on the CURRENT week, never a stale
   fixed month. Grammar: `@w<weekOffset>.<isoWeekday>[T<HH:MM>]`
     weekOffset  0 = this week, 1 = next, -1 = last (relative to today)
     isoWeekday  1 = Mon … 7 = Sun
     with a time → a floating-local ISO (a timed event, shown at that wall-clock);
     without a time → a bare day string (an all-day event).
   Anchored on the Monday of the current local week. ONLY "@"-prefixed strings are
   transformed; every other value (ids, titles, absolute dates) passes through. */
const REL_DATE_RE = /^@w(-?\d+)\.([1-7])(?:T(\d{1,2}):(\d{2}))?$/;
export function resolveRelDate(v, now = new Date()) {
  if (typeof v !== "string" || v[0] !== "@") return v;
  const m = REL_DATE_RE.exec(v.trim());
  if (!m) return v;
  const [, off, dow, hh, mm] = m;
  const isoToday = ((now.getDay() + 6) % 7) + 1; // getDay 0=Sun..6=Sat → 1=Mon..7=Sun
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (isoToday - 1));
  const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + Number(off) * 7 + (Number(dow) - 1));
  const p = (n) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return hh === undefined ? day : `${day}T${p(Number(hh))}:${mm}:00`;
}

function typedValue(field, i, rowsByObject, config) {
  switch (field.type) {
    case "select":
      return field.options?.length ? optVal(field.options[i % field.options.length]) : "";
    case "multiselect": {
      const opts = (field.options ?? []).map(optVal);
      return opts.length ? [...new Set([opts[i % opts.length], opts[(i + 1) % opts.length]])] : [];
    }
    case "boolean":
      return i % 3 !== 0;
    case "rating":
      return (i % (field.scale ?? 5)) + 1;
    case "dateTime": {
      const d = new Date(Date.UTC(2026, 6, 2 + (i % 20), 9 + (i % 8), 15 * (i % 4)));
      return d.toISOString();
    }
    case "array": {
      const pool = ["priority", "eu-region", "renewal", "expansion", "at-risk", "reference"];
      return [pool[i % pool.length], pool[(i + 2) % pool.length]];
    }
    case "longText":
      return `Working notes ${i + 1}: context gathered from the last touchpoint; follow-ups agreed and owners assigned.`;
    case "json":
      return { source: "seed", index: i };
    case "whiteboard":
      // canvases start empty — scenes are drawn, never fabricated by the seeder
      return null;
    case "user": {
      const users = config?.users ?? [];
      return users.length ? users[i % users.length] : "you";
    }
    case "number":
      return (i + 1) * 7 + 20;
    case "currency":
      return ((i % 8) + 1) * 6500;
    case "date": {
      const d = new Date(Date.UTC(2026, 6 + (i % 3), 2 + ((i * 5) % 26)));
      return d.toISOString().slice(0, 10);
    }
    case "email":
      return `${FIRST[i % FIRST.length].toLowerCase()}${i}@example.test`;
    case "url":
      return `${WORDS[i % WORDS.length].toLowerCase()}${i}.example`;
    case "relation": {
      const target = rowsByObject[field.relation ?? ""] ?? [];
      if (!target.length) return "";
      const t = target[i % target.length];
      return t.__primary ?? t.id;
    }
    default:
      return field.key.toLowerCase().includes("city")
        ? CITY[i % CITY.length]
        : `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`;
  }
}

export function seed(config) {
  const t0 = Date.parse("2026-07-01T09:00:00Z");
  const rows = {};
  const events = {};
  const ev = (obj, id, i, kind, summary) => {
    ((events[obj] ??= {})[id] ??= []).push({
      id: `sev_${obj}_${id}_${i}`,
      ts: new Date(t0 + i * 36e5).toISOString(),
      kind,
      summary,
      actor: "seed",
    });
  };

  // Two passes so relations can point at already-seeded targets (config order
  // should list relation TARGETS first; a forward relation falls back to blank).
  for (const obj of config.objects) {
    const primary = obj.fields.find((f) => f.primary) ?? obj.fields[0];
    const out = (rows[obj.key] = []);
    if (Array.isArray(obj.sampleRows) && obj.sampleRows.length) {
      obj.sampleRows.forEach((r, i) => {
        const id = r.id ?? `${obj.key.slice(0, 2)}_${i + 1}`;
        const row = { ...r, id };
        // resolve any relative demo-date tokens (@w..) so a calendar demo lands on
        // the current week; ids and non-token values pass through untouched
        for (const k of Object.keys(row)) if (k !== "id") row[k] = resolveRelDate(row[k]);
        row.__primary = String(row[primary.key] ?? id);
        out.push(row);
      });
    } else {
      const n = obj.seedCount ?? 6;
      for (let i = 0; i < n; i++) {
        const id = `${obj.key.slice(0, 2)}_${i + 1}`;
        const row = { id };
        for (const f of obj.fields) row[f.key] = typedValue(f, i, rows, config);
        row.__primary = String(row[primary.key] ?? id);
        out.push(row);
      }
    }
  }
  for (const obj of config.objects) {
    for (const [i, row] of (rows[obj.key] ?? []).entries()) {
      delete row.__primary;
      ev(obj.key, row.id, i, "created", `${obj.labelOne} created`);
      if (obj.stageField && row[obj.stageField]) {
        ev(obj.key, row.id, i + 20, "stage", `Stage set to ${row[obj.stageField]}`);
      }
    }
  }
  return { rows, events };
}
