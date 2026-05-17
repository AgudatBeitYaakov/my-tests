import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cohortLabel, loadCurrentCohorts } from "@/lib/cohorts/active";
import { shouldShowArchivedCohorts } from "@/lib/cohorts/server";
import { ARCHIVED_COHORTS_COOKIE } from "@/lib/cohorts/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { cohortA, cohortB } = await loadCurrentCohorts(supabase);
  const showArchived = await shouldShowArchivedCohorts();
  return NextResponse.json({
    cohortA: cohortA
      ? { id: cohortA.id, name: cohortLabel(cohortA), grade_level: cohortA.grade_level }
      : null,
    cohortB: cohortB
      ? { id: cohortB.id, name: cohortLabel(cohortB), grade_level: cohortB.grade_level }
      : null,
    showArchived,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { show_archived?: boolean };
  const store = await cookies();
  if (body.show_archived) {
    store.set(ARCHIVED_COHORTS_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  } else {
    store.delete(ARCHIVED_COHORTS_COOKIE);
  }
  return GET();
}
