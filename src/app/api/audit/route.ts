import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const entityType = (searchParams.get("entity_type") ?? "").trim();
  const entityId = (searchParams.get("entity_id") ?? "").trim();
  const studentId = (searchParams.get("student_id") ?? "").trim();

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("audit_logs")
    .select("id, user_id, entity_type, entity_id, action_type, old_value, new_value, created_at, users(full_name, username)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (entityType && entityId) {
    q = q.eq("entity_type", entityType).eq("entity_id", entityId);
  } else if (studentId) {
    q = q.or(`entity_id.eq.${studentId},and(entity_type.eq.student,entity_id.eq.${studentId})`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
