import type { LookupEntitySlug } from "@/lib/lookups/entities";

/** לוקאפים ששייכים לשנת לימודים (לא גלובליים) */
export const YEAR_SCOPED_LOOKUPS = new Set<LookupEntitySlug>([
  "classes",
  "specializations",
  "tracks",
]);

export function isYearScopedLookup(entity: LookupEntitySlug): boolean {
  return YEAR_SCOPED_LOOKUPS.has(entity);
}
