"use client";

import Link from "next/link";
import { GradeBadge } from "@/components/cohorts/GradeBadge";
import { useCohortPair } from "@/components/cohorts/CohortPairProvider";

export function CohortArchiveToggle() {
  const { data } = useCohortPair();
  const selected = data?.selected;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
      <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">זוג מחזורים:</span>
      {selected ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            <GradeBadge kind={selected.cohortA.badge} />
            מחזור {selected.cohortA.name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            <GradeBadge kind={selected.cohortB.badge} />
            מחזור {selected.cohortB.name}
          </span>
        </>
      ) : (
        <span className="text-amber-800">לא הוגדר זוג — פתחי שנתון</span>
      )}
      <Link href="/settings/archived-cohorts" className="text-sky-700 hover:underline">
        מחזורים קודמים
      </Link>
    </div>
  );
}
