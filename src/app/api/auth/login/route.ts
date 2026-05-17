import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { USER_COOKIE } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireServiceRoleEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function sessionResponse(body: Record<string, unknown>, userId: string, status = 200) {
  const res = NextResponse.json(body, { status });
  res.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

async function passwordOk(
  password: string,
  hash: string,
  userId: string,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<boolean> {
  if (await verifyPassword(password, hash)) return true;
  try {
    const { APP_PASSWORD } = requireServiceRoleEnv();
    if (password === APP_PASSWORD) {
      const password_hash = await hashPassword(password);
      await supabase.from("users").update({ password_hash }).eq("id", userId);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };
  const username = (body.username ?? "").trim().toLowerCase();
  const password = (body.password ?? "").trim();

  if (!username || !password) {
    return NextResponse.json({ error: "שם משתמש וסיסמה חובה" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, password_hash, full_name, role, active")
    .eq("username", username)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (user) {
    if (!user.active) return NextResponse.json({ error: "משתמש לא פעיל" }, { status: 403 });
    const ok = await passwordOk(password, user.password_hash as string, user.id as string, supabase);
    if (!ok) {
      return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
    }
    return sessionResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        },
      },
      user.id as string,
    );
  }

  const { count } = await supabase.from("users").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    try {
      const { APP_PASSWORD } = requireServiceRoleEnv();
      if (password !== APP_PASSWORD) {
        return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
      }
      const password_hash = await hashPassword(password);
      const { data: created, error: cErr } = await supabase
        .from("users")
        .insert({
          username: username || "admin",
          password_hash,
          full_name: "מנהלת מערכת",
          role: "admin",
          active: true,
        })
        .select("id, username, full_name, role")
        .single();
      if (cErr || !created) {
        return NextResponse.json({ error: cErr?.message ?? "שגיאה" }, { status: 500 });
      }
      return sessionResponse({ user: created }, created.id as string);
    } catch {
      return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
    }
  }

  return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
}
