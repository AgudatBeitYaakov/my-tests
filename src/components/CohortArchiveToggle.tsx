"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CohortArchiveToggle() {
  const { data, mutate } = useSWR<{
    cohortA: { name: string; grade_level: string } | null;
    cohortB: { name: string; grade_level: string } | null;
    showArchived: boolean;
  }>("/api/cohorts/current", fetcher);

  const showArchived = data?.showArchived ?? false;

  async function toggle() {
    const r = await fetch("/api/cohorts/current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_archived: !showArchived }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "שגיאה");
      return;
    }
    await mutate();
    window.location.reload();
  }

  const a = data?.cohortA;
  const b = data?.cohortB;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
      <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">שנתונים פעילים:</span>
      {a ? (
        <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
          מחזור {a.name} — שכבה {a.grade_level}
        </span>
      ) : null}
      {b ? (
        <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          מחזור {b.name} — שכבה {b.grade_level}
        </span>
      ) : null}
      <label className="flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" checked={showArchived} onChange={() => void toggle()} className="rounded" />
        <span>הצג שנתונים קודמים</span>
      </label>
    </div>
  );
}
