// deno-lint-ignore no-import-prefix
import { z } from "https://esm.sh/zod@3.23.8";
import {
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

type Action =
  | "route_lead"
  | "reassign_lead"
  | "recycle_lead"
  | "manual_review"
  | "operator_note";

const uuid = z.string().uuid();
const ActionSchema = z.enum([
  "route_lead",
  "reassign_lead",
  "recycle_lead",
  "manual_review",
  "operator_note",
]);
const BodySchema = z.object({
  action: ActionSchema,
  assignment_id: uuid.nullish(),
  lead_id: uuid.nullish(),
  scan_session_id: uuid.nullish(),
  analysis_id: uuid.nullish(),
  syndicate_id: uuid.nullish(),
  client_slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/i)
    .nullish(),
  contractor_account_id: uuid.nullish(),
  reason_code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_:-]+$/i),
  operator_note: z.string().trim().max(1000).nullish(),
  metadata: z.record(z.unknown()).optional().default({}),
}).strict();

type ParsedBody = z.infer<typeof BodySchema>;

function hasIdentity(body: ParsedBody) {
  return Boolean(body.lead_id || body.scan_session_id || body.analysis_id);
}

function validateActionShape(body: ParsedBody): string | null {
  if (
    (body.action === "route_lead" || body.action === "reassign_lead") &&
    !body.client_slug
  ) {
    return "client_slug is required for assignment actions.";
  }
  if (body.action === "route_lead" && !hasIdentity(body)) {
    return "route_lead requires lead_id, scan_session_id, or analysis_id.";
  }
  if (
    body.action === "reassign_lead" && !body.assignment_id && !hasIdentity(body)
  ) {
    return "reassign_lead requires assignment_id or a lead identity.";
  }
  if (
    (body.action === "recycle_lead" || body.action === "manual_review" ||
      body.action === "operator_note") &&
    !body.assignment_id && !hasIdentity(body)
  ) {
    return `${body.action} requires assignment_id or a lead identity.`;
  }
  return null;
}

function pgErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "routing_failed";
  const record = error as Record<string, unknown>;
  return typeof record.code === "string" ? record.code : "routing_failed";
}

function pgErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Lead assignment routing failed.";
  }
  const record = error as Record<string, unknown>;
  return typeof record.message === "string"
    ? record.message
    : "Lead assignment routing failed.";
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

  let body: ParsedBody;
  try {
    body = BodySchema.parse(await req.json());
  } catch (error) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid lead assignment request.",
      {
        issues: error instanceof z.ZodError
          ? error.flatten().fieldErrors
          : undefined,
      },
    );
  }

  const shapeError = validateActionShape(body);
  if (shapeError) return errorResponse(400, "invalid_action_shape", shapeError);

  const metadata = {
    ...body.metadata,
    requested_action: body.action,
    requested_by: validation.userId,
    requested_at: new Date().toISOString(),
    external_dispatch: false,
    revenue_truth_mutated: false,
  };

  const { data, error } = await validation.supabaseAuth.rpc(
    "admin_route_lead_assignment",
    {
      p_action: body.action,
      p_assignment_id: body.assignment_id ?? null,
      p_lead_id: body.lead_id ?? null,
      p_scan_session_id: body.scan_session_id ?? null,
      p_analysis_id: body.analysis_id ?? null,
      p_syndicate_id: body.syndicate_id ?? null,
      p_client_slug: body.client_slug ?? null,
      p_contractor_account_id: body.contractor_account_id ?? null,
      p_reason_code: body.reason_code,
      p_operator_note: body.operator_note ?? null,
      p_metadata: metadata,
    },
  );

  if (error) {
    return errorResponse(400, pgErrorCode(error), pgErrorMessage(error));
  }

  return successResponse({
    data: data as Record<string, unknown>,
    action: body.action as Action,
  });
});
