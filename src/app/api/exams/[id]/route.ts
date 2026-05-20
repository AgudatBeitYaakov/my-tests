import { NextResponse } from "next/server";
import { rowToMultiTarget } from "@/lib/assignments/multiTarget";
import {
  EXAM_HARD_DELETE_PHRASE,
  hardDeleteExam,
  previewExamHardDelete,
} from "@/lib/exams/deleteExam";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .select("*, teachers ( id, first_name, last_name, full_name_generated )")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (eErr || !exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });

  const row = exam as { id: string };
  const labels = await resolveExamTargetLabels(supabase, [
    { id: row.id, ...rowToMultiTarget(exam) },
  ]);
  const examEnriched = { ...exam, target_label: labels[row.id] ?? "—" };
  const delete_preview = await previewExamHardDelete(supabase, id);

  const { data: lines, error: lErr } = await supabase
    .from("exam_students")
    .select("id, status, updated_at, student_id")
    .eq("exam_id", id);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const studentIds = [...new Set((lines ?? []).map((l) => l.student_id))];
  type StudentLine = {
    id: string;
    first_name: string;
    last_name: string;
    tz: string;
    is_psychology?: boolean;
    teaching_track_type?: "full" | "short" | null;
    classes?: { name: string } | { name: string }[] | null;
    tracks?: { name: string } | { name: string }[] | null;
    specializations?: { name: string } | { name: string }[] | null;
    secondary_specializations?: { name: string } | { name: string }[] | null;
  };
  let byStudent: Record<string, StudentLine> = {};

  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select(
        `id, first_name, last_name, tz, is_psychology, teaching_track_type,
        classes ( name ),
        tracks ( name ),
        specializations:specializations!students_specialization_id_fkey ( name ),
        secondary_specializations:specializations!students_secondary_specialization_id_fkey ( name )`,
      )
      .in("id", studentIds);

    for (const s of studs ?? []) {
      const r = s as StudentLine;
      byStudent[r.id] = r;
    }
  }

  const exam_students = (lines ?? [])
    .map((l) => ({
      ...l,
      students: byStudent[l.student_id] ?? null,
    }))
    .sort((a, b) => {
      const la = `${a.students?.last_name ?? ""} ${a.students?.first_name ?? ""}`;
      const lb = `${b.students?.last_name ?? ""} ${b.students?.first_name ?? ""}`;
      return la.localeCompare(lb, "he");
    });

  return NextResponse.json({ exam: examEnriched, exam_students, delete_preview });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirm_phrase?: string };
  if (body.confirm_phrase?.trim() !== EXAM_HARD_DELETE_PHRASE) {
    return NextResponse.json(
      { error: `יש להקליד בדיוק: ${EXAM_HARD_DELETE_PHRASE}` },
      { status: 400 },
    );
  }

  const { data: exam, error: loadErr } = await supabase
    .from("exams")
    .select("id, academic_year_id, subject, exam_date")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (exam.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const result = await hardDeleteExam(supabase, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
