import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeachingTrackName } from "@/lib/students/fields";
import type { ExamTargetType, TeachingMode } from "@/lib/types/db";

export async function resolveAssignmentTeachingMode(
  supabase: SupabaseClient,
  targetType: ExamTargetType,
  targetId: string,
  teachingMode: string | null | undefined,
): Promise<{ teaching_mode: TeachingMode | null; error: string | null }> {
  const mode = (teachingMode ?? "").trim() as TeachingMode | "";
  if (!mode) return { teaching_mode: null, error: null };

  if (mode !== "full" && mode !== "short") {
    return { teaching_mode: null, error: "סוג הוראה לא תקין" };
  }

  if (targetType !== "track") {
    return { teaching_mode: null, error: "סוג הוראה מותר רק בשיבוץ מסלול" };
  }

  const { data: trackRow } = await supabase.from("tracks").select("name").eq("id", targetId).maybeSingle();
  if (!isTeachingTrackName((trackRow?.name as string) ?? "")) {
    return { teaching_mode: null, error: "סוג הוראה מותר רק במסלול הוראה" };
  }

  return { teaching_mode: mode, error: null };
}
