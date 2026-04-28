/**
 * contractor-actions — Phase 3.4 server-side actions for the contractor monetization lifecycle.
 *
 * Consolidated edge function handling 5 actions via `action` field:
 *   1. mark_interest
 *   2. review_release
 *   3. release_contact
 *   4. update_billing_status
 *   5. update_outcome
 *
 * All actions use service role (operator-only). No anon access.
 */

import {
  corsHeaders,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  event_name: string,
  metadata: Record<string, unknown>,
) {
  return supabase.from("event_logs").insert({
    event_name,
    route: "/admin",
    metadata: { ...metadata, timestamp: new Date().toISOString() },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require operator or super_admin role
    const validation = await validateAdminRequestWithRole(req, [
      "super_admin",
      "operator",
    ]);
    if (!validation.ok) return validation.response;

    const { supabaseAdmin: supabase } = validation;

    const body = await req.json();
    const { action } = body;

    const now = new Date().toISOString();

    // ═══════════════════════════════════════════════════════════════════
    // ACTION 1: mark_interest
    // ═══════════════════════════════════════════════════════════════════
    if (action === "mark_interest") {
      const { route_id, opportunity_id, contractor_id, notes } = body;
      if (!route_id || !opportunity_id) {
        return json({ error: "route_id and opportunity_id required" }, 400);
      }

      // Update route
      const { error: routeErr } = await supabase
        .from("contractor_opportunity_routes")
        .update({
          route_status: "interested",
          interested_at: now,
          interest_notes: notes || null,
          release_status: "pending_review",
          release_requested_at: now,
        })
        .eq("id", route_id);

      if (routeErr) {
        console.error(
          "[contractor-actions] mark_interest route update failed",
          routeErr,
        );
        return json({ error: "Failed to update route" }, 500);
      }

      // Update opportunity
      await supabase
        .from("contractor_opportunities")
        .update({
          status: "contractor_interested",
          last_interest_at: now,
          release_ready: true,
        })
        .eq("id", opportunity_id);

      await logEvent(supabase, "contractor_interest_submitted", {
        route_id,
        opportunity_id,
        contractor_id,
      });

      return json({ success: true, route_id, status: "interested" });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTION 2: review_release
    // ═══════════════════════════════════════════════════════════════════
    if (action === "review_release") {
      const { route_id, decision, reviewer, reason } = body;
      if (!route_id || !decision) {
        return json(
          { error: "route_id and decision (approve/deny) required" },
          400,
        );
      }

      if (decision === "approve") {
        await supabase
          .from("contractor_opportunity_routes")
          .update({
            release_status: "approved",
            release_reviewed_at: now,
            release_reviewed_by: reviewer || "operator",
          })
          .eq("id", route_id);

        await logEvent(supabase, "contact_release_approved", {
          route_id,
          reviewer: reviewer || "operator",
        });
      } else if (decision === "deny") {
        await supabase
          .from("contractor_opportunity_routes")
          .update({
            release_status: "denied",
            release_reviewed_at: now,
            release_reviewed_by: reviewer || "operator",
            release_denial_reason: reason || null,
          })
          .eq("id", route_id);

        await logEvent(supabase, "contact_release_denied", {
          route_id,
          reviewer: reviewer || "operator",
          reason,
        });
      } else {
        return json({ error: "decision must be 'approve' or 'deny'" }, 400);
      }

      return json({ success: true, route_id, decision });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTION 3: release_contact
    // ═══════════════════════════════════════════════════════════════════
    if (action === "release_contact") {
      const {
        route_id,
        opportunity_id,
        contractor_id,
        lead_id,
        analysis_id,
        billing_model,
        fee_amount,
        released_by,
        notes,
      } = body;
      if (!route_id || !opportunity_id || !contractor_id || !lead_id) {
        return json({
          error:
            "route_id, opportunity_id, contractor_id, and lead_id required",
        }, 400);
      }

      // Verify route is approved
      const { data: route } = await supabase
        .from("contractor_opportunity_routes")
        .select("release_status")
        .eq("id", route_id)
        .maybeSingle();

      if (!route || route.release_status !== "approved") {
        return json(
          { error: "Route must be approved before contact release" },
          403,
        );
      }

      // Mark contact released on route
      await supabase
        .from("contractor_opportunity_routes")
        .update({
          contact_released: true,
          contact_released_at: now,
          release_status: "released",
        })
        .eq("id", route_id);

      // Update opportunity
      await supabase
        .from("contractor_opportunities")
        .update({
          status: "homeowner_contact_released",
          homeowner_contact_released_at: now,
          last_release_at: now,
        })
        .eq("id", opportunity_id);

      // Create billable intro
      const { data: intro, error: introErr } = await supabase
        .from("billable_intros")
        .insert({
          opportunity_id,
          route_id,
          contractor_id,
          lead_id,
          analysis_id: analysis_id || null,
          release_approved_at: now,
          contact_released_at: now,
          billing_status: "billable",
          billing_model: billing_model || "flat_fee",
          fee_amount: fee_amount ?? null,
          released_by: released_by || "operator",
          notes: notes || null,
        })
        .select("id")
        .single();

      if (introErr) {
        console.error(
          "[contractor-actions] billable_intros insert failed",
          introErr,
        );
        return json({ error: "Failed to create billable intro" }, 500);
      }

      // Create initial outcome stub
      await supabase.from("contractor_outcomes").insert({
        billable_intro_id: intro!.id,
        opportunity_id,
        route_id,
        contractor_id,
        appointment_status: "pending",
        quote_status: "pending",
        deal_status: "open",
      });

      // Log events
      await logEvent(supabase, "homeowner_contact_released", {
        route_id,
        opportunity_id,
        contractor_id,
        billable_intro_id: intro!.id,
      });
      await logEvent(supabase, "billable_intro_created", {
        billable_intro_id: intro!.id,
        opportunity_id,
        contractor_id,
        billing_model: billing_model || "flat_fee",
        fee_amount,
      });
      await logEvent(supabase, "contractor_outcome_record_initialized", {
        billable_intro_id: intro!.id,
        opportunity_id,
      });

      return json({
        success: true,
        billable_intro_id: intro!.id,
        opportunity_id,
        route_id,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTION 4: update_billing_status
    // ═══════════════════════════════════════════════════════════════════
    if (action === "update_billing_status") {
      const { billable_intro_id, billing_status, invoice_reference, notes } =
        body;
      if (!billable_intro_id || !billing_status) {
        return json(
          { error: "billable_intro_id and billing_status required" },
          400,
        );
      }

      const updateFields: Record<string, unknown> = { billing_status };
      if (invoice_reference) updateFields.invoice_reference = invoice_reference;
      if (notes) updateFields.notes = notes;

      // Set lifecycle timestamps
      if (billing_status === "paid") updateFields.paid_at = now;
      if (billing_status === "waived") updateFields.waived_at = now;
      if (billing_status === "refunded") updateFields.refunded_at = now;
      if (billing_status === "disputed") updateFields.disputed_at = now;

      await supabase
        .from("billable_intros")
        .update(updateFields)
        .eq("id", billable_intro_id);

      const eventMap: Record<string, string> = {
        invoiced: "billable_intro_marked_invoiced",
        paid: "billable_intro_marked_paid",
        waived: "billable_intro_marked_waived",
        refunded: "billable_intro_marked_refunded",
        disputed: "billable_intro_marked_disputed",
      };

      if (eventMap[billing_status]) {
        await logEvent(supabase, eventMap[billing_status], {
          billable_intro_id,
          billing_status,
        });
      }

      return json({ success: true, billable_intro_id, billing_status });
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTION 5: update_outcome
    // ═══════════════════════════════════════════════════════════════════
    if (action === "update_outcome") {
      const {
        billable_intro_id,
        appointment_status,
        appointment_booked_at,
        quote_status,
        replacement_quote_range,
        did_beat_price,
        did_improve_warranty,
        did_fix_scope_gaps,
        deal_status,
        deal_value,
        outcome_notes,
      } = body;
      if (!billable_intro_id) {
        return json({ error: "billable_intro_id required" }, 400);
      }

      const updateFields: Record<string, unknown> = {};
      if (appointment_status !== undefined) {
        updateFields.appointment_status = appointment_status;
      }
      if (appointment_booked_at !== undefined) {
        updateFields.appointment_booked_at = appointment_booked_at;
      }
      if (quote_status !== undefined) updateFields.quote_status = quote_status;
      if (replacement_quote_range !== undefined) {
        updateFields.replacement_quote_range = replacement_quote_range;
      }
      if (did_beat_price !== undefined) {
        updateFields.did_beat_price = did_beat_price;
      }
      if (did_improve_warranty !== undefined) {
        updateFields.did_improve_warranty = did_improve_warranty;
      }
      if (did_fix_scope_gaps !== undefined) {
        updateFields.did_fix_scope_gaps = did_fix_scope_gaps;
      }
      if (deal_status !== undefined) updateFields.deal_status = deal_status;
      if (deal_value !== undefined) updateFields.deal_value = deal_value;
      if (outcome_notes !== undefined) {
        updateFields.outcome_notes = outcome_notes;
      }
      if (
        deal_status === "won" || deal_status === "lost" ||
        deal_status === "dead"
      ) {
        updateFields.closed_at = now;
      }

      const { error: outcomeErr } = await supabase
        .from("contractor_outcomes")
        .update(updateFields)
        .eq("billable_intro_id", billable_intro_id);

      if (outcomeErr) {
        console.error("[contractor-actions] outcome update failed", outcomeErr);
        return json({ error: "Failed to update outcome" }, 500);
      }

      // Log appropriate events
      if (appointment_status === "booked") {
        await logEvent(supabase, "appointment_booked", { billable_intro_id });
      }
      if (quote_status === "submitted") {
        await logEvent(supabase, "replacement_quote_submitted", {
          billable_intro_id,
        });
      }
      if (deal_status) {
        await logEvent(supabase, "deal_outcome_updated", {
          billable_intro_id,
          deal_status,
          deal_value,
        });
      }

      return json({ success: true, billable_intro_id });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[contractor-actions] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
