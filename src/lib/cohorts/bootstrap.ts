import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCohortPairByIds, loadDefaultCohortPair } from "@/lib/cohorts/active";
import { validateAdjacentCohortPair } from "@/lib/cohorts/pairRules";
import { getSelectedCohortIds, setSelectedCohortIds } from "@/lib/cohorts/settings";
import type { CohortPairView } from "@/lib/cohorts/types";

async function pairStillValid(
  supabase: SupabaseClient,
  idA: string,
  idB: string,
): Promise<CohortPairView | null> {
  const pair = await loadCohortPairByIds(supabase, idA, idB);
  if (!pair) return null;
  if (validateAdjacentCohortPair(pair.cohortA, pair.cohortB)) return null;
  return pair;
}

export async function repairAndResolveCohortPair(
  supabase: SupabaseClient,
): Promise<CohortPairView | null> {
  const saved = await getSelectedCohortIds(supabase);
  if (saved) {
    const valid = await pairStillValid(supabase, saved[0], saved[1]);
    if (valid) return valid;
  }

  const active = await loadDefaultCohortPair(supabase);
  if (active) {
    await setSelectedCohortIds(supabase, [active.cohortA.id, active.cohortB.id]);
    return active;
  }

  return null;
}
