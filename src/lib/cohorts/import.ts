import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCohortByNumber,
  findCohortByNumber,
  type GradeLevel,
} from "@/lib/cohorts/active";

export async function resolveImportTarget(
  supabase: SupabaseClient,
  cohortInput: string,
): Promise<{ cohortId: string; cohortNumber: number; grade: GradeLevel | null; error?: string }> {
  const cohortNumber = Number.parseInt(cohortInput.trim(), 10);
  if (!Number.isFinite(cohortNumber) || cohortNumber < 1) {
    return { cohortId: "", cohortNumber: 0, grade: null, error: "מספר מחזור לא תקין" };
  }

  let cohort = await findCohortByNumber(supabase, cohortNumber);
  if (!cohort) {
    try {
      cohort = await createCohortByNumber(supabase, cohortNumber);
    } catch (e) {
      return { cohortId: "", cohortNumber, grade: null, error: (e as Error).message };
    }
  }

  return {
    cohortId: cohort.id,
    cohortNumber,
    grade: cohort.grade_level,
  };
}
