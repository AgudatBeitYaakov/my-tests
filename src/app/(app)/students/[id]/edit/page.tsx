import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { gradeForCohortInYear, loadYearCohortConfig } from "@/lib/academic/yearCohorts";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { cohortLabelFromRow } from "@/lib/cohorts/db";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { listCohorts } = await import("@/lib/cohorts/db");
  const studentSelect = await getStudentWithLookupsSelect(supabase);
  const { data: student, error } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("id", id)
    .single();
  if (error || !student) redirect("/students");

  const [cohortItems, cl, sp, tr] = await Promise.all([
    listCohorts(supabase),
    supabase.from("classes").select("id,name").order("name", { ascending: true }),
    supabase.from("specializations").select("id,name").order("name", { ascending: true }),
    supabase.from("tracks").select("id,name").order("name", { ascending: true }),
  ]);

  if (cl.error) throw new Error(cl.error.message);
  if (sp.error) throw new Error(sp.error.message);
  if (tr.error) throw new Error(tr.error.message);

  const s = student as unknown as {
    id: string;
    first_name: string;
    last_name: string;
    tz: string;
    cohort_id: string;
    academic_year_id: string;
    class_id: string;
    specialization_id: string | null;
    track_id: string | null;
    cohorts?: { id: string; name?: string; cohort_number?: number } | null;
  };

  const yearCfg = s.academic_year_id ? await loadYearCohortConfig(supabase, s.academic_year_id) : null;
  const computedGrade = yearCfg && s.cohort_id ? gradeForCohortInYear(s.cohort_id, yearCfg) : null;

  async function updateStudent(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const sb = createSupabaseAdminClient();

    const patch = {
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      tz: String(formData.get("tz") ?? "").trim(),
      cohort_id: String(formData.get("cohort_id") ?? "").trim(),
      class_id: String(formData.get("class_id") ?? "").trim(),
      specialization_id: String(formData.get("specialization_id") ?? "").trim() || null,
      track_id: String(formData.get("track_id") ?? "").trim() || null,
    };

    const { error: uErr } = await sb.from("students").update(patch).eq("id", id);
    if (uErr) throw new Error(uErr.message);
    redirect(`/students/${id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">עריכת תלמידה</h1>
          <p className="mt-1 text-sm text-zinc-600">
            שכבה נוכחית (לפי מחזור ושנה):{" "}
            <span className="font-medium">{formatCohortGradeLabel(computedGrade)}</span>
            {cohortLabelFromRow(s.cohorts) ? ` · מחזור ${cohortLabelFromRow(s.cohorts)}` : null}
          </p>
        </div>
        <Link
          href={`/students/${id}`}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50"
        >
          חזרה לכרטיס
        </Link>
      </div>

      <form
        action={updateStudent}
        className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-md md:grid-cols-2"
      >
        <Field name="first_name" label="שם פרטי" required defaultValue={s.first_name} />
        <Field name="last_name" label="שם משפחה" required defaultValue={s.last_name} />
        <Field name="tz" label="ת״ז" required dir="ltr" defaultValue={s.tz} />

        <SelectLookup
          name="cohort_id"
          label="מחזור"
          required
          options={cohortItems}
          defaultValue={s.cohort_id}
        />
        <SelectLookup name="class_id" label="כיתה" required options={cl.data ?? []} defaultValue={s.class_id} />
        <SelectLookup
          name="specialization_id"
          label="התמחות"
          options={sp.data ?? []}
          allowEmpty
          defaultValue={s.specialization_id ?? ""}
        />
        <SelectLookup
          name="track_id"
          label="מסלול"
          options={tr.data ?? []}
          allowEmpty
          defaultValue={s.track_id ?? ""}
        />

        <div className="md:col-span-2 flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-95"
          >
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  dir,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  dir?: "rtl" | "ltr";
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      <input
        name={name}
        required={required}
        dir={dir}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
      />
    </label>
  );
}

function SelectLookup({
  name,
  label,
  required,
  options,
  allowEmpty,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  options: { id: string; name: string }[];
  allowEmpty?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? (allowEmpty ? "" : undefined)}
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
      >
        {allowEmpty ? <option value="">— ללא —</option> : null}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
