import { NextResponse } from "next/server";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { parseTeacherBody } from "@/lib/teachers/validation";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "200", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 200;

  const supabase = createSupabaseAdminClient();
  let query = notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS))
    .order("last_name")
    .order("first_name")
    .limit(limit);

  if (q) {
    const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,full_name_generated.ilike.%${escaped}%,tz.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teachers: data ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseTeacherBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teachers")
    .insert({
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      tz: parsed.tz,
      email: parsed.email,
      notes: parsed.notes,
    })
    .select(TEACHER_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ teacher: data });
}
