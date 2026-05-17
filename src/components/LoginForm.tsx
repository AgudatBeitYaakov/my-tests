"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError === "wrong_password" ? "שם משתמש או סיסמה שגויים" : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j as { error?: string }).error ?? "שגיאת התחברות";
        if (msg === "Unauthorized") {
          throw new Error("השרת חסם התחברות — עצרי והפעילי מחדש את npm run dev");
        }
        throw new Error(msg);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">שם משתמש</span>
        <input
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">סיסמה</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </label>
      {error ? (
        <div className="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
      >
        {loading ? "מתחברת…" : "התחברות"}
      </button>
      <p className="text-center text-xs text-slate-500">התחברות ראשונה: admin + סיסמת APP_PASSWORD מההגדרות</p>
    </form>
  );
}
