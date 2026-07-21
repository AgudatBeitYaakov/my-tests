"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ExamEditDialog, type SaveSummary } from "@/components/exams/ExamEditDialog";
import { ExamStudentsPanel, useExamStudentsData } from "@/components/exams/ExamStudentsPanel";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { Spinner } from "@/components/ui/Spinner";
import { EXAM_HARD_DELETE_PHRASE, type ExamDeletePreview } from "@/lib/exams/deleteExam";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";

type Props = {
  examId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  initialView?: "students" | "edit";
};

function buildDeleteHint(preview: ExamDeletePreview | null | undefined, locked: boolean): string {
  if (!preview) {
    return "מחיקה קשה — כל הנתונים הקשורים למבחן יימחקו לצמיתות, כולל שיוך התלמידות למבחן זה.";
  }
  return [
    "מחיקה קשה — לא ניתן לשחזר.",
    "",
    "יימחקו לצמיתות:",
    `• ${preview.exam_students} שורות תלמידות במבחן`,
    preview.makeup_exams ? `• ${preview.makeup_exams} השלמות` : null,
    preview.makeup_tracking ? `• ${preview.makeup_tracking} רשומות מעקב השלמות` : null,
    preview.exam_tracking ? `• ${preview.exam_tracking} רשומות מעקב מורה` : null,
    "• המבחן עצמו וכל התיעוד שלו",
    "",
    locked ? "שימי לב: המבחן כבר ננעל והיו בו השלמות." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function ExamWorkspaceModal({
  examId,
  open,
  onClose,
  onDeleted,
  initialView = "students",
}: Props) {
  const { viewingYear } = useAcademicYear();
  const yearId = viewingYear?.id;
  const [view, setView] = useState<"students" | "edit">(initialView);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { data, isLoading, mutate, readOnly } = useExamStudentsData(examId ?? "");

  useEffect(() => {
    if (open) {
      setView(initialView);
      setDeleteOpen(false);
    }
  }, [open, initialView, examId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteOpen]);

  if (!open || !examId) return null;

  const e = data?.exam;
  const locked = Boolean(e?.makeup_locked_at);
  const preview = data?.delete_preview;

  async function deleteExam() {
    setDeleteBusy(true);
    try {
      const r = await fetch(withYearQuery(`/api/exams/${examId}`, yearId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_phrase: EXAM_HARD_DELETE_PHRASE }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert((j as { error?: string }).error ?? "מחיקה נכשלה");
        return;
      }
      setDeleteOpen(false);
      onDeleted?.();
      onClose();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="סגירה"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("students")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === "students"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              תלמידות ונוכחות
            </button>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => setView("edit")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  view === "edit"
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                עריכת מבחן
              </button>
            ) : null}
            {!readOnly ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
                מחק מבחן
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-50"
            aria-label="סגירה"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {view === "students" ? (
            <ExamStudentsPanel
              examId={examId}
              embedded
              onEditExam={readOnly ? undefined : () => setView("edit")}
            />
          ) : isLoading || !e ? (
            <div className="flex items-center gap-2 py-10 text-zinc-600">
              <Spinner />
              טוען…
            </div>
          ) : readOnly ? (
            <p className="text-sm text-amber-800">צפייה בלבד — לא ניתן לערוך.</p>
          ) : (
            <ExamEditDialog
              inline
              examId={examId}
              locked={locked}
              onSaved={(summary: SaveSummary | null) => {
                if (summary) {
                  const parts: string[] = [];
                  if (summary.added) parts.push(`נוספו ${summary.added} תלמידות`);
                  if (summary.removedExamStudents) parts.push(`הוסרו ${summary.removedExamStudents}`);
                  if (summary.removedMakeups) parts.push(`נמחקו ${summary.removedMakeups} השלמות`);
                  if (parts.length) alert(`המבחן עודכן: ${parts.join(" · ")}`);
                }
                void mutate();
                setView("students");
              }}
              initial={{
                exam_date: e.exam_date,
                assignment_category: e.assignment_category,
                grade_levels: e.grade_levels ?? [],
                class_ids: e.class_ids ?? [],
                track_ids: e.track_ids ?? [],
                specialization_ids: e.specialization_ids ?? [],
                psychology_enabled: Boolean(e.psychology_enabled),
                applies_to_all_in_grade: Boolean(e.applies_to_all_in_grade),
                teaching_track_type: e.teaching_track_type ?? null,
                teacher_id: e.teacher_id ?? "",
              }}
            />
          )}
        </div>
      </div>

      <ConfirmDangerDialog
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title="מחיקת מבחן"
        description={
          e
            ? `${e.subject} · ${formatHebrewDateFromYmd(e.exam_date)}`
            : undefined
        }
        hint={
          buildDeleteHint(preview, locked) +
          `\n\nלאישור הקלידי בדיוק: ${EXAM_HARD_DELETE_PHRASE}`
        }
        confirmLabel="מחק לצמיתות"
        requiredPhrase={EXAM_HARD_DELETE_PHRASE}
        busy={deleteBusy}
        onConfirm={() => deleteExam()}
      />
    </div>
  );
}
