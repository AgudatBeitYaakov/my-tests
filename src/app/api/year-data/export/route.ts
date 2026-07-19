import { NextResponse } from "next/server";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildYearExportFiles } from "@/lib/yearData/exportRows";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );

    const files = await buildYearExportFiles(supabase, scope.year.id);

    return NextResponse.json({
      year_id: scope.year.id,
      year_name: scope.year.year_name,
      files,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה בייצוא" },
      { status: 500 },
    );
  }
}
