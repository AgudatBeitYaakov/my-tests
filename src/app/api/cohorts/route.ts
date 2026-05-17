import { NextResponse } from "next/server";
import { listCohorts } from "@/lib/cohorts/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  try {
    const cohorts = await listCohorts(supabase);
    return NextResponse.json({ cohorts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
