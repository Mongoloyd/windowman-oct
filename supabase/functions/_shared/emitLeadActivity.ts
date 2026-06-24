/**
 * Best-effort CRM activity emission into lead_events + denormalized leads snapshot.
 * Never throws into the capture path; failures are observable via PII-free console.warn.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  computeFollowupReadiness,
  hasLeadContact,
  type FollowupReadiness,
} from "./computeFollowupReadiness.ts";

export type EmitLeadActivityArgs = {
  supabaseAdmin: SupabaseClient;
  leadId: string;
  eventName: string;
  eventSource?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  scanSessionId?: string | null;
  analysisId?: string | null;
  /** When set, follow_up readiness is computed from contact presence. */
  contact?: { phone_e164?: string | null; email?: string | null };
  /** Override computed follow_up readiness when callers already know it. */
  followupReadiness?: FollowupReadiness;
};

function warnEmitFailure(
  eventName: string,
  hasLeadId: boolean,
  stage: "insert" | "snapshot_update",
  error: { code?: string; message?: string },
): void {
  console.warn("[emitLeadActivity] failed", {
    eventName,
    hasLeadId,
    stage,
    errorCode: error.code ?? "unknown",
    errorMessage: error.message ?? "unknown",
  });
}

export async function emitLeadActivity(
  args: EmitLeadActivityArgs,
): Promise<void> {
  const {
    supabaseAdmin,
    leadId,
    eventName,
    eventSource = "edge_function",
    occurredAt = new Date().toISOString(),
    metadata = {},
    scanSessionId,
    analysisId,
    contact,
    followupReadiness,
  } = args;

  if (!leadId) return;

  const hasContact = contact ? hasLeadContact(contact) : false;
  const readiness = followupReadiness ??
    computeFollowupReadiness({ eventName, hasContact });

  const activityMetadata: Record<string, unknown> = {
    ...metadata,
    followup_readiness: readiness,
    contact_present: hasContact,
  };

  try {
    const { error: insertErr } = await supabaseAdmin.from("lead_events").insert({
      lead_id: leadId,
      event_name: eventName,
      event_source: eventSource,
      metadata: activityMetadata,
      scan_session_id: scanSessionId ?? null,
      analysis_id: analysisId ?? null,
    });

    if (insertErr) {
      warnEmitFailure(eventName, true, "insert", insertErr);
      return;
    }
  } catch (e) {
    warnEmitFailure(eventName, true, "insert", {
      message: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  try {
    const { error: updateErr } = await supabaseAdmin
      .from("leads")
      .update({
        last_activity_at: occurredAt,
        latest_activity_type: eventName,
      })
      .eq("id", leadId)
      .or(`last_activity_at.is.null,last_activity_at.lte.${occurredAt}`);

    if (updateErr) {
      warnEmitFailure(eventName, true, "snapshot_update", updateErr);
    }
  } catch (e) {
    warnEmitFailure(eventName, true, "snapshot_update", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
