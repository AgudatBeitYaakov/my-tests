/** שמות קבצים קבועים לייצוא/ייבוא שנה — זיהוי לפי basename בלי סיומת */

export type YearDataKind =
  | "classes"
  | "specializations"
  | "tracks"
  | "teachers"
  | "students"
  | "assignments";

/** סדר ייבוא חובה: לוקאפים → מורות → תלמידות → שיבוצים */
export const YEAR_DATA_IMPORT_ORDER: YearDataKind[] = [
  "classes",
  "specializations",
  "tracks",
  "teachers",
  "students",
  "assignments",
];

export const YEAR_DATA_FILE_NAMES: Record<
  YearDataKind,
  { primary: string; aliases: string[]; sheetName: string; label: string }
> = {
  classes: {
    primary: "כיתות.xlsx",
    aliases: ["classes.xlsx", "כיתות.xlsx"],
    sheetName: "כיתות",
    label: "כיתות",
  },
  specializations: {
    primary: "התמחויות.xlsx",
    aliases: ["specializations.xlsx", "התמחויות.xlsx"],
    sheetName: "התמחויות",
    label: "התמחויות",
  },
  tracks: {
    primary: "מסלולים.xlsx",
    aliases: ["tracks.xlsx", "מסלולים.xlsx"],
    sheetName: "מסלולים",
    label: "מסלולים",
  },
  teachers: {
    primary: "מורות.xlsx",
    aliases: ["teachers.xlsx", "מורות.xlsx"],
    sheetName: "מורות",
    label: "מורות",
  },
  students: {
    primary: "תלמידות.xlsx",
    aliases: ["students.xlsx", "תלמידות.xlsx"],
    sheetName: "תלמידות",
    label: "תלמידות",
  },
  assignments: {
    primary: "שיבוצים.xlsx",
    aliases: ["assignments.xlsx", "שיבוצים.xlsx", "שיבוצי-מורות.xlsx"],
    sheetName: "שיבוצים",
    label: "שיבוצים",
  },
};

export function normalizeYearDataFileName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").trim().toLowerCase();
  return base;
}

export function matchYearDataKind(fileName: string): YearDataKind | null {
  const n = normalizeYearDataFileName(fileName);
  for (const kind of YEAR_DATA_IMPORT_ORDER) {
    const meta = YEAR_DATA_FILE_NAMES[kind];
    if (meta.aliases.some((a) => a.toLowerCase() === n)) return kind;
  }
  return null;
}
