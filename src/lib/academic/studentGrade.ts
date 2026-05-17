import type { SupabaseClient } from "@supabase/supabase-js";
import { cohortLabelFromRow, type CohortRow } from "@/lib/cohorts/db";
import {
  buildGradeMapFromYear,
  gradeForCohortInYear,
  loadYearCohortConfig,
  type CohortGrade,
  type YearCohortConfig,
} from "@/lib/academic/yearCohorts";

export type { CohortGrade };

export type StudentCohortRef = {
  cohort_id: string | null;
};

export function getStudentGradeLevel(
  student: StudentCohortRef,
  year: Pick<YearCohortConfig, "cohort_a_id" | "cohort_b_id">,
): CohortGrade | null {
  return gradeForCohortInYear(student.cohort_id, year);
}

export async function loadGradeMapForYear(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<Map<string, CohortGrade>> {
  const year = await loadYearCohortConfig(supabase, academicYearId);
  if (!year) return new Map();
  return buildGradeMapFromYear(year);
}

export function enrichStudentsWithGrade<T extends StudentCohortRef & { cohorts?: CohortRow | null }>(
  students: T[],
  year: Pick<YearCohortConfig, "cohort_a_id" | "cohort_b_id">,
): (T & { computed_grade_level: CohortGrade | null; cohort_name: string | null })[] {
  return students.map((s) => ({
    ...s,
    computed_grade_level: getStudentGradeLevel(s, year),
    cohort_name: cohortLabelFromRow(s.cohorts) || null,
  }));
}

export async function enrichStudentsWithGradeForYear<T extends StudentCohortRef & { cohorts?: CohortRow | null }>(
  supabase: SupabaseClient,
  students: T[],
  academicYearId: string,
): Promise<(T & { computed_grade_level: CohortGrade | null; cohort_name: string | null })[]> {
  const year = await loadYearCohortConfig(supabase, academicYearId);
  if (!year) return students.map((s) => ({ ...s, computed_grade_level: null, cohort_name: cohortLabelFromRow(s.cohorts) || null }));
  return enrichStudentsWithGrade(students, year);
}

export function formatCohortGradeLabel(grade: CohortGrade | null | undefined): string {
  if (!grade) return "—";
  return grade;
}
