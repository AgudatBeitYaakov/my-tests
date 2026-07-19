import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * מחיקה קשה של תלמידה — רק אם אין שורות exam_students.
 * מוחקת גם היסטוריה, השלמות יתומות (אם יש), ומעקב.
 */
export async function hardDeleteStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<{ ok: true } | { error: string; linked_exams?: number }> {
  const { data: student, error: loadErr } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!student) return { error: "תלמידה לא נמצאה" };

  const { count: linkedExams, error: linkErr } = await supabase
    .from("exam_students")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if (linkErr) return { error: linkErr.message };
  if ((linkedExams ?? 0) > 0) {
    return {
      error: `לא ניתן למחוק תלמידה שמקושרת ל-${linkedExams} מבחנים. יש להסיר אותה מהמבחנים קודם, או למחוק את המבחנים.`,
      linked_exams: linkedExams ?? 0,
    };
  }

  const steps: Array<{ table: string; run: () => PromiseLike<{ error: { message: string } | null }> }> = [
    {
      table: "makeup_tracking",
      run: () => supabase.from("makeup_tracking").delete().eq("student_id", studentId),
    },
    {
      table: "makeup_exams",
      run: () => supabase.from("makeup_exams").delete().eq("student_id", studentId),
    },
    {
      table: "student_history",
      run: () => supabase.from("student_history").delete().eq("student_id", studentId),
    },
    {
      table: "students",
      run: () => supabase.from("students").delete().eq("id", studentId),
    },
  ];

  for (const step of steps) {
    const { error } = await step.run();
    if (error) return { error: `${step.table}: ${error.message}` };
  }

  return { ok: true };
}
