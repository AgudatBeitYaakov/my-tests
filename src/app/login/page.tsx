import { LoginTimeGreeting } from "@/components/LoginTimeGreeting";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const err = typeof p.error === "string" ? p.error : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white p-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <LoginTimeGreeting />
        <h1 className="mt-4 text-2xl font-bold text-[var(--color-primary)]">{"כניסה למערכת"}</h1>
        <LoginForm initialError={err} />
      </div>
    </div>
  );
}
