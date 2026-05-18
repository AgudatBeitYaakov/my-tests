import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/currentUser";
import { writeAudit } from "@/lib/audit/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, full_name, active, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };

  const username = (body.username ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();

  if (!username || !password) {
    return NextResponse.json({ error: "שם משתמש וסיסמה חובה" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from("users")
    .insert({
      username,
      password_hash,
      full_name: username,
      active: true,
    })
    .select("id, username, full_name, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: admin.id,
    entityType: "user",
    entityId: data.id as string,
    actionType: "create",
    newValue: { username },
  });

  return NextResponse.json({ user: data });
}
