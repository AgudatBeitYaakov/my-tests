import { NextResponse } from "next/server";
import { resolveAcademicYearScope, readOnlyResponse, scopeFromSearchParams } from "@/lib/academicYears/scope";
import {
  buildExistingTeacherMaps,
  teacherImportKey,
  validateTeacherImportRows,
  type ParsedTeacherRow,
  type ValidatedTeacherRow,
} from "@/lib/teachers/excelImport";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedTeacherRow[];
  skipDuplicates?: boolean;
  updateExisting?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const updateExisting = Boolean(body.updateExisting);
  const skipDuplicates = updateExisting ? false : body.skipDuplicates !== false;

  if (!rowsIn.length) return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: teachers, error: loadErr } = await notDeleted(
    supabase.from("teachers").select(TEACHER_COLUMNS).eq("academic_year_id", scope.year.id),
  );
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const existing = buildExistingTeacherMaps(teachers ?? []);
  const existingKeys = new Set(
    (teachers ?? []).map((t) =>
      teacherImportKey({
        first_name: t.first_name,
        last_name: t.last_name,
        tz: (t.tz as string | null) ?? null,
      }),
    ),
  );

  const validated = validateTeacherImportRows(rowsIn, existing);

  const failed: { rowNumber: number; errors: string[] }[] = [];
  const good = validated.filter((r) => {
    if (r.errors.length) {
      failed.push({ rowNumber: r.rowNumber, errors: r.errors });
      return false;
    }
    return true;
  });

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];
  const rowErrors: { rowNumber: number; errors: string[] }[] = [...failed];
  let skippedDuplicates = 0;

  for (const r of good as ValidatedTeacherRow[]) {
    if (!r.resolved) continue;
    const key = teacherImportKey(r.resolved);
    const patch = {
      first_name: r.resolved.first_name,
      last_name: r.resolved.last_name,
      tz: r.resolved.tz,
      email: r.resolved.email,
      notes: r.resolved.notes,
    };

    if (existingKeys.has(key)) {
      if (updateExisting) {
        const id =
          (r.resolved.tz && existing.byTz.get(r.resolved.tz)) ||
          existing.byName.get(
            `${r.resolved.first_name} ${r.resolved.last_name}`.trim().replace(/\s+/g, " ").toLowerCase(),
          );
        if (id) {
          toUpdate.push({ id, patch });
          continue;
        }
      }
      if (skipDuplicates) {
        skippedDuplicates += 1;
        continue;
      }
      rowErrors.push({ rowNumber: r.rowNumber, errors: ["מורה זו כבר קיימת במערכת"] });
      continue;
    }
    existingKeys.add(key);
    toInsert.push({
      academic_year_id: scope.year.id,
      ...patch,
    });
  }

  const chunk = 80;
  let inserted = 0;
  let updated = 0;

  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("teachers").insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
    for (const u of toUpdate) {
      const { error } = await supabase.from("teachers").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
      updated += 1;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: (e as Error).message,
        imported: inserted,
        updated,
        failed: rowErrors.length,
        skippedDuplicates,
        errors: rowErrors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    imported: inserted,
    updated,
    skippedDuplicates,
    failed: rowErrors.length,
    errors: rowErrors,
  });
}
