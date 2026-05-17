import { NextResponse } from "next/server";
import { resolveImportTarget } from "@/lib/academic/yearCohorts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PlanBody = {
  academic_year_name?: string;
  cohort_name?: string;
  valid_count?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as PlanBody;
  const academicYearName = (body.academic_year_name ?? "").trim();
  const cohortName = (body.cohort_name ?? "").trim();
  const validCount = Number(body.valid_count ?? 0);

  if (!academicYearName || !cohortName) {
    return NextResponse.json({ error: "חובה שנת לימודים ומחזור" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const target = await resolveImportTarget(supabase, academicYearName, cohortName);
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 });

  return NextResponse.json({
    plan: {
      academicYearName,
      cohortName,
      targetGrade: target.grade,
      cohortAName: target.year.cohort_a_name,
      cohortBName: target.year.cohort_b_name,
      willImportCount: validCount,
    },
  });
}
