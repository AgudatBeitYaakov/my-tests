import {
  cohortDisplayNumber,
  cohortWithGradeLabel,
  gradeForCohort,
  gradeInPair,
} from "@/lib/cohorts/grades";
import type { CohortPairView, CohortRow, GradeLevel } from "@/lib/cohorts/types";

export type CohortBadgeKind = "layer_a" | "layer_b" | "history" | "unknown";

export function cohortBadgeKind(cohort: Pick<CohortRow, "display_order">): CohortBadgeKind {
  if (cohort.display_order === 1) return "layer_a";
  if (cohort.display_order === 2) return "layer_b";
  return "history";
}

export function cohortApiItem(cohort: CohortRow, pair: CohortPairView | null) {
  const grade =
    gradeForCohort(cohort) ?? (pair ? gradeInPair(cohort.id, pair) : null);
  return {
    id: cohort.id,
    number: cohort.number,
    name: cohortDisplayNumber(cohort),
    display_order: cohort.display_order,
    grade_level: grade,
    label: cohortWithGradeLabel({ ...cohort, display_order: cohort.display_order }),
    badge: cohortBadgeKind(cohort),
  };
}

export function pairApiPayload(pair: CohortPairView) {
  return {
    cohortA: cohortApiItem(pair.cohortA, pair),
    cohortB: cohortApiItem(pair.cohortB, pair),
    cohortIds: [pair.cohortA.id, pair.cohortB.id] as [string, string],
    label: `${pair.cohortA.number} + ${pair.cohortB.number}`,
  };
}

export type CohortPairApiResponse = {
  selected: ReturnType<typeof pairApiPayload> | null;
  pairs: Array<{
    cohortAId: string;
    cohortBId: string;
    label: string;
    isDefaultPair: boolean;
    isActivePair: boolean;
  }>;
  setupRequired: boolean;
  message: string | null;
  rules: {
    adjacentOnly: boolean;
    sourceOfTruth: "cohort_id";
    gradeFrom: "display_order";
  };
};
