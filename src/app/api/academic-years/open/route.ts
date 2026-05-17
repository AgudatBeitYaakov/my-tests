import { NextResponse } from "next/server";
import { openAcademicYear } from "@/lib/academic/openYear";
import { requireAdmin } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireAdmin();
  const body = (await request.json()) as {
    name?: string;
    cohort_a_name?: string;
    cohort_b_name?: string;
  };

  const supabase = createSupabaseAdminClient();
  const { result, error } = await openAcademicYear(supabase, {
    name: body.name ?? "",
    cohortAName: body.cohort_a_name ?? "",
    cohortBName: body.cohort_b_name ?? "",
  });

  if (error || !result) return NextResponse.json({ error: error ?? "שגיאה" }, { status: 400 });
  return NextResponse.json({ ok: true, year: result });
}
