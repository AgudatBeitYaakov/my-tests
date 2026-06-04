/** מחלקות עכבר מותאמות — אייקונים ב־public/cursors, מוגדרים ב־globals.css */
export const interactiveCursor = {
  student: "cursor-entity-student",
  exam: "cursor-entity-exam",
  note: "cursor-entity-note",
  edit: "cursor-entity-edit",
  nav: "cursor-entity-nav",
  teacher: "cursor-entity-teacher",
  makeup: "cursor-entity-makeup",
  tracking: "cursor-entity-tracking",
  calendar: "cursor-entity-calendar",
  assignment: "cursor-entity-assignment",
  settings: "cursor-entity-settings",
  delete: "cursor-entity-delete",
  add: "cursor-entity-add",
  export: "cursor-entity-export",
  import: "cursor-entity-import",
  check: "cursor-entity-check",
} as const;

/** עכבר לפי נתיב קישור */
export function cursorClassForHref(href: string): string {
  if (href.includes("/import")) return interactiveCursor.import;
  if (href.startsWith("/students")) return interactiveCursor.student;
  if (href.startsWith("/teachers")) {
    return href.includes("/edit") || href.endsWith("/new")
      ? interactiveCursor.edit
      : interactiveCursor.teacher;
  }
  if (href.startsWith("/exams")) {
    return href.includes("/edit") || href.endsWith("/new")
      ? interactiveCursor.edit
      : interactiveCursor.exam;
  }
  if (href.startsWith("/makeups")) return interactiveCursor.makeup;
  if (href.startsWith("/tracking")) return interactiveCursor.tracking;
  if (href.startsWith("/calendar")) return interactiveCursor.calendar;
  if (href.startsWith("/assignments")) return interactiveCursor.assignment;
  if (href.startsWith("/settings") || href.startsWith("/archive")) return interactiveCursor.settings;
  if (href.startsWith("/notifications")) return interactiveCursor.nav;
  if (href.startsWith("/dashboard") || href === "/") return interactiveCursor.nav;
  if (href.includes("/edit")) return interactiveCursor.edit;
  return interactiveCursor.nav;
}

/** עכבר לתוצאת חיפוש (סוג בעברית + נתיב) */
export function cursorClassForSearchResult(type: string, href: string): string {
  if (type.includes("תלמיד")) return interactiveCursor.student;
  if (type.includes("מורה")) return interactiveCursor.teacher;
  if (type.includes("מבחן")) return interactiveCursor.exam;
  return cursorClassForHref(href);
}
