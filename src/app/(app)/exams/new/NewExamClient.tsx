"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import type { GradeLevel } from "@/lib/academicYears/types";
import { Spinner } from "@/components/ui/Spinner";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import { teachingModeLabel } from "@/lib/teachers/display";
import type { TeachingMode, TeachingTrackType } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  subject: string;
  lesson_name?: string | null;
  teaching_mode?: TeachingMode | null;
  grade_level: string;
  year_label?: string;
  track_id: string | null;
  target_label?: string;
  target_type_label?: string;
};

type GradeLevelOption = {
  id: string;
  name: string;
  grade_levels: GradeLevel[];
};

export function NewExamClient() {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();

  const [teacherId, setTeacherId] = useState("");
  const [gradeLevelOptionIds, setGradeLevelOptionIds] = useState<string[]>([]);
  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    const p = new URLSearchParams({ teacher_id: teacherId });
    return withYearQuery(`/api/teacher-assignments?${p.toString()}`, viewingYear?.id);
  }, [teacherId, viewingYear?.id]);

  const { data: aData, isLoading: aLoad } = useSWR<{ assignments: AssignmentRow[] }>(assignUrl, fetcher);
  const { data: gradeData } = useSWR<{ items: GradeLevelOption[] }>(
    "/api/lookups/grade-level-options",
    fetcher,
  );

  const gradeOptions = gradeData?.items ?? [];

  const selectedGradeLevels = useMemo(() => {
    const levels = new Set<GradeLevel>();
    for (const id of gradeLevelOptionIds) {
      const opt = gradeOptions.find((o) => o.id === id);
      opt?.grade_levels.forEach((g) => levels.add(g));
    }
    return levels;
  }, [gradeLevelOptionIds, gradeOptions]);

  const activeAssignments = useMemo(() => {
    const all = aData?.assignments ?? [];
    if (!selectedGradeLevels.size) return all;
    return all.filter((a) => selectedGradeLevels.has(a.grade_level as GradeLevel));
  }, [aData, selectedGradeLevels]);

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [teachingTrackType, setTeachingTrackType] = useState<TeachingTrackType | "">("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => activeAssignments.find((a) => a.id === assignmentId),
    [activeAssignments, assignmentId],
  );

  const isTeachingTarget =
    Boolean(selected?.track_id) &&
    (selected?.target_label === TEACHING_TRACK_NAME ||
      selected?.target_label?.includes(TEACHING_TRACK_NAME));

  useEffect(() => {
    setAssignmentId("");
  }, [teacherId, gradeLevelOptionIds]);

  useEffect(() => {
    if (selected?.teaching_mode) {
      setTeachingTrackType(selected.teaching_mode);
    } else if (!isTeachingTarget) {
      setTeachingTrackType("");
    }
  }, [selected?.id, selected?.teaching_mode, isTeachingTarget]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId || !gradeLevelOptionIds.length || !selected || !examDate) {
      alert("מלאי מורה, שכבה (אחת או יותר), שיבוץ ותאריך");
      return;
    }
    if (isTeachingTarget && !teachingTrackType) {
      alert("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(withYearQuery("/api/exams", viewingYear?.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject: selected.subject,
          exam_date: examDate,
          grade_level_option_ids: gradeLevelOptionIds,
          teacher_assignment_id: selected.id,
          teaching_track_type: isTeachingTarget ? teachingTrackType : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const examId = (j as { exam?: { id: string } }).exam?.id;
      const createdCount = (j as { created_count?: number }).created_count ?? 1;
      if (createdCount > 1) {
        alert(`נוצרו ${createdCount} מבחנים (לפי השכבות שנבחרו)`);
        router.push("/exams");
        return;
      }
      if (examId) router.push(`/exams/${examId}`);
      else router.push("/exams");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">יצירת מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">
            מורה → שכבה → שיבוץ → תאריך. אפשר לסמן כמה שכבות (למשל «ג» וגם «א+ב») — נוצר מבחן נפרד לכל שכבה באותו יעד.
            {viewingYear ? ` (${viewingYear.year_name})` : ""}
          </p>
        </div>
        <Link
          href="/exams"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>

      <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <TeacherSearchCombobox
          value={teacherId}
          onChange={(id) => {
            setTeacherId(id);
            setGradeLevelOptionIds([]);
          }}
          disabled={readOnly}
          required
          label="מורה"
        />

        <fieldset className="block" disabled={!teacherId || readOnly}>
          <legend className="text-sm font-medium text-zinc-700">שכבות * (אפשר כמה)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {gradeOptions.map((o) => {
              const checked = gradeLevelOptionIds.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setGradeLevelOptionIds((prev) =>
                        checked ? prev.filter((id) => id !== o.id) : [...prev, o.id],
                      );
                    }}
                  />
                  {o.name}
                  <span className="text-xs text-zinc-500">({o.grade_levels.join(", ")})</span>
                </label>
              );
            })}
          </div>
          {!gradeOptions.length ? (
            <p className="mt-1 text-xs text-amber-800">
              אין שכבות בלוקאפ — הוסיפי בהגדרות → שכבות (למשל: א, ב, ג, א+ב)
            </p>
          ) : null}
          {gradeLevelOptionIds.length > 1 ? (
            <p className="mt-2 text-xs text-zinc-600">
              נבחרו {selectedGradeLevels.size} שכבות — ייווצרו עד {selectedGradeLevels.size} מבחנים (אותו מקצוע ויעד)
            </p>
          ) : null}
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעד)</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={assignmentId}
            onChange={(e) => {
              setAssignmentId(e.target.value);
              setTeachingTrackType("");
            }}
            required
            disabled={!teacherId || !gradeLevelOptionIds.length || readOnly}
          >
            <option value="">— בחרי —</option>
            {activeAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.year_label ? `${a.year_label} · ` : ""}
                {a.subject}
                {a.lesson_name ? ` · ${a.lesson_name}` : ""}
                {a.teaching_mode ? ` · ${teachingModeLabel(a.teaching_mode)}` : ""}
                {" · "}
                {a.target_type_label ? `${a.target_type_label}: ` : ""}
                {a.target_label ?? "—"}
              </option>
            ))}
          </select>
          {teacherId && gradeLevelOptionIds.length > 0 && aLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </div>
          ) : teacherId && gradeLevelOptionIds.length > 0 && !aLoad && !activeAssignments.length ? (
            <p className="mt-1 text-xs text-amber-800">
              אין שיבוצים תואמים למורה ולשכבה שנבחרו
            </p>
          ) : null}
        </label>

        {isTeachingTarget ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">סוג הוראה *</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teachingTrackType}
              onChange={(e) => setTeachingTrackType(e.target.value as TeachingTrackType | "")}
              required
            >
              <option value="">— בחרי —</option>
              <option value="full">מלא</option>
              <option value="short">מקוצר</option>
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">תאריך מבחן</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
            disabled={readOnly}
          />
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || readOnly}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "יוצר…" : "יצירת מבחן ושיוך תלמידות"}
          </button>
        </div>
      </form>
    </div>
  );
}
