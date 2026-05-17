import type { SupabaseClient } from "@supabase/supabase-js";
import { cohortLabel } from "@/lib/cohorts/active";
import type { CohortRow, GradeLevel } from "@/lib/cohorts/types";

export type { GradeLevel };

export function formatCohortGradeLabel(grade: GradeLevel | null | undefined): string {
  return grade ?? "—";
}

export type StudentCohortRef = {
  cohort_id: string;
  cohorts?: CohortRow | null;
};

export function enrichStudentsWithGrade<T extends StudentCohortRef>(
  students: T[],
): (T & { grade_level: GradeLevel | null; cohort_name: string | null })[] {
  return students.map((s) => ({
    ...s,
    grade_level: (s.cohorts?.grade_level as GradeLevel | null) ?? null,
    cohort_name: s.cohorts ? cohortLabel(s.cohorts) : null,
  }));
}

export async function enrichStudentsWithGradeForYear<T extends StudentCohortRef>(
  _supabase: SupabaseClient,
  students: T[],
  _academicYearId?: string,
): Promise<(T & { grade_level: GradeLevel | null; cohort_name: string | null })[]> {
  return enrichStudentsWithGrade(students);
}
