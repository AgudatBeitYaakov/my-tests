import type { SupabaseClient } from "@supabase/supabase-js";

export type CohortRow = {
  id: string;
  name?: string;
  cohort_number?: number;
};

type CohortNameColumn = "name" | "cohort_number";

let cachedNameColumn: CohortNameColumn | null = null;

/** תואם גם לפני הרצת migration 0003 (cohort_number) וגם אחריה (name) */
export async function getCohortNameColumn(supabase: SupabaseClient): Promise<CohortNameColumn> {
  if (cachedNameColumn) return cachedNameColumn;
  const probe = await supabase.from("cohorts").select("name").limit(1);
  if (probe.error?.message?.includes("name") && probe.error.message.includes("does not exist")) {
    cachedNameColumn = "cohort_number";
  } else {
    cachedNameColumn = "name";
  }
  return cachedNameColumn;
}

export function cohortLabelFromRow(row: CohortRow | null | undefined): string {
  if (!row) return "";
  if (row.name != null && String(row.name).trim()) return String(row.name).trim();
  if (row.cohort_number != null) return String(row.cohort_number);
  return "";
}

export async function listCohorts(supabase: SupabaseClient) {
  const col = await getCohortNameColumn(supabase);
  const select = col === "name" ? "id, name, created_at" : "id, cohort_number, created_at";
  const { data, error } = await supabase.from("cohorts").select(select).order(col, { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as CohortRow;
    return { id: row.id, name: cohortLabelFromRow(row) };
  });
}

export async function findCohortByLabel(supabase: SupabaseClient, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const col = await getCohortNameColumn(supabase);
  if (col === "name") {
    const { data, error } = await supabase.from("cohorts").select("id, name").eq("name", trimmed).maybeSingle();
    if (error) throw new Error(error.message);
    return data as CohortRow | null;
  }
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num)) return null;
  const { data, error } = await supabase
    .from("cohorts")
    .select("id, cohort_number")
    .eq("cohort_number", num)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CohortRow | null;
}

export async function createCohortByLabel(supabase: SupabaseClient, label: string) {
  const trimmed = label.trim();
  const col = await getCohortNameColumn(supabase);
  if (col === "name") {
    const { data, error } = await supabase.from("cohorts").insert({ name: trimmed }).select("id, name").single();
    if (error) throw new Error(error.message);
    return data as CohortRow;
  }
  const num = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(num)) throw new Error("מספר מחזור לא תקין");
  const { data, error } = await supabase
    .from("cohorts")
    .insert({ cohort_number: num })
    .select("id, cohort_number")
    .single();
  if (error) throw new Error(error.message);
  return data as CohortRow;
}

export async function buildStudentWithLookupsSelect(supabase: SupabaseClient): Promise<string> {
  const col = await getCohortNameColumn(supabase);
  const cohortField = col === "name" ? "name" : "cohort_number";
  return `
  *,
  cohorts ( id, ${cohortField} ),
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;
}

export async function buildCohortPlacementSelect(supabase: SupabaseClient): Promise<string> {
  const col = await getCohortNameColumn(supabase);
  const cohortField = col === "name" ? "name" : "cohort_number";
  return `id, cohort_id, grade_level, cohorts(${cohortField})`;
}
