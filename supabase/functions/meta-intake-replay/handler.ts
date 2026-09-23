import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type AppRole,
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";
import {
  asJsonRecord,
  FACEBOOK_CANONICAL_MAPPING_OPTIONS,
  inspectFacebookPayload,
  isFacebookCanonicalMappingKey,
  type JsonRecord,
  prepareFacebookReplayFixture,
} from "../_shared/facebook-normalizer.ts";

const MAX_REQUEST_BYTES = 1_000_000;
const ANALYZE_ROLES: AppRole[] = ["super_admin", "operator", "viewer"];
const SAVE_ROLES: AppRole[] = ["super_admin", "operator"];

type ReplayAction = "analyze" | "save_mapping";
type MappingAction = "map" | "ignore";

type DedupDecision = {
  action: "create" | "update" | "reject";
  reason:
    | "platform_lead_id_required"
    | "email_or_phone_required"
    | "platform_lead_id_match"
    | "email_match"
    | "phone_match"
    | "no_existing_identity_match";
};

type Authorizer = typeof validateAdminRequestWithRole;

export type MetaIntakeReplayDependencies = {
  authorize?: Authorizer;
};

function isReplayAction(value: unknown): value is ReplayAction {
  return value === "analyze" || value === "save_mapping";
}

function cleanRequiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

async function readRequestBody(req: Request): Promise<
  | { ok: true; body: JsonRecord }
  | {
    ok: false;
    status: 400 | 413;
    code: "invalid_json" | "payload_must_be_object" | "payload_too_large";
    message: string;
  }
> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "payload_too_large",
      message: "Fixture payload exceeds the 1 MB limit.",
    };
  }

  const rawBytes = new Uint8Array(await req.arrayBuffer());
  if (rawBytes.byteLength > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "payload_too_large",
      message: "Fixture payload exceeds the 1 MB limit.",
    };
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
    parsed = JSON.parse(text);
  } catch (_error) {
    return {
      ok: false,
      status: 400,
      code: "invalid_json",
      message: "Request body must be valid UTF-8 JSON.",
    };
  }

  const body = asJsonRecord(parsed);
  if (!body) {
    return {
      ok: false,
      status: 400,
      code: "payload_must_be_object",
      message: "Request body must be a JSON object.",
    };
  }

  return { ok: true, body };
}

async function lookupSingle(
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<boolean> {
  const { data, error } = await query;
  if (error) throw new Error("dedup_lookup_failed");
  return data !== null && data !== undefined;
}

async function planDedup(
  supabaseAdmin: SupabaseClient,
  normalizedLead: JsonRecord,
  validationErrors: string[],
): Promise<DedupDecision> {
  if (validationErrors.includes("platform_lead_id_required")) {
    return { action: "reject", reason: "platform_lead_id_required" };
  }
  if (validationErrors.includes("email_or_phone_required")) {
    return { action: "reject", reason: "email_or_phone_required" };
  }

  const platformLeadId = normalizedLead.platform_lead_id as string;
  const attributionMatch = await lookupSingle(
    supabaseAdmin
      .from("lead_attribution_details")
      .select("lead_id")
      .eq("source_platform", "facebook")
      .eq("platform_lead_id", platformLeadId)
      .limit(1)
      .maybeSingle(),
  );
  if (attributionMatch) {
    return { action: "update", reason: "platform_lead_id_match" };
  }

  const email = typeof normalizedLead.email === "string"
    ? normalizedLead.email
    : null;
  if (email) {
    const emailMatch = await lookupSingle(
      supabaseAdmin
        .from("leads")
        .select("id")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (emailMatch) return { action: "update", reason: "email_match" };
  }

  const phone = typeof normalizedLead.phone_e164 === "string"
    ? normalizedLead.phone_e164
    : null;
  if (phone) {
    const phoneMatch = await lookupSingle(
      supabaseAdmin
        .from("leads")
        .select("id")
        .eq("phone_e164", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (phoneMatch) return { action: "update", reason: "phone_match" };
  }

  return { action: "create", reason: "no_existing_identity_match" };
}

async function analyzeFixture(
  requestBody: JsonRecord,
  role: AppRole,
  supabaseAdmin: SupabaseClient,
): Promise<Response> {
  if (!("fixture" in requestBody)) {
    return errorResponse(
      400,
      "fixture_required",
      "Provide a fixture to analyze.",
    );
  }

  const prepared = prepareFacebookReplayFixture(
    requestBody.fixture,
    requestBody.form_id,
  );
  if (!prepared.ok) {
    const message = prepared.error === "missing_field_data"
      ? "This payload contains no field_data. Paste a Graph lead fixture or a field_data array; the lab never calls Meta."
      : prepared.error === "invalid_field_data"
      ? "field_data must be an array."
      : prepared.error === "empty_field_data"
      ? "field_data must contain at least one field."
      : "Fixture must be a JSON object or a field_data array.";
    return errorResponse(400, prepared.error, message);
  }

  const inspection = inspectFacebookPayload(prepared.fixture.body);
  let dedupDecision: DedupDecision;
  try {
    dedupDecision = await planDedup(
      supabaseAdmin,
      inspection.normalized_lead,
      inspection.validation_errors,
    );
  } catch (_error) {
    return errorResponse(
      500,
      "dedup_lookup_failed",
      "The read-only duplicate check could not be completed.",
    );
  }

  return successResponse({
    result: {
      ...inspection,
      source_shape: prepared.fixture.source_shape,
      dedup_decision: dedupDecision,
      mapping_options: FACEBOOK_CANONICAL_MAPPING_OPTIONS,
      can_save_mappings: role === "operator" || role === "super_admin",
      is_test: true,
      lead_persistence_suppressed: true,
      calling_suppressed: true,
      crm_delivery_suppressed: true,
      writes_performed: [],
    },
  });
}

async function saveMapping(
  requestBody: JsonRecord,
  supabaseAdmin: SupabaseClient,
): Promise<Response> {
  const formId = cleanRequiredText(requestBody.form_id, 255);
  const questionLabel = cleanRequiredText(requestBody.question_label, 500);
  const mappingAction = requestBody.mapping_action;

  if (!formId) {
    return errorResponse(
      400,
      "form_id_required",
      "A valid form ID is required.",
    );
  }
  if (!questionLabel) {
    return errorResponse(
      400,
      "question_label_required",
      "A valid question label is required.",
    );
  }
  if (mappingAction !== "map" && mappingAction !== "ignore") {
    return errorResponse(
      400,
      "invalid_mapping_action",
      "Mapping action must be map or ignore.",
    );
  }

  const canonicalKey = mappingAction === "ignore"
    ? null
    : requestBody.canonical_key;
  if (mappingAction === "map" && !isFacebookCanonicalMappingKey(canonicalKey)) {
    return errorResponse(
      400,
      "invalid_canonical_key",
      "Choose an approved canonical destination.",
    );
  }

  const row = {
    form_id: formId,
    question_label: questionLabel,
    mapping_action: mappingAction as MappingAction,
    canonical_key: canonicalKey as string | null,
  };

  const { data, error } = await supabaseAdmin.rpc("meta_save_form_mapping", {
    p_form_id: row.form_id,
    p_question_label: row.question_label,
    p_mapping_action: row.mapping_action,
    p_canonical_key: row.canonical_key,
  });

  if (error) {
    return errorResponse(
      500,
      "mapping_save_failed",
      "The mapping decision could not be saved.",
    );
  }

  return successResponse({ mapping: data as JsonRecord });
}

export async function handleMetaIntakeReplayRequest(
  req: Request,
  dependencies: MetaIntakeReplayDependencies = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST.");
  }

  const parsed = await readRequestBody(req);
  if (!parsed.ok) {
    return errorResponse(parsed.status, parsed.code, parsed.message);
  }

  const action = parsed.body.action;
  if (!isReplayAction(action)) {
    return errorResponse(
      400,
      "invalid_action",
      "Action must be analyze or save_mapping.",
    );
  }

  const authorize = dependencies.authorize ?? validateAdminRequestWithRole;
  const validation = await authorize(
    req,
    action === "analyze" ? ANALYZE_ROLES : SAVE_ROLES,
  );
  if (!validation.ok) return validation.response;

  return action === "analyze"
    ? analyzeFixture(parsed.body, validation.role, validation.supabaseAdmin)
    : saveMapping(parsed.body, validation.supabaseAdmin);
}
