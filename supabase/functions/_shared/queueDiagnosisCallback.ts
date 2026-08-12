/**
 * Idempotent diagnosis-callback persistence.
 *
 * Server-only. lead_id, phone_e164, call_intent, and cta_source are never
 * taken from the browser. diagnosis_submission_id protects an intake retry;
 * the diagnosis callback entitlement is scoped to scan_session_id.
 */

export const DIAGNOSIS_CALLBACK_INTENT = "general_callback" as const;
export const DIAGNOSIS_CALLBACK_CTA_SOURCE = "diagnosis_final_cta" as const;

export const CALLBACK_CONFLICT_ERROR =
  "Request already bound to a different report";
export const CALLBACK_QUEUE_ERROR = "Failed to queue callback";

export interface DiagnosisCallbackRow {
  id: string;
  lead_id: string;
  scan_session_id: string | null;
  diagnosis_submission_id: string | null;
}

export interface DiagnosisCallbackDb {
  findBySubmissionId(
    diagnosisSubmissionId: string,
  ): Promise<DiagnosisCallbackRow | null>;
  findBySession(
    scanSessionId: string,
  ): Promise<DiagnosisCallbackRow | null>;
  insertQueued(input: {
    leadId: string;
    scanSessionId: string;
    diagnosisSubmissionId: string;
    phoneE164: string;
  }): Promise<
    | { ok: true; id: string }
    | { ok: false; uniqueViolation: boolean; message?: string }
  >;
}

export type QueueDiagnosisCallbackResult =
  | { ok: true; followup_id: string; reused: boolean }
  | { ok: false; status: 409 | 500; error: string };

function sameBinding(
  row: DiagnosisCallbackRow,
  leadId: string,
  scanSessionId: string,
): boolean {
  return row.lead_id === leadId && row.scan_session_id === scanSessionId;
}

export async function queueDiagnosisCallback(
  db: DiagnosisCallbackDb,
  input: {
    leadId: string;
    scanSessionId: string;
    diagnosisSubmissionId: string;
    phoneE164: string;
  },
): Promise<QueueDiagnosisCallbackResult> {
  const existing = await db.findBySubmissionId(input.diagnosisSubmissionId);
  if (existing) {
    if (!sameBinding(existing, input.leadId, input.scanSessionId)) {
      return { ok: false, status: 409, error: CALLBACK_CONFLICT_ERROR };
    }
    return { ok: true, followup_id: existing.id, reused: true };
  }

  const existingForSession = await db.findBySession(input.scanSessionId);
  if (existingForSession) {
    if (!sameBinding(existingForSession, input.leadId, input.scanSessionId)) {
      return { ok: false, status: 409, error: CALLBACK_CONFLICT_ERROR };
    }
    return { ok: true, followup_id: existingForSession.id, reused: true };
  }

  const inserted = await db.insertQueued(input);
  if (inserted.ok) {
    return { ok: true, followup_id: inserted.id, reused: false };
  }

  if (!inserted.uniqueViolation) {
    // Database errors can include row details. Never serialize phone-bearing
    // callback input into centralized logs.
    console.error("[queueDiagnosisCallback] insert failed");
    return { ok: false, status: 500, error: CALLBACK_QUEUE_ERROR };
  }

  const winner = await db.findBySubmissionId(input.diagnosisSubmissionId) ??
    await db.findBySession(input.scanSessionId);
  if (!winner) {
    console.error(
      "[queueDiagnosisCallback] unique-violation recovery missed the winning row",
    );
    return { ok: false, status: 500, error: CALLBACK_QUEUE_ERROR };
  }
  if (!sameBinding(winner, input.leadId, input.scanSessionId)) {
    return { ok: false, status: 409, error: CALLBACK_CONFLICT_ERROR };
  }
  return { ok: true, followup_id: winner.id, reused: true };
}

type SupabaseLike = {
  from(table: string): {
    select(columns: string): SupabaseSelectFilter;
    insert(payload: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{
          data: Record<string, unknown> | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
};

type SupabaseMaybeSingleResult = {
  data: Record<string, unknown> | null;
  error: { message?: string; code?: string } | null;
};

interface SupabaseSelectFilter {
  eq(column: string, value: string): SupabaseSelectFilter;
  maybeSingle(): Promise<SupabaseMaybeSingleResult>;
}

export function isUniqueViolation(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("diagnosis_submission_id") ||
    message.includes("scan_session_id")
  );
}

function asCallbackRow(
  data: Record<string, unknown> | null,
): DiagnosisCallbackRow | null {
  if (
    !data || typeof data.id !== "string" || typeof data.lead_id !== "string"
  ) {
    return null;
  }
  return {
    id: data.id,
    lead_id: data.lead_id,
    scan_session_id: typeof data.scan_session_id === "string"
      ? data.scan_session_id
      : null,
    diagnosis_submission_id: typeof data.diagnosis_submission_id === "string"
      ? data.diagnosis_submission_id
      : null,
  };
}

export function createSupabaseDiagnosisCallbackDb(
  supabase: SupabaseLike,
): DiagnosisCallbackDb {
  return {
    async findBySubmissionId(diagnosisSubmissionId) {
      const { data, error } = await supabase
        .from("voice_followups")
        .select("id, lead_id, scan_session_id, diagnosis_submission_id")
        .eq("diagnosis_submission_id", diagnosisSubmissionId)
        .maybeSingle();
      if (error) throw error;
      return asCallbackRow(data);
    },
    async findBySession(scanSessionId) {
      const { data, error } = await supabase
        .from("voice_followups")
        .select("id, lead_id, scan_session_id, diagnosis_submission_id")
        .eq("scan_session_id", scanSessionId)
        .eq("call_intent", DIAGNOSIS_CALLBACK_INTENT)
        .eq("cta_source", DIAGNOSIS_CALLBACK_CTA_SOURCE)
        .maybeSingle();
      if (error) throw error;
      return asCallbackRow(data);
    },
    async insertQueued(input) {
      const { data, error } = await supabase
        .from("voice_followups")
        .insert({
          lead_id: input.leadId,
          scan_session_id: input.scanSessionId,
          diagnosis_submission_id: input.diagnosisSubmissionId,
          phone_e164: input.phoneE164,
          call_intent: DIAGNOSIS_CALLBACK_INTENT,
          cta_source: DIAGNOSIS_CALLBACK_CTA_SOURCE,
          status: "queued",
          payload_json: {
            info: {
              lead_id: input.leadId,
              scan_session_id: input.scanSessionId,
              diagnosis_submission_id: input.diagnosisSubmissionId,
              call_intent: DIAGNOSIS_CALLBACK_INTENT,
              cta_source: DIAGNOSIS_CALLBACK_CTA_SOURCE,
            },
          },
        })
        .select("id")
        .single();
      if (error) {
        return {
          ok: false as const,
          uniqueViolation: isUniqueViolation(error),
          message: error.message,
        };
      }
      if (!data || typeof data.id !== "string") {
        return { ok: false as const, uniqueViolation: false };
      }
      return { ok: true as const, id: data.id };
    },
  };
}
