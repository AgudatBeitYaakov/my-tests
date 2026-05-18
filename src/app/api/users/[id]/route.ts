import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/currentUser";
import { writeAudit } from "@/lib/audit/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    active?: boolean;
    password?: string;
  };

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase.from("users").select("*").eq("id", id).maybeSingle();

  const patch: Record<string, unknown> = {};
  if (body.active !== undefined) patch.active = body.active;
  if (body.password?.trim()) patch.password_hash = await hashPassword(body.password.trim());

  const { data, error } = await supabase.from("users").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: admin.id,
    entityType: "user",
    entityId: id,
    actionType: "update",
    oldValue: before,
    newValue: data,
  });

  return NextResponse.json({ user: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (id === admin.id) return NextResponse.json({ error: "לא ניתן למחוק את עצמך" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("users")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: admin.id,
    entityType: "user",
    entityId: id,
    actionType: "delete",
    oldValue: before,
  });

  return NextResponse.json({ ok: true });
}
