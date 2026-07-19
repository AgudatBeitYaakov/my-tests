import type { SupabaseClient } from "@supabase/supabase-js";

export const EXAM_HARD_DELETE_PHRASE = "מחק לצמיתות";

export type ExamDeletePreview = {
  exam_students: number;
  makeup_exams: number;
  makeup_tracking: number;
  exam_tracking: number;
};

async function countRows(
  supabase: SupabaseClient,
  table: "exam_students" | "makeup_exams" | "makeup_tracking" | "exam_tracking",
  examId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function previewExamHardDelete(
  supabase: SupabaseClient,
  examId: string,
): Promise<ExamDeletePreview> {
  const [exam_students, makeup_exams, makeup_tracking, exam_tracking] = await Promise.all([
    countRows(supabase, "exam_students", examId),
    countRows(supabase, "makeup_exams", examId),
    countRows(supabase, "makeup_tracking", examId),
    countRows(supabase, "exam_tracking", examId),
  ]);
  return { exam_students, makeup_exams, makeup_tracking, exam_tracking };
}

export async function hardDeleteExam(
  supabase: SupabaseClient,
  examId: string,
): Promise<{ ok: true } | { error: string }> {
  const { data: exam, error: loadErr } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .maybeSingle();
  if (loadErr) return { error: loadErr.message };
  if (!exam) return { error: "מבחן לא נמצא" };

  const { data: lineRows, error: linesErr } = await supabase
    .from("exam_students")
    .select("id")
    .eq("exam_id", examId);
  if (linesErr) return { error: linesErr.message };

  const lineIds = (lineRows ?? []).map((r) => r.id as string);
  if (lineIds.length) {
    const { error: lineAuditErr } = await supabase
      .from("audit_logs")
      .delete()
      .eq("entity_type", "exam_student")
      .in("entity_id", lineIds);
    if (lineAuditErr) return { error: `audit_logs(exam_student): ${lineAuditErr.message}` };
  }

  // סדר חשוב בגלל FK restrict
  const steps: Array<{ table: string; run: () => PromiseLike<{ error: { message: string } | null }> }> = [
    {
      table: "makeup_tracking",
      run: () => supabase.from("makeup_tracking").delete().eq("exam_id", examId),
    },
    {
      table: "makeup_exams",
      run: () => supabase.from("makeup_exams").delete().eq("exam_id", examId),
    },
    {
      table: "exam_students",
      run: () => supabase.from("exam_students").delete().eq("exam_id", examId),
    },
    {
      table: "exam_tracking",
      run: () => supabase.from("exam_tracking").delete().eq("exam_id", examId),
    },
    {
      table: "audit_logs",
      run: () =>
        supabase.from("audit_logs").delete().eq("entity_type", "exam").eq("entity_id", examId),
    },
    {
      table: "exams",
      run: () => supabase.from("exams").delete().eq("id", examId),
    },
  ];

  for (const step of steps) {
    const { error } = await step.run();
    if (error) return { error: `${step.table}: ${error.message}` };
  }

  // וידוא שהמבחן באמת נמחק
  const { data: stillThere, error: checkErr } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .maybeSingle();
  if (checkErr) return { error: checkErr.message };
  if (stillThere) {
    return { error: "המבחן לא נמחק מהמסד — בדקי הרשאות service role / RLS" };
  }

  return { ok: true };
}
