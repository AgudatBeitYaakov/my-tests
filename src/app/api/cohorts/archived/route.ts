import { NextResponse } from "next/server";
import { cohortApiItem } from "@/lib/cohorts/apiPayload";
import { resolveSelectedCohortPair } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const pair = await resolveSelectedCohortPair(supabase);
  const activeIds = new Set(pair ? [pair.cohortA.id, pair.cohortB.id] : []);

  const { data, error } = await supabase
    .from("cohorts")
    .select("id, number, name, display_order, deleted_at")
    .order("number", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const archived = (data ?? [])
    .filter((c) => !activeIds.has(c.id) && (c.display_order === null || c.deleted_at))
    .map((c) => cohortApiItem(c, pair));

  return NextResponse.json({ cohorts: archived });
}
