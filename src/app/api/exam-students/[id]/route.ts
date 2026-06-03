import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { ExamStudentStatus } from "@/lib/types/db";
import {
  assertExamNotLocked,
  assertValidExamStudentStatusTransition,
} from "@/lib/validations/exams";
import { applyExamStudentStatusChange } from "@/lib/exams/applyStatusChange";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    status?: ExamStudentStatus;
    from_student_card?: boolean;
    force?: boolean;
  };
  const status = body.status;
  const fromStudentCard = Boolean(body.from_student_card);
  const force = Boolean(body.force);

  if (!status || !["took", "missing", "pending", "makeup", "completed"].includes(status)) {
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }
  const user = await getCurrentUser(supabase);

  const transition = await assertValidExamStudentStatusTransition(supabase, id, status);
  if (!transition.ok) return NextResponse.json({ error: transition.error }, { status: 400 });

  const { data: row, error: gErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, student_id, status")
    .eq("id", id)
    .single();

  if (gErr || !row) return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });

  const { data: examRow } = await supabase
    .from("exams")
    .select("academic_year_id")
    .eq("id", row.exam_id as string)
    .maybeSingle();
  const examYearId = examRow?.academic_year_id as string | undefined;
  if (examYearId && examYearId !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  // בדיקת נעילה — אפשר לעקוף מ-"כרטיס תלמידה" או מ-"force" (תיקון טעות מפורש)
  if (!fromStudentCard && !force) {
    const locked = await assertExamNotLocked(supabase, row.exam_id as string);
    if (!locked.ok) return NextResponse.json({ error: locked.error }, { status: 400 });
  }

  const result = await applyExamStudentStatusChange(supabase, id, status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { data: updated, error: fetchErr } = await supabase
    .from("exam_students")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam_student",
    entityId: id,
    actionType: "status_change",
    entityNameSnapshot: `סטטוס ${result.newStatus}`,
    oldValue: { status: result.previousStatus },
    newValue: { status: result.newStatus },
  });

  return NextResponse.json({
    exam_student: updated,
    side_effects: {
      previous_status: result.previousStatus,
      new_status: result.newStatus,
      deleted_makeups: result.deletedMakeups,
      deleted_tracking: result.deletedTracking,
      upserted_makeup: result.upsertedMakeup,
      unlocked_exam: result.unlockedExam,
    },
  });
}
