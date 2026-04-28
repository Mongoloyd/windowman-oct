/**
 * partner-update-disposition — Authoritative write path for partner CRM disposition updates.
 *
 * Resolves contractor JWT → contractors.id, enforces ownership, validates the
 * requested state transition, updates contractor_outcomes, rolls up summary
 * truth to leads, and emits a canonical sold event when the outcome closes.
 *
 * All writes go through the service-role client — contractor_outcomes has no
 * public RLS policies by design.
 *
 * Inputs (POST body):
 *   {
 *     opportunity_id: string;           // required — identifies the outcome row
 *     disposition_state: string;        // required — target state
 *     disposition_reason_code?: string; // required when disposition_state = 'lost_dead'
 *     projected_value_cents?: number;   // optional
 *     final_value_cents?: number;       // required when disposition_state = 'sold_closed'
 *     value_basis?: string;             // required when disposition_state = 'sold_closed'
 *     signed_contract_url?: string;     // optional
 *     notes?: string;                   // stored in outcome_notes
 *   }
 *
 * Auth: JWT required (contractor auth user)
 */

// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createCanonicalEvent } from "../_shared/tracking/canonical/createCanonicalEvent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Valid disposition states
const VALID_STATES = new Set([
  "new",
  "attempting_contact",
  "meeting_scheduled",
  "quote_delivered",
  "sold_closed",
  "lost_dead",
]);

// Valid reason codes — must stay in sync with DISPOSITION_REASON_CODE in src/lib/statusConstants.ts
const VALID_REASON_CODES = new Set([
  "price_too_high",
  "chose_competitor",
  "no_longer_interested",
  "unresponsive",
  "project_canceled",
  "out_of_service_area",
  "other",
]);

const VALID_VALUE_BASIS = new Set([
  "contract_total",
  "gross_sale_value",
  "true_margin",
  "estimated_contract_value",
  "unknown",
]);

function computeIntegrity(input: {
  disposition_state: string;
  final_value_cents?: number;
  value_basis?: string;
  disposition_reason_code?: string;
  notes?: string;
  client_slug?: string | null;
  lead_assignment_id?: string | null;
  contractor_account_id?: string | null;
  assignment_client_slug?: string | null;
  contractor_account_client_slug?: string | null;
}) {
  const reasons: string[] = [];
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";

  if (!input.client_slug) reasons.push("missing_client_slug");
  if (!input.lead_assignment_id) reasons.push("missing_assignment");
  if (!input.contractor_account_id) reasons.push("missing_contractor_account");

  if (input.disposition_state === "sold_closed") {
    if (input.final_value_cents == null) reasons.push("sold_missing_value");
    else if (input.final_value_cents <= 0) reasons.push("sold_invalid_value");

    if (!input.value_basis) reasons.push("sold_missing_value_basis");
    else if (input.value_basis === "unknown") {
      reasons.push("value_basis_unknown");
    } else if (input.value_basis === "gross_sale_value") {
      reasons.push("value_basis_gross_proxy");
    }
  }

  if (
    input.disposition_state === "lost_dead" &&
    (!input.disposition_reason_code || !notes)
  ) {
    reasons.push("lost_missing_reason");
  }

  if (!["sold_closed", "lost_dead"].includes(input.disposition_state)) {
    reasons.push("outcome_not_terminal");
  }

  if (
    input.client_slug && input.assignment_client_slug &&
    input.client_slug !== input.assignment_client_slug
  ) {
    reasons.push("assignment_client_mismatch");
  }
  if (
    input.client_slug && input.contractor_account_client_slug &&
    input.client_slug !== input.contractor_account_client_slug
  ) {
    reasons.push("contractor_client_mismatch");
  }

  const eligible = input.disposition_state === "sold_closed" &&
    typeof input.final_value_cents === "number" &&
    input.final_value_cents > 0 &&
    Boolean(input.value_basis) &&
    input.value_basis !== "unknown" &&
    Boolean(input.client_slug) &&
    !reasons.some((reason) =>
      ["assignment_client_mismatch", "contractor_client_mismatch"].includes(
        reason,
      )
    );
  reasons.push(
    eligible ? "eligible_for_future_signal" : "not_eligible_for_signal",
  );

  const status = reasons.some((r) =>
      [
        "sold_missing_value",
        "sold_invalid_value",
        "lost_missing_reason",
        "assignment_client_mismatch",
        "contractor_client_mismatch",
      ]
        .includes(r)
    )
    ? "blocked"
    : reasons.some((r) =>
        [
          "missing_client_slug",
          "missing_assignment",
          "missing_contractor_account",
          "sold_missing_value_basis",
          "value_basis_unknown",
        ].includes(r)
      )
    ? "needs_review"
    : reasons.some((r) =>
        ["value_basis_gross_proxy", "outcome_not_terminal"].includes(r)
      )
    ? "warning"
    : "valid";

  return { status, reasons };
}

// Legal transitions: key = current state, value = allowed next states
const TRANSITIONS: Record<string, string[]> = {
  new: ["attempting_contact", "lost_dead"],
  attempting_contact: ["meeting_scheduled", "lost_dead"],
  meeting_scheduled: ["quote_delivered", "lost_dead"],
  quote_delivered: ["sold_closed", "lost_dead"],
  sold_closed: [],
  lost_dead: [],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        { error: "unauthenticated", message: "Missing auth token." },
        401,
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }
    const authUserId = user.id;

    // ── Service client ───────────────────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Verify active contractor profile ─────────────────────────
    const { data: profile } = await svc
      .from("contractor_profiles")
      .select("id, status")
      .eq("id", authUserId)
      .maybeSingle();

    if (!profile) {
      return json({
        error: "no_contractor_profile",
        message: "No contractor profile found.",
      }, 404);
    }
    if (profile.status !== "active") {
      return json({
        error: "contractor_inactive",
        message: `Contractor account is ${profile.status}.`,
      }, 403);
    }

    // ── Resolve marketplace contractor record ────────────────────
    const { data: contractor } = await svc
      .from("contractors")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!contractor) {
      return json({
        error: "no_contractor_record",
        message: "No marketplace contractor record linked to your account.",
      }, 404);
    }
    const contractorId = contractor.id as string;

    // ── Parse and validate request body ─────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({
        error: "invalid_body",
        message: "Request body must be valid JSON.",
      }, 400);
    }

    const {
      opportunity_id,
      disposition_state,
      disposition_reason_code,
      projected_value_cents,
      final_value_cents,
      value_basis,
      lead_assignment_id,
      client_slug,
      contractor_account_id,
      signed_contract_url,
      notes,
    } = body as {
      opportunity_id?: string;
      disposition_state?: string;
      disposition_reason_code?: string;
      projected_value_cents?: number;
      final_value_cents?: number;
      value_basis?: string;
      lead_assignment_id?: string;
      client_slug?: string;
      contractor_account_id?: string;
      signed_contract_url?: string;
      notes?: string;
    };

    if (!opportunity_id || typeof opportunity_id !== "string") {
      return json({
        error: "invalid_input",
        message: "opportunity_id is required.",
      }, 400);
    }
    if (!disposition_state || typeof disposition_state !== "string") {
      return json({
        error: "invalid_input",
        message: "disposition_state is required.",
      }, 400);
    }
    if (!VALID_STATES.has(disposition_state)) {
      return json({
        error: "invalid_state",
        message:
          `disposition_state '${disposition_state}' is not a valid state.`,
        valid_states: [...VALID_STATES],
      }, 422);
    }
    if (
      disposition_reason_code != null &&
      !VALID_REASON_CODES.has(disposition_reason_code)
    ) {
      return json({
        error: "invalid_reason_code",
        message:
          `disposition_reason_code '${disposition_reason_code}' is not a valid reason code.`,
        valid_reason_codes: [...VALID_REASON_CODES],
      }, 422);
    }
    if (lead_assignment_id != null && typeof lead_assignment_id !== "string") {
      return json({
        error: "invalid_input",
        message: "lead_assignment_id must be a string when provided.",
      }, 400);
    }
    if (client_slug != null && typeof client_slug !== "string") {
      return json({
        error: "invalid_input",
        message: "client_slug must be a string when provided.",
      }, 400);
    }
    if (
      contractor_account_id != null && typeof contractor_account_id !== "string"
    ) {
      return json({
        error: "invalid_input",
        message: "contractor_account_id must be a string when provided.",
      }, 400);
    }
    if (
      value_basis != null &&
      (!VALID_VALUE_BASIS.has(value_basis) || value_basis === "unknown")
    ) {
      return json({
        error: "invalid_value_basis",
        message:
          "value_basis must explicitly describe the sold value basis and cannot be unknown for partner updates.",
        valid_value_basis: [...VALID_VALUE_BASIS].filter((basis) =>
          basis !== "unknown"
        ),
      }, 422);
    }

    // ── lost_dead requires reason code AND typed manual reason text ───────
    const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
    if (disposition_state === "lost_dead") {
      if (!disposition_reason_code) {
        return json({
          error: "reason_required",
          message:
            "disposition_reason_code is required when marking a lead as lost_dead.",
        }, 422);
      }
      if (!trimmedNotes) {
        return json({
          error: "lost_reason_text_required",
          message:
            "A typed loss reason is required when marking a lead as lost_dead.",
        }, 422);
      }
    }

    // ── sold_closed requires positive integer final_value_cents (> 0) ─────
    if (disposition_state === "sold_closed") {
      if (
        final_value_cents == null ||
        !Number.isInteger(final_value_cents) ||
        final_value_cents <= 0
      ) {
        return json({
          error: "positive_value_required",
          message:
            "final_value_cents must be a positive integer greater than 0 when marking a lead as sold_closed.",
        }, 422);
      }
      if (!value_basis || value_basis === "unknown") {
        return json({
          error: "value_basis_required",
          message:
            "value_basis is required when marking a lead as sold_closed. Use contract_total, gross_sale_value, true_margin, or estimated_contract_value.",
        }, 422);
      }
    }

    if (
      projected_value_cents != null &&
      (!Number.isInteger(projected_value_cents) || projected_value_cents < 0)
    ) {
      return json({
        error: "invalid_input",
        message: "projected_value_cents must be a non-negative integer.",
      }, 422);
    }
    if (
      final_value_cents != null &&
      (!Number.isInteger(final_value_cents) || final_value_cents < 0)
    ) {
      return json({
        error: "invalid_input",
        message: "final_value_cents must be a non-negative integer.",
      }, 422);
    }

    // ── Fetch current outcome row ─────────────────────────────────
    const { data: outcome, error: outcomeErr } = await svc
      .from("contractor_outcomes")
      .select("id, contractor_id, opportunity_id, disposition_state")
      .eq("opportunity_id", opportunity_id)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (outcomeErr) {
      console.error(
        "[partner-update-disposition] Outcome fetch error:",
        outcomeErr,
      );
      return json({
        error: "fetch_error",
        message: "Failed to fetch outcome row.",
      }, 500);
    }
    if (!outcome) {
      return json({
        error: "outcome_not_found",
        message: "No outcome record found for this opportunity.",
      }, 404);
    }

    const { data: oppContext, error: oppContextErr } = await svc
      .from("contractor_opportunities")
      .select("lead_id, analysis_id, client_slug")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (oppContextErr) {
      console.error(
        "[partner-update-disposition] Opportunity context lookup error:",
        { opportunity_id, message: oppContextErr.message },
      );
      return json({
        error: "context_lookup_failed",
        message: "Failed to reconcile outcome context.",
      }, 500);
    }

    const opportunityClientSlug = typeof oppContext?.client_slug === "string"
      ? oppContext.client_slug
      : null;
    let leadClientSlug: string | null = null;
    if (oppContext?.lead_id) {
      const { data: leadContext, error: leadContextErr } = await svc
        .from("leads")
        .select("client_slug")
        .eq("id", oppContext.lead_id)
        .maybeSingle();

      if (leadContextErr) {
        console.error(
          "[partner-update-disposition] Lead context lookup error:",
          { lead_id: oppContext.lead_id, message: leadContextErr.message },
        );
        return json({
          error: "lead_context_lookup_failed",
          message: "Failed to reconcile lead context.",
        }, 500);
      }
      leadClientSlug = typeof leadContext?.client_slug === "string"
        ? leadContext.client_slug
        : null;
    }
    let resolvedClientSlug = opportunityClientSlug ?? leadClientSlug ?? null;
    let assignmentClientSlug: string | null = null;
    let contractorAccountClientSlug: string | null = null;

    if (lead_assignment_id) {
      const { data: assignment, error: assignmentErr } = await svc
        .from("lead_assignments")
        .select("id, client_slug, lead_id, analysis_id")
        .eq("id", lead_assignment_id)
        .maybeSingle();

      if (assignmentErr) {
        console.error("[partner-update-disposition] Assignment lookup error:", {
          lead_assignment_id,
          message: assignmentErr.message,
        });
        return json({
          error: "assignment_lookup_failed",
          message: "Failed to reconcile assignment context.",
        }, 500);
      }
      if (!assignment) {
        return json({
          error: "assignment_not_found",
          message: "lead_assignment_id does not reference an assignment.",
        }, 422);
      }
      assignmentClientSlug = assignment.client_slug as string | null;
      if (
        resolvedClientSlug && assignmentClientSlug &&
        resolvedClientSlug !== assignmentClientSlug
      ) {
        return json({
          error: "assignment_client_mismatch",
          message:
            "Outcome context does not match the linked assignment client.",
        }, 422);
      }
      resolvedClientSlug = resolvedClientSlug ?? assignmentClientSlug;
    }

    if (contractor_account_id) {
      const { data: contractorAccount, error: contractorAccountErr } = await svc
        .from("contractor_accounts")
        .select("id, client_slug, auth_user_id, is_active")
        .eq("id", contractor_account_id)
        .maybeSingle();

      if (contractorAccountErr) {
        console.error(
          "[partner-update-disposition] Contractor account lookup error:",
          { contractor_account_id, message: contractorAccountErr.message },
        );
        return json({
          error: "contractor_account_lookup_failed",
          message: "Failed to reconcile contractor account context.",
        }, 500);
      }
      if (!contractorAccount) {
        return json({
          error: "contractor_account_not_found",
          message:
            "contractor_account_id does not reference a contractor account.",
        }, 422);
      }
      contractorAccountClientSlug = contractorAccount.client_slug as
        | string
        | null;
      if (
        contractorAccount.auth_user_id &&
        contractorAccount.auth_user_id !== authUserId
      ) {
        return json({
          error: "contractor_account_forbidden",
          message:
            "Contractor account is not linked to the authenticated partner.",
        }, 403);
      }
      if (
        resolvedClientSlug && contractorAccountClientSlug &&
        resolvedClientSlug !== contractorAccountClientSlug
      ) {
        return json({
          error: "contractor_client_mismatch",
          message:
            "Outcome context does not match the contractor account client.",
        }, 422);
      }
      resolvedClientSlug = resolvedClientSlug ?? contractorAccountClientSlug;
    }

    if (
      client_slug && resolvedClientSlug && client_slug !== resolvedClientSlug
    ) {
      return json({
        error: "client_slug_mismatch",
        message:
          "Provided client_slug does not match server-resolved outcome context.",
      }, 422);
    }
    resolvedClientSlug = resolvedClientSlug ?? (client_slug || null);

    const integrity = computeIntegrity({
      disposition_state,
      final_value_cents,
      value_basis,
      disposition_reason_code,
      notes,
      client_slug: resolvedClientSlug,
      lead_assignment_id: lead_assignment_id ?? null,
      contractor_account_id: contractor_account_id ?? null,
      assignment_client_slug: assignmentClientSlug,
      contractor_account_client_slug: contractorAccountClientSlug,
    });

    // ── Validate state transition ─────────────────────────────────
    const currentState = (outcome.disposition_state as string) ?? "new";
    const allowedNext = TRANSITIONS[currentState] ?? [];
    if (!allowedNext.includes(disposition_state)) {
      return json({
        error: "invalid_state_transition",
        message:
          `Cannot transition from '${currentState}' to '${disposition_state}'.`,
        current_state: currentState,
        allowed_next_states: allowedNext,
      }, 422);
    }

    const now = new Date().toISOString();

    // ── Update contractor_outcomes (optimistic concurrency guard) ──
    // Include .eq("disposition_state", currentState) so a concurrent write that
    // already moved the state will cause 0 rows to match, detected below.
    const updatePayload: Record<string, unknown> = {
      disposition_state,
      last_partner_action_at: now,
    };
    if (disposition_reason_code != null) {
      updatePayload.disposition_reason_code = disposition_reason_code;
    }
    if (projected_value_cents != null) {
      updatePayload.projected_value_cents = projected_value_cents;
    }
    if (final_value_cents != null) {
      updatePayload.final_value_cents = final_value_cents;
    }
    if (value_basis != null) {
      updatePayload.value_basis = value_basis;
    }
    if (resolvedClientSlug != null) {
      updatePayload.client_slug = resolvedClientSlug;
    }
    if (lead_assignment_id != null) {
      updatePayload.lead_assignment_id = lead_assignment_id;
    }
    if (contractor_account_id != null) {
      updatePayload.contractor_account_id = contractor_account_id;
    }
    updatePayload.outcome_integrity_status = integrity.status;
    updatePayload.outcome_integrity_reasons = integrity.reasons;
    updatePayload.outcome_source = "operator_or_partner";
    updatePayload.outcome_metadata = {
      revenue_truth_source: "contractor_outcomes",
      lead_rollup_only: true,
      assignment_operational_only: true,
      external_dispatch: false,
      dispatch_created: false,
      source_system: "partner-update-disposition",
    };
    if (signed_contract_url != null) {
      updatePayload.signed_contract_url = signed_contract_url;
    }
    if (notes != null) updatePayload.outcome_notes = notes;

    const { data: updatedRows, error: updateErr } = await svc
      .from("contractor_outcomes")
      .update(updatePayload)
      .eq("id", outcome.id)
      .eq("disposition_state", currentState)
      .select("id");

    if (updateErr) {
      console.error(
        "[partner-update-disposition] Outcome update error:",
        updateErr,
      );
      return json({
        error: "update_error",
        message: "Failed to update outcome.",
      }, 500);
    }
    if (!updatedRows || updatedRows.length === 0) {
      return json({
        error: "state_changed",
        message: "Outcome state was changed concurrently; refetch and retry.",
      }, 409);
    }

    // ── Resolve lead_id via contractor_opportunities ──────────────
    // contractor_outcomes remains revenue truth; leads only receive rollup mirrors.
    let lead_rollup_succeeded = false;
    const leadId = oppContext?.lead_id as string | null;

    // ── Lead rollup ───────────────────────────────────────────────
    if (leadId) {
      const leadUpdate: Record<string, unknown> = {};

      if (disposition_state === "sold_closed") {
        // A confirmed sale always wins at the lead level.
        // Mirror to revenue_amount so the admin rollup
        // COALESCE(deal_value, revenue_amount, 0) stays consistent
        // regardless of which field downstream consumers read.
        const dealValue = final_value_cents! / 100;
        leadUpdate.deal_status = "won";
        leadUpdate.deal_value = dealValue;
        leadUpdate.revenue_amount = dealValue;
        leadUpdate.closed_at = now;
      } else if (disposition_state === "lost_dead") {
        // Only write "lost" to the lead when every other contractor outcome for
        // this lead is also terminal (sold_closed or lost_dead). If another
        // contractor is still active the lead should not be closed.
        const { data: allOpps } = await svc
          .from("contractor_opportunities")
          .select("id")
          .eq("lead_id", leadId);

        const allOppIds = (allOpps ?? []).map((o) => o.id as string);

        if (allOppIds.length > 0) {
          const { count: activeCount } = await svc
            .from("contractor_outcomes")
            .select("id", { count: "exact", head: true })
            .in("opportunity_id", allOppIds)
            .neq("id", outcome.id) // exclude the row we just updated
            .not("disposition_state", "eq", "sold_closed")
            .not("disposition_state", "eq", "lost_dead");

          if (activeCount === 0) {
            leadUpdate.deal_status = "lost";
            leadUpdate.closed_at = now;
          }
        }
      }

      if (Object.keys(leadUpdate).length > 0) {
        const { error: leadErr } = await svc
          .from("leads")
          .update(leadUpdate)
          .eq("id", leadId);
        if (leadErr) {
          console.error(
            "[partner-update-disposition] Lead rollup error:",
            leadErr,
          );
        } else {
          lead_rollup_succeeded = true;
        }
      } else {
        // No lead fields changed (e.g. non-terminal state update) — not a failure
        lead_rollup_succeeded = true;
      }
    }

    // ── Canonical sold event ──────────────────────────────────────
    // Internal canonical revenue signal — written to wm_event_log via
    // `createCanonicalEvent`. This emit is intentionally NON-FATAL: the
    // outcome row has already been updated and the leads rollup mirror
    // has already run; if the canonical event fails to land we surface
    // it in the error log but do not roll back disposition.
    //
    // Sprint 1F integrity contract — every sold event MUST carry:
    //   - revenue_truth_source:        "contractor_outcomes"
    //   - revenue_rollup_target:       "leads"
    //   - source_system:               "partner-update-disposition"
    //   - disposition_state:           "sold_closed"
    //   - lead_id / opportunity_id / contractor_id / contractor_outcome_id
    //   - final_value_cents + final_value_usd
    //   - optimization_value_basis:   "gross_sale_value"  (NOT true profit)
    //   - true_margin_available:      false               (no cost basis)
    //   - margin_model_version:       null                (no model yet)
    //
    // No external dispatch happens here. The dispatch-platform-events
    // worker reads `wm_platform_dispatch_log` separately on its own
    // cadence; this function never calls Meta / Google / TikTok / GTM.
    if (
      disposition_state === "sold_closed" && final_value_cents != null && leadId
    ) {
      const finalValueUsd = final_value_cents / 100;
      const soldEventContext = {
        lead_id: leadId,
        opportunity_id,
        contractor_id: contractorId,
        contractor_outcome_id: outcome.id,
        final_value_cents,
        disposition_state: "sold_closed" as const,
      };
      try {
        await createCanonicalEvent(
          {
            eventName: "sold",
            leadId,
            // marginUsd drives optimization_value_usd in the canonical
            // pipeline. We pass GROSS sale value here as the closest
            // available proxy. The metadata block below explicitly flags
            // this so downstream consumers cannot mistake it for true
            // profit margin.
            marginUsd: finalValueUsd,
            payload: {
              identity: { leadId },
              journey: { route: "/partner/disposition", flow: "admin" },
              source: { sourceSystem: "edge_function" },
              metadata: {
                // Truth-source contract
                revenue_truth_source: "contractor_outcomes",
                revenue_rollup_target: "leads",
                source_system: "partner-update-disposition",
                disposition_state: "sold_closed",

                // Identity / linkage
                lead_id: leadId,
                opportunity_id,
                contractor_id: contractorId,
                contractor_outcome_id: outcome.id,

                // Revenue values
                final_value_cents,
                final_value_usd: finalValueUsd,

                // Honesty flags — keep these in lockstep with marginUsd
                // above so analytics never silently treats gross sale as
                // profit margin.
                optimization_value_basis: value_basis ?? "gross_sale_value",
                true_margin_available: false,
                margin_model_version: null,
              },
            },
            rawPayload: { opportunity_id, contractor_id: contractorId },
          },
          // The real `SupabaseClient` is structurally compatible with the
          // narrower `DBLike` contract `createCanonicalEvent` declares
          // internally, but TS cannot prove it through Promise return-type
          // variance on the Postgrest builder. Cast through unknown using
          // `Parameters<typeof createCanonicalEvent>[1]["db"]` so we stay
          // type-safe against the real contract instead of widening to
          // `any`. Same idiom is used in `dispatch-platform-events`.
          {
            db: svc as unknown as Parameters<
              typeof createCanonicalEvent
            >[1]["db"],
          },
        );
      } catch (eventErr) {
        // Structured, PII-free error log so on-call can correlate this
        // failure to the sold outcome without grepping the request body.
        // Include `name` + `stack` (when available) so production debugging
        // does not require local repro.
        const error = eventErr instanceof Error
          ? {
            name: eventErr.name,
            message: eventErr.message,
            stack: eventErr.stack,
          }
          : { message: String(eventErr) };
        console.error(
          "[partner-update-disposition] Canonical sold event emit failed (non-fatal)",
          {
            ...soldEventContext,
            error,
          },
        );
        // Non-fatal: outcome is already updated; event failure must not
        // roll back the disposition.
      }
    }

    return json({
      success: true,
      outcome_id: outcome.id,
      disposition_state,
      lead_id: leadId,
      lead_rollup_succeeded,
      outcome_integrity_status: integrity.status,
      outcome_integrity_reasons: integrity.reasons,
      external_dispatch: false,
    });
  } catch (err) {
    console.error("[partner-update-disposition] Unhandled error:", err);
    return json(
      { error: "internal_error", message: "Internal server error." },
      500,
    );
  }
});
