"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import useSWR from "swr";
import type { CohortPairApiResponse } from "@/lib/cohorts/apiPayload";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const j = (await r.json()) as CohortPairApiResponse & { error?: string };
    if (!r.ok) throw new Error(j.message ?? j.error ?? "שגיאת טעינת מחזורים");
    return j;
  });

type CohortPairContextValue = {
  data: CohortPairApiResponse | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectPair: (cohortAId: string, cohortBId: string) => Promise<void>;
  cohortIds: string[];
};

const CohortPairContext = createContext<CohortPairContextValue | null>(null);

export function CohortPairProvider({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<CohortPairApiResponse>("/api/cohorts/pair", fetcher, {
    revalidateOnFocus: true,
  });

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const selectPair = useCallback(
    async (cohortAId: string, cohortBId: string) => {
      const r = await fetch("/api/cohorts/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort_a_id: cohortAId, cohort_b_id: cohortBId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      await mutate();
    },
    [mutate],
  );

  const value = useMemo<CohortPairContextValue>(
    () => ({
      data,
      loading: isLoading,
      error: error?.message ?? data?.message ?? null,
      refresh,
      selectPair,
      cohortIds: data?.selected?.cohortIds ?? [],
    }),
    [data, error, isLoading, refresh, selectPair],
  );

  return <CohortPairContext.Provider value={value}>{children}</CohortPairContext.Provider>;
}

export function useCohortPair() {
  const ctx = useContext(CohortPairContext);
  if (!ctx) throw new Error("useCohortPair must be used within CohortPairProvider");
  return ctx;
}
