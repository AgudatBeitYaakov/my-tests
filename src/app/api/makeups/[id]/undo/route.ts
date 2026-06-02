import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { performUndoMissingByMakeup } from "@/lib/exams/undoMissing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/makeups/[id]/undo
 *
 * ביטול טעות מהמסך "השלמות": מאתר את שורת התלמידה במבחן,
 * מוחק את ההשלמה והמעקב, ומחזיר את הסטטוס ל"נבחנה במועד".
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }
  const user = await getCurrentUser(supabase);

  const result = await performUndoMissingByMakeup(supabase, {
    makeupId: id,
    scopeYearId: scope.year.id,
  });

  if (!result.ok) {
    console.error("[POST /api/makeups/:id/undo] error:", result.error, { id });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "makeup_exam",
    entityId: id,
    actionType: "undo_missing",
    entityNameSnapshot: `ביטול השלמה (${result.previousStatus} → took)`,
    oldValue: { status: result.previousStatus },
    newValue: {
      status: "took",
      deleted_makeups: result.deletedMakeups,
      deleted_tracking: result.deletedTracking,
      unlocked_exam: result.unlockedExam,
    },
  });

  return NextResponse.json({
    ok: true,
    exam_student_id: result.examStudentId,
    exam_id: result.examId,
    student_id: result.studentId,
    deleted_makeups: result.deletedMakeups,
    deleted_tracking: result.deletedTracking,
    unlocked_exam: result.unlockedExam,
  });
}
