/* Deterministic seed — realistic FICTIONAL data (never real orgs/people), stable
   across boots so journeys can assert on known rows. */

const COMPANIES = [
  ["Brightline Analytics", "brightline.example", "Software", 140, "Ghent"],
  ["Nordwind Retail", "nordwind.example", "Retail", 900, "Antwerp"],
  ["Cargolane", "cargolane.example", "Logistics", 320, "Rotterdam"],
  ["Veldkliniek Group", "veldkliniek.example", "Health", 210, "Leuven"],
  ["Meridian Capital", "meridian.example", "Finance", 75, "Brussels"],
  ["Pixelforge Studio", "pixelforge.example", "Software", 28, "Lille"],
  ["GreenCrate Foods", "greencrate.example", "Retail", 460, "Utrecht"],
  ["Tidal Freight", "tidalfreight.example", "Logistics", 150, "Hamburg"],
];

const PEOPLE = [
  ["Maya Verstraete", "maya@brightline.example", "CTO", "Brightline Analytics"],
  ["Jonas Peeters", "jonas@nordwind.example", "Ops Director", "Nordwind Retail"],
  ["Lena Dubois", "lena@cargolane.example", "Head of Fleet", "Cargolane"],
  ["Karim El Amrani", "karim@veldkliniek.example", "CIO", "Veldkliniek Group"],
  ["Sofia Marchetti", "sofia@meridian.example", "Partner", "Meridian Capital"],
  ["Tom Janssens", "tom@pixelforge.example", "Founder", "Pixelforge Studio"],
  ["Anouk de Vries", "anouk@greencrate.example", "Buying Lead", "GreenCrate Foods"],
  ["Erik Lindqvist", "erik@tidalfreight.example", "COO", "Tidal Freight"],
];

const DEALS = [
  ["Brightline platform rollout", "Qualified", 48000, "Brightline Analytics", "you", "2026-08-14"],
  ["Nordwind store copilot", "New", 32000, "Nordwind Retail", "you", "2026-09-01"],
  ["Cargolane dispatch automation", "Proposal", 76000, "Cargolane", "you", "2026-08-05"],
  ["Veldkliniek intake agent", "New", 21000, "Veldkliniek Group", "you", "2026-09-18"],
  ["Meridian research assistant", "Won", 54000, "Meridian Capital", "you", "2026-06-30"],
  ["Pixelforge support bot", "Qualified", 12000, "Pixelforge Studio", "you", "2026-08-22"],
  ["GreenCrate supplier portal", "Proposal", 39000, "GreenCrate Foods", "you", "2026-08-29"],
  ["Tidal customs copilot", "Lost", 18000, "Tidal Freight", "you", "2026-07-02"],
];

export function seed() {
  const t0 = Date.parse("2026-07-01T09:00:00Z");
  const rows = { companies: [], people: [], deals: [] };
  const events = { companies: {}, people: {}, deals: {} };
  const ev = (obj, id, i, kind, summary) => {
    (events[obj][id] ??= []).push({ id: `sev_${obj}_${id}_${i}`, ts: new Date(t0 + i * 36e5).toISOString(), kind, summary, actor: "seed" });
  };

  COMPANIES.forEach(([name, domain, industry, employees, city], i) => {
    const id = `co_${i + 1}`;
    rows.companies.push({ id, name, domain, industry, employees, city });
    ev("companies", id, i, "created", "Company created");
  });
  PEOPLE.forEach(([name, email, role, company], i) => {
    const id = `pe_${i + 1}`;
    rows.people.push({ id, name, email, role, company });
    ev("people", id, i, "created", "Person created");
  });
  DEALS.forEach(([name, stage, amount, company, owner, closeDate], i) => {
    const id = `de_${i + 1}`;
    rows.deals.push({ id, name, stage, amount, company, owner, closeDate });
    ev("deals", id, i, "created", "Deal created");
    ev("deals", id, i + 20, "stage", `Stage set to ${stage}`);
  });

  return { rows, events };
}
