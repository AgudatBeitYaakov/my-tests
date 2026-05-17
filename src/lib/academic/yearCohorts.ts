/** @deprecated Prefer @/lib/cohorts/active */
export type { GradeLevel, CohortRow, CurrentCohorts, YearCohortConfig } from "@/lib/cohorts/active";
export {
  cohortLabel,
  loadCohortConfig as loadYearCohortConfig,
  gradeForCohortInYear,
} from "@/lib/cohorts/active";
export { resolveImportTarget } from "@/lib/cohorts/import";
