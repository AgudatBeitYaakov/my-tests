import { NextResponse } from "next/server";
import { loadCohortConfig } from "@/lib/cohorts/active";
import { resolveImportTarget } from "@/lib/cohorts/import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PlanBody = {
  cohort_number?: string | number;
  valid_count?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as PlanBody;
  const cohortInput = String(body.cohort_number ?? "").trim();
  const validCount = Number(body.valid_count ?? 0);

  if (!cohortInput) {
    return NextResponse.json({ error: "חובה לבחור מחזור" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const target = await resolveImportTarget(supabase, cohortInput);
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 });

  const cfg = await loadCohortConfig(supabase);

  return NextResponse.json({
    plan: {
      cohortNumber: target.cohortNumber,
      cohortAName: cfg?.cohortAName ?? null,
      cohortBName: cfg?.cohortBName ?? null,
      targetGrade: target.grade,
      willImportCount: validCount,
    },
  });
}
