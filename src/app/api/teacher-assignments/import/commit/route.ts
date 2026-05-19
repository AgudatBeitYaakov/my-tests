import { NextResponse } from "next/server";
import { computeTargetsFingerprint } from "@/lib/assignments/multiTarget";
import {
  assignmentImportKey,
  validateAssignmentImportRows,
  type ParsedAssignmentRow,
  type ValidatedAssignmentRow,
} from "@/lib/assignments/excelImport";
import {
  formatAssignmentImportInsertError,
  loadAssignmentImportContext,
} from "@/lib/assignments/importContext";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedAssignmentRow[];
  skipDuplicates?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const skipDuplicates = body.skipDuplicates !== false;

  if (!rowsIn.length) {
    return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const loaded = await loadAssignmentImportContext(supabase, scope.year.id);
  if ("error" in loaded) {
    return NextResponse.json({ error: dbSchemaHint(loaded.error) }, { status: 500 });
  }
  const { ctx } = loaded;

  const validated = validateAssignmentImportRows(rowsIn, ctx);

  const failed: { rowNumber: number; errors: string[] }[] = [];
  const good = validated.filter((r) => {
    if (r.errors.length) {
      failed.push({ rowNumber: r.rowNumber, errors: r.errors });
      return false;
    }
    return true;
  });

  const toInsert: Record<string, unknown>[] = [];
  const rowErrors: { rowNumber: number; errors: string[] }[] = [...failed];
  let skippedDuplicates = 0;

  for (const r of good as ValidatedAssignmentRow[]) {
    if (!r.resolved) continue;
    const key = assignmentImportKey(ctx.academicYearId, r.resolved);
    if (ctx.existingKeys.has(key)) {
      if (skipDuplicates) {
        skippedDuplicates += 1;
        continue;
      }
      rowErrors.push({ rowNumber: r.rowNumber, errors: ["שיבוץ זהה כבר קיים"] });
      continue;
    }
    ctx.existingKeys.add(key);
    const fingerprint = computeTargetsFingerprint(r.resolved);
    toInsert.push({
      academic_year_id: ctx.academicYearId,
      teacher_id: r.resolved.teacher_id,
      subject: r.resolved.subject,
      lesson_name: r.resolved.lesson_name,
      grade_levels: r.resolved.grade_levels,
      assignment_category: r.resolved.assignment_category,
      class_ids: r.resolved.class_ids,
      track_ids: r.resolved.track_ids,
      specialization_ids: r.resolved.specialization_ids,
      psychology_enabled: r.resolved.psychology_enabled,
      applies_to_all_in_grade: r.resolved.applies_to_all_in_grade,
      targets_fingerprint: fingerprint,
      teaching_mode: r.resolved.teaching_mode,
    });
  }

  if (!toInsert.length) {
    const msg =
      rowErrors.length > 0
        ? "לא נוסף אף שיבוץ — יש שגיאות בשורות (ראי פירוט למטה)"
        : skippedDuplicates > 0
          ? "כל השורות כבר קיימות במערכת — לא נוסף שיבוץ חדש"
          : "אין שורות תקינות לייבוא";
    return NextResponse.json(
      {
        error: msg,
        imported: 0,
        failed: rowErrors.length,
        skippedDuplicates,
        errors: rowErrors,
      },
      { status: 400 },
    );
  }

  const chunk = 80;
  let inserted = 0;

  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("teacher_assignments").insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
  } catch (e) {
    const raw = (e as Error).message;
    return NextResponse.json(
      {
        error: dbSchemaHint(formatAssignmentImportInsertError(raw)),
        imported: inserted,
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
    skippedDuplicates,
    failed: rowErrors.length,
    errors: rowErrors,
  });
}
