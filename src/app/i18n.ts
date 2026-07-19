/* i18n scaffold — every NEW string is born here (ux-canon: count defs × languages;
   DATA stays in its own language). v0 ships `en`; add a locale by adding a dict and
   the switch re-renders the active view (wire a selector when a 2nd locale lands). */

const dicts = {
  en: {
    "palette.placeholder": "Jump to a record, object, or page…",
    "palette.records": "Records",
    "palette.objects": "Objects",
    "palette.pages": "Pages",
    "palette.empty": "No matches.",
    "bulk.selected": "selected",
    "bulk.exportCsv": "Export CSV",
    "bulk.delete": "Delete",
    "bulk.confirmTitle": "Delete {n} {label}?",
    "bulk.confirmBody": "This removes the records listed below. This action cannot be undone.",
    "bulk.cancel": "Cancel",
    "bulk.confirm": "Delete records",
    "bulk.deleted": "{n} deleted",
    "bulk.exported": "{n} rows exported",
    "chat.open": "Chat with the assistant",
    "chat.title": "Assistant",
  },
} as const;

type Key = keyof (typeof dicts)["en"];
let locale: keyof typeof dicts = "en";

export function setLocale(l: keyof typeof dicts) {
  locale = l;
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = dicts[locale][key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
