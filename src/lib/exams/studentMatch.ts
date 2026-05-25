import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeachingTrackName } from "@/lib/students/fields";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";

export type StudentForMatch = {
  id: string;
  grade_level: string;
  class_id: string | null;
  track_id: string | null;
  specialization_id: string | null;
  secondary_specialization_id: string | null;
  is_psychology: boolean;
  teaching_track_type: TeachingTrackType | null;
};

export type ExamTargetForMatch = {
  assignment_category: AssignmentCategory;
  grade_levels: string[];
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade: boolean;
  teaching_track_type: TeachingTrackType | null;
};

/** מחזיר Set של ids של מסלולים שהם «מסלול הוראה». */
export async function fetchTeachingTrackIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("tracks").select("id, name");
  const out = new Set<string>();
  for (const r of data ?? []) {
    const row = r as { id: string; name: string };
    if (isTeachingTrackName(row.name)) out.add(row.id);
  }
  return out;
}

/**
 * בודק האם תלמידה מתאימה ליעד של מבחן.
 * - שכבה: חובה להיות בתוך grade_levels
 * - התמחות: התאמה לפי specialization_id או secondary_specialization_id
 * - חובה: איחוד (OR) על כיתות/מסלולים; פסיכולוגיה משמשת כסינון:
 *   • אם נבחרה רק פסיכולוגיה (בלי כיתה/מסלול) — רק תלמידות פסיכולוגיה
 *   • אם נבחרו גם כיתה/מסלול וגם פסיכולוגיה — רק תלמידות פסיכולוגיה
 *     מתוך אלו שמתאימות לכיתה/מסלול שנבחרו (AND)
 */
export function studentMatchesExamTarget(
  student: StudentForMatch,
  exam: ExamTargetForMatch,
  teachingTrackIds: Set<string>,
): boolean {
  if (!exam.grade_levels.includes(student.grade_level)) return false;

  if (exam.assignment_category === "התמחות") {
    if (!exam.specialization_ids.length) return false;
    if (student.specialization_id && exam.specialization_ids.includes(student.specialization_id)) {
      return true;
    }
    if (
      student.secondary_specialization_id &&
      exam.specialization_ids.includes(student.secondary_specialization_id)
    ) {
      return true;
    }
    return false;
  }

  if (exam.applies_to_all_in_grade) return true;

  const hasClassOrTrack = exam.class_ids.length > 0 || exam.track_ids.length > 0;

  if (exam.psychology_enabled && !hasClassOrTrack) {
    return student.is_psychology;
  }

  let matches = false;
  if (student.class_id && exam.class_ids.includes(student.class_id)) {
    matches = true;
  }
  if (!matches && student.track_id && exam.track_ids.includes(student.track_id)) {
    if (teachingTrackIds.has(student.track_id) && exam.teaching_track_type) {
      matches = student.teaching_track_type === exam.teaching_track_type;
    } else {
      matches = true;
    }
  }

  if (!matches) return false;

  if (exam.psychology_enabled && !student.is_psychology) return false;

  return true;
}
