import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowToMultiTarget,
  type AssignmentMultiTarget,
} from "@/lib/assignments/multiTarget";
import { isTeachingTrackName } from "@/lib/students/fields";

export type { AssignmentMultiTarget };

export { fetchStudentIdsForMultiTarget as fetchStudentIdsForTarget } from "@/lib/assignments/multiTarget";

export async function isTeachingTrackId(supabase: SupabaseClient, trackId: string): Promise<boolean> {
  const { data } = await supabase.from("tracks").select("name").eq("id", trackId).maybeSingle();
  return isTeachingTrackName((data?.name as string) ?? "");
}

export function multiTargetFromAssignment(row: {
  grade_levels?: string[] | null;
  class_ids?: string[] | null;
  track_ids?: string[] | null;
  specialization_ids?: string[] | null;
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
}): AssignmentMultiTarget {
  return rowToMultiTarget(row);
}
