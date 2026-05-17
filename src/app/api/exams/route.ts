import { NextResponse } from "next/server";
import { loadCurrentCohorts } from "@/lib/cohorts/active";
import { shouldShowArchivedCohorts } from "@/lib/cohorts/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { assertTeacherAssignmentMatchesExam, fetchStudentIdsForTarget } from "@/lib/exams/logic";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { assertNoDuplicateExam } from "@/lib/validations/exams";
import type { ExamTargetType } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohort_id")?.trim();
  const includeArchived =
    searchParams.get("include_archived") === "1" || (await shouldShowArchivedCohorts());

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("exams")
    .select("*, teachers(name), cohorts(id, name, number, grade_level)")
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (cohortId) {
    query = query.eq("cohort_id", cohortId);
  } else if (!includeArchived) {
    const current = await loadCurrentCohorts(supabase);
    const ids = [current.cohortA?.id, current.cohortB?.id].filter(Boolean) as string[];
    if (ids.length) query = query.in("cohort_id", ids);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const exams = data ?? [];
  const labels = await resolveExamTargetLabels(
    supabase,
    exams.map((e) => ({
      id: (e as { id: string }).id,
      target_type: (e as { target_type: ExamTargetType }).target_type,
      target_id: (e as { target_id: string }).target_id,
    })),
  );

  const enriched = exams.map((e) => {
    const row = e as { id: string };
    return { ...e, target_label: labels[row.id] ?? row.id };
  });

  return NextResponse.json({ exams: enriched, includeArchived });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    target_type?: ExamTargetType;
    target_id?: string;
    cohort_id?: string;
  };

  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const exam_date = (body.exam_date ?? "").trim();
  const target_type = body.target_type;
  const target_id = (body.target_id ?? "").trim();
  let cohort_id = (body.cohort_id ?? "").trim();

  if (!teacher_id || !subject || !exam_date || !target_type || !target_id) {
    return NextResponse.json({ error: "כל השדות חובה" }, { status: 400 });
  }
  if (!["class", "specialization", "track"].includes(target_type)) {
    return NextResponse.json({ error: "סוג יעד לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const user = await getCurrentUser(supabase);

  if (!cohort_id) {
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("cohort_id")
      .eq("teacher_id", teacher_id)
      .eq("subject", subject)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    cohort_id = (assignment?.cohort_id as string) ?? "";
  }

  if (!cohort_id) {
    return NextResponse.json({ error: "לא נמצא שנתון לשיבוץ — בחרי שנתון או צרי שיבוץ" }, { status: 400 });
  }

  const dup = await assertNoDuplicateExam(supabase, {
    cohortId: cohort_id,
    teacherId: teacher_id,
    subject,
    targetType: target_type,
    targetId: target_id,
    examDate: exam_date,
  });
  if (!dup.ok) return NextResponse.json({ error: dup.error }, { status: 400 });

  const check = await assertTeacherAssignmentMatchesExam(
    supabase,
    teacher_id,
    subject,
    target_type,
    target_id,
    cohort_id,
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForTarget(
    supabase,
    target_type,
    target_id,
    cohort_id,
  );
  if (stErr) return NextResponse.json({ error: stErr }, { status: 500 });
  if (!studentIds.length) {
    return NextResponse.json({ error: "לא נמצאו תלמידות לפי היעד ושנתון שנבחרו" }, { status: 400 });
  }

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .insert({
      teacher_id,
      subject,
      exam_date,
      target_type,
      target_id,
      cohort_id,
    })
    .select("*")
    .single();

  if (eErr || !exam) {
    return NextResponse.json({ error: eErr?.message ?? "שגיאה ביצירת מבחן" }, { status: 400 });
  }

  const examId = exam.id as string;

  const { error: trErr } = await supabase.from("exam_tracking").insert({
    exam_id: examId,
    teacher_id,
  });
  if (trErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return NextResponse.json({ error: trErr.message }, { status: 400 });
  }

  const rows = studentIds.map((student_id) => ({
    exam_id: examId,
    student_id,
    status: "pending" as const,
  }));

  const { error: esErr } = await supabase.from("exam_students").insert(rows);
  if (esErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return NextResponse.json({ error: esErr.message }, { status: 400 });
  }

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam",
    entityId: examId,
    actionType: "create",
    newValue: { teacher_id, subject, exam_date, target_type, target_id, cohort_id },
  });

  return NextResponse.json({ exam, students_count: studentIds.length });
}
