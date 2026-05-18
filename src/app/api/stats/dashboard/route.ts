import { NextResponse } from "next/server";
import { listGradeOptions } from "@/lib/academicYears/options";
import { GRADE_LEVELS } from "@/lib/academicYears/types";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  const yearId = scope.year.id;
  const today = todayISODate();
  const grades = await listGradeOptions(supabase, yearId);

  const [
    examsTotal,
    examsToday,
    examsUpcoming,
    makeupsOpen,
    studentsTotal,
    trackingTodo,
  ] = await Promise.all([
    notDeleted(supabase.from("exams").select("id", { count: "exact", head: true })).eq(
      "academic_year_id",
      yearId,
    ),
    notDeleted(supabase.from("exams").select("id", { count: "exact", head: true }))
      .eq("academic_year_id", yearId)
      .eq("exam_date", today),
    notDeleted(supabase.from("exams").select("id", { count: "exact", head: true }))
      .eq("academic_year_id", yearId)
      .gte("exam_date", today),
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open"),
    notDeleted(supabase.from("students").select("id", { count: "exact", head: true })).eq(
      "academic_year_id",
      yearId,
    ),
    notDeleted(supabase.from("exam_tracking").select("id", { count: "exact", head: true })).or(
      "grades_submitted.eq.false,transferred_to_system.eq.false",
    ),
  ]);

  for (const r of [examsTotal, examsToday, examsUpcoming, makeupsOpen, studentsTotal, trackingTodo]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const { count: studentsInMakeup } = await supabase
    .from("exam_students")
    .select("id", { count: "exact", head: true })
    .in("status", ["makeup", "missing"]);

  const byGrade = await Promise.all(
    GRADE_LEVELS.map(async (grade) => {
      const [st, ex] = await Promise.all([
        notDeleted(supabase.from("students").select("id", { count: "exact", head: true }))
          .eq("academic_year_id", yearId)
          .eq("grade_level", grade),
        notDeleted(supabase.from("exams").select("id", { count: "exact", head: true }))
          .eq("academic_year_id", yearId)
          .eq("grade_level", grade),
      ]);
      return {
        grade_level: grade,
        students: st.count ?? 0,
        exams: ex.count ?? 0,
      };
    }),
  );

  return NextResponse.json({
    examsTotal: examsTotal.count ?? 0,
    examsToday: examsToday.count ?? 0,
    examsUpcoming: examsUpcoming.count ?? 0,
    makeupsOpen: makeupsOpen.count ?? 0,
    studentsTotal: studentsTotal.count ?? 0,
    studentsInMakeup: studentsInMakeup ?? 0,
    trackingTodo: trackingTodo.count ?? 0,
    byGrade,
    grades,
    readOnly: scope.readOnly,
    academicYear: scope.year,
  });
}
