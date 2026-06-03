import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExamStudentStatus } from "@/lib/types/db";
import { ensureMakeupTracking } from "@/lib/makeupTracking/sync";

/**
 * שינוי סטטוס דו-כיווני עם טיפול אוטומטי בכל ה-side effects:
 *
 *   ► פעולה             | side effects
 *   --------------------+--------------------------------------------------------
 *   ANY → took/pending  | מחיקת makeup_exams + makeup_tracking הקשורים,
 *                       | ושחרור נעילה אם לא נשארו השלמות
 *   ANY → missing/makeup| upsert makeup_exams (status=open) + ensureMakeupTracking
 *                       | (סטטוס פנימי ב-exam_students הוא תמיד "makeup")
 *   ANY → completed     | upsert makeup_exams (status=completed, completed_at=now)
 *                       | + ensureMakeupTracking
 *
 * הפונקציה לא עוצרת על "מבחן נעול" — מי שקורא לה אחראי לבדוק זאת אם רצוי.
 */

export type StatusChangeResult = {
  ok: true;
  previousStatus: ExamStudentStatus;
  newStatus: ExamStudentStatus;
  deletedMakeups: number;
  deletedTracking: number;
  upsertedMakeup: boolean;
  unlockedExam: boolean;
};

export type StatusChangeError = {
  ok: false;
  error: string;
  status: number;
};

export async function applyExamStudentStatusChange(
  supabase: SupabaseClient,
  examStudentId: string,
  requestedStatus: ExamStudentStatus,
): Promise<StatusChangeResult | StatusChangeError> {
  const { data: row, error: gErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, student_id, status")
    .eq("id", examStudentId)
    .maybeSingle();

  if (gErr) return { ok: false, error: gErr.message, status: 500 };
  if (!row) return { ok: false, error: "רשומה לא נמצאה", status: 404 };

  const examId = row.exam_id as string;
  const studentId = row.student_id as string;
  const previousStatus = row.status as ExamStudentStatus;

  // ב-DB אין סטטוס "missing" עצמאי — "לא נבחנה" מתורגם פנימית ל-"makeup"
  // (יוצרים השלמה פתוחה והסטטוס במבחן מסומן "makeup").
  const newStatus: ExamStudentStatus =
    requestedStatus === "missing" ? "makeup" : requestedStatus;

  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select("academic_year_id, makeup_locked_at")
    .eq("id", examId)
    .maybeSingle();
  if (examErr) return { ok: false, error: examErr.message, status: 500 };
  if (!examRow) return { ok: false, error: "מבחן לא נמצא", status: 404 };

  let deletedMakeups = 0;
  let deletedTracking = 0;
  let upsertedMakeup = false;
  let unlockedExam = false;

  // ► מעבר לסטטוס "ניטרלי" (took/pending) — ניקוי כל המעקבים/השלמות
  if (newStatus === "took" || newStatus === "pending") {
    const { data: delT, error: trkErr } = await supabase
      .from("makeup_tracking")
      .delete()
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .select("id");
    if (trkErr) return { ok: false, error: trkErr.message, status: 400 };
    deletedTracking = (delT ?? []).length;

    const { data: delM, error: mkErr } = await supabase
      .from("makeup_exams")
      .delete()
      .eq("exam_id", examId)
      .eq("student_id", studentId)
      .select("id");
    if (mkErr) return { ok: false, error: mkErr.message, status: 400 };
    deletedMakeups = (delM ?? []).length;
  }

  // ► מעבר ל-"makeup" — יצירה / עדכון השלמה פתוחה
  if (newStatus === "makeup") {
    const { data: makeupRow, error: mErr } = await supabase
      .from("makeup_exams")
      .upsert(
        {
          academic_year_id: examRow.academic_year_id as string,
          student_id: studentId,
          exam_id: examId,
          status: "open",
          completed_at: null,
        },
        { onConflict: "student_id,exam_id" },
      )
      .select("id")
      .single();
    if (mErr) return { ok: false, error: mErr.message, status: 400 };

    const trk = await ensureMakeupTracking(supabase, {
      studentId,
      examId,
      makeupExamId: makeupRow?.id ?? null,
    });
    if (trk.error) return { ok: false, error: trk.error, status: 400 };
    upsertedMakeup = true;
  }

  // ► מעבר ל-"completed" — יצירה אם חסר, ועדכון ל-completed
  if (newStatus === "completed") {
    const now = new Date().toISOString();
    const { data: makeupRow, error: mErr } = await supabase
      .from("makeup_exams")
      .upsert(
        {
          academic_year_id: examRow.academic_year_id as string,
          student_id: studentId,
          exam_id: examId,
          status: "completed",
          completed_at: now,
        },
        { onConflict: "student_id,exam_id" },
      )
      .select("id")
      .single();
    if (mErr) return { ok: false, error: mErr.message, status: 400 };

    const trk = await ensureMakeupTracking(supabase, {
      studentId,
      examId,
      makeupExamId: makeupRow?.id ?? null,
    });
    if (trk.error) return { ok: false, error: trk.error, status: 400 };
    upsertedMakeup = true;
  }

  // ► עדכון exam_students.status
  const { error: uErr } = await supabase
    .from("exam_students")
    .update({ status: newStatus })
    .eq("id", examStudentId);
  if (uErr) return { ok: false, error: uErr.message, status: 400 };

  // ► שחרור נעילה אם פינינו את כל ההשלמות
  if (
    (newStatus === "took" || newStatus === "pending") &&
    examRow.makeup_locked_at
  ) {
    const { count: remaining } = await supabase
      .from("makeup_exams")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId);
    if (!remaining) {
      const { error: unlockErr } = await supabase
        .from("exams")
        .update({ makeup_locked_at: null })
        .eq("id", examId);
      if (unlockErr) {
        console.warn(
          "[applyExamStudentStatusChange] לא הצלחתי לשחרר נעילת מבחן:",
          unlockErr.message,
        );
      } else {
        unlockedExam = true;
      }
    }
  }

  return {
    ok: true,
    previousStatus,
    newStatus,
    deletedMakeups,
    deletedTracking,
    upsertedMakeup,
    unlockedExam,
  };
}
