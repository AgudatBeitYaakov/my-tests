import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const [history, audit] = await Promise.all([
    supabase
      .from("student_history")
      .select("*, users(full_name)")
      .eq("student_id", id)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase
      .from("audit_logs")
      .select("*, users(full_name, username)")
      .eq("entity_type", "student")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (history.error) return NextResponse.json({ error: history.error.message }, { status: 500 });
  if (audit.error) return NextResponse.json({ error: audit.error.message }, { status: 500 });

  return NextResponse.json({
    history: history.data ?? [],
    audit: audit.data ?? [],
  });
}
