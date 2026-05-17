"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AcademicYearSelector() {
  const { data, mutate } = useSWR<{ years: { id: string; name: string; is_active: boolean }[] }>(
    "/api/academic-years",
    fetcher,
  );

  const years = data?.years ?? [];
  const active = years.find((y) => y.is_active);

  async function onChange(yearId: string) {
    const r = await fetch("/api/academic-years/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year_id: yearId }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "שגיאה");
      return;
    }
    await mutate();
    window.location.reload();
  }

  if (!years.length) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-600">
      <span className="shrink-0 font-medium">שנת לימודים</span>
      <select
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        value={active?.id ?? ""}
        onChange={(e) => void onChange(e.target.value)}
      >
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
    </label>
  );
}
