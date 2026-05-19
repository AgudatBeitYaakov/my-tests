import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { pickLookupName } from "@/lib/lookups/display";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import type { Student } from "@/lib/types/db";

export type StudentDisplayFields = Pick<
  Student,
  | "grade_level"
  | "is_psychology"
  | "teaching_track_type"
  | "notes"
  | "classes"
  | "tracks"
  | "specializations"
  | "secondary_specializations"
> & { year_label?: string };

export function psychologyLabel(value: boolean | undefined | null): string {
  if (value === true) return "כן";
  if (value === false) return "לא";
  return "—";
}

/** שורות לתצוגה בטבלה / כרטיס / ייצוא */
export function studentProfileFields(s: StudentDisplayFields): { label: string; value: string }[] {
  return [
    {
      label: "שכבה",
      value: s.year_label ?? formatCohortGradeLabel(s.grade_level),
    },
    { label: "כיתה", value: pickLookupName(s.classes) },
    { label: "מסלול", value: pickLookupName(s.tracks) },
    { label: "התמחות", value: pickLookupName(s.specializations) },
    { label: "התמחות נוספת", value: pickLookupName(s.secondary_specializations) },
    { label: "פסיכולוגיה", value: psychologyLabel(s.is_psychology) },
    { label: "סוג הוראה", value: teachingTrackTypeLabel(s.teaching_track_type) },
    { label: "הערות", value: (s.notes ?? "").trim() || "—" },
  ];
}
