"use client";

import Link from "next/link";
import useSWR from "swr";
import { GradeBadge } from "@/components/cohorts/GradeBadge";
import { Spinner } from "@/components/ui/Spinner";
import type { CohortBadgeKind } from "@/lib/cohorts/apiPayload";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Row = {
  id: string;
  number: number;
  name: string;
  label: string;
  badge: CohortBadgeKind;
};

export function ArchivedCohortsClient() {
  const { data, error, isLoading } = useSWR<{ cohorts: Row[] }>("/api/cohorts/archived", fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-zinc-600">
        <Spinner /> טוען…
      </div>
    );
  }
  if (error) {
    return <p className="text-red-700">שגיאת טעינה</p>;
  }

  const rows = data?.cohorts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">מחזורים קודמים</h1>
        <p className="mt-1 text-sm text-zinc-600">מחזורים שאינם בזוג הפעיל הנוכחי (היסטוריה / לא בשכבה א–ב)</p>
      </div>
      <ul className="divide-y rounded-xl border border-zinc-200 bg-white">
        {rows.length ? (
          rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">מחזור {c.name}</span>
              <GradeBadge kind={c.badge} />
            </li>
          ))
        ) : (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">אין מחזורים בארכיון</li>
        )}
      </ul>
      <Link href="/settings/open-year" className="text-sm text-sky-700 hover:underline">
        חזרה לפתיחת שנתון
      </Link>
    </div>
  );
}
