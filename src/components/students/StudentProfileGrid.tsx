import { studentProfileFields } from "@/lib/students/display";
import type { StudentDisplayFields } from "@/lib/students/display";

export function StudentProfileGrid({
  student,
  className = "",
}: {
  student: StudentDisplayFields;
  className?: string;
}) {
  const fields = studentProfileFields(student);
  return (
    <dl
      className={`grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`.trim()}
    >
      {fields.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
