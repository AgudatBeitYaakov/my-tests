import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const YEAR_COOKIE = "academic_year_id";

export type AcademicYear = {
  id: string;
  name: string;
  is_active: boolean;
};

export async function getActiveAcademicYear(supabase: SupabaseClient): Promise<AcademicYear | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, is_active")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as AcademicYear;
}

export async function resolveAcademicYearId(
  supabase: SupabaseClient,
  requestedId?: string | null,
): Promise<string | null> {
  if (requestedId?.trim()) return requestedId.trim();
  const store = await cookies();
  const fromCookie = store.get(YEAR_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;
  const active = await getActiveAcademicYear(supabase);
  return active?.id ?? null;
}

export async function setAcademicYearCookie(yearId: string) {
  const store = await cookies();
  store.set(YEAR_COOKIE, yearId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
