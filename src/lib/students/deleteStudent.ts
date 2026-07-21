import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * מחיקה קשה של תלמידה.
 * — ללא מבחנים פעילים: מחיקה ישירה.
 * — מבחן פעיל אחד בלבד: מוחקים קודם את השיוך (exam_students + השלמות/מעקב) ואז את התלמידה.
 * — יותר ממבחן פעיל אחד: חסום.
 * שיוכים למבחנים שנמחקו (רכה) מנוקים אוטומטית.
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
    const activeExamIdList = [...new Set(activeLinks.map((r) => r.exam_id as string))];

    if (activeExamIdList.length > 1) {
      return {
        error: `לא ניתן למחוק תלמידה שמקושרת ל-${activeExamIdList.length} מבחנים פעילים. יש להסיר אותה מהמבחנים קודם, או למחוק את המבחנים.`,
        linked_exams: activeExamIdList.length,
      };
    }

    if (activeExamIdList.length === 1) {
      const examId = activeExamIdList[0]!;
      const activeLineIds = activeLinks.map((r) => r.id as string);

      if (activeLineIds.length) {
        const { error: lineAuditErr } = await supabase
          .from("audit_logs")
          .delete()
          .eq("entity_type", "exam_student")
          .in("entity_id", activeLineIds);
        if (lineAuditErr) return { error: `audit_logs(exam_student): ${lineAuditErr.message}` };
      }

      const { error: mtErr } = await supabase
        .from("makeup_tracking")
        .delete()
        .eq("student_id", studentId)
        .eq("exam_id", examId);
      if (mtErr) return { error: `makeup_tracking: ${mtErr.message}` };

      const { error: meErr } = await supabase
        .from("makeup_exams")
        .delete()
        .eq("student_id", studentId)
        .eq("exam_id", examId);
      if (meErr) return { error: `makeup_exams: ${meErr.message}` };

      const { error: esErr } = await supabase.from("exam_students").delete().in("id", activeLineIds);
      if (esErr) return { error: `exam_students: ${esErr.message}` };
    }

    // ניקוי שיוכים יתומים למבחנים מחוקים
    const orphanIds = links
      .filter((r) => !activeExamIds.has(r.exam_id as string))
      .map((r) => r.id as string);
    if (orphanIds.length) {
      const { error: orphanErr } = await supabase.from("exam_students").delete().in("id", orphanIds);
      if (orphanErr) return { error: `exam_students: ${orphanErr.message}` };
    }
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
