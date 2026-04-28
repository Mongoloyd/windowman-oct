import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

type Mode = "preview_attempt" | "simulate_attempt" | "simulate_selected";
type AttemptStatus = "simulated" | "failed_preflight" | "blocked_by_gate";

interface OutboxRow {
  id: string;
  created_at: string;
  canonical_event_log_id: string | null;
  canonical_event_id: string | null;
  canonical_event_name: string | null;
  canonical_event_timestamp: string | null;
  client_slug: string | null;
  platform_config_id: string | null;
  platform_name: string | null;
  dispatch_event_name: string | null;
  mapper_version: string | null;
  idempotency_key: string | null;
  redacted_payload_snapshot: Record<string, unknown> | null;
  eligibility_status: string | null;
  eligibility_reasons: string[] | null;
  dry_run_only: boolean | null;
  send_enabled: boolean | null;
  lifecycle_status: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  sent_at: string | null;
  external_event_id: string | null;
}

const UUIDSchema = z.string().uuid();
const BodySchema = z.object({
  mode: z.enum(["preview_attempt", "simulate_attempt", "simulate_selected"]),
  outbox_id: UUIDSchema.optional(),
  outbox_ids: z.array(UUIDSchema).max(25).optional().default([]),
  confirmation: z.string().optional(),
}).strict();

function maskId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableStringify(record[key])}`
    ).join(",")
  }}`;
}

async function sha256Hex(value: unknown): Promise<string | null> {
  try {
    const encoded = new TextEncoder().encode(stableStringify(value));
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest)).map((byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
  } catch {
    return null;
  }
}

const SENSITIVE_KEY_RE =
  /(token|secret|authorization|bearer|email|phone|endpoint_url|webhook_url|url|fbclid|fbc|fbp|ttclid|ttp|gclid|gbraid|wbraid|ip|user_agent|address)/i;

function sanitizeSnapshot(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      if (key.endsWith("_present") || key.endsWith("Present")) {
        next[key] = Boolean(child);
      } else if (key.endsWith("_masked") || key.endsWith("Masked")) {
        next[key] = child;
      } else next[key] = "[redacted]";
    } else {
      next[key] = sanitizeSnapshot(child);
    }
  }
  return next;
}

function safeBaseSnapshot(row: OutboxRow): Record<string, unknown> | null {
  const snapshot = row.redacted_payload_snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  return sanitizeSnapshot(snapshot) as Record<string, unknown>;
}

function liveLifecycleStatus(value: string | null): boolean {
  if (!value) return true;
  return ![
    "disabled_dry_run",
    "candidate",
    "materialized_not_sendable",
    "blocked",
    "superseded",
    "cancelled",
  ].includes(value);
}

function gateReasons(row: OutboxRow | null): string[] {
  if (!row) return ["outbox_row_missing"];
  const reasons: string[] = [];
  if (row.dry_run_only !== true) reasons.push("outbox_not_dry_run_only");
  if (row.send_enabled !== false) reasons.push("send_enabled_not_false");
  if (row.sent_at) reasons.push("sent_at_present");
  if (row.external_event_id) reasons.push("external_event_id_present");
  if (row.locked_at) reasons.push("locked_at_present");
  if (row.locked_by) reasons.push("locked_by_present");
  if (row.next_attempt_at) reasons.push("next_attempt_at_present");
  if (liveLifecycleStatus(row.lifecycle_status)) {
    reasons.push("unsafe_lifecycle_status");
  }
  if (!row.idempotency_key) reasons.push("idempotency_key_missing");
  if (!safeBaseSnapshot(row)) reasons.push("redacted_payload_snapshot_missing");
  if (!row.platform_config_id) reasons.push("platform_config_id_missing");
  if (!row.canonical_event_log_id) {
    reasons.push("canonical_event_log_id_missing");
  }
  return reasons;
}

function preflightReasons(
  row: OutboxRow,
  attemptNumber: number,
  payloadHash: string | null,
): string[] {
  const reasons: string[] = [];
  const snapshot = safeBaseSnapshot(row);
  if (!payloadHash) reasons.push("payload_hash_unavailable");
  if (!snapshot) reasons.push("redacted_snapshot_malformed");
  if (!row.platform_name) reasons.push("platform_name_missing");
  if (!row.client_slug) reasons.push("client_slug_missing");
  if (!row.canonical_event_id && !row.canonical_event_log_id) {
    reasons.push("event_identity_missing");
  }
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    reasons.push("attempt_number_invalid");
  }
  return reasons;
}

function statusFor(
  row: OutboxRow | null,
  attemptNumber: number,
  payloadHash: string | null,
): { status: AttemptStatus; reasons: string[] } {
  const gate = gateReasons(row);
  if (!row || gate.length > 0) {
    return { status: "blocked_by_gate", reasons: gate };
  }
  const preflight = preflightReasons(row, attemptNumber, payloadHash);
  if (preflight.length > 0) {
    return { status: "failed_preflight", reasons: preflight };
  }
  return { status: "simulated", reasons: [] };
}

function buildRequestSnapshot(
  row: OutboxRow,
  payloadHash: string | null,
): Record<string, unknown> {
  return {
    ...(safeBaseSnapshot(row) ?? {}),
    attempt_simulation: {
      source: "platform_dispatch_outbox",
      outbox_id: maskId(row.id),
      idempotency_key_present: Boolean(row.idempotency_key),
      platform_name: row.platform_name,
      client_slug: row.client_slug,
      canonical_event_id_present: Boolean(row.canonical_event_id),
      canonical_event_id_masked: maskId(row.canonical_event_id),
      dry_run_only: row.dry_run_only === true,
      send_enabled: row.send_enabled === true,
      payload_hash_present: Boolean(payloadHash),
      would_call_external_api: false,
      external_response_expected: false,
    },
  };
}

function errorFor(
  status: AttemptStatus,
  reasons: string[],
): { error_code: string | null; error_message: string | null } {
  if (status === "simulated") return { error_code: null, error_message: null };
  const first = reasons[0] ?? "unknown_preflight_reason";
  return {
    error_code: first,
    error_message: status === "blocked_by_gate"
      ? `Blocked by dry-run gate: ${first}`
      : `Failed simulated preflight: ${first}`,
  };
}

async function nextAttemptNumber(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  outboxId: string,
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_dispatch_attempts")
    .select("attempt_number")
    .eq("outbox_id", outboxId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (error) return null;
  const current = Array.isArray(data) && data[0]?.attempt_number
    ? Number(data[0].attempt_number)
    : 0;
  return Number.isFinite(current) ? current + 1 : null;
}

async function simulateOne(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  outboxId: string,
  write: boolean,
  operatorId: string,
): Promise<Record<string, unknown>> {
  const { data: rowData, error } = await supabaseAdmin
    .from("platform_dispatch_outbox")
    .select("*")
    .eq("id", outboxId)
    .maybeSingle();

  if (error) {
    return {
      outbox_id_masked: maskId(outboxId),
      status: "blocked_by_gate",
      reasons: ["outbox_lookup_failed"],
      attempts_written: false,
      error: error.message,
    };
  }

  const row = (rowData ?? null) as OutboxRow | null;
  const attemptNumber = row
    ? await nextAttemptNumber(supabaseAdmin, row.id)
    : 0;
  const snapshotSeed = row ? safeBaseSnapshot(row) : null;
  const payloadHash = snapshotSeed ? await sha256Hex(snapshotSeed) : null;
  const status = row && attemptNumber
    ? statusFor(row, attemptNumber, payloadHash)
    : {
      status: "blocked_by_gate" as AttemptStatus,
      reasons: row ? ["attempt_number_unavailable"] : ["outbox_row_missing"],
    };
  const requestSnapshot = row ? buildRequestSnapshot(row, payloadHash) : null;
  const errors = errorFor(status.status, status.reasons);

  const item: Record<string, unknown> = {
    outbox_id: row?.id ?? outboxId,
    outbox_id_masked: maskId(row?.id ?? outboxId),
    platform_name: row?.platform_name ?? null,
    client_slug: row?.client_slug ?? null,
    attempt_number: attemptNumber,
    status: status.status,
    request_payload_hash: payloadHash,
    request_payload_hash_short: payloadHash
      ? `${payloadHash.slice(0, 12)}…${payloadHash.slice(-8)}`
      : null,
    redacted_request_snapshot: requestSnapshot,
    response_status_code: null,
    response_excerpt: null,
    error_code: errors.error_code,
    error_message: errors.error_message,
    reasons: status.reasons,
    dry_run: true,
    external_apis_called: false,
    attempts_written: false,
  };

  if (!write || !row || !requestSnapshot || !attemptNumber) return item;

  const insertPayload = {
    outbox_id: row.id,
    attempt_number: attemptNumber,
    dry_run: true,
    status: status.status,
    request_payload_hash: payloadHash,
    redacted_request_snapshot: requestSnapshot,
    response_status_code: null,
    response_excerpt: null,
    error_code: errors.error_code,
    error_message: errors.error_message,
    metadata: {
      simulated_by: operatorId,
      simulated_at: new Date().toISOString(),
      simulator_version: "dispatch-attempt-simulator-v1",
      reason_codes: status.reasons,
      external_apis_called: false,
      outbox_updated: false,
    },
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("platform_dispatch_attempts")
    .insert(insertPayload)
    .select("id, created_at")
    .single();

  if (insertError) {
    return {
      ...item,
      status: "failed_preflight",
      error_code: "attempt_insert_failed",
      error_message: insertError.message,
      reasons: [...status.reasons, "attempt_insert_failed"],
      attempts_written: false,
    };
  }

  return {
    ...item,
    attempt_id: inserted?.id ?? null,
    created_at: inserted?.created_at ?? null,
    attempts_written: true,
  };
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
      "Invalid attempt simulation request.",
      {
        issues: error instanceof z.ZodError
          ? error.flatten().fieldErrors
          : undefined,
      },
    );
  }

  if (parsed.mode === "preview_attempt" && !parsed.outbox_id) {
    return errorResponse(
      400,
      "outbox_id_required",
      "preview_attempt requires one outbox_id.",
    );
  }
  if (parsed.mode === "simulate_attempt" && !parsed.outbox_id) {
    return errorResponse(
      400,
      "outbox_id_required",
      "simulate_attempt requires one outbox_id.",
    );
  }
  if (parsed.mode === "simulate_selected" && parsed.outbox_ids.length === 0) {
    return errorResponse(
      400,
      "outbox_ids_required",
      "simulate_selected requires outbox_ids.",
    );
  }
  if (
    (parsed.mode === "simulate_attempt" ||
      parsed.mode === "simulate_selected") &&
    parsed.confirmation !== "SIMULATE_DRY_RUN_ATTEMPT_ONLY"
  ) {
    return errorResponse(
      400,
      "confirmation_required",
      "Type SIMULATE_DRY_RUN_ATTEMPT_ONLY to write simulated dry-run attempt rows.",
    );
  }

  const writeRequested = parsed.mode !== "preview_attempt";
  const ids = parsed.mode === "simulate_selected"
    ? parsed.outbox_ids
    : [parsed.outbox_id!];
  const items = [];
  for (const id of ids) {
    items.push(
      await simulateOne(
        validation.supabaseAdmin,
        id,
        writeRequested,
        validation.userId,
      ),
    );
  }

  const summary = {
    outbox_rows_considered: items.length,
    simulated: items.filter((item) => item.status === "simulated").length,
    failed_preflight: items.filter((item) =>
      item.status === "failed_preflight"
    ).length,
    blocked_by_gate:
      items.filter((item) => item.status === "blocked_by_gate").length,
    attempts_written:
      items.filter((item) => item.attempts_written === true).length,
    response_status_codes_written: 0,
    external_apis_called: 0,
    outbox_rows_updated: 0,
  };

  return successResponse({
    mode: parsed.mode,
    write_requested: writeRequested,
    preview_only: !writeRequested,
    dry_run_only: true,
    external_apis_called: false,
    response_status_codes_written: false,
    outbox_rows_updated: false,
    attempts_written: summary.attempts_written > 0,
    attempts_written_count: summary.attempts_written,
    summary,
    items,
  });
});
