import { NextResponse } from "next/server";
import {
  loadCurrentCohorts,
  listCohortsForFilter,
} from "@/lib/cohorts/active";
import { shouldShowArchivedCohorts } from "@/lib/cohorts/server";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import type { ExamTargetType } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const targetTypeLabel: Record<string, string> = {
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");
  const targetType = searchParams.get("target_type") as ExamTargetType | null;
  const targetId = searchParams.get("target_id");
  const cohortId = searchParams.get("cohort_id");
  const includeArchived =
    searchParams.get("include_archived") === "1" || (await shouldShowArchivedCohorts());

  const supabase = createSupabaseAdminClient();
  let q = supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS).order("subject");
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (targetType && ["class", "specialization", "track"].includes(targetType)) q = q.eq("target_type", targetType);
  if (targetId) q = q.eq("target_id", targetId);
  if (cohortId) q = q.eq("cohort_id", cohortId);

  if (!includeArchived) {
    const current = await loadCurrentCohorts(supabase);
    const ids = [current.cohortA?.id, current.cohortB?.id].filter(Boolean) as string[];
    if (ids.length) q = q.in("cohort_id", ids);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const labels = await resolveExamTargetLabels(
    supabase,
    rows.map((a) => ({
      id: (a as { id: string }).id,
      target_type: (a as { target_type: ExamTargetType }).target_type,
      target_id: (a as { target_id: string }).target_id,
    })),
  );
  const cohorts = await listCohortsForFilter(supabase, includeArchived);
  return NextResponse.json({
    assignments: rows.map((a) => {
      const row = a as { id: string; target_type: string };
      return { ...a, target_label: labels[row.id] ?? row.id, target_type_label: targetTypeLabel[row.target_type] ?? row.target_type };
    }),
    cohorts,
    includeArchived,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    cohort_id?: string;
    target_type?: ExamTargetType;
    target_id?: string;
    active?: boolean;
  };
  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const cohort_id = (body.cohort_id ?? "").trim();
  const target_type = body.target_type;
  const target_id = (body.target_id ?? "").trim();
  if (!teacher_id || !subject || !cohort_id || !target_type || !target_id) {
    return NextResponse.json({ error: "כל השדות חובה כולל שנתון" }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teacher_assignments")
    .insert({ teacher_id, subject, cohort_id, target_type, target_id, active: body.active ?? true })
    .select(ASSIGNMENT_WITH_LOOKUPS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}
