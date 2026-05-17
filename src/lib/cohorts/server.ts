import { cookies } from "next/headers";
import { ARCHIVED_COHORTS_COOKIE } from "@/lib/cohorts/types";

export async function shouldShowArchivedCohorts(): Promise<boolean> {
  const store = await cookies();
  return store.get(ARCHIVED_COHORTS_COOKIE)?.value === "1";
}
