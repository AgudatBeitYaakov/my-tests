import type { CohortBadgeKind } from "@/lib/cohorts/apiPayload";

const styles: Record<CohortBadgeKind, string> = {
  layer_a: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  layer_b: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  history: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  unknown: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

const labels: Record<CohortBadgeKind, string> = {
  layer_a: "שכבה א",
  layer_b: "שכבה ב",
  history: "היסטוריה",
  unknown: "—",
};

export function GradeBadge({
  kind,
  className = "",
}: {
  kind: CohortBadgeKind;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${styles[kind]} ${className}`}
    >
      {labels[kind]}
    </span>
  );
}
