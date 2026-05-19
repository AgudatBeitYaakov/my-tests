import Image from "next/image";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* פאנל רקע — סמל עדין בלבד (ימין ב-RTL) */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-s border-slate-200/80 bg-gradient-to-bl from-sky-100/90 via-white to-slate-50 lg:block"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
          <Image
            src="/logo.png"
            alt=""
            width={640}
            height={640}
            className="h-auto max-h-[min(88vh,42rem)] w-full max-w-[min(92%,28rem)] object-contain opacity-[0.11] contrast-[1.15] brightness-110"
            priority
          />
        </div>
      </aside>

      {/* טופס התחברות */}
      <main className="relative flex items-center justify-center bg-gradient-to-b from-sky-50 to-white p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] lg:hidden">
          <Image
            src="/logo.png"
            alt=""
            width={400}
            height={400}
            className="h-auto max-h-[70vh] w-[85%] object-contain"
          />
        </div>

        <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-lg backdrop-blur-sm sm:p-8">
          <LoginTimeGreeting />
          <h1 className="mt-4 text-2xl font-bold text-[var(--color-primary)]">כניסה למערכת</h1>
          <LoginForm initialError={err} />
        </div>
      </main>
    </div>
  );
}
