import type { GradeLevel } from "@/lib/cohorts/active";
import type { LookupRow, StudentStatus } from "@/lib/types/db";
import type { CohortRow } from "@/lib/cohorts/db";

export type StudentWithLookupsRow = {
  id: string;
  first_name: string;
  last_name: string;
  tz: string;
  cohort_id: string;
  class_id: string;
  specialization_id: string | null;
  track_id: string | null;
  notes?: string | null;
  status?: StudentStatus;
  created_at?: string;
  cohorts?: CohortRow | null;
  classes?: LookupRow | null;
  specializations?: LookupRow | null;
  tracks?: LookupRow | null;
  grade_level?: GradeLevel | null;
  cohort_name?: string | null;
};

export function asStudentRows(data: unknown): StudentWithLookupsRow[] {
  return (data ?? []) as StudentWithLookupsRow[];
}

export function asStudentRow(data: unknown): StudentWithLookupsRow {
  return data as StudentWithLookupsRow;
}
