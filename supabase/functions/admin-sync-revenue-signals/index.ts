// deno-lint-ignore no-import-prefix
import { z } from "https://esm.sh/zod@3.22.4";
import {
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

const BodySchema = z.object({
  dry_run: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(500).optional().default(100),
}).strict();

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toSafeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0
  ).slice(0, 25);
}

function sanitizeDryRunResult(raw: unknown) {
  const result = toRecord(raw);
  if (result.external_dispatch !== false || result.dispatch_created !== false) {
    throw new Error("unsafe_dispatch_flags");
  }

  return {
    ok: result.ok === true,
    dry_run: result.dry_run === true,
    run_id: toOptionalString(result.run_id),
    operator_id: toOptionalString(result.operator_id),
    started_at: toOptionalString(result.started_at),
    candidate_count: toNonNegativeInteger(result.candidate_count),
    would_insert: toNonNegativeInteger(result.would_insert),
    inserted: toNonNegativeInteger(result.inserted),
    blocked: toNonNegativeInteger(result.blocked),
    duplicate_protected: toNonNegativeInteger(result.duplicate_protected),
    weak_lifecycle_key: toNonNegativeInteger(result.weak_lifecycle_key),
    lifecycle_duplicate_claim: toNonNegativeInteger(
      result.lifecycle_duplicate_claim,
    ),
    duplicate_revenue_signal_key: toNonNegativeInteger(
      result.duplicate_revenue_signal_key,
    ),
    by_client_slug: toRecord(result.by_client_slug),
    by_reason_code: toRecord(result.by_reason_code),
    by_key_basis: toRecord(result.by_key_basis),
    sample_candidate_ids: toSafeIdList(result.sample_candidate_ids),
    external_dispatch: false,
    dispatch_created: false,
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
      "Invalid revenue signal sync request.",
      {
        issues: error instanceof z.ZodError
          ? error.flatten().fieldErrors
          : undefined,
      },
    );
  }

  if (parsed.dry_run !== true) {
    return errorResponse(
      400,
      "live_sync_not_available_from_dry_run_service",
      "Live revenue signal sync is not available from this dry-run service.",
    );
  }

  const { data, error } = await validation.supabaseAdmin.rpc(
    "admin_sync_revenue_signals",
    {
      p_limit: parsed.limit,
      p_dry_run: true,
    },
  );

  if (error) {
    return errorResponse(500, "sync_failed", "Revenue signal sync failed.", {
      message: error.message,
    });
  }

  try {
    const result = sanitizeDryRunResult(data);
    if (
      result.ok !== true || result.dry_run !== true || !result.run_id ||
      !result.started_at
    ) {
      return errorResponse(
        502,
        "malformed_dry_run_response",
        "Revenue signal dry-run response was malformed.",
      );
    }
    return successResponse(result);
  } catch (_error) {
    return errorResponse(
      502,
      "unsafe_dry_run_response",
      "Revenue signal dry-run response failed safety validation.",
    );
  }
});
