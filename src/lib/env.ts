function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

/** טעינה מ־.env — trim + הסרת BOM (העתקה מ־Excel/מסמך) */
function requireEnv(name: string): string {
  const raw = process.env[name];
  if (raw == null || !String(raw).trim()) throw new Error(`Missing required env var: ${name}`);
  return stripBom(String(raw).trim());
}

/** מפתחות sb_secret_* לפעמים מועתקים כ־ssb_secret — תיקון שכיח */
function normalizeServiceRoleKey(v: string): string {
  if (v.startsWith("ssb_secret_")) return `sb_secret_${v.slice("ssb_secret_".length)}`;
  return v;
}

export function requireSupabasePublicEnv() {
  return {
    SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  } as const;
}

export function requireServiceRoleKey(): string {
  return normalizeServiceRoleKey(requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getAppPassword(): string | null {
  const raw = process.env.APP_PASSWORD;
  if (raw == null || !String(raw).trim()) return null;
  return stripBom(String(raw).trim());
}

export function requireServiceRoleEnv() {
  return {
    SUPABASE_SERVICE_ROLE_KEY: requireServiceRoleKey(),
    APP_PASSWORD: getAppPassword() ?? "",
  } as const;
}

