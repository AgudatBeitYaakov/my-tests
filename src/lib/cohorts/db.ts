import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cohortLabel,
  createCohortByNumber,
  findCohortByNumber,
  listCohortsForFilter,
  loadCurrentCohorts,
  openNewCohort,
  gradeForStudent,
} from "@/lib/cohorts/active";

export {
  type CohortRow,
  type CurrentCohorts,
  type GradeLevel,
  cohortLabel,
  cohortLabel as cohortLabelFromRow,
  createCohortByNumber,
  findCohortByNumber,
  listCohortsForFilter,
  loadCurrentCohorts,
  openNewCohort,
  gradeForStudent,
} from "@/lib/cohorts/active";

export async function listCohorts(supabase: SupabaseClient) {
  const rows = await listCohortsForFilter(supabase, true);
  return rows.map((r) => ({ id: r.id, name: cohortLabel(r) }));
}

export async function findCohortByLabel(supabase: SupabaseClient, label: string) {
  const num = Number.parseInt(label.trim(), 10);
  if (!Number.isFinite(num)) return null;
  return findCohortByNumber(supabase, num);
}

export async function createCohortByLabel(supabase: SupabaseClient, label: string) {
  const num = Number.parseInt(label.trim(), 10);
  if (!Number.isFinite(num)) throw new Error("מספר מחזור לא תקין");
  return createCohortByNumber(supabase, num);
}

export const STUDENT_WITH_LOOKUPS = `
  *,
  cohorts ( id, name, number, grade_level, is_current, is_archived ),
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;

export async function getStudentWithLookupsSelect() {
  return STUDENT_WITH_LOOKUPS;
}
