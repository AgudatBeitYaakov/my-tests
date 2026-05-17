import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TABLES: Record<string, string> = {
  students: "students",
  exams: "exams",
  makeups: "makeup_exams",
  "makeup-exams": "makeup_exams",
};

export async function GET(_request: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  await requireCurrentUser();
  const { entity, id } = await ctx.params;
  const table = TABLES[entity];
  if (!table) return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from(table).select("notes").eq("id", id).single();
  if (error) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  return NextResponse.json({ notes: (data as { notes: string | null }).notes ?? "" });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  await requireCurrentUser();
  const { entity, id } = await ctx.params;
  const table = TABLES[entity];
  if (!table) return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });

  const body = (await request.json()) as { notes?: string };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(table)
    .update({ notes: body.notes ?? "" })
    .eq("id", id)
    .select("notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ notes: (data as { notes: string }).notes ?? "" });
}
