"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";

export function OpenYearClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newCohort, setNewCohort] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch("/api/cohorts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_cohort_number: newCohort.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const res = (j as { result?: { cohortAName: string; cohortBName: string; archivedName: string | null } }).result;
      setMessage(
        res
          ? `עודכן: מחזור ${res.cohortAName} — שכבה א, מחזור ${res.cohortBName} — שכבה ב${res.archivedName ? `, מחזור ${res.archivedName} בארכיון` : ""}`
          : "השנתון נפתח בהצלחה",
      );
      setTimeout(() => router.push("/students"), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <ListPageHeader
        title="פתיחת שנתון חדש"
        actions={<Link href="/settings" className={LIST_SECONDARY_LINK_CLASS}>חזרה</Link>}
      />
      <p className="max-w-md text-sm text-zinc-600">
        המערכת תעביר אוטומטית: המחזור החדש לשכבה א, המחזור הקודם של שכבה א לשכבה ב, ומחזור שכבה ב הקודם לארכיון.
      </p>
      <form onSubmit={(e) => void submit(e)} className="max-w-md space-y-3 rounded border bg-white p-4 dark:bg-zinc-900">
        <label className="block text-sm">
          מספר מחזור חדש
          <input
            required
            type="number"
            min={1}
            className="mt-1 w-full rounded border px-2 py-1"
            value={newCohort}
            onChange={(e) => setNewCohort(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        <button disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">
          {busy ? "..." : "פתיחת שנתון"}
        </button>
      </form>
    </div>
  );
}
