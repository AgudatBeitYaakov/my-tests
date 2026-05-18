import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditPayload = {
  userId: string | null;
  entityType: string;
  entityId: string;
  actionType: string;
  entityNameSnapshot?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function writeAudit(supabase: SupabaseClient, payload: AuditPayload) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: payload.userId,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    action_type: payload.actionType,
    entity_name_snapshot: payload.entityNameSnapshot ?? null,
    old_value: payload.oldValue ?? null,
    new_value: payload.newValue ?? null,
  });
  if (error) console.error("audit_log failed:", error.message);
}
