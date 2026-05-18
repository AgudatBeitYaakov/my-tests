import type { SupabaseClient } from "@supabase/supabase-js";
import { repairAndResolveCohortPair } from "@/lib/cohorts/bootstrap";
import { loadCohortPairByIds } from "@/lib/cohorts/active";
import { validateAdjacentCohortPair } from "@/lib/cohorts/pairRules";
import { setSelectedCohortIds } from "@/lib/cohorts/settings";
import type { CohortPairView } from "@/lib/cohorts/types";

export async function resolveSelectedCohortPair(supabase: SupabaseClient): Promise<CohortPairView | null> {
  return repairAndResolveCohortPair(supabase);
}

export async function setSelectedCohortPair(
  supabase: SupabaseClient,
  cohortAId: string,
  cohortBId: string,
): Promise<{ pair: CohortPairView | null; error?: string }> {
  const pair = await loadCohortPairByIds(supabase, cohortAId, cohortBId);
  if (!pair) return { pair: null, error: "זוג מחזורים לא נמצא" };

  const adjacentErr = validateAdjacentCohortPair(pair.cohortA, pair.cohortB);
  if (adjacentErr) return { pair: null, error: adjacentErr };

  await setSelectedCohortIds(supabase, [pair.cohortA.id, pair.cohortB.id]);
  return { pair };
}

export async function selectedCohortIdList(supabase: SupabaseClient): Promise<string[]> {
  const pair = await resolveSelectedCohortPair(supabase);
  if (!pair) return [];
  return [pair.cohortA.id, pair.cohortB.id];
}
