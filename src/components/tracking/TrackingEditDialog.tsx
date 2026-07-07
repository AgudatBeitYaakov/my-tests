"use client";

import { useEffect, useState } from "react";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { HebrewDateTimePicker } from "@/components/ui/HebrewDateTimePicker";

export type TrackingRowData = {
  id: string;
  submitted_exam: string | null;
  student_submission_date: string | null;
  reminder_1_hindi: string | null;
  reminder_2_biller: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  exam?: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

export type TrackingSavePayload = {
  submitted_exam: string | null;
  student_submission_date: string | null;
  reminder_1_hindi: string | null;
  reminder_2_biller: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
};

function TrackingRowForm({
  row,
  onCancel,
  onSave,
}: {
  row: TrackingRowData;
  onCancel: () => void;
  onSave: (p: TrackingSavePayload) => void;
}) {
  const [examSubmitted, setExamSubmitted] = useState(Boolean(row.submitted_exam));
  const [submittedIso, setSubmittedIso] = useState<string | null>(row.submitted_exam);
  const [studentSubmissionDate, setStudentSubmissionDate] = useState<string>(
    row.student_submission_date ? row.student_submission_date.slice(0, 10) : "",
  );
  const [reminder1Hindi, setReminder1Hindi] = useState<string>(
    row.reminder_1_hindi ? row.reminder_1_hindi.slice(0, 10) : "",
  );
  const [reminder2Biller, setReminder2Biller] = useState<string>(
    row.reminder_2_biller ? row.reminder_2_biller.slice(0, 10) : "",
  );
  const [approved, setApproved] = useState(row.approved_by_coordinator);
  const [sent, setSent] = useState(row.sent_for_review);
  const [gradesIn, setGradesIn] = useState(row.grades_submitted);
  const [gradesOk, setGradesOk] = useState(row.grades_approved);
  const [transferred, setTransferred] = useState(row.transferred_to_system);

  function handleSave() {
    if (examSubmitted && !submittedIso) {
      alert('סימון «הוגש מבחן» דורש למלא תאריך ושעה של הגשת המבחן.');
      return;
    }
    onSave({
      submitted_exam: examSubmitted ? submittedIso : null,
      student_submission_date: studentSubmissionDate.trim() || null,
      reminder_1_hindi: reminder1Hindi.trim() || null,
      reminder_2_biller: reminder2Biller.trim() || null,
      approved_by_coordinator: approved,
      sent_for_review: sent,
      grades_submitted: gradesIn,
      grades_approved: gradesOk,
      transferred_to_system: transferred,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={examSubmitted}
          onChange={(e) => {
            const checked = e.target.checked;
            setExamSubmitted(checked);
            if (!checked) setSubmittedIso(null);
          }}
        />
        הוגש מבחן
      </label>
      {examSubmitted ? (
        <HebrewDateTimePicker
          label="תאריך ושעת הגשת מבחן *"
          value={submittedIso}
          onChange={setSubmittedIso}
          required
        />
      ) : null}
      <HebrewDatePicker
        label='תאריך הגשת מטלה ע"י תלמידות'
        value={studentSubmissionDate}
        onChange={setStudentSubmissionDate}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        אישור רכזת
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
        נשלח לבדיקה
      </label>
      <HebrewDatePicker
        label='תזכורת 1 ע"י הינדי'
        value={reminder1Hindi}
        onChange={setReminder1Hindi}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
      <HebrewDatePicker
        label='תזכורת 2 ע"י בילר'
        value={reminder2Biller}
        onChange={setReminder2Biller}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={gradesIn} onChange={(e) => setGradesIn(e.target.checked)} />
        ציונים הוגשו
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={gradesOk} onChange={(e) => setGradesOk(e.target.checked)} />
        ציונים אושרו
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={transferred} onChange={(e) => setTransferred(e.target.checked)} />
        הועבר למערכת
      </label>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={onCancel}>
          ביטול
        </button>
        <button
          type="button"
          className="rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white"
          onClick={handleSave}
        >
          שמירה
        </button>
      </div>
    </div>
  );
}

type DialogProps = {
  open: boolean;
  row: TrackingRowData | null;
  onClose: () => void;
  onSave: (payload: TrackingSavePayload) => void | Promise<void>;
  busy?: boolean;
};

export function TrackingEditDialog({ open, row, onClose, onSave, busy = false }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !row) return null;

  const title = row.exam?.subject ?? "מעקב מבחן";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="סגירה"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {row.exam?.teacher_name ? (
          <p className="mt-1 text-sm text-zinc-600">{row.exam.teacher_name}</p>
        ) : null}
        <div className="mt-4">
          <TrackingRowForm
            key={row.id}
            row={row}
            onCancel={onClose}
            onSave={(p) => void onSave(p)}
          />
        </div>
      </div>
    </div>
  );
}
