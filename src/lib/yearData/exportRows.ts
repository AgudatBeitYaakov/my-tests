import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowToMultiTarget,
} from "@/lib/assignments/multiTarget";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { asStudentRows, type StudentWithLookupsRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { ASSIGNMENT_EXCEL_HEADERS } from "@/lib/assignments/excelTemplate";
import { LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";
import { pickLookupName } from "@/lib/lookups/display";
import { STUDENT_EXCEL_HEADERS } from "@/lib/students/excelTemplate";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";
import { TEACHER_EXCEL_HEADERS } from "@/lib/teachers/excelTemplate";
import {
  YEAR_DATA_FILE_NAMES,
  YEAR_DATA_IMPORT_ORDER,
  type YearDataKind,
} from "@/lib/yearData/fileNames";

/** לייצוא תואם-ייבוא — לא לייצא «—» כערך תא */
function lookupNameForImport(v: unknown): string {
  const n = pickLookupName(v);
  return n === "—" ? "" : n;
}

function teachingModeForImport(mode: string | null | undefined): string {
  const label = teachingModeSelectionLabel(mode);
  return label === "—" ? "" : label;
}

export type YearExportFile = {
  kind: YearDataKind;
  filename: string;
  sheetName: string;
  rows: Record<string, string>[];
};

async function paginateSelect<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function namesByIdMap(rows: { id: string; name: string }[] | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows ?? []) m.set(r.id, r.name);
  return m;
}

function joinNames(ids: string[], byId: Map<string, string>): string {
  return ids
    .map((id) => byId.get(id) ?? "")
    .filter(Boolean)
    .join(", ");
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null;
  return v;
}

async function exportLookupRows(
  supabase: SupabaseClient,
  table: "classes" | "specializations" | "tracks",
  yearId: string,
): Promise<Record<string, string>[]> {
  const data = await paginateSelect<{ name: string }>((from, to) =>
    supabase
      .from(table)
      .select("name")
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
      .range(from, to),
  );
  return data.map((r) => ({ [LOOKUP_EXCEL_HEADER]: r.name }));
}

async function exportTeacherRows(
  supabase: SupabaseClient,
  yearId: string,
): Promise<Record<string, string>[]> {
  const data = await paginateSelect<{
    first_name: string;
    last_name: string;
    tz: string | null;
    email: string | null;
    notes: string | null;
  }>((from, to) =>
    notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS))
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .range(from, to),
  );
  return data.map((t) => ({
    [TEACHER_EXCEL_HEADERS[0]]: t.first_name ?? "",
    [TEACHER_EXCEL_HEADERS[1]]: t.last_name ?? "",
    [TEACHER_EXCEL_HEADERS[2]]: t.tz ?? "",
    [TEACHER_EXCEL_HEADERS[3]]: t.email ?? "",
    [TEACHER_EXCEL_HEADERS[4]]: (t.notes ?? "").trim(),
  }));
}

async function exportStudentRows(
  supabase: SupabaseClient,
  yearId: string,
): Promise<Record<string, string>[]> {
  const studentSelect = await getStudentWithLookupsSelect();
  const data = await paginateSelect<StudentWithLookupsRow>(async (from, to) => {
    const res = await supabase
      .from("students")
      .select(studentSelect)
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .range(from, to);
    return {
      data: asStudentRows(res.data),
      error: res.error,
    };
  });
  return asStudentRows(data).map((s) => {
    const teaching =
      s.teaching_track_type === "full"
        ? "מלא"
        : s.teaching_track_type === "short"
          ? "מקוצר"
          : "";
    return {
      [STUDENT_EXCEL_HEADERS[0]]: s.first_name ?? "",
      [STUDENT_EXCEL_HEADERS[1]]: s.last_name ?? "",
      [STUDENT_EXCEL_HEADERS[2]]: s.tz ?? "",
      [STUDENT_EXCEL_HEADERS[3]]: lookupNameForImport(s.classes),
      [STUDENT_EXCEL_HEADERS[4]]: lookupNameForImport(s.specializations),
      [STUDENT_EXCEL_HEADERS[5]]: lookupNameForImport(s.tracks),
      [STUDENT_EXCEL_HEADERS[6]]: lookupNameForImport(s.secondary_specializations),
      [STUDENT_EXCEL_HEADERS[7]]: s.is_psychology ? "כן" : "לא",
      [STUDENT_EXCEL_HEADERS[8]]: teaching,
      [STUDENT_EXCEL_HEADERS[9]]: s.grade_level ?? "",
    };
  });
}

async function exportAssignmentRows(
  supabase: SupabaseClient,
  yearId: string,
): Promise<Record<string, string>[]> {
  const raw = await paginateSelect((from, to) =>
    notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS))
      .eq("academic_year_id", yearId)
      .order("subject")
      .range(from, to),
  );

  type Row = {
    subject?: string | null;
    lesson_name?: string | null;
    teaching_mode?: string | null;
    assignment_category?: string;
    teachers?:
      | { first_name?: string; last_name?: string }
      | { first_name?: string; last_name?: string }[]
      | null;
    grade_levels?: string[];
    class_ids?: string[];
    track_ids?: string[];
    specialization_ids?: string[];
    psychology_enabled?: boolean;
    applies_to_all_in_grade?: boolean;
  };

  const rows = raw as Row[];
  const classIds = new Set<string>();
  const specIds = new Set<string>();
  const trackIds = new Set<string>();
  for (const a of rows) {
    const mt = rowToMultiTarget(a);
    mt.class_ids.forEach((id) => classIds.add(id));
    mt.specialization_ids.forEach((id) => specIds.add(id));
    mt.track_ids.forEach((id) => trackIds.add(id));
  }

  const [classesRes, specsRes, tracksRes] = await Promise.all([
    classIds.size
      ? supabase.from("classes").select("id,name").in("id", [...classIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    specIds.size
      ? supabase.from("specializations").select("id,name").in("id", [...specIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    trackIds.size
      ? supabase.from("tracks").select("id,name").in("id", [...trackIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const classById = namesByIdMap(classesRes.data as { id: string; name: string }[]);
  const specById = namesByIdMap(specsRes.data as { id: string; name: string }[]);
  const trackById = namesByIdMap(tracksRes.data as { id: string; name: string }[]);

  return rows.map((a) => {
    const mt = rowToMultiTarget(a);
    const teacher = unwrapOne(a.teachers);
    const classCell = mt.applies_to_all_in_grade
      ? "כל השכבה"
      : joinNames(mt.class_ids, classById);
    return {
      [ASSIGNMENT_EXCEL_HEADERS[0]]: teacher?.first_name ?? "",
      [ASSIGNMENT_EXCEL_HEADERS[1]]: teacher?.last_name ?? "",
      [ASSIGNMENT_EXCEL_HEADERS[2]]: a.subject ?? "",
      [ASSIGNMENT_EXCEL_HEADERS[3]]: a.lesson_name ?? "",
      [ASSIGNMENT_EXCEL_HEADERS[4]]: mt.grade_levels.join(", "),
      [ASSIGNMENT_EXCEL_HEADERS[5]]: a.assignment_category ?? "",
      [ASSIGNMENT_EXCEL_HEADERS[6]]: classCell,
      [ASSIGNMENT_EXCEL_HEADERS[7]]: joinNames(mt.specialization_ids, specById),
      [ASSIGNMENT_EXCEL_HEADERS[8]]: joinNames(mt.track_ids, trackById),
      [ASSIGNMENT_EXCEL_HEADERS[9]]: mt.psychology_enabled ? "כן" : "לא",
      [ASSIGNMENT_EXCEL_HEADERS[10]]: teachingModeForImport(a.teaching_mode),
    };
  });
}

export async function buildYearExportFiles(
  supabase: SupabaseClient,
  yearId: string,
): Promise<YearExportFile[]> {
  const files: YearExportFile[] = [];

  for (const kind of YEAR_DATA_IMPORT_ORDER) {
    const meta = YEAR_DATA_FILE_NAMES[kind];
    let rows: Record<string, string>[] = [];
    if (kind === "classes") rows = await exportLookupRows(supabase, "classes", yearId);
    else if (kind === "specializations") {
      rows = await exportLookupRows(supabase, "specializations", yearId);
    } else if (kind === "tracks") rows = await exportLookupRows(supabase, "tracks", yearId);
    else if (kind === "teachers") rows = await exportTeacherRows(supabase, yearId);
    else if (kind === "students") rows = await exportStudentRows(supabase, yearId);
    else if (kind === "assignments") rows = await exportAssignmentRows(supabase, yearId);

    files.push({
      kind,
      filename: meta.primary,
      sheetName: meta.sheetName,
      rows,
    });
  }

  return files;
}
