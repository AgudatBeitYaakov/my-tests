"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";

export function OpenYearClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [cohortA, setCohortA] = useState("");
  const [cohortB, setCohortB] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const r = await fetch("/api/academic-years/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          cohort_a_name: cohortA.trim(),
          cohort_b_name: cohortB.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const y = (j as { year?: { yearName: string; cohortAName: string; cohortBName: string } }).year;
      setMessage(
        y
          ? `נפתחה שנת ${y.yearName}: שכבה א׳ — מחזור ${y.cohortAName}, שכבה ב׳ — מחזור ${y.cohortBName}`
          : "השנה נוצרה והוגדרה כפעילה",
      );
      setName("");
      setCohortA("");
      setCohortB("");
      setTimeout(() => router.push("/students"), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
        <ListPageHeader
          title="פתיחת שנת לימודים"
          subtitle="הגדרת שנה חדשה עם מחזור לשכבה א׳ ומחזור לשכבה ב׳. השנה הקודמת תסומן כלא פעילה."
          actions={
            <Link href="/settings" className={LIST_SECONDARY_LINK_CLASS}>
              חזרה להגדרות
            </Link>
          }
        />

        <form
          onSubmit={(e) => void submit(e)}
          className="grid max-w-lg gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-md"
        >
          <label className="block text-sm">
            <span className="font-medium">שם שנת לימודים</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={'תשפ"ז'}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">מחזור שכבה א׳</span>
            <input
              required
              value={cohortA}
              onChange={(e) => setCohortA(e.target.value)}
              placeholder="10"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">מחזור שכבה ב׳</span>
            <input
              required
              value={cohortB}
              onChange={(e) => setCohortB(e.target.value)}
              placeholder="9"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-800">{message}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                יוצרת שנה…
              </span>
            ) : (
              "פתיחת שנה"
            )}
          </button>
        </form>

        <p className="max-w-lg text-sm text-zinc-600">
          דוגמה: בשנת תשפ&quot;ז מחזור 10 יהיה בשכבה א׳ ומחזור 9 בשכבה ב׳. מחזורים חדשים נוצרים אוטומטית אם
          אינם קיימים.
        </p>
    </div>
  );
}
