import { NextResponse } from "next/server";
import { loadCohortConfig } from "@/lib/cohorts/active";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** @deprecated Use /api/cohorts/current */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = createSupabaseAdminClient();
    const cfg = await loadCohortConfig(supabase);
    return NextResponse.json({
      years: [],
      current: cfg
        ? {
            cohort_a_name: cfg.cohortAName,
            cohort_b_name: cfg.cohortBName,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, years: [] }, { status: 500 });
  }
}

export async function POST() {
  await requireCurrentUser();
  return NextResponse.json(
    { error: "לפתיחת שנתון חדש השתמשי במסך «פתיחת שנתון»" },
    { status: 400 },
  );
}
