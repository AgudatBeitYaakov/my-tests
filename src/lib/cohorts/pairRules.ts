import type { CohortRow } from "@/lib/cohorts/types";

export function areAdjacentCohortNumbers(a: number, b: number): boolean {
  return Math.abs(a - b) === 1;
}

export function validateAdjacentCohortPair(
  cohortA: Pick<CohortRow, "number">,
  cohortB: Pick<CohortRow, "number">,
): string | null {
  if (!areAdjacentCohortNumbers(cohortA.number, cohortB.number)) {
    return "מותר לבחור רק זוג מחזורים עוקבים (למשל 10+9 או 9+8)";
  }
  return null;
}
