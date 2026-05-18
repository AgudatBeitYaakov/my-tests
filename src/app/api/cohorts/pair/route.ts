import { NextResponse } from "next/server";
import { listAllCohorts } from "@/lib/cohorts/active";
import { pairApiPayload, type CohortPairApiResponse } from "@/lib/cohorts/apiPayload";
import { buildPairOptions } from "@/lib/cohorts/grades";
import { resolveSelectedCohortPair, setSelectedCohortPair } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const RULES = {
  adjacentOnly: true,
  sourceOfTruth: "cohort_id" as const,
  gradeFrom: "display_order" as const,
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const cohorts = await listAllCohorts(supabase);
    const { options, defaultPair } = buildPairOptions(cohorts);
    const selected = await resolveSelectedCohortPair(supabase);

    const body: CohortPairApiResponse = {
      pairs: options.map((p) => ({
        cohortAId: p.cohortAId,
        cohortBId: p.cohortBId,
        label: p.label,
        isDefaultPair: p.isDefaultPair,
        isActivePair: p.isDefaultPair,
      })),
      selected: selected ? pairApiPayload(selected) : null,
      setupRequired: !selected,
      message: selected
        ? null
        : "אין זוג מחזורים פעיל. פתחי מחזור חדש בהגדרות → פתיחת שנתון (למשל 10, ואחריו 9).",
      rules: RULES,
    };

    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      {
        pairs: [],
        selected: null,
        setupRequired: true,
        message: (e as Error).message,
        rules: RULES,
      } satisfies CohortPairApiResponse,
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as { cohort_a_id?: string; cohort_b_id?: string };
  const a = body.cohort_a_id?.trim();
  const b = body.cohort_b_id?.trim();
  if (!a || !b || a === b) {
    return NextResponse.json({ error: "חובה לבחור זוג מחזורים (שני מחזורים שונים)" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { pair, error } = await setSelectedCohortPair(supabase, a, b);
  if (!pair) return NextResponse.json({ error: error ?? "זוג מחזורים לא תקין" }, { status: 400 });

  return NextResponse.json({ ok: true, selected: pairApiPayload(pair), rules: RULES });
}
