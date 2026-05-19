import { NextResponse } from "next/server";
import { resolveAcademicYearScope, readOnlyResponse, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });
  }

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();

  if (isYearScopedLookup(entity)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }
    const { data, error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("academic_year_id", scope.year.id)
      .is("deleted_at", null)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ deleted: data?.length ?? 0 });
  }

  const { data, error } = await supabase.from(table).delete().not("id", "is", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
