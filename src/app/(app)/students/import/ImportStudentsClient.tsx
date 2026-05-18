"use client";

import Link from "next/link";
import { FileDown, List } from "lucide-react";
import { useCallback, useState } from "react";
import { useCohortPair } from "@/components/cohorts/CohortPairProvider";
import { GradeBadge } from "@/components/cohorts/GradeBadge";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnMap } from "@/lib/students/excelImport";

type ImportPlan = {
  cohortNumber: number;
  targetGrade: string | null;
  cohortAName?: string | null;
  cohortBName?: string | null;
  willImportCount: number;
};

type PreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  tz: string;
  class_name: string;
  specialization: string;
  track: string;
  errors: string[];
  warnings?: string[];
};

type PreviewSummary = {
  newCount: number;
  updateCount: number;
  duplicateTz: number;
  errorCount: number;
  validCount: number;
};

const MAP_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "first_name", label: "שם פרטי" },
  { key: "last_name", label: "שם משפחה" },
  { key: "tz", label: "תעודת זהות" },
  { key: "class_name", label: "כיתה" },
  { key: "specialization", label: "התמחות" },
  { key: "track", label: "מסלול" },
];

export function ImportStudentsClient() {
  const { data: pairData } = useCohortPair();
  const selected = pairData?.selected;

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; errors: string[] }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [showMapping, setShowMapping] = useState(false);

  const activeHint = selected
    ? [
        selected.cohortA ? `מחזור ${selected.cohortA.name}` : null,
        selected.cohortB ? `מחזור ${selected.cohortB.name}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const processFile = useCallback(
    async (file: File, map: ColumnMap = {}) => {
      setMessage(null);
      setBusy(true);
      setRows(null);
      setSummary(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (Object.keys(map).length) fd.set("column_map", JSON.stringify(map));
        const r = await fetch("/api/students/import/preview", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const headers = (j as { headers?: string[] }).headers ?? [];
          if (headers.length) {
            setExcelHeaders(headers);
            setShowMapping(true);
            setPendingFile(file);
          }
          throw new Error((j as { error?: string }).error ?? "שגיאה");
        }
        setRows((j as { rows: PreviewRow[] }).rows ?? []);
        setValidCount((j as { validCount: number }).validCount ?? 0);
        setErrorCount((j as { errorCount: number }).errorCount ?? 0);
        setSummary((j as { summary?: PreviewSummary }).summary ?? null);
        setShowMapping(false);
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setPendingFile(file);
      setColumnMap({});
      void processFile(file);
    },
    [processFile],
  );

  const cohortReady = Boolean(cohortName.trim());

  async function openConfirm() {
    if (!rows?.length || validCount === 0) return;
    if (!cohortReady) {
      setMessage("לפני ייבוא: בחרי מחזור יעד");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/students/import/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_number: cohortName.trim(),
          valid_count: validCount,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setPlan((j as { plan: ImportPlan }).plan);
      setConfirmOpen(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!rows?.length) return;
    setBusy(true);
    setMessage(null);
    setImportErrors([]);
    try {
      const payload = rows.map((r) => ({
        rowNumber: r.rowNumber,
        first_name: r.first_name,
        last_name: r.last_name,
        tz: r.tz,
        class_name: r.class_name,
        specialization: r.specialization,
        track: r.track,
      }));
      const r = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payload,
          updateExisting,
          cohort_number: cohortName.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportErrors((j as { errors?: { rowNumber: number; errors: string[] }[] }).errors ?? []);
        throw new Error((j as { error?: string }).error ?? "שגיאה");
      }
      setMessage(
        `ייבוא הושלם: יובאו ${(j as { imported?: number }).imported ?? 0}, עודכנו ${(j as { updated?: number }).updated ?? 0}, נכשלו ${(j as { failed?: number }).failed ?? 0}`,
      );
      setRows(null);
      setSummary(null);
      setValidCount(0);
      setErrorCount(0);
      setConfirmOpen(false);
      setPlan(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const planHint = plan
    ? [
        `מחזור ${plan.cohortNumber} → שכבה ${plan.targetGrade ?? "—"}`,
        `ייובאו ${plan.willImportCount} תלמידות`,
      ].join("\n")
    : "";

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="ייבוא תלמידות מאקסל"
        subtitle="העלי קובץ Excel. מחזור יעד נדרש לאישור הסופי בלבד."
        actions={
          <>
            <a href="/api/students/import/template" className={LIST_SECONDARY_LINK_CLASS}>
              <FileDown className="size-4 shrink-0" strokeWidth={2} />
              תבנית
            </a>
            <Link href="/settings/open-year" className={LIST_SECONDARY_LINK_CLASS}>
              פתיחת שנתון
            </Link>
            <Link href="/students" className={LIST_SECONDARY_LINK_CLASS}>
              <List className="size-4 shrink-0" strokeWidth={2} />
              חזרה
            </Link>
          </>
        }
      />

      {selected ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-600">זוג פעיל:</span>
          <GradeBadge kind={selected.cohortA.badge} />
          <span>מחזור {selected.cohortA.name}</span>
          <GradeBadge kind={selected.cohortB.badge} />
          <span>מחזור {selected.cohortB.name}</span>
        </div>
      ) : null}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center text-sm">
        <input
          type="file"
          accept=".xlsx,.xls,.xlsm"
          className="hidden"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-5" /> מעבד…
          </span>
        ) : (
          <>
            <span className="font-medium">בחרי קובץ Excel</span>
            {pendingFile ? <span className="text-xs text-emerald-800">{pendingFile.name}</span> : null}
          </>
        )}
      </label>

      {showMapping && excelHeaders.length ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-medium text-amber-900">מיפוי עמודות — התאימי עמודות הקובץ לשדות המערכת</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MAP_FIELDS.map(({ key, label }) => (
              <label key={key} className="block text-sm">
                <span className="font-medium">{label}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                  value={columnMap[key] ?? ""}
                  onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value || undefined }))}
                >
                  <option value="">— בחרי עמודה —</option>
                  {excelHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !pendingFile}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            onClick={() => pendingFile && void processFile(pendingFile, columnMap)}
          >
            המשך לתצוגה מקדימה
          </button>
        </div>
      ) : null}

      <div className="grid max-w-lg gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs text-zinc-600">
          {activeHint ? `זוג מחזורים: ${activeHint}` : "בחרי מחזור יעד (לפני אישור ייבוא)"}
        </p>
        <label className="block text-sm">
          <span className="font-medium">מחזור יעד</span>
          <input
            value={cohortName}
            onChange={(e) => setCohortName(e.target.value)}
            placeholder={selected?.cohortA?.name ?? "10"}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
          />
        </label>
      </div>

      {message ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{message}</p>
      ) : null}

      {rows ? (
        <div className="space-y-4">
          {summary ? (
            <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm sm:grid-cols-4">
              <div>
                <span className="text-zinc-500">חדשות</span>
                <div className="font-semibold text-emerald-800">{summary.newCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">יעדכנו</span>
                <div className="font-semibold text-sky-800">{summary.updateCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">תקינות</span>
                <div className="font-semibold">{summary.validCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">שגויות</span>
                <div className="font-semibold text-red-800">{summary.errorCount}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-emerald-800">תקינות: {validCount}</span> ·{" "}
              <span className="text-red-800">שגויות: {errorCount}</span>
            </p>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            עדכן לפי ת״ז
          </label>
          <Table className="min-w-[800px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>ת״ז</TableHead>
                <TableHead>כיתה</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell>{r.rowNumber}</TableCell>
                  <TableCell>
                    {r.first_name} {r.last_name}
                  </TableCell>
                  <TableCell dir="ltr">{r.tz}</TableCell>
                  <TableCell>{r.class_name}</TableCell>
                  <TableCell className="text-red-800">
                    {[...r.errors, ...(r.warnings ?? [])].join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <button
            type="button"
            disabled={busy || validCount === 0 || !cohortReady}
            onClick={() => void openConfirm()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            אישור ייבוא
          </button>
        </div>
      ) : null}

      <ConfirmDangerDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="אישור ייבוא"
        description="שיוך תלמידות למחזור שנבחר."
        hint={planHint}
        confirmLabel="ייבוא"
        busy={busy}
        onConfirm={commit}
      />
    </div>
  );
}
