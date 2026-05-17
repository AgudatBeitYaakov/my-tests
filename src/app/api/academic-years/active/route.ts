import { NextResponse } from "next/server";
import { setAcademicYearCookie } from "@/lib/academic/year";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireCurrentUser();
  const body = (await request.json()) as { year_id?: string };
  const yearId = (body.year_id ?? "").trim();
  if (!yearId) return NextResponse.json({ error: "year_id חובה" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  const { data, error } = await supabase
    .from("academic_years")
    .update({ is_active: true })
    .eq("id", yearId)
    .select("id, name, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await setAcademicYearCookie(yearId);
  return NextResponse.json({ year: data });
}
