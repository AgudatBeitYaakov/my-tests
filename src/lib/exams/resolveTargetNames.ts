import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveMultiTargetLabels,
  rowToMultiTarget,
  type AssignmentMultiTargetRow,
} from "@/lib/assignments/multiTarget";

export async function resolveExamTargetLabels(
  supabase: SupabaseClient,
  rows: AssignmentMultiTargetRow[],
): Promise<Record<string, string>> {
  const normalized = rows.map((r) => ({
    id: r.id,
    ...rowToMultiTarget(r),
    assignment_category: r.assignment_category,
  }));
  return resolveMultiTargetLabels(supabase, normalized);
}
