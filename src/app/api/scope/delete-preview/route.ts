import { NextResponse } from "next/server";
import { pairApiPayload } from "@/lib/cohorts/apiPayload";
import { previewScopedDeletesDetailed } from "@/lib/scope/bulkDelete";
import { resolveSelectedCohortPair, selectedCohortIdList } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const pair = await resolveSelectedCohortPair(supabase);
  const cohortIds = await selectedCohortIdList(supabase);
  const { preview, byCohort } = await previewScopedDeletesDetailed(supabase, cohortIds);

  const lines = byCohort.map((c) => {
    const parts = [
      c.students ? `${c.students} תלמידות` : null,
      c.exams ? `${c.exams} מבחנים` : null,
      c.assignments ? `${c.assignments} שיבוצים` : null,
    ].filter(Boolean);
    return `מחזור ${c.cohortNumber}: ${parts.join(", ") || "אין רשומות"}`;
  });

  return NextResponse.json({
    cohortIds,
    pair: pair ? pairApiPayload(pair) : null,
    preview,
    byCohort,
    summaryText: lines.join("\n"),
  });
}
