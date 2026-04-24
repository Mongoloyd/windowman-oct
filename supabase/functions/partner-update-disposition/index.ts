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
 *     signed_contract_url?: string;     // optional
 *     notes?: string;                   // stored in outcome_notes
 *   }
 *
 * Auth: JWT required (contractor auth user)
 */

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
      return json({ error: "unauthenticated", message: "Missing auth token." }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "unauthenticated", message: "Invalid auth token." }, 401);
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
      return json({ error: "no_contractor_profile", message: "No contractor profile found." }, 404);
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
      return json({ error: "invalid_body", message: "Request body must be valid JSON." }, 400);
    }

    const {
      opportunity_id,
      disposition_state,
      disposition_reason_code,
      projected_value_cents,
      final_value_cents,
      signed_contract_url,
      notes,
    } = body as {
      opportunity_id?: string;
      disposition_state?: string;
      disposition_reason_code?: string;
      projected_value_cents?: number;
      final_value_cents?: number;
      signed_contract_url?: string;
      notes?: string;
    };

    if (!opportunity_id || typeof opportunity_id !== "string") {
      return json({ error: "invalid_input", message: "opportunity_id is required." }, 400);
    }
    if (!disposition_state || typeof disposition_state !== "string") {
      return json({ error: "invalid_input", message: "disposition_state is required." }, 400);
    }
    if (!VALID_STATES.has(disposition_state)) {
      return json({
        error: "invalid_state",
        message: `disposition_state '${disposition_state}' is not a valid state.`,
        valid_states: [...VALID_STATES],
      }, 422);
    }
    if (disposition_reason_code != null && !VALID_REASON_CODES.has(disposition_reason_code)) {
      return json({
        error: "invalid_reason_code",
        message: `disposition_reason_code '${disposition_reason_code}' is not a valid reason code.`,
        valid_reason_codes: [...VALID_REASON_CODES],
      }, 422);
    }

    // ── lost_dead requires reason code AND typed manual reason text ───────
    const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
    if (disposition_state === "lost_dead") {
      if (!disposition_reason_code) {
        return json({
          error: "reason_required",
          message: "disposition_reason_code is required when marking a lead as lost_dead.",
        }, 422);
      }
      if (!trimmedNotes) {
        return json({
          error: "lost_reason_text_required",
          message: "A typed loss reason is required when marking a lead as lost_dead.",
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
          message: "final_value_cents must be a positive integer greater than 0 when marking a lead as sold_closed.",
        }, 422);
      }
    }

    if (projected_value_cents != null && (!Number.isInteger(projected_value_cents) || projected_value_cents < 0)) {
      return json({ error: "invalid_input", message: "projected_value_cents must be a non-negative integer." }, 422);
    }
    if (final_value_cents != null && (!Number.isInteger(final_value_cents) || final_value_cents < 0)) {
      return json({ error: "invalid_input", message: "final_value_cents must be a non-negative integer." }, 422);
    }

    // ── Fetch current outcome row ─────────────────────────────────
    const { data: outcome, error: outcomeErr } = await svc
      .from("contractor_outcomes")
      .select("id, contractor_id, opportunity_id, disposition_state")
      .eq("opportunity_id", opportunity_id)
      .eq("contractor_id", contractorId)
      .maybeSingle();

    if (outcomeErr) {
      console.error("[partner-update-disposition] Outcome fetch error:", outcomeErr);
      return json({ error: "fetch_error", message: "Failed to fetch outcome row." }, 500);
    }
    if (!outcome) {
      return json({
        error: "outcome_not_found",
        message: "No outcome record found for this opportunity.",
      }, 404);
    }

    // ── Validate state transition ─────────────────────────────────
    const currentState = (outcome.disposition_state as string) ?? "new";
    const allowedNext = TRANSITIONS[currentState] ?? [];
    if (!allowedNext.includes(disposition_state)) {
      return json({
        error: "invalid_state_transition",
        message: `Cannot transition from '${currentState}' to '${disposition_state}'.`,
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
    if (disposition_reason_code != null) updatePayload.disposition_reason_code = disposition_reason_code;
    if (projected_value_cents != null) updatePayload.projected_value_cents = projected_value_cents;
    if (final_value_cents != null) updatePayload.final_value_cents = final_value_cents;
    if (signed_contract_url != null) updatePayload.signed_contract_url = signed_contract_url;
    if (notes != null) updatePayload.outcome_notes = notes;

    const { data: updatedRows, error: updateErr } = await svc
      .from("contractor_outcomes")
      .update(updatePayload)
      .eq("id", outcome.id)
      .eq("disposition_state", currentState)
      .select("id");

    if (updateErr) {
      console.error("[partner-update-disposition] Outcome update error:", updateErr);
      return json({ error: "update_error", message: "Failed to update outcome." }, 500);
    }
    if (!updatedRows || updatedRows.length === 0) {
      return json({
        error: "state_changed",
        message: "Outcome state was changed concurrently; refetch and retry.",
      }, 409);
    }

    // ── Resolve lead_id via contractor_opportunities ──────────────
    // contractor_outcomes has no direct lead_id column; join through opportunity
    let lead_rollup_succeeded = false;
    const { data: oppRow, error: oppErr } = await svc
      .from("contractor_opportunities")
      .select("lead_id")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (oppErr) {
      console.error("[partner-update-disposition] Opportunity lookup error:", oppErr, { opportunity_id });
    }

    const leadId = oppRow?.lead_id as string | null;

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
          console.error("[partner-update-disposition] Lead rollup error:", leadErr);
        } else {
          lead_rollup_succeeded = true;
        }
      } else {
        // No lead fields changed (e.g. non-terminal state update) — not a failure
        lead_rollup_succeeded = true;
      }
    }

    // ── Canonical sold event ──────────────────────────────────────
    if (disposition_state === "sold_closed" && final_value_cents != null && leadId) {
      try {
        await createCanonicalEvent(
          {
            eventName: "sold",
            leadId,
            // marginUsd drives optimization_value_usd in the canonical pipeline.
            // We pass gross sale value here as the closest available proxy;
            // actual margin is not available at this layer.
            marginUsd: final_value_cents / 100,
            payload: {
              identity: { leadId },
              journey: { route: "/partner/disposition", flow: "admin" },
              source: { sourceSystem: "edge_function" },
              metadata: {
                contractor_outcome_id: outcome.id,
                contractor_id: contractorId,
                final_value_cents,
                disposition_state: "sold_closed",
              },
            },
            rawPayload: { opportunity_id, contractor_id: contractorId },
          },
          { db: svc },
        );
      } catch (eventErr) {
        console.error("[partner-update-disposition] Canonical event error:", eventErr);
        // Non-fatal: outcome is already updated; event failure should not roll back the disposition
      }
    }

    return json({
      success: true,
      outcome_id: outcome.id,
      disposition_state,
      lead_id: leadId,
      lead_rollup_succeeded,
    });
  } catch (err) {
    console.error("[partner-update-disposition] Unhandled error:", err);
    return json({ error: "internal_error", message: "Internal server error." }, 500);
  }
});
