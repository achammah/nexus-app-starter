/* i18n scaffold — every NEW string is born here (UI copy lives in dicts; record
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
    "import.open": "Import",
    "import.title": "Import {label} from CSV",
    "import.back": "Back",
    "import.next": "Next",
    "import.run": "Import {n} rows",
    "import.cancel": "Cancel",
    "import.close": "Close",
    "import.summary": "{created} created · {restored} restored · {skipped} skipped · {failed} failed",
    "import.failedCsv": "Download failed rows (CSV)",
    "dup.open": "Find duplicates",
    "dup.title": "Possible duplicates — {label}",
    "dup.none": "No duplicates found.",
    "dup.review": "Review merge",
    "dup.panelTitle": "Possible duplicates",
    "wizard.landingTitle": "New {label}",
    "wizard.landingHint": "Answer a few quick questions and we'll fill it in, or start from a blank draft.",
    "wizard.guided": "Guided",
    "wizard.guidedDesc": "Answer a few questions and we'll fill in the fields.",
    "wizard.blank": "Blank",
    "wizard.blankDesc": "Start from an empty {label} and fill it in yourself.",
    "wizard.complete": "Create {label}",
    "tasks.new": "New task",
    "tasks.titlePlaceholder": "What needs doing?",
    "tasks.create": "Create",
    "tasks.add": "Add",
    "tasks.none": "No tasks yet.",
    "tasks.deleted": "(deleted)",
    "tasks.bucket.overdue": "Overdue",
    "tasks.bucket.today": "Today",
    "tasks.bucket.week": "This week",
    "tasks.bucket.later": "Later",
    "tasks.bucket.done": "Done",
    "sync.now": "Sync",
    "sync.tip": "Pull in external updates",
    "sync.applied": "synced {n}",
    "sync.upToDate": "up to date",
    "sync.failed": "Sync failed",
    "gen.action": "Generate {label}",
    "gen.working": "Generating…",
    "gen.stalled": "Taking longer than usual…",
    "gen.ready": "{label} ready",
    "kit.views.label": "record views",
    "kit.views.gallery": "Gallery view — cover-card masonry (Showcase demo)",
    "kit.views.calendar": "Calendar view: every FullCalendar mode, event CRUD, recurring (Sessions demo, navigate to Aug 2026)",
    "kit.views.form": "Form view — config-driven intake (People › Form tab)",
    "panel.search": "Search",
    "panel.actions": "Actions",
    "panel.searchRecords": "Search records",
    "panel.searchPlaceholder": "Search records…",
    "panel.empty": "No matches.",
    "views.notInstalled": "view type “{type}” is not installed",
    "kit.sheetTitle": "sheet view (spreadsheet grid)",
    "kit.sheetBlurb": "Excel-grade bulk editing over any object: fill-handle, range select, copy/paste, frozen first column. Give an object a grid view entry and the switcher grows a Sheet tab.",
    "kit.sheetOpen": "Open the Sheet demo",
    "kit.workbookTitle": "spreadsheet (full workbook)",
    "kit.workbookBlurb": "A full Excel-grade workbook as a standalone page: a formula bar with 400+ functions, insert rows and columns, cell formatting, multiple sheets, freeze and merge. Powered by Univer, themed to your tokens, loaded as a lazy chunk.",
    "kit.workbookOpen": "Open the Spreadsheet",
    "page.spreadsheet.title": "Spreadsheet",
    "page.spreadsheet.loading": "Loading spreadsheet…",
    "page.spreadsheet.saving": "Saving…",
    "page.spreadsheet.saved": "Saved",
    "page.spreadsheet.reset": "Reset demo",
    "page.spreadsheet.clear": "Clear",
    "page.spreadsheet.emptyTitle": "No workbook yet",
    "page.spreadsheet.emptyBody": "Create a workbook to start with formulas, formatting, and multiple sheets.",
    "page.spreadsheet.create": "Create a workbook",
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
