import { NextResponse } from "next/server";
import { formatGradeLabel } from "@/lib/academicYears/labels";
import { listGradeOptions } from "@/lib/academicYears/options";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { previewScopedDeletesDetailed } from "@/lib/scope/bulkDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  const grades = await listGradeOptions(supabase, scope.year.id);
  const { preview, byGrade } = await previewScopedDeletesDetailed(supabase, scope.year.id, grades);

  const lines = byGrade.map((c) => {
    const parts = [
      c.students ? `${c.students} תלמידות` : null,
      c.exams ? `${c.exams} מבחנים` : null,
      c.assignments ? `${c.assignments} שיבוצים` : null,
    ].filter(Boolean);
    return `${formatGradeLabel(c.grade_level)}: ${parts.join(", ") || "אין רשומות"}`;
  });

  return NextResponse.json({
    preview,
    byGrade,
    grades,
    readOnly: scope.readOnly,
    academicYear: scope.year,
    summaryText: lines.join("\n"),
  });
}
