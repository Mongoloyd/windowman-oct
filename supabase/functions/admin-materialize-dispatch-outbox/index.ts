// deno-lint-ignore no-import-prefix
import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

type Mode =
  | "preview_selected"
  | "preview_filtered"
  | "materialize_selected"
  | "materialize_filtered";
type CandidateStatus =
  | "eligible_not_sent"
  | "warning_not_sent"
  | "blocked"
  | "duplicate_protected"
  | "skipped"
  | "superseded";

interface CandidateRow {
  candidate_id: string;
  event_row_id: string;
  canonical_event_id: string | null;
  canonical_event_name: string;
  canonical_event_timestamp: string | null;
  client_id: string | null;
  client_slug: string | null;
  platform_config_id: string | null;
  platform_name: string | null;
  dispatch_event_name: string | null;
  mapper_version: string | null;
  idempotency_key: string | null;
  candidate_fingerprint: string | null;
  eligibility_version: string | null;
  eligibility_status: CandidateStatus;
  eligibility_reasons: string[] | null;
  readiness_status: string | null;
  outbox_row_exists: boolean | null;
  outbox_id: string | null;
  value_usd: number | string | null;
  currency: string | null;
  value_basis: string | null;
  true_margin_available: boolean | null;
  attribution_strength: string | null;
  token_present: boolean | null;
  destination_present: boolean | null;
  config_state: string | null;
  validation_status: string | null;
  decision_snapshot: Record<string, unknown> | null;
}

const ModeSchema = z.enum([
  "preview_selected",
  "preview_filtered",
  "materialize_selected",
  "materialize_filtered",
]);
const StatusSchema = z.enum([
  "eligible_not_sent",
  "warning_not_sent",
  "blocked",
  "duplicate_protected",
]);
const BodySchema = z.object({
  mode: ModeSchema,
  candidate_ids: z.array(z.string().min(8).max(128)).max(500).optional()
    .default([]),
  filters: z.object({
    client_slug: z.string().min(1).max(120).optional(),
    platform_name: z.string().min(1).max(80).optional(),
    eligibility_status: StatusSchema.optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional(),
  }).strict().optional().default({}),
  include_warnings: z.boolean().optional().default(false),
  confirmation: z.string().optional(),
}).strict();

function maskId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isMaterializeMode(mode: Mode) {
  return mode === "materialize_selected" || mode === "materialize_filtered";
}

function isSelectedMode(mode: Mode) {
  return mode === "preview_selected" || mode === "materialize_selected";
}

function inDateRange(value: string | null, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  if (from && ts < new Date(from).getTime()) return false;
  if (to && ts > new Date(to).getTime()) return false;
  return true;
}

function applyFilters(rows: CandidateRow[], body: z.infer<typeof BodySchema>) {
  const ids = new Set(body.candidate_ids ?? []);
  let result = rows;

  if (isSelectedMode(body.mode)) {
    result = result.filter((row) => ids.has(row.candidate_id));
  } else {
    const filters = body.filters ?? {};
    result = result.filter((row) => {
      if (filters.client_slug && row.client_slug !== filters.client_slug) {
        return false;
      }
      if (
        filters.platform_name && row.platform_name !== filters.platform_name
      ) return false;
      if (
        filters.eligibility_status &&
        row.eligibility_status !== filters.eligibility_status
      ) return false;
      if (
        !inDateRange(
          row.canonical_event_timestamp,
          filters.date_from,
          filters.date_to,
        )
      ) return false;
      return true;
    });
  }

  return result.slice(0, 500);
}

function emptyReasonBreakdown(): Record<string, number> {
  return {};
}

function addReasons(
  breakdown: Record<string, number>,
  reasons: string[] | null | undefined,
) {
  for (const reason of reasons ?? []) {
    breakdown[reason] = (breakdown[reason] ?? 0) + 1;
  }
}

function classifyCandidate(row: CandidateRow, includeWarnings: boolean) {
  const reasons = row.eligibility_reasons ?? [];
  if (
    row.outbox_row_exists || row.eligibility_status === "duplicate_protected"
  ) return { action: "duplicate" as const, reasons };
  if (row.eligibility_status === "eligible_not_sent") {
    return { action: "insert" as const, reasons };
  }
  if (row.eligibility_status === "warning_not_sent") {
    return includeWarnings ? { action: "insert_warning" as const, reasons } : {
      action: "invalid" as const,
      reasons: [...reasons, "warning_requires_explicit_include_warnings"],
    };
  }
  if (row.eligibility_status === "blocked") {
    return { action: "blocked" as const, reasons };
  }
  return { action: "invalid" as const, reasons };
}

function hasRequiredInsertFields(row: CandidateRow) {
  return Boolean(
    row.event_row_id &&
      row.canonical_event_name &&
      row.client_slug &&
      row.platform_config_id &&
      row.platform_name &&
      row.dispatch_event_name &&
      row.mapper_version &&
      row.idempotency_key &&
      row.candidate_fingerprint,
  );
}

function redactedPayloadSnapshot(row: CandidateRow) {
  return {
    outbox_contract: "dry-run-materialization-v1",
    canonical_event_id_present: Boolean(row.canonical_event_id),
    canonical_event_id_masked: maskId(row.canonical_event_id),
    event_name: row.canonical_event_name,
    client_slug: row.client_slug,
    platform_name: row.platform_name,
    dispatch_event_name: row.dispatch_event_name,
    mapper_version: row.mapper_version,
    value_usd: toNumber(row.value_usd),
    currency: row.currency ?? "USD",
    attribution_strength: row.attribution_strength,
    token_present: Boolean(row.token_present),
    destination_present: Boolean(row.destination_present),
    dry_run_only: true,
    send_enabled: false,
    reason_codes: row.eligibility_reasons ?? [],
  };
}

function decisionSnapshot(
  row: CandidateRow,
  operatorId: string,
  mode: Mode,
  includeWarnings: boolean,
) {
  return {
    ...(row.decision_snapshot ?? {}),
    materialization: {
      materialized_by: operatorId,
      materialized_at: new Date().toISOString(),
      materialization_mode: mode,
      include_warnings: includeWarnings,
      external_dispatch: false,
      attempts_written: false,
    },
  };
}

async function fetchExistingOutboxId(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  row: CandidateRow,
): Promise<string | null> {
  if (!row.idempotency_key) return null;
  const { data } = await supabaseAdmin
    .from("platform_dispatch_outbox")
    .select("id")
    .eq("idempotency_key", row.idempotency_key)
    .maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is allowed.");
  }

  const validation = await validateAdminRequestWithRole(req, [
    "super_admin",
    "operator",
  ]);
  if (!validation.ok) return validation.response;

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (error) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid materialization request.",
      {
        issues: error instanceof z.ZodError
          ? error.flatten().fieldErrors
          : undefined,
      },
    );
  }

  if (isSelectedMode(parsed.mode) && parsed.candidate_ids.length === 0) {
    return errorResponse(
      400,
      "candidate_ids_required",
      "Selected modes require at least one candidate ID.",
    );
  }
  if (
    isMaterializeMode(parsed.mode) &&
    parsed.confirmation !== "MATERIALIZE_DRY_RUN_ONLY"
  ) {
    return errorResponse(
      400,
      "confirmation_required",
      "Type MATERIALIZE_DRY_RUN_ONLY to materialize dry-run outbox rows.",
    );
  }

  const { supabaseAuth, supabaseAdmin, userId } = validation;
  const { data, error } = await supabaseAuth.rpc(
    "admin_dispatch_outbox_candidates",
  );
  if (error) {
    return errorResponse(
      500,
      "candidate_recompute_failed",
      "Could not recompute dispatch candidates.",
      { message: error.message },
    );
  }

  const candidates = applyFilters((data ?? []) as CandidateRow[], parsed);
  const reasonBreakdown = emptyReasonBreakdown();
  const items: Array<Record<string, unknown>> = [];
  const createdIdsMasked: string[] = [];
  const summary = {
    candidates_considered: candidates.length,
    inserted: 0,
    inserted_warnings: 0,
    duplicate_protected: 0,
    skipped_blocked: 0,
    skipped_duplicate: 0,
    skipped_invalid: 0,
    errors: 0,
  };

  for (const row of candidates) {
    const classification = classifyCandidate(row, parsed.include_warnings);
    addReasons(reasonBreakdown, classification.reasons);

    if (classification.action === "duplicate") {
      summary.duplicate_protected += 1;
      summary.skipped_duplicate += 1;
      items.push({
        candidate_id: row.candidate_id,
        status: "duplicate_protected",
        outbox_id_masked: maskId(row.outbox_id),
        reasons: row.eligibility_reasons ?? [],
      });
      continue;
    }
    if (classification.action === "blocked") {
      summary.skipped_blocked += 1;
      items.push({
        candidate_id: row.candidate_id,
        status: "skipped_blocked",
        reasons: row.eligibility_reasons ?? [],
      });
      continue;
    }
    if (classification.action === "invalid" || !hasRequiredInsertFields(row)) {
      summary.skipped_invalid += 1;
      items.push({
        candidate_id: row.candidate_id,
        status: "skipped_invalid",
        reasons: classification.reasons,
      });
      continue;
    }

    if (!isMaterializeMode(parsed.mode)) {
      items.push({
        candidate_id: row.candidate_id,
        status: classification.action === "insert_warning"
          ? "would_insert_warning"
          : "would_insert",
        idempotency_key_masked: maskId(row.idempotency_key),
        reasons: row.eligibility_reasons ?? [],
      });
      continue;
    }

    const insertPayload = {
      canonical_event_log_id: row.event_row_id,
      canonical_event_id: row.canonical_event_id,
      canonical_event_name: row.canonical_event_name,
      canonical_event_timestamp: row.canonical_event_timestamp,
      client_id: row.client_id,
      client_slug: row.client_slug,
      platform_config_id: row.platform_config_id,
      platform_name: row.platform_name,
      dispatch_event_name: row.dispatch_event_name,
      mapper_version: row.mapper_version,
      payload_version: "outbox-contract-v1",
      idempotency_key: row.idempotency_key,
      payload_hash: null,
      redacted_payload_snapshot: redactedPayloadSnapshot(row),
      eligibility_status: row.eligibility_status,
      eligibility_reasons: row.eligibility_reasons ?? [],
      readiness_status: row.readiness_status,
      dry_run_only: true,
      send_enabled: false,
      eligibility_version: row.eligibility_version ?? "dispatch-eligibility-v1",
      candidate_fingerprint: row.candidate_fingerprint,
      decision_snapshot: decisionSnapshot(
        row,
        userId,
        parsed.mode,
        parsed.include_warnings,
      ),
      value_usd: toNumber(row.value_usd),
      currency: "USD",
      value_basis: row.value_basis,
      true_margin_available: row.true_margin_available,
      attribution_strength: row.attribution_strength,
      token_present: Boolean(row.token_present),
      destination_present: Boolean(row.destination_present),
      config_state: row.config_state,
      validation_status: row.validation_status,
      lifecycle_status: "materialized_not_sendable",
      attempt_count: 0,
      max_attempts: 3,
      next_attempt_at: null,
      locked_at: null,
      locked_by: null,
      sent_at: null,
      external_event_id: null,
      last_error: null,
      metadata: {
        materialization_mode: parsed.mode,
        materialized_by: userId,
        include_warnings: parsed.include_warnings,
        no_external_dispatch: true,
      },
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("platform_dispatch_outbox")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const existingId = await fetchExistingOutboxId(supabaseAdmin, row);
        summary.duplicate_protected += 1;
        summary.skipped_duplicate += 1;
        items.push({
          candidate_id: row.candidate_id,
          status: "duplicate_protected",
          outbox_id_masked: maskId(existingId),
          reasons: ["duplicate_outbox_row_exists"],
        });
      } else {
        summary.errors += 1;
        items.push({
          candidate_id: row.candidate_id,
          status: "error",
          error: insertError.message,
          reasons: row.eligibility_reasons ?? [],
        });
      }
      continue;
    }

    const maskedId = maskId(inserted?.id) ?? "created";
    createdIdsMasked.push(maskedId);
    summary.inserted += 1;
    if (classification.action === "insert_warning") {
      summary.inserted_warnings += 1;
    }
    items.push({
      candidate_id: row.candidate_id,
      status: classification.action === "insert_warning"
        ? "inserted_warning"
        : "inserted",
      outbox_id_masked: maskedId,
      idempotency_key_masked: maskId(row.idempotency_key),
      reasons: row.eligibility_reasons ?? [],
    });
  }

  return successResponse({
    mode: parsed.mode,
    preview_only: !isMaterializeMode(parsed.mode),
    dry_run_only: true,
    send_enabled: false,
    external_apis_called: false,
    attempts_written: false,
    summary,
    created_outbox_row_ids_masked: createdIdsMasked,
    reason_code_breakdown: reasonBreakdown,
    items,
  });
});
