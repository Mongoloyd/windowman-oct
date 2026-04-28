import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATES = new Set(["new", "attempting_contact", "contacted", "meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead"]);
const CONTACT_RELEASE_REQUIRED = new Set(["contacted", "meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead"]);
const TERMINAL_STATES = new Set(["sold_closed", "lost_dead"]);
const VALID_REASON_CODES = new Set(["price_too_high", "chose_competitor", "no_longer_interested", "unresponsive", "project_canceled", "out_of_service_area", "other"]);
const VALID_VALUE_BASIS = new Set(["contract_total", "gross_sale_value", "true_margin", "estimated_contract_value"]);
const FORBIDDEN_CLIENT_FIELDS = ["contractor_account_id", "client_slug", "operator_id", "revenue_signal_key", "external_dispatch", "dispatch_created"];

type JsonBody = Record<string, unknown>;

type ContractorAccountRow = {
  id: string;
  client_slug: string;
  access_status: string | null;
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  client_slug: string;
  contractor_account_id: string | null;
  lead_id: string | null;
  analysis_id: string | null;
  status: string;
  is_current: boolean | null;
  metadata: Record<string, unknown> | null;
};

type OutcomeRow = {
  id: string;
  disposition_state: string;
  outcome_metadata: Record<string, unknown> | null;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function badRequest(message: string, extra: Record<string, unknown> = {}) {
  return json({ error: "invalid_input", message, external_dispatch: false, dispatch_created: false, ...extra }, 400);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function intValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function metadataUuid(metadata: Record<string, unknown> | null, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && UUID_RE.test(value)) return value;
  }
  return null;
}

function activeOutcome(row: OutcomeRow): boolean {
  return row.outcome_metadata?.signal_lifecycle_action !== "inactive";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed", message: "POST required.", external_dispatch: false, dispatch_created: false }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "unauthenticated", message: "Missing auth token.", external_dispatch: false, dispatch_created: false }, 401);
    }

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user?.id) {
      return json({ error: "unauthenticated", message: "Invalid auth token.", external_dispatch: false, dispatch_created: false }, 401);
    }

    let body: JsonBody;
    try {
      body = await req.json();
    } catch {
      return badRequest("Request body must be valid JSON.");
    }

    const spoofedFields = FORBIDDEN_CLIENT_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
    if (spoofedFields.length > 0) {
      return json({ error: "forbidden_client_fields", message: "Server-owned fields may not be supplied by the client.", fields: spoofedFields, external_dispatch: false, dispatch_created: false }, 422);
    }

    const leadAssignmentId = textValue(body.lead_assignment_id) ?? textValue(body.assignmentId);
    const dispositionState = textValue(body.disposition_state) ?? textValue(body.dispositionState);
    const dispositionReasonCode = textValue(body.disposition_reason_code) ?? textValue(body.dispositionReasonCode);
    const notes = textValue(body.outcome_notes) ?? textValue(body.notes);
    const valueBasis = textValue(body.value_basis) ?? textValue(body.valueBasis);
    const projectedValueCents = intValue(body.projected_value_cents ?? body.projectedValueCents);
    const finalValueCents = intValue(body.final_value_cents ?? body.finalValueCents);
    const signedContractUrl = textValue(body.signed_contract_url) ?? textValue(body.signedContractUrl);

    if (!leadAssignmentId || !UUID_RE.test(leadAssignmentId)) return badRequest("lead_assignment_id is required and must be a UUID.");
    if (!dispositionState || !VALID_STATES.has(dispositionState)) {
      return json({ error: "invalid_state", message: "disposition_state is not allowed for contractor submission.", valid_states: [...VALID_STATES], external_dispatch: false, dispatch_created: false }, 422);
    }
    if (dispositionReasonCode && !VALID_REASON_CODES.has(dispositionReasonCode)) {
      return json({ error: "invalid_reason_code", message: "disposition_reason_code is not allowed.", valid_reason_codes: [...VALID_REASON_CODES], external_dispatch: false, dispatch_created: false }, 422);
    }
    if (valueBasis && !VALID_VALUE_BASIS.has(valueBasis)) {
      return json({ error: "invalid_value_basis", message: "value_basis is not allowed.", valid_value_basis: [...VALID_VALUE_BASIS], external_dispatch: false, dispatch_created: false }, 422);
    }
    if (body.projected_value_cents != null && projectedValueCents == null) return badRequest("projected_value_cents must be an integer when supplied.");
    if (body.final_value_cents != null && finalValueCents == null) return badRequest("final_value_cents must be an integer when supplied.");

    if (dispositionState === "sold_closed") {
      if (finalValueCents == null || finalValueCents <= 0) {
        return json({ error: "positive_value_required", message: "Sold outcomes require a positive final_value_cents value.", external_dispatch: false, dispatch_created: false }, 422);
      }
      if (!valueBasis) {
        return json({ error: "value_basis_required", message: "Sold outcomes require value_basis.", external_dispatch: false, dispatch_created: false }, 422);
      }
    }
    if (dispositionState === "lost_dead" && (!dispositionReasonCode || !notes)) {
      return json({ error: "lost_reason_required", message: "Lost outcomes require disposition_reason_code and notes.", external_dispatch: false, dispatch_created: false }, 422);
    }

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: accounts, error: accountErr } = await svc
      .from("contractor_accounts")
      .select("id, client_slug, access_status, is_active")
      .eq("auth_user_id", userData.user.id)
      .eq("is_active", true)
      .eq("access_status", "active");
    if (accountErr) {
      console.error("[contractor-submit-outcome] account lookup failed", accountErr);
      return json({ error: "account_lookup_failed", message: "Contractor account could not be verified.", external_dispatch: false, dispatch_created: false }, 500);
    }
    const activeAccounts = (accounts ?? []) as ContractorAccountRow[];
    if (activeAccounts.length === 0) {
      return json({ error: "contractor_account_not_active", message: "No active contractor account is linked to this login.", external_dispatch: false, dispatch_created: false }, 403);
    }

    const { data: assignmentData, error: assignmentErr } = await svc
      .from("lead_assignments")
      .select("id, client_slug, contractor_account_id, lead_id, analysis_id, status, is_current, metadata")
      .eq("id", leadAssignmentId)
      .maybeSingle();
    if (assignmentErr) {
      console.error("[contractor-submit-outcome] assignment lookup failed", assignmentErr);
      return json({ error: "assignment_lookup_failed", message: "Assigned opportunity could not be verified.", external_dispatch: false, dispatch_created: false }, 500);
    }
    const assignment = assignmentData as AssignmentRow | null;
    if (!assignment?.contractor_account_id) {
      return json({ error: "assignment_not_found", message: "Assigned opportunity was not found for this contractor account.", external_dispatch: false, dispatch_created: false }, 404);
    }

    const contractorAccount = activeAccounts.find((account) => account.id === assignment.contractor_account_id && account.client_slug === assignment.client_slug);
    if (!contractorAccount) {
      return json({ error: "assignment_forbidden", message: "Assigned opportunity does not belong to this contractor account and client.", external_dispatch: false, dispatch_created: false }, 403);
    }
    if (assignment.is_current === false || assignment.status === "recycled") {
      return json({ error: "assignment_not_current", message: "Only current assigned opportunities can receive contractor outcomes.", external_dispatch: false, dispatch_created: false }, 409);
    }

    if (CONTACT_RELEASE_REQUIRED.has(dispositionState)) {
      const { data: release, error: releaseErr } = await svc
        .from("lead_contact_releases")
        .select("release_status, allowed_contact_fields")
        .eq("lead_assignment_id", assignment.id)
        .eq("contractor_account_id", contractorAccount.id)
        .eq("client_slug", assignment.client_slug)
        .maybeSingle();
      if (releaseErr) {
        console.error("[contractor-submit-outcome] release lookup failed", releaseErr);
        return json({ error: "release_lookup_failed", message: "Contact release state could not be verified.", external_dispatch: false, dispatch_created: false }, 500);
      }
      if (!release || release.release_status !== "approved") {
        return json({ error: "contact_release_required", message: "This outcome state requires approved contact release for the assignment.", external_dispatch: false, dispatch_created: false }, 403);
      }
    }

    const { data: existingRows, error: existingErr } = await svc
      .from("contractor_outcomes")
      .select("id, disposition_state, outcome_metadata")
      .eq("lead_assignment_id", assignment.id)
      .eq("contractor_account_id", contractorAccount.id)
      .eq("client_slug", assignment.client_slug)
      .order("created_at", { ascending: false })
      .limit(5);
    if (existingErr) {
      console.error("[contractor-submit-outcome] outcome lookup failed", existingErr);
      return json({ error: "outcome_lookup_failed", message: "Outcome record could not be loaded.", external_dispatch: false, dispatch_created: false }, 500);
    }

    const existing = ((existingRows ?? []) as OutcomeRow[]).find(activeOutcome) ?? null;
    if (existing && TERMINAL_STATES.has(existing.disposition_state) && existing.disposition_state !== dispositionState) {
      return json({ error: "terminal_outcome_locked", message: "A terminal outcome already exists for this assignment.", current_state: existing.disposition_state, external_dispatch: false, dispatch_created: false }, 409);
    }

    const now = new Date().toISOString();
    const opportunityId = metadataUuid(assignment.metadata, ["opportunity_id", "contractor_opportunity_id"]);
    const routeId = metadataUuid(assignment.metadata, ["route_id", "contractor_route_id"]);
    const payload: Record<string, unknown> = {
      lead_assignment_id: assignment.id,
      client_slug: assignment.client_slug,
      contractor_account_id: contractorAccount.id,
      opportunity_id: opportunityId,
      route_id: routeId,
      disposition_state: dispositionState,
      disposition_reason_code: dispositionState === "lost_dead" ? dispositionReasonCode : null,
      projected_value_cents: projectedValueCents,
      final_value_cents: dispositionState === "sold_closed" ? finalValueCents : null,
      value_basis: dispositionState === "sold_closed" ? valueBasis : null,
      signed_contract_url: signedContractUrl,
      outcome_notes: notes,
      last_partner_action_at: now,
      closed_at: TERMINAL_STATES.has(dispositionState) ? now : null,
      deal_status: dispositionState === "sold_closed" ? "won" : dispositionState === "lost_dead" ? "lost" : "open",
      deal_value: dispositionState === "sold_closed" && finalValueCents != null ? finalValueCents / 100 : null,
      outcome_source: "contractor_portal_4d",
      outcome_metadata: {
        revenue_truth_source: "contractor_outcomes",
        lead_rollup_only: false,
        assignment_operational_only: false,
        source_system: "contractor-submit-outcome",
        signal_lifecycle_action: "active",
        external_dispatch: false,
        dispatch_created: false,
      },
    };

    const mutation = existing
      ? svc.from("contractor_outcomes").update(payload).eq("id", existing.id).select("id, disposition_state, outcome_integrity_status, outcome_integrity_reasons").single()
      : svc.from("contractor_outcomes").insert(payload).select("id, disposition_state, outcome_integrity_status, outcome_integrity_reasons").single();
    const { data: saved, error: saveErr } = await mutation;
    if (saveErr) {
      console.error("[contractor-submit-outcome] outcome save failed", saveErr);
      return json({ error: "outcome_save_failed", message: "Outcome could not be saved safely.", external_dispatch: false, dispatch_created: false }, 500);
    }

    return json({
      success: true,
      outcome_id: saved.id,
      disposition_state: saved.disposition_state,
      outcome_integrity_status: saved.outcome_integrity_status,
      outcome_integrity_reasons: saved.outcome_integrity_reasons ?? [],
      external_dispatch: false,
      dispatch_created: false,
    });
  } catch (error) {
    console.error("[contractor-submit-outcome] unhandled error", error);
    return json({ error: "internal_error", message: "Internal server error.", external_dispatch: false, dispatch_created: false }, 500);
  }
});
