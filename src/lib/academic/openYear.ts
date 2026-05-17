import type { SupabaseClient } from "@supabase/supabase-js";
import { setAcademicYearCookie } from "@/lib/academic/year";
import { findCohortByLabel, createCohortByLabel } from "@/lib/cohorts/db";
import { loadYearCohortConfig } from "@/lib/academic/yearCohorts";

export type OpenYearInput = {
  name: string;
  cohortAName: string;
  cohortBName: string;
};

export type OpenYearResult = {
  yearId: string;
  yearName: string;
  cohortAName: string;
  cohortBName: string;
};

export async function openAcademicYear(
  supabase: SupabaseClient,
  input: OpenYearInput,
): Promise<{ result?: OpenYearResult; error?: string }> {
  const name = input.name.trim();
  const cohortAName = input.cohortAName.trim();
  const cohortBName = input.cohortBName.trim();

  if (!name || !cohortAName || !cohortBName) {
    return { error: "חובה שם שנה, מחזור שכבה א׳ ומחזור שכבה ב׳" };
  }
  if (cohortAName === cohortBName) {
    return { error: "אותו מחזור לא יכול להיות גם בשכבה א׳ וגם בשכבה ב׳" };
  }

  const { data: existing } = await supabase.from("academic_years").select("id").eq("name", name).maybeSingle();
  if (existing) return { error: "שנת לימודים כבר קיימת — בחרי שם אחר" };

  let cohortA = await findCohortByLabel(supabase, cohortAName);
  if (!cohortA) cohortA = await createCohortByLabel(supabase, cohortAName);

  let cohortB = await findCohortByLabel(supabase, cohortBName);
  if (!cohortB) cohortB = await createCohortByLabel(supabase, cohortBName);

  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);

  const probe = await supabase.from("academic_years").select("cohort_a_id").limit(1);
  const useColumns = !(
    probe.error?.message?.includes("cohort_a_id") && probe.error.message.includes("does not exist")
  );

  const { data: created, error: insErr } = await supabase
    .from("academic_years")
    .insert(
      useColumns
        ? { name, is_active: true, cohort_a_id: cohortA.id, cohort_b_id: cohortB.id }
        : { name, is_active: true },
    )
    .select("id, name")
    .single();

  if (insErr || !created) return { error: insErr?.message ?? "שגיאה ביצירת שנה" };

  const yearId = created.id as string;

  if (!useColumns) {
    const { error: placeErr } = await supabase.from("cohort_year_placements").insert([
      { academic_year_id: yearId, cohort_id: cohortA.id, grade_level: "A" },
      { academic_year_id: yearId, cohort_id: cohortB.id, grade_level: "B" },
    ]);
    if (placeErr) {
      return {
        error: `${placeErr.message} — הריצי ב-Supabase את supabase/migrations/0004_year_architecture_refactor.sql`,
      };
    }
  }
  await setAcademicYearCookie(yearId);

  const cfg = await loadYearCohortConfig(supabase, yearId);
  if (!cfg?.cohort_a_id || !cfg?.cohort_b_id) {
    return { error: "השנה נוצרה אך חסרים מחזורי א׳/ב׳" };
  }

  return {
    result: {
      yearId,
      yearName: name,
      cohortAName,
      cohortBName,
    },
  };
}
