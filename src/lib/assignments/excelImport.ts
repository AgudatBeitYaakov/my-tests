import { parseGradeLevel, parseYearGroup } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";
import { ASSIGNMENT_EXCEL_HEADERS } from "@/lib/assignments/excelTemplate";
import {
  isTeachingTrackName,
  parseTeachingTrackTypeCell,
} from "@/lib/students/fields";
import { teacherDisplayName } from "@/lib/teachers/display";
import type { ExamTargetType, TeachingMode } from "@/lib/types/db";
import { filterDataRows } from "@/lib/students/excelImport";

export { filterDataRows };

export type AssignmentColumnMap = Partial<
  Record<keyof typeof ASSIGNMENT_FIELD_ALIASES, string>
>;

export type ParsedAssignmentRow = {
  rowNumber?: number;
  teacher_first_name: string;
  teacher_last_name: string;
  subject: string;
  lesson_name: string;
  year_group: string;
  grade_level: string;
  target_type_raw: string;
  target_value: string;
  teaching_mode_raw: string;
};

export type ValidatedAssignmentRow = ParsedAssignmentRow & {
  rowNumber: number;
  errors: string[];
  resolved?: {
    teacher_id: string;
    subject: string;
    lesson_name: string | null;
    year_group: number;
    grade_level: GradeLevel;
    target_type: ExamTargetType;
    target_id: string;
    teaching_mode: TeachingMode | null;
  };
};

export const ASSIGNMENT_FIELD_ALIASES: Record<
  keyof Omit<ParsedAssignmentRow, "rowNumber">,
  readonly string[]
> = {
  teacher_first_name: ["שם פרטי מורה", "שם פרטי", "first_name"],
  teacher_last_name: ["שם משפחה מורה", "שם משפחה", "last_name"],
  subject: ["מקצוע", "subject"],
  lesson_name: ["שם שיעור", "שיעור", "lesson_name"],
  year_group: ["שנתון", "year_group", "year"],
  grade_level: ["שכבה", "grade_level", "grade"],
  target_type_raw: ["סוג שיבוץ", "סוג יעד", "target_type"],
  target_value: ["ערך שיבוץ", "יעד", "target_value", "ערך יעד"],
  teaching_mode_raw: ["סוג הוראה", "הוראה מקוצר", "teaching_mode"],
};

const REQUIRED_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
  "teacher_first_name",
  "teacher_last_name",
  "subject",
  "year_group",
  "grade_level",
  "target_type_raw",
];

const ALL_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
  ...REQUIRED_FIELDS,
  "lesson_name",
  "target_value",
  "teaching_mode_raw",
];

function normalizeHeaderKey(k: string): string {
  const t = k.trim().replace(/\s+/g, " ");
  if (/^[a-z0-9_]+$/i.test(t)) return t.toLowerCase();
  return t;
}

function normCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) < 1e10) return String(Math.trunc(v));
    return String(v).trim();
  }
  return String(v).trim();
}

function cellFromRow(obj: Record<string, unknown>, field: keyof typeof ASSIGNMENT_FIELD_ALIASES): string {
  const nkMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    nkMap.set(normalizeHeaderKey(k), v);
  }
  for (const alias of ASSIGNMENT_FIELD_ALIASES[field]) {
    const hit = nkMap.get(normalizeHeaderKey(alias));
    if (hit !== undefined) return normCell(hit);
  }
  return "";
}

export function assertAssignmentRequiredHeaders(rawKeys: string[]): string | null {
  const nk = new Set(rawKeys.map((k) => normalizeHeaderKey(k)).filter(Boolean));
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const ok = ASSIGNMENT_FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a)));
    if (!ok) missing.push(ASSIGNMENT_FIELD_ALIASES[field][0]);
  }
  if (!missing.length) return null;
  return `חסרות עמודות חובה: ${missing.join(", ")}. הורידי את התבנית ממסך ייבוא השיבוצים.`;
}

export function sheetRowsToAssignmentObjects(raw: Record<string, unknown>[]): ParsedAssignmentRow[] {
  const out: ParsedAssignmentRow[] = [];
  let i = 0;
  for (const obj of raw) {
    i += 1;
    out.push({
      rowNumber: i + 1,
      teacher_first_name: cellFromRow(obj, "teacher_first_name"),
      teacher_last_name: cellFromRow(obj, "teacher_last_name"),
      subject: cellFromRow(obj, "subject"),
      lesson_name: cellFromRow(obj, "lesson_name"),
      year_group: cellFromRow(obj, "year_group"),
      grade_level: cellFromRow(obj, "grade_level"),
      target_type_raw: cellFromRow(obj, "target_type_raw"),
      target_value: cellFromRow(obj, "target_value"),
      teaching_mode_raw: cellFromRow(obj, "teaching_mode_raw"),
    });
  }
  return out;
}

export function assignmentImportKey(
  academicYearId: string,
  resolved: NonNullable<ValidatedAssignmentRow["resolved"]>,
): string {
  return [
    academicYearId,
    resolved.teacher_id,
    resolved.year_group,
    resolved.grade_level,
    resolved.subject,
    resolved.lesson_name ?? "",
    resolved.target_type,
    resolved.target_id,
    resolved.teaching_mode ?? "",
  ].join("\0");
}

export function applyAssignmentColumnMap(
  raw: Record<string, unknown>[],
  map: AssignmentColumnMap,
): Record<string, unknown>[] {
  if (!Object.keys(map).length) return raw;
  return raw.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const field of ALL_FIELDS) {
      const src = map[field]?.trim();
      if (!src) continue;
      const val = row[src] ?? row[Object.keys(row).find((k) => normalizeHeaderKey(k) === normalizeHeaderKey(src)) ?? ""];
      if (val !== undefined) {
        out[ASSIGNMENT_FIELD_ALIASES[field][0]] = val;
      }
    }
    return out;
  });
}

function normalizeNameKey(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export type TeacherLookupMaps = {
  byFullName: Map<string, string>;
  byParts: Map<string, string>;
};

export function buildTeacherLookupMaps(
  teachers: { id: string; first_name: string; last_name: string; full_name_generated?: string | null }[],
): TeacherLookupMaps {
  const byFullName = new Map<string, string>();
  const byParts = new Map<string, string>();
  for (const t of teachers) {
    const full = normalizeNameKey(teacherDisplayName(t));
    if (full) byFullName.set(full, t.id);
    const parts = normalizeNameKey(`${t.first_name} ${t.last_name}`);
    if (parts) byParts.set(parts, t.id);
  }
  return { byFullName, byParts };
}

function resolveTeacherId(
  maps: TeacherLookupMaps,
  first: string,
  last: string,
): { id?: string; err?: string } {
  const parts = normalizeNameKey(`${first} ${last}`);
  if (!parts) return { err: "שם מורה חסר" };
  const byParts = maps.byParts.get(parts);
  if (byParts) return { id: byParts };
  const byFull = maps.byFullName.get(parts);
  if (byFull) return { id: byFull };
  return { err: `מורה "${first} ${last}" לא נמצאה — הוסיפי אותה במסך מורות` };
}

function parseTargetType(raw: string): ExamTargetType | null {
  const t = raw.trim().toLowerCase();
  if (["class", "כיתה"].includes(t)) return "class";
  if (["specialization", "התמחות", "spec"].includes(t)) return "specialization";
  if (["track", "מסלול"].includes(t)) return "track";
  if (["psychology", "פסיכולוגיה", "פסיכ"].includes(t)) return "psychology";
  return null;
}

function lookupTarget(
  targetType: ExamTargetType,
  value: string,
  classByName: Map<string, string>,
  specByName: Map<string, string>,
  trackByName: Map<string, string>,
): { id?: string; err?: string } {
  if (targetType === "psychology") {
    return { id: "__psychology__" };
  }
  const name = value.trim();
  if (!name) return { err: "ערך שיבוץ חסר" };
  const map =
    targetType === "class" ? classByName : targetType === "specialization" ? specByName : trackByName;
  const label =
    targetType === "class" ? "כיתה" : targetType === "specialization" ? "התמחות" : "מסלול";
  const id = map.get(name);
  if (!id) return { err: `${label} "${name}" לא קיימת בלוקאפים` };
  return { id };
}

export type AssignmentImportMaps = {
  teacherMaps: TeacherLookupMaps;
  classByName: Map<string, string>;
  specByName: Map<string, string>;
  trackByName: Map<string, string>;
  academicYearId: string;
  trackNameById: Map<string, string>;
};

export function validateAssignmentImportRows(
  rows: ParsedAssignmentRow[],
  maps: AssignmentImportMaps,
): ValidatedAssignmentRow[] {
  return rows.map((r, idx) => {
    const rowNumber = r.rowNumber ?? idx + 1;
    const errors: string[] = [];

    if (!r.teacher_first_name.trim()) errors.push("שם פרטי מורה חסר");
    if (!r.teacher_last_name.trim()) errors.push("שם משפחה מורה חסר");
    if (!r.subject.trim()) errors.push("מקצוע חסר");
    if (!r.year_group.trim()) errors.push("שנתון חסר");
    if (!r.grade_level.trim()) errors.push("שכבה חסרה");
    if (!r.target_type_raw.trim()) errors.push("סוג שיבוץ חסר");

    const teacher = resolveTeacherId(maps.teacherMaps, r.teacher_first_name, r.teacher_last_name);
    if (teacher.err) errors.push(teacher.err);

    const year_group = parseYearGroup(r.year_group);
    const grade_level = parseGradeLevel(r.grade_level);
    if (!year_group) errors.push("שנתון לא תקין");
    if (!grade_level) errors.push("שכבה לא תקינה (א/ב/ג)");

    const target_type = parseTargetType(r.target_type_raw);
    if (!target_type) errors.push("סוג שיבוץ לא תקין (כיתה/התמחות/מסלול/פסיכולוגיה)");

    let target_id: string | undefined;
    if (target_type) {
      const tgt = lookupTarget(
        target_type,
        r.target_value,
        maps.classByName,
        maps.specByName,
        maps.trackByName,
      );
      if (tgt.err) errors.push(tgt.err);
      else if (target_type === "psychology") target_id = maps.academicYearId;
      else target_id = tgt.id;
    }

    let teaching_mode: TeachingMode | null = null;
    if (r.teaching_mode_raw.trim()) {
      if (target_type !== "track") {
        errors.push("סוג הוראה מותר רק כשסוג השיבוץ הוא מסלול");
      } else if (target_id && target_id !== maps.academicYearId) {
        const trackName = maps.trackNameById.get(target_id) ?? "";
        if (!isTeachingTrackName(trackName)) {
          errors.push("סוג הוראה מותר רק במסלול «הוראה»");
        } else {
          teaching_mode = parseTeachingTrackTypeCell(r.teaching_mode_raw);
          if (!teaching_mode) errors.push("סוג הוראה לא תקין (מלא/מקוצר)");
        }
      }
    }

    const resolved =
      errors.length === 0 &&
      teacher.id &&
      target_type &&
      target_id &&
      year_group &&
      grade_level
        ? {
            teacher_id: teacher.id,
            subject: r.subject.trim(),
            lesson_name: r.lesson_name.trim() || null,
            year_group,
            grade_level,
            target_type,
            target_id,
            teaching_mode,
          }
        : undefined;

    return { ...r, rowNumber, errors, resolved };
  });
}
