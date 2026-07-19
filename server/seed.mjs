/* Config-driven seed — the CONFIG is the whole app, demo data included.
   Per object: `sampleRows` in the config wins (curated, journey-stable ids
   `<obj2char>_<n>`); absent → a deterministic typed generator fills `seedCount`
   (default 6) rows with FICTIONAL values. Relations resolve to the target object's
   primary values so link cells and pickers work out of the box. */

const FIRST = ["Maya", "Jonas", "Lena", "Karim", "Sofia", "Tom", "Anouk", "Erik", "Nadia", "Pieter", "Iris", "Marco"];
const LAST = ["Verstraete", "Peeters", "Dubois", "El Amrani", "Marchetti", "Janssens", "de Vries", "Lindqvist", "Haddad", "Bakker", "Novak", "Costa"];
const WORDS = ["Bright", "Nord", "Cargo", "Veld", "Meridian", "Pixel", "Green", "Tidal", "Atlas", "Silver", "Cedar", "Quartz"];
const CITY = ["Ghent", "Antwerp", "Rotterdam", "Leuven", "Brussels", "Lille", "Utrecht", "Hamburg"];

function typedValue(field, i, rowsByObject) {
  switch (field.type) {
    case "select":
      return field.options?.[i % (field.options.length || 1)] ?? "";
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
        const row = { id, ...r };
        row.__primary = String(row[primary.key] ?? id);
        out.push(row);
      });
    } else {
      const n = obj.seedCount ?? 6;
      for (let i = 0; i < n; i++) {
        const id = `${obj.key.slice(0, 2)}_${i + 1}`;
        const row = { id };
        for (const f of obj.fields) row[f.key] = typedValue(f, i, rows);
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
