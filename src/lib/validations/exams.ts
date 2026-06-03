import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";

export async function assertNoOpenMakeupDuplicate(
  supabase: SupabaseClient,
  studentId: string,
  examId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await notDeleted(
    supabase
      .from("makeup_exams")
      .select("id")
      .eq("student_id", studentId)
      .eq("exam_id", examId)
      .eq("status", "open")
      .limit(1),
  );
  if (error) return { ok: false, error: error.message };
  if (data?.length) {
    return { ok: false, error: "כבר קיימת השלמה פתוחה לתלמידה במבחן זה" };
  }
  return { ok: true, error: null };
}

export async function assertExamNotLocked(
  supabase: SupabaseClient,
  examId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("exams")
    .select("makeup_locked_at")
    .eq("id", examId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.makeup_locked_at) {
    return {
      ok: false,
      error: "המבחן ננעל לאחר העברה להשלמות — עדכון רק מכרטיס תלמידה",
    };
  }
  return { ok: true, error: null };
}

export async function assertValidExamStudentStatusTransition(
  supabase: SupabaseClient,
  examStudentId: string,
  nextStatus: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: row, error } = await supabase
    .from("exam_students")
    .select("status, exam_id, student_id")
    .eq("id", examStudentId)
    .single();

  if (error || !row) return { ok: false, error: "רשומה לא נמצאה" };

  const validStatuses = ["pending", "took", "missing", "makeup", "completed"];
  if (!validStatuses.includes(nextStatus)) {
    return { ok: false, error: "סטטוס לא תקין" };
  }

  return { ok: true, error: null };
}
