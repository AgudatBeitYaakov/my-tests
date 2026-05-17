import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRequiredHeaders,
  filterDataRows,
  sheetRowsToObjects,
  validateImportRows,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "חסר קובץ או שהקובץ ריק" }, { status: 400 });
  }

  const name = file instanceof File ? file.name.toLowerCase() : "";
  if (name && !/\.(xlsx|xlsm|xls)$/.test(name)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך — העלי קובץ Excel (.xlsx או .xls)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "לא ניתן לקרוא את קובץ האקסל" }, { status: 400 });
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "גיליון ריק" }, { status: 400 });

  const sheet = wb.Sheets[sheetName];
  const rawAll = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const raw = filterDataRows(rawAll);
  if (!raw.length) return NextResponse.json({ error: "אין שורות נתונים בגיליון" }, { status: 400 });

  const headerErr = assertRequiredHeaders(Object.keys(raw[0] ?? {}));
  if (headerErr) return NextResponse.json({ error: headerErr }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [cl, sp, tr, tzRes] = await Promise.all([
    supabase.from("classes").select("id,name"),
    supabase.from("specializations").select("id,name"),
    supabase.from("tracks").select("id,name"),
    supabase.from("students").select("tz"),
  ]);

  for (const res of [cl, sp, tr, tzRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const existingTz = new Set((tzRes.data ?? []).map((r) => r.tz.trim()));

  const parsed = sheetRowsToObjects(raw);
  const validated = validateImportRows(parsed, { classByName, specByName, trackByName });

  const rows: (ValidatedImportRow & { warnings?: string[] })[] = validated.map((row) => {
    const warnings: string[] = [];
    if (row.tz && existingTz.has(row.tz) && row.errors.length === 0) {
      warnings.push("תלמידה עם ת״ז זו כבר קיימת במערכת (יידלג או יעודכן לפי הסימון בעת האישור)");
    }
    return { ...row, warnings };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return NextResponse.json({ rows, validCount, errorCount });
}
