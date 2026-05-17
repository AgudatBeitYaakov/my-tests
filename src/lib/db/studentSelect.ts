export { buildStudentWithLookupsSelect as getStudentWithLookupsSelect } from "@/lib/cohorts/db";

/** @deprecated השתמשי ב-getStudentWithLookupsSelect(supabase) לתאימות סכימה */
export const STUDENT_WITH_LOOKUPS = `
  *,
  cohorts ( id, name ),
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;
