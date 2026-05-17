import type { SupabaseClient } from "@supabase/supabase-js";
import type { CohortRow, CurrentCohorts, GradeLevel, YearCohortConfig } from "@/lib/cohorts/types";

export type { CohortRow, CurrentCohorts, GradeLevel, YearCohortConfig } from "@/lib/cohorts/types";
export { ARCHIVED_COHORTS_COOKIE } from "@/lib/cohorts/types";

export function cohortLabel(c: Pick<CohortRow, "name" | "number">): string {
  if (c.name?.trim()) return c.name.trim();
  if (c.number != null) return String(c.number);
  return "";
}

export async function activeCohortIds(supabase: SupabaseClient): Promise<string[]> {
  const { cohortA, cohortB } = await loadCurrentCohorts(supabase);
  return [cohortA?.id, cohortB?.id].filter(Boolean) as string[];
}

export async function loadCurrentCohorts(supabase: SupabaseClient): Promise<CurrentCohorts> {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, number, grade_level, is_current, is_archived")
    .eq("is_current", true)
    .order("grade_level", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CohortRow[];
  const cohortA = rows.find((r) => r.grade_level === "א") ?? null;
  const cohortB = rows.find((r) => r.grade_level === "ב") ?? null;
  return { cohortA, cohortB };
}

export async function listCohortsForFilter(
  supabase: SupabaseClient,
  includeArchived: boolean,
): Promise<CohortRow[]> {
  let q = supabase
    .from("cohorts")
    .select("id, name, number, grade_level, is_current, is_archived")
    .order("number", { ascending: false });
  if (!includeArchived) q = q.eq("is_current", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as CohortRow[];
}

export async function findCohortByNumber(supabase: SupabaseClient, num: number) {
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, name, number, grade_level, is_current, is_archived")
    .eq("number", num)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CohortRow | null;
}

export async function createCohortByNumber(supabase: SupabaseClient, num: number, name?: string) {
  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      number: num,
      name: name ?? String(num),
      is_current: false,
      is_archived: false,
    })
    .select("id, name, number, grade_level, is_current, is_archived")
    .single();
  if (error) throw new Error(error.message);
  return data as CohortRow;
}

export async function openNewCohort(
  supabase: SupabaseClient,
  newCohortNumber: number,
): Promise<{
  result?: { cohortAName: string; cohortBName: string; archivedName: string | null };
  error?: string;
}> {
  if (!Number.isFinite(newCohortNumber) || newCohortNumber < 1) {
    return { error: "מספר שנתון לא תקין" };
  }

  const current = await loadCurrentCohorts(supabase);
  const prevA = current.cohortA;
  const prevB = current.cohortB;

  let newCohort = await findCohortByNumber(supabase, newCohortNumber);
  if (!newCohort) newCohort = await createCohortByNumber(supabase, newCohortNumber);

  if (prevB?.id) {
    const { error } = await supabase
      .from("cohorts")
      .update({ is_current: false, is_archived: true, grade_level: null })
      .eq("id", prevB.id);
    if (error) return { error: error.message };
  }

  if (prevA?.id) {
    const { error } = await supabase
      .from("cohorts")
      .update({ grade_level: "ב" as GradeLevel, is_current: true, is_archived: false })
      .eq("id", prevA.id);
    if (error) return { error: error.message };
  }

  const { error: newErr } = await supabase
    .from("cohorts")
    .update({ grade_level: "א" as GradeLevel, is_current: true, is_archived: false })
    .eq("id", newCohort.id);
  if (newErr) return { error: newErr.message };

  return {
    result: {
      cohortAName: cohortLabel(newCohort),
      cohortBName: prevA ? cohortLabel(prevA) : "—",
      archivedName: prevB ? cohortLabel(prevB) : null,
    },
  };
}

export function gradeForStudent(cohortId: string, current: CurrentCohorts): GradeLevel | null {
  if (current.cohortA?.id === cohortId) return "א";
  if (current.cohortB?.id === cohortId) return "ב";
  return null;
}

export async function loadCohortConfig(supabase: SupabaseClient): Promise<YearCohortConfig | null> {
  const { cohortA, cohortB } = await loadCurrentCohorts(supabase);
  if (!cohortA && !cohortB) return null;
  const cohortToGrade = new Map<string, GradeLevel>();
  if (cohortA?.id) cohortToGrade.set(cohortA.id, "א");
  if (cohortB?.id) cohortToGrade.set(cohortB.id, "ב");
  return {
    cohortAId: cohortA?.id ?? null,
    cohortBId: cohortB?.id ?? null,
    cohortAName: cohortA ? cohortLabel(cohortA) : "",
    cohortBName: cohortB ? cohortLabel(cohortB) : "",
    cohortToGrade,
  };
}

export function gradeForCohortInYear(
  cohortId: string,
  cfg: Pick<YearCohortConfig, "cohortToGrade">,
): GradeLevel | null {
  return cfg.cohortToGrade.get(cohortId) ?? null;
}
