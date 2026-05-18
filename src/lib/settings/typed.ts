import type { SupabaseClient } from "@supabase/supabase-js";
import { SELECTED_COHORTS_KEY, getSelectedCohortIds, setSelectedCohortIds } from "@/lib/cohorts/settings";

export type SettingKey = typeof SELECTED_COHORTS_KEY;

type SettingValueMap = {
  [SELECTED_COHORTS_KEY]: { selected_cohort_ids: string[] };
};

export async function getSetting<K extends SettingKey>(
  supabase: SupabaseClient,
  key: K,
): Promise<SettingValueMap[K] | null> {
  if (key === SELECTED_COHORTS_KEY) {
    const ids = await getSelectedCohortIds(supabase);
    return ids ? ({ selected_cohort_ids: ids } as SettingValueMap[K]) : null;
  }
  const { data, error } = await supabase.from("system_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value as SettingValueMap[K]) ?? null;
}

export async function setSetting<K extends SettingKey>(
  supabase: SupabaseClient,
  key: K,
  value: SettingValueMap[K],
): Promise<void> {
  if (key === SELECTED_COHORTS_KEY) {
    const v = value as SettingValueMap[typeof SELECTED_COHORTS_KEY];
    const ids = v.selected_cohort_ids;
    if (ids.length === 2) await setSelectedCohortIds(supabase, [ids[0], ids[1]]);
    return;
  }
  const { error } = await supabase.from("system_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
