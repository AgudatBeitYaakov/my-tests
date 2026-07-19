import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * מחיקה קשה של תלמידה — רק אם אין שיוך למבחנים פעילים.
 * שיוכים למבחנים שנמחקו (רכה) מנוקים אוטומטית ואז אפשר למחוק.
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

  const { data: linkRows, error: linkErr } = await supabase
    .from("exam_students")
    .select("id, exam_id")
    .eq("student_id", studentId);
  if (linkErr) return { error: linkErr.message };

  const links = linkRows ?? [];
  if (links.length) {
    const examIds = [...new Set(links.map((r) => r.exam_id as string))];
    const { data: exams, error: examsErr } = await supabase
      .from("exams")
      .select("id, deleted_at")
      .in("id", examIds);
    if (examsErr) return { error: examsErr.message };

    const activeExamIds = new Set(
      (exams ?? [])
        .filter((e) => !(e as { deleted_at?: string | null }).deleted_at)
        .map((e) => e.id as string),
    );
    // מבחן שנמחק לגמרי / לא נמצא — נחשב יתום
    const activeLinks = links.filter((r) => activeExamIds.has(r.exam_id as string));
    if (activeLinks.length > 0) {
      return {
        error: `לא ניתן למחוק תלמידה שמקושרת ל-${activeLinks.length} מבחנים פעילים. יש להסיר אותה מהמבחנים קודם, או למחוק את המבחנים.`,
        linked_exams: activeLinks.length,
      };
    }

    // ניקוי שיוכים יתומים למבחנים מחוקים
    const orphanIds = links.map((r) => r.id as string);
    const { error: orphanErr } = await supabase.from("exam_students").delete().in("id", orphanIds);
    if (orphanErr) return { error: `exam_students: ${orphanErr.message}` };
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
