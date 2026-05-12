"use client";

import Link from "next/link";
import { FileDown, List } from "lucide-react";
import { useCallback, useState } from "react";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

type PreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  tz: string;
  grade_level: string;
  class_name: string;
  specialization: string;
  track: string;
  errors: string[];
  warnings?: string[];
};

export function ImportStudentsClient() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setMessage(null);
    setBusy(true);
    setRows(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/students/import/preview", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setRows((j as { rows: PreviewRow[] }).rows ?? []);
      setValidCount((j as { validCount: number }).validCount ?? 0);
      setErrorCount((j as { errorCount: number }).errorCount ?? 0);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  async function commit() {
    if (!rows?.length || errorCount > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const payload = rows.map((r) => ({
        rowNumber: r.rowNumber,
        first_name: r.first_name,
        last_name: r.last_name,
        tz: r.tz,
        grade_level: r.grade_level,
        class_name: r.class_name,
        specialization: r.specialization,
        track: r.track,
      }));
      const r = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, updateExisting }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const ins = (j as { inserted?: number }).inserted ?? 0;
      const upd = (j as { updated?: number }).updated ?? 0;
      const sk = (j as { skipped?: number }).skipped ?? 0;
      setMessage(`ייבוא הושלם: נוספו ${ins}, עודכנו ${upd}, דולגו ${sk}`);
      setRows(null);
      setValidCount(0);
      setErrorCount(0);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="ייבוא תלמידות מאקסל"
        subtitle="כותרות בעברית (או באנגלית) — הערכים בשורות חייבים להתאים בדיוק לשמות בלוקאפים (הגדרות)."
        actions={
          <>
            <a href="/api/students/import/template" className={LIST_SECONDARY_LINK_CLASS}>
              <FileDown className="size-4 shrink-0" strokeWidth={2} />
              הורדת תבנית Excel
            </a>
            <Link href="/students" className={LIST_SECONDARY_LINK_CLASS}>
              <List className="size-4 shrink-0" strokeWidth={2} />
              חזרה לרשימה
            </Link>
          </>
        }
      />

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-zinc-600 dark:bg-zinc-900/30">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-5" />
            מעבד…
          </span>
        ) : (
          <>
            <span className="font-medium text-zinc-800">גרירה ושחרור או לחיצה לבחירת קובץ .xlsx</span>
            <span className="text-xs text-[var(--muted)]">
              שם פרטי · שם משפחה · תעודת זהות · שכבה · כיתה · התמחות · מסלול
            </span>
          </>
        )}
      </label>

      {message ? <p className="text-sm text-zinc-800">{message}</p> : null}

      {rows ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-emerald-800">שורות תקינות: {validCount}</span>
            <span className="text-red-800">שורות שגויות: {errorCount}</span>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              עדכן תלמידות קיימות (לפי ת״ז)
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <Table className="min-w-[900px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>שם פרטי</TableHead>
                  <TableHead>שם משפחה</TableHead>
                  <TableHead>תעודת זהות</TableHead>
                  <TableHead>שכבה</TableHead>
                  <TableHead>כיתה</TableHead>
                  <TableHead>התמחות</TableHead>
                  <TableHead>מסלול</TableHead>
                  <TableHead>הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.rowNumber}-${i}-${r.tz}`} className={r.errors.length ? "bg-red-50/90 dark:bg-red-950/20" : ""}>
                    <TableCell className="font-mono">{r.rowNumber}</TableCell>
                    <TableCell>{r.first_name}</TableCell>
                    <TableCell>{r.last_name}</TableCell>
                    <TableCell className="text-left font-mono" dir="ltr">
                      {r.tz}
                    </TableCell>
                    <TableCell>{r.grade_level}</TableCell>
                    <TableCell>{r.class_name}</TableCell>
                    <TableCell>{r.specialization}</TableCell>
                    <TableCell>{r.track}</TableCell>
                    <TableCell className="text-right text-red-800">
                      {r.errors.length ? r.errors.map((e) => <div key={e}>שורה {r.rowNumber}: {e}</div>) : null}
                      {r.warnings?.length
                        ? r.warnings.map((w) => (
                            <div key={w} className="text-amber-800">
                              {w}
                            </div>
                          ))
                        : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TableClearFooter
              label="תצוגה מקדימה"
              count={rows.length}
              localClear={() => {
                setRows(null);
                setValidCount(0);
                setErrorCount(0);
                setMessage(null);
              }}
              confirmHint="רק התצוגה המקדימה — לא נמחקות תלמידות מהמסד."
              onCleared={() => {}}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ExportExcelButton
              label="תצוגה מקדימה לאקסל"
              filename="ייבוא-תצוגה-מקדימה"
              sheetName="ייבוא"
              getRows={async () =>
                (rows ?? []).map((r) => ({
                  מספר_שורה: r.rowNumber,
                  שם_פרטי: r.first_name,
                  שם_משפחה: r.last_name,
                  תעודת_זהות: r.tz,
                  שכבה: r.grade_level,
                  כיתה: r.class_name,
                  התמחות: r.specialization,
                  מסלול: r.track,
                  שגיאות: r.errors.join("; "),
                  אזהרות: (r.warnings ?? []).join("; "),
                }))
              }
            />
            <button
              type="button"
              disabled={busy || errorCount > 0}
              onClick={() => void commit()}
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              אישור ייבוא
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRows(null);
                setValidCount(0);
                setErrorCount(0);
                setMessage(null);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
