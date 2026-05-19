import { NextResponse } from "next/server";
import { resolveAcademicYearScope, readOnlyResponse, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** מסתיר את כל המורות של שנת הלימודים הנבחרת (soft delete) */
export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("academic_year_id", scope.year.id)
    .is("deleted_at", null)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
