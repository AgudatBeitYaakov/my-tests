"use client";

import Link from "next/link";
import { GradeBadge } from "@/components/cohorts/GradeBadge";
import { useCohortPair } from "@/components/cohorts/CohortPairProvider";

export function CohortPairSelector() {
  const { data, loading, error, selectPair } = useCohortPair();

  const selected = data?.selected;
  const pairs = data?.pairs ?? [];

  const selectedKey = selected
    ? `${selected.cohortA.id},${selected.cohortB.id}`
    : "";

  async function onPairChange(value: string) {
    const [cohort_a_id, cohort_b_id] = value.split(",");
    if (!cohort_a_id || !cohort_b_id) return;
    try {
      await selectPair(cohort_a_id, cohort_b_id);
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading && !data) {
    return <span className="text-xs text-zinc-500">טוען מחזורים…</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">מחזורים נבחרים:</span>
      {selected ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            <GradeBadge kind={selected.cohortA.badge} />
            {selected.cohortA.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            <GradeBadge kind={selected.cohortB.badge} />
            {selected.cohortB.label}
          </span>
        </>
      ) : (
        <span className="text-amber-700">
          {data?.setupRequired ? (
            <>
              {data.message ?? "אין זוג פעיל"}{" "}
              <Link href="/settings/open-year" className="underline">
                פתיחת מחזור
              </Link>
            </>
          ) : (
            "לא הוגדר זוג מחזורים"
          )}
        </span>
      )}
      {error && !selected ? <span className="text-red-600">{error}</span> : null}
      {pairs.length > 0 ? (
        <label className="flex items-center gap-1.5">
          <span className="sr-only">בחירת זוג מחזורים</span>
          <select
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={selectedKey}
            onChange={(e) => void onPairChange(e.target.value)}
          >
            {!selectedKey ? <option value="">— בחרי זוג —</option> : null}
            {pairs.map((p) => (
              <option key={`${p.cohortAId},${p.cohortBId}`} value={`${p.cohortAId},${p.cohortBId}`}>
                {p.label}
                {p.isActivePair ? " (פעיל)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
