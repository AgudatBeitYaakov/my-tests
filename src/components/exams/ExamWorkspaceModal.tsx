"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ExamEditDialog, type SaveSummary } from "@/components/exams/ExamEditDialog";
import { ExamStudentsPanel, useExamStudentsData } from "@/components/exams/ExamStudentsPanel";
import { Spinner } from "@/components/ui/Spinner";

type Props = {
  examId: string | null;
  open: boolean;
  onClose: () => void;
  initialView?: "students" | "edit";
};

export function ExamWorkspaceModal({ examId, open, onClose, initialView = "students" }: Props) {
  const [view, setView] = useState<"students" | "edit">(initialView);
  const { data, isLoading, mutate, readOnly } = useExamStudentsData(examId ?? "");

  useEffect(() => {
    if (open) setView(initialView);
  }, [open, initialView, examId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !examId) return null;

  const e = data?.exam;
  const locked = Boolean(e?.makeup_locked_at);

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
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex gap-2">
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
    </div>
  );
}
