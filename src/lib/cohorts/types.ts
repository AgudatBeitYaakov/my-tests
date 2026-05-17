export type GradeLevel = "א" | "ב";

export const ARCHIVED_COHORTS_COOKIE = "show_archived_cohorts";

export type CohortRow = {
  id: string;
  name: string;
  number?: number | null;
  grade_level: GradeLevel | null;
  is_current: boolean;
  is_archived: boolean;
};

export type CurrentCohorts = {
  cohortA: CohortRow | null;
  cohortB: CohortRow | null;
};

export type YearCohortConfig = {
  cohortAId: string | null;
  cohortBId: string | null;
  cohortAName: string;
  cohortBName: string;
  cohortToGrade: Map<string, GradeLevel>;
};
