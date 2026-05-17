import { NextResponse } from "next/server";
import { openNewCohort } from "@/lib/cohorts/active";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireCurrentUser();
  const body = (await request.json()) as { new_cohort_number?: string | number };
  const newCohortNumber = Number.parseInt(String(body.new_cohort_number ?? ""), 10);

  const supabase = createSupabaseAdminClient();
  const { result, error } = await openNewCohort(supabase, newCohortNumber);

  if (error || !result) return NextResponse.json({ error: error ?? "שגיאה" }, { status: 400 });
  return NextResponse.json({ ok: true, result });
}
