import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ביטול טעות של "לא נבחנה" / "הושלמה בהשלמה" → החזרה ל"נבחנה במועד".
 *
 * פעולה:
 *   1. מוחקת לצמיתות את רשומת ה-makeup_tracking של (exam_id, student_id), אם קיימת.
 *   2. מוחקת לצמיתות את רשומת ה-makeup_exams של (exam_id, student_id), אם קיימת.
 *   3. מעדכנת את exam_students.status ל-"took".
 *   4. אם המבחן ננעל (makeup_locked_at) ולא נשארו עוד רשומות makeup_exams בכלל
 *      (פתוחות או הושלמו) — מבטלת את הנעילה כדי לאפשר עריכה שוטפת.
 *
 * הפעולה עוקפת בכוונה את `assertExamNotLocked` ואת מנגנון המעבר הרגיל
 * שב-`assertValidExamStudentStatusTransition`, כי כל מטרתה לתקן טעות אפילו
 * במבחן שננעל.
 */
export type UndoMissingParams = {
  examStudentId: string;
  scopeYearId: string;
};

export type UndoMissingResult = {
  ok: true;
  examStudentId: string;
  examId: string;
  studentId: string;
  deletedMakeups: number;
  deletedTracking: number;
  unlockedExam: boolean;
  previousStatus: string;
};

export type UndoMissingError = {
  ok: false;
  error: string;
  status: number;
};

export async function performUndoMissingByExamStudent(
  supabase: SupabaseClient,
  params: UndoMissingParams,
): Promise<UndoMissingResult | UndoMissingError> {
  const { data: row, error: gErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, student_id, status")
    .eq("id", params.examStudentId)
    .maybeSingle();
  if (gErr) return { ok: false, error: gErr.message, status: 500 };
  if (!row) return { ok: false, error: "רשומה לא נמצאה", status: 404 };

  const examId = row.exam_id as string;
  const studentId = row.student_id as string;
  const currentStatus = row.status as string;

  if (currentStatus !== "makeup" && currentStatus !== "completed" && currentStatus !== "missing") {
    return {
      ok: false,
      error: "אין מה לבטל — הסטטוס הנוכחי אינו «השלמה» / «הושלמה בהשלמה» / «לא נבחנה»",
      status: 400,
    };
  }

  // אימות שייכות לשנה הנוכחית — מבחנים חוצי-שנה לא נוגעים כאן
  const { data: examRow } = await supabase
    .from("exams")
    .select("academic_year_id, makeup_locked_at")
    .eq("id", examId)
    .maybeSingle();
  if (examRow && examRow.academic_year_id !== params.scopeYearId) {
    return { ok: false, error: "מבחן לא שייך לשנה הנוכחית", status: 403 };
  }

  // מחיקת מעקב השלמות (אם קיים)
  const { data: deletedTracking, error: trkErr } = await supabase
    .from("makeup_tracking")
    .delete()
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .select("id");
  if (trkErr) return { ok: false, error: trkErr.message, status: 400 };

  // מחיקת רשומת ההשלמה עצמה (אם קיימת)
  const { data: deletedMakeups, error: mkErr } = await supabase
    .from("makeup_exams")
    .delete()
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .select("id");
  if (mkErr) return { ok: false, error: mkErr.message, status: 400 };

  // החזרת הסטטוס ל"נבחנה במועד"
  const { error: uErr } = await supabase
    .from("exam_students")
    .update({ status: "took" })
    .eq("id", params.examStudentId);
  if (uErr) return { ok: false, error: uErr.message, status: 400 };

  // אם המבחן ננעל — נבדוק אם נשארו עוד השלמות, ואם לא — נשחרר נעילה
  let unlockedExam = false;
  if (examRow?.makeup_locked_at) {
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
        console.warn("[undoMissing] לא הצלחתי לבטל נעילת מבחן:", unlockErr.message);
      } else {
        unlockedExam = true;
      }
    }
  }

  return {
    ok: true,
    examStudentId: params.examStudentId,
    examId,
    studentId,
    deletedMakeups: (deletedMakeups ?? []).length,
    deletedTracking: (deletedTracking ?? []).length,
    unlockedExam,
    previousStatus: currentStatus,
  };
}

/**
 * וריאנט הנקרא מ-/api/makeups/[id]/undo — מקבל makeup_id ומאתר בתוך הפעולה
 * את exam_students.id ההתואם, ואז מפעיל את אותה לוגיקה.
 */
export async function performUndoMissingByMakeup(
  supabase: SupabaseClient,
  params: { makeupId: string; scopeYearId: string },
): Promise<UndoMissingResult | UndoMissingError> {
  const { data: m, error } = await supabase
    .from("makeup_exams")
    .select("exam_id, student_id, academic_year_id")
    .eq("id", params.makeupId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!m) return { ok: false, error: "רשומת השלמה לא נמצאה", status: 404 };
  if (m.academic_year_id && m.academic_year_id !== params.scopeYearId) {
    return { ok: false, error: "השלמה לא שייכת לשנה הנוכחית", status: 403 };
  }

  const { data: esRow, error: esErr } = await supabase
    .from("exam_students")
    .select("id")
    .eq("exam_id", m.exam_id as string)
    .eq("student_id", m.student_id as string)
    .maybeSingle();
  if (esErr) return { ok: false, error: esErr.message, status: 500 };
  if (!esRow) {
    return {
      ok: false,
      error: "שורת תלמידה במבחן לא נמצאה — אי אפשר לבטל",
      status: 404,
    };
  }

  return performUndoMissingByExamStudent(supabase, {
    examStudentId: esRow.id as string,
    scopeYearId: params.scopeYearId,
  });
}
