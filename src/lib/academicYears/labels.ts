import type { GradeLevel } from "@/lib/academicYears/types";

/** @deprecated use formatGradeLabel — year groups removed */
export function formatYearGradeLabel(_yearGroup: number | null | undefined, gradeLevel: GradeLevel): string {
  return formatGradeLabel(gradeLevel);
}

export function formatGradeLabel(gradeLevel: GradeLevel | null | undefined): string {
  return gradeLevel ? `שכבה ${gradeLevel}` : "—";
}

export function parseGradeLevel(raw: string): GradeLevel | null {
  let t = raw.trim().replace(/\s+/g, " ");
  const hebrewFromLabel = t.match(/^שכבה\s*([אבג])$/);
  if (hebrewFromLabel) t = hebrewFromLabel[1];
  if (t === "א" || t === "ב" || t === "ג") return t;
  if (t === "A" || t === "a") return "א";
  if (t === "B" || t === "b") return "ב";
  if (t === "C" || t === "c" || t === "G" || t === "g") return "ג";
  return null;
}
