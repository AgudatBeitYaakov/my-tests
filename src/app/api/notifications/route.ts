import { NextResponse } from "next/server";
import { resolveAcademicYearId } from "@/lib/academic/year";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const today = todayISODate();
  const yearId = await resolveAcademicYearId(supabase);

  let examsTodayQ = supabase.from("exams").select("id", { count: "exact", head: true }).eq("exam_date", today);
  if (yearId) examsTodayQ = examsTodayQ.eq("academic_year_id", yearId);

  let trackingQ = supabase
    .from("exam_tracking")
    .select("id, exam_id, exams!inner(exam_date, academic_year_id)", { count: "exact", head: true })
    .eq("grades_submitted", false)
    .lte("exams.exam_date", today);

  const [examsToday, makeupsOpen, trackingOpen] = await Promise.all([
    examsTodayQ,
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open"),
    yearId
      ? supabase
          .from("exam_tracking")
          .select("id, exams!inner(academic_year_id, exam_date)", { count: "exact", head: true })
          .eq("grades_submitted", false)
          .eq("exams.academic_year_id", yearId)
          .lte("exams.exam_date", today)
      : trackingQ,
  ]);

  const items: { id: string; type: string; message: string; href: string }[] = [];

  if ((examsToday.count ?? 0) > 0) {
    items.push({
      id: "exams-today",
      type: "info",
      message: `יש ${examsToday.count} מבחנים היום`,
      href: "/calendar",
    });
  }
  if ((makeupsOpen.count ?? 0) > 0) {
    items.push({
      id: "makeups-open",
      type: "warning",
      message: `יש ${makeupsOpen.count} השלמות פתוחות`,
      href: "/makeups",
    });
  }
  if ((trackingOpen.count ?? 0) > 0) {
    items.push({
      id: "tracking-todo",
      type: "warning",
      message: `יש ${trackingOpen.count} מבחנים ללא ציונים / מעקב`,
      href: "/tracking",
    });
  }

  return NextResponse.json({ items, unread: items.length });
}
