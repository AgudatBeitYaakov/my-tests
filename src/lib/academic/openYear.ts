import type { SupabaseClient } from "@supabase/supabase-js";
import { openNewCohort } from "@/lib/cohorts/active";

export async function openAcademicYear(
  supabase: SupabaseClient,
  params: { name?: string; newCohortNumber: number },
) {
  return openNewCohort(supabase, params.newCohortNumber);
}
