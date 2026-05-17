import type { SupabaseClient } from "@supabase/supabase-js";

type StudentRow = {
  class_id: string;
  specialization_id: string | null;
  track_id: string | null;
  academic_year_id: string | null;
};

export async function recordStudentHistoryIfChanged(
  supabase: SupabaseClient,
  studentId: string,
  before: StudentRow,
  after: StudentRow,
  changedBy: string | null,
) {
  const changed =
    before.class_id !== after.class_id ||
    before.specialization_id !== after.specialization_id ||
    before.track_id !== after.track_id;

  if (!changed) return;

  await supabase.from("student_history").insert({
    student_id: studentId,
    academic_year_id: after.academic_year_id,
    old_class_id: before.class_id,
    new_class_id: after.class_id,
    old_specialization_id: before.specialization_id,
    new_specialization_id: after.specialization_id,
    old_track_id: before.track_id,
    new_track_id: after.track_id,
    changed_by: changedBy,
  });
}
