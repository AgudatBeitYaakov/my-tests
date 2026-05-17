import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUserId } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppUser = {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "secretary";
  active: boolean;
};

export async function getCurrentUser(supabase?: SupabaseClient): Promise<AppUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = supabase ?? createSupabaseAdminClient();
  const { data, error } = await db
    .from("users")
    .select("id, username, full_name, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.active) return null;
  return data as AppUser;
}

export async function requireCurrentUser(): Promise<AppUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Unauthorized");
  return u;
}

export async function requireAdmin(): Promise<AppUser> {
  const u = await requireCurrentUser();
  if (u.role !== "admin") throw new Error("Forbidden");
  return u;
}
