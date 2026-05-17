import { NextResponse } from "next/server";
import { enrichStudentsWithGrade } from "@/lib/academic/studentGrade";
import { listCohortsForFilter, loadCurrentCohorts } from "@/lib/cohorts/active";
import { shouldShowArchivedCohorts } from "@/lib/cohorts/server";
import { asStudentRows } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const gradeLevel = (searchParams.get("grade_level") ?? searchParams.get("cohort_grade") ?? "").trim();
    const cohortId = (searchParams.get("cohort_id") ?? "").trim();
    const classId = (searchParams.get("class_id") ?? "").trim();
    const specializationId = (searchParams.get("specialization_id") ?? "").trim();
    const trackId = (searchParams.get("track_id") ?? "").trim();
    const includeArchived =
      searchParams.get("include_archived") === "1" || (await shouldShowArchivedCohorts());

    const supabase = createSupabaseAdminClient();
    const current = await loadCurrentCohorts(supabase);

    const studentSelect = await getStudentWithLookupsSelect();
    let query = supabase
      .from("students")
      .select(studentSelect)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(500);

    if (!includeArchived) {
      const ids = [current.cohortA?.id, current.cohortB?.id].filter(Boolean) as string[];
      if (ids.length) query = query.in("cohort_id", ids);
    }

    const gl = gradeLevel === "A" ? "א" : gradeLevel === "B" ? "ב" : gradeLevel;
    if (gl === "א" && current.cohortA?.id) query = query.eq("cohort_id", current.cohortA.id);
    if (gl === "ב" && current.cohortB?.id) query = query.eq("cohort_id", current.cohortB.id);
    if (cohortId) query = query.eq("cohort_id", cohortId);
    if (classId) query = query.eq("class_id", classId);
    if (specializationId) query = query.eq("specialization_id", specializationId);
    if (trackId) query = query.eq("track_id", trackId);

    if (q) {
      const escapeIlike = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
      const parts = q.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const p0 = escapeIlike(parts[0]);
        const pRest = escapeIlike(parts.slice(1).join(" "));
        const pLast = escapeIlike(parts[parts.length - 1]);
        const pHead = escapeIlike(parts.slice(0, -1).join(" "));
        query = query.or(
          `and(first_name.ilike.%${p0}%,last_name.ilike.%${pRest}%),and(first_name.ilike.%${pHead}%,last_name.ilike.%${pLast}%)`,
        );
      } else {
        const escaped = escapeIlike(parts[0] ?? q);
        query = query.or(
          `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
        );
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const students = enrichStudentsWithGrade(asStudentRows(data));
    const cohorts = await listCohortsForFilter(supabase, includeArchived);

    return NextResponse.json({ students, current, cohorts, includeArchived });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, students: [] }, { status: 500 });
  }
}
