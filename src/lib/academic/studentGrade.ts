import { formatGradeLabel } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";

export type { GradeLevel };

export function formatCohortGradeLabel(grade: GradeLevel | null | undefined): string {
  return formatGradeLabel(grade);
}

export type StudentGradeRef = {
  grade_level: GradeLevel;
};

/** @deprecated use StudentGradeRef */
export type StudentYearRef = StudentGradeRef;

export function enrichStudentsWithGrade<T extends StudentGradeRef>(
  students: T[],
): (T & { grade_level: GradeLevel; year_label: string })[] {
  return students.map((s) => ({
    ...s,
    grade_level: s.grade_level,
    year_label: formatGradeLabel(s.grade_level),
  }));
}
