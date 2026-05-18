import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { selectedCohortIdList } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type ComputedItem = { key: string; title: string; body: string; href: string };

async function computeItems(supabase: ReturnType<typeof createSupabaseAdminClient>): Promise<ComputedItem[]> {
  const today = todayISODate();
  const cohortIds = await selectedCohortIdList(supabase);

  let examsTodayQ = supabase.from("exams").select("id", { count: "exact", head: true }).eq("exam_date", today).is("deleted_at", null);
  if (cohortIds.length) examsTodayQ = examsTodayQ.in("cohort_id", cohortIds);

  let trackingQ = supabase
    .from("exam_tracking")
    .select("id, exam_id, exams!inner(exam_date, cohort_id)", { count: "exact", head: true })
    .eq("grades_submitted", false)
    .lte("exams.exam_date", today);
  if (cohortIds.length) trackingQ = trackingQ.in("exams.cohort_id", cohortIds);

  const [examsToday, makeupsOpen, trackingOpen] = await Promise.all([
    examsTodayQ,
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open").is("deleted_at", null),
    trackingQ,
  ]);

  const items: ComputedItem[] = [];
  if ((examsToday.count ?? 0) > 0) {
    items.push({
      key: `exams-today-${today}`,
      title: `מבחנים היום (${examsToday.count})`,
      body: `יש ${examsToday.count} מבחנים היום`,
      href: "/calendar",
    });
  }
  if ((makeupsOpen.count ?? 0) > 0) {
    items.push({
      key: "makeups-open",
      title: `השלמות פתוחות (${makeupsOpen.count})`,
      body: `יש ${makeupsOpen.count} השלמות פתוחות`,
      href: "/makeups",
    });
  }
  if ((trackingOpen.count ?? 0) > 0) {
    items.push({
      key: "tracking-todo",
      title: `מעקב חסר (${trackingOpen.count})`,
      body: `יש ${trackingOpen.count} מבחנים ללא ציונים / מעקב`,
      href: "/tracking",
    });
  }
  return items;
}

async function syncNotifications(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  computed: ComputedItem[],
) {
  const keys = new Set(computed.map((c) => c.key));
  for (const c of computed) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("title", c.key)
      .maybeSingle();
    if (!existing) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: c.key,
        body: c.body,
        href: c.href,
      });
    }
  }
  const { data: stale } = await supabase.from("notifications").select("id, title").eq("user_id", userId);
  for (const row of stale ?? []) {
    if (!keys.has(row.title)) {
      await supabase.from("notifications").delete().eq("id", row.id);
    }
  }
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const user = await getCurrentUser(supabase);
  const computed = await computeItems(supabase);

  if (user) {
    await syncNotifications(supabase, user.id, computed);
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id, title, body, href, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (rows ?? []).map((r) => ({
      id: r.id,
      type: "info",
      message: r.body ?? r.title,
      href: r.href ?? "/",
      read: Boolean(r.read_at),
    }));
    const unread = items.filter((i) => !i.read).length;
    return NextResponse.json({ items, unread });
  }

  const items = computed.map((c) => ({
    id: c.key,
    type: "info",
    message: c.body,
    href: c.href,
    read: false,
  }));
  return NextResponse.json({ items, unread: items.length });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחוברת" }, { status: 401 });

  const body = (await request.json()) as { ids?: string[]; all?: boolean };
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (body.all) {
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  } else if (body.ids?.length) {
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).in("id", body.ids);
  }

  return NextResponse.json({ ok: true });
}
