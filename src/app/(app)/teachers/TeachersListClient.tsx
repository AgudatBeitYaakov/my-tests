"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_DELETE_CLASS,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import type { Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

export function TeachersListClient() {
  const { data, error, isLoading, mutate } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);
  const count = data?.teachers?.length ?? 0;

  async function removeTeacher(id: string) {
    if (!confirm("למחוק מורה? ייתכן שתישארנה תלויות בשיבוצים ובמבחנים.")) return;
    const r = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="מורות"
        subtitle="ניהול מורות — שמות כפי שמופיעים בשיבוצים ובמבחנים"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="מורות"
              sheetName="מורות"
              exportUrl="/api/export/teachers"
            />
            <Link href="/teachers/new" className={LIST_PRIMARY_LINK_CLASS}>
              <Plus className="size-4 shrink-0" strokeWidth={2} />
              הוספת מורה
            </Link>
          </>
        }
      />

      <ListDataCard>
        <ListTableToolbar>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען…
            </span>
          ) : error ? (
            <span className="text-red-600">{(error as Error).message}</span>
          ) : (
            <span>{count} מורות ברשימה</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[320px]">
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.teachers?.length ? (
              data.teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">{t.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/teachers/${t.id}/edit`} className={LIST_ROW_LINK_CLASS}>
                        <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                        עריכה
                      </Link>
                      <button
                        type="button"
                        className={LIST_ROW_DELETE_CLASS}
                        onClick={() => void removeTeacher(t.id)}
                      >
                        <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                        מחיקה
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={2}>
                  {isLoading ? "טוען…" : "אין מורות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="מורות"
          count={count}
          apiPath="/api/teachers/clear-all"
          confirmHint="יימחקו קודם כל המבחנים במערכת (כולל מעקב והשלמות), ואז כל המורות והשיבוצים."
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
