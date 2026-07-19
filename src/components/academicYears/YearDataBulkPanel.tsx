"use client";

import { Download, FolderUp } from "lucide-react";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { sheetRowsToAssignmentObjects } from "@/lib/assignments/excelImport";
import { sheetRowsToLookupObjects } from "@/lib/lookups/excelImport";
import { filterDataRows, sheetRowsToObjects } from "@/lib/students/excelImport";
import { sheetRowsToTeacherObjects } from "@/lib/teachers/excelImport";
import {
  matchYearDataKind,
  YEAR_DATA_FILE_NAMES,
  YEAR_DATA_IMPORT_ORDER,
  type YearDataKind,
} from "@/lib/yearData/fileNames";

type ExportFilePayload = {
  kind: YearDataKind;
  filename: string;
  sheetName: string;
  rows: Record<string, string>[];
};

type KindResult = {
  kind: YearDataKind;
  label: string;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  error?: string;
};

async function rowsToXlsxBlob(
  sheetName: string,
  rows: Record<string, string | number | boolean | null | undefined>[],
): Promise<Blob> {
  const XLSX = await import("xlsx");
  const safeSheet = sheetName.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Sheet1";
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "אין נתונים": "" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("גיליון ריק");
  const sheet = wb.Sheets[sheetName];
  const rawAll = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return filterDataRows(rawAll);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function YearDataBulkPanel() {
  const { viewingYear, readOnly } = useAcademicYear();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<KindResult[] | null>(null);

  const yearLabel = viewingYear?.year_name ?? "שנה";

  async function exportYear() {
    if (!viewingYear?.id) return;
    setBusy("export");
    setMessage(null);
    setResults(null);
    try {
      const r = await fetch(withYearQuery("/api/year-data/export", viewingYear.id));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "ייצוא נכשל");

      const files = (j as { files: ExportFilePayload[]; year_name?: string }).files ?? [];
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of files) {
        const blob = await rowsToXlsxBlob(f.sheetName, f.rows);
        zip.file(f.filename, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeName = (j as { year_name?: string }).year_name ?? yearLabel;
      downloadBlob(zipBlob, `נתוני-שנה-${safeName}.zip`);
      setMessage(`הורד ZIP עם ${files.length} קבצי אקסל לשנה ${safeName}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importFolder(fileList: FileList | null) {
    if (!viewingYear?.id || readOnly) return;
    if (!fileList?.length) {
      setMessage("לא נבחרו קבצים");
      return;
    }

    setBusy("import");
    setMessage(null);
    setResults(null);

    try {
      const byKind = new Map<YearDataKind, File>();
      for (const file of Array.from(fileList)) {
        if (!/\.(xlsx|xls|xlsm)$/i.test(file.name)) continue;
        const kind = matchYearDataKind(file.name);
        if (kind && !byKind.has(kind)) byKind.set(kind, file);
      }

      if (!byKind.size) {
        throw new Error(
          "לא נמצאו קבצי אקסל מוכרים בתיקייה. צפוי: כיתות, התמחויות, מסלולים, מורות, תלמידות, שיבוצים",
        );
      }

      const out: KindResult[] = [];

      for (const kind of YEAR_DATA_IMPORT_ORDER) {
        const file = byKind.get(kind);
        if (!file) continue;
        const label = YEAR_DATA_FILE_NAMES[kind].label;
        try {
          const raw = await parseExcelFile(file);
          if (!raw.length) {
            out.push({
              kind,
              label,
              imported: 0,
              updated: 0,
              skipped: 0,
              failed: 0,
              error: "קובץ ריק",
            });
            continue;
          }

          let commitUrl = "";
          let body: Record<string, unknown> = {};

          if (kind === "classes" || kind === "specializations" || kind === "tracks") {
            const rows = sheetRowsToLookupObjects(raw);
            commitUrl = withYearQuery(`/api/lookups/${kind}/import/commit`, viewingYear.id);
            body = { rows, skipDuplicates: true };
          } else if (kind === "teachers") {
            const rows = sheetRowsToTeacherObjects(raw);
            commitUrl = withYearQuery("/api/teachers/import/commit", viewingYear.id);
            body = { rows, updateExisting: true };
          } else if (kind === "students") {
            const rows = sheetRowsToObjects(raw);
            commitUrl = withYearQuery("/api/students/import/commit", viewingYear.id);
            body = { rows, updateExisting: true };
          } else {
            const rows = sheetRowsToAssignmentObjects(raw);
            commitUrl = withYearQuery("/api/teacher-assignments/import/commit", viewingYear.id);
            body = { rows, updateExisting: true };
          }

          const r = await fetch(commitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const j = (await r.json().catch(() => ({}))) as {
            error?: string;
            imported?: number;
            updated?: number;
            skippedDuplicates?: number;
            skipped?: number;
            failed?: number;
          };
          if (!r.ok) {
            out.push({
              kind,
              label,
              imported: j.imported ?? 0,
              updated: j.updated ?? 0,
              skipped: j.skippedDuplicates ?? j.skipped ?? 0,
              failed: j.failed ?? 0,
              error: j.error ?? "ייבוא נכשל",
            });
            continue;
          }
          out.push({
            kind,
            label,
            imported: j.imported ?? 0,
            updated: j.updated ?? 0,
            skipped: j.skippedDuplicates ?? j.skipped ?? 0,
            failed: j.failed ?? 0,
          });
        } catch (e) {
          out.push({
            kind,
            label,
            imported: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            error: (e as Error).message,
          });
        }
      }

      setResults(out);
      const missing = YEAR_DATA_IMPORT_ORDER.filter((k) => !byKind.has(k)).map(
        (k) => YEAR_DATA_FILE_NAMES[k].label,
      );
      const parts = [
        `ייבוא לשנה ${yearLabel} הסתיים`,
        missing.length ? `חסרו: ${missing.join(", ")}` : null,
      ].filter(Boolean);
      setMessage(parts.join(" · "));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 dark:bg-zinc-900/40">
      <h2 className="text-lg font-semibold">גיבוי / טעינת נתוני שנה</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        ייצוא ZIP של כיתות, התמחויות, מסלולים, מורות, תלמידות ושיבוצים לשנה הנצפית — או ייבוא מתיקייה
        עם אותם קבצים (עדכון לפי מפתח, בלי מחיקה). לא כולל מבחנים / השלמות / מעקב.
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        שנה נוכחית לפעולה: {yearLabel}
        {readOnly ? " (ארכיון — ייבוא חסום)" : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null || !viewingYear}
          onClick={() => void exportYear()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <Download className="size-4" strokeWidth={2} />
          {busy === "export" ? "מייצא…" : "ייצוא כל האקסלים (ZIP)"}
        </button>

        <button
          type="button"
          disabled={busy !== null || !viewingYear || readOnly}
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-700 bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          <FolderUp className="size-4" strokeWidth={2} />
          {busy === "import" ? "מייבא…" : "ייבוא מתיקייה"}
        </button>

        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
          onChange={(e) => void importFolder(e.target.files)}
        />
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}

      {results?.length ? (
        <ul className="mt-4 divide-y rounded-xl border border-zinc-200 text-sm dark:border-zinc-700">
          {results.map((r) => (
            <li key={r.kind} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span className="font-medium">{r.label}</span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {r.error ? (
                  <span className="text-red-700">{r.error}</span>
                ) : (
                  <>
                    נוספו {r.imported}
                    {r.updated ? ` · עודכנו ${r.updated}` : ""}
                    {r.skipped ? ` · דולגו ${r.skipped}` : ""}
                    {r.failed ? ` · נכשלו ${r.failed}` : ""}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
