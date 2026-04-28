/**
 * get-contractor-dossier — Secure dossier read path for contractors.
 *
 * Resolves route param (analysis id) → analysis + lead data.
 * Masks PII unless the contractor has unlocked the lead.
 * Returns credit balance and unlock state as meta.
 *
 * Inputs: { id: uuid } — the analysis id from the route param
 * Auth: JWT required
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const includeDiagnosticStage = () =>
  Deno.env.get("WM_EDGE_DIAGNOSTICS") === "true" ||
  Deno.env.get("EDGE_DIAGNOSTICS") === "true";

const internalErrorBody = (stage: string) => ({
  error: "internal_error",
  message: "Internal server error.",
  error_code: `get_contractor_dossier_failed_at_${stage}`,
  ...(includeDiagnosticStage() ? { stage } : {}),
});

const logStageError = (
  stage: string,
  err: unknown,
  context: Record<string, unknown> = {},
) => {
  const error = err as { name?: unknown; message?: unknown; stack?: unknown };
  console.error("[get-contractor-dossier] stage_error", {
    stage,
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string" ? error.message : String(err),
    stack: typeof error?.stack === "string" ? error.stack : undefined,
    routeId: context.routeId,
    leadId: context.leadId,
    contractorId: context.contractorId,
  });
};

function maskString(value: string | null | undefined, visibleEnd = 4): string {
  if (!value) return "••••••••";
  if (value.length <= visibleEnd) return "••••••••";
  return "•".repeat(value.length - visibleEnd) + value.slice(-visibleEnd);
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "••••@••••.•••";
  const at = email.indexOf("@");
  if (at < 1) return "••••@••••.•••";
  return "•".repeat(at) + email.slice(at);
}

Deno.serve(async (req) => {
  let stage = "start";
  let routeId: string | null = null;
  let leadId: string | null = null;
  let contractorId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    stage = "auth_header";
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

    stage = "get_claims";
    const { data: userData, error: userErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user?.id) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }
    contractorId = userData.user.id;

    // ── Input ─────────────────────────────────────────────────────
    stage = "parse_body";
    const body = await req.json();
    routeId = body?.id;
    if (!routeId || typeof routeId !== "string") {
      return json({ error: "invalid_input", message: "id is required." }, 400);
    }

    // ── Service client for data reads ─────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve route id as analysis id ───────────────────────────
    stage = "fetch_analysis";
    const { data: analysis, error: aErr } = await svc
      .from("analyses")
      .select(
        "id, grade, confidence_score, flags, full_json, proof_of_read, preview_json, document_type, rubric_version, created_at, lead_id",
      )
      .eq("id", routeId)
      .maybeSingle();

    if (aErr) {
      logStageError(stage, aErr, { routeId, leadId, contractorId });
      return json(internalErrorBody(stage), 500);
    }

    if (!analysis) {
      return json({
        error: "not_found",
        message: "Dossier not found for the given ID.",
      }, 404);
    }

    leadId = (analysis.lead_id as string | null) ?? null;

    // ── Fetch lead data ───────────────────────────────────────────
    let lead: Record<string, unknown> | null = null;
    if (leadId) {
      stage = "fetch_lead";
      const { data: leadRow, error: leadErr } = await svc
        .from("leads")
        .select(
          "id, first_name, last_name, email, phone_e164, city, state, county, project_type, quote_range, window_count, grade, estimated_savings_low, estimated_savings_high",
        )
        .eq("id", leadId)
        .maybeSingle();
      if (leadErr) {
        logStageError(stage, leadErr, { routeId, leadId, contractorId });
      } else {
        lead = leadRow;
      }
    }

    // ── Check unlock state ────────────────────────────────────────
    let alreadyUnlocked = false;
    if (leadId) {
      stage = "fetch_unlock";
      const { data: unlockRow, error: unlockErr } = await svc
        .from("contractor_unlocked_leads")
        .select("id")
        .eq("contractor_id", contractorId)
        .eq("lead_id", leadId)
        .maybeSingle();
      if (unlockErr) {
        logStageError(stage, unlockErr, { routeId, leadId, contractorId });
      } else {
        alreadyUnlocked = !!unlockRow;
      }
    }

    // ── Fetch contractor profile & credits ────────────────────────
    stage = "fetch_profile";
    const { data: profile, error: profileErr } = await svc
      .from("contractor_profiles")
      .select("status")
      .eq("id", contractorId)
      .maybeSingle();
    if (profileErr) {
      logStageError(stage, profileErr, { routeId, leadId, contractorId });
    }

    const contractorStatus = (profile?.status as string) ?? "unknown";

    stage = "fetch_credits";
    const { data: creditRow, error: creditErr } = await svc
      .from("contractor_credits")
      .select("balance")
      .eq("contractor_id", contractorId)
      .maybeSingle();
    if (creditErr) {
      logStageError(stage, creditErr, { routeId, leadId, contractorId });
    }

    const creditBalance = (creditRow?.balance as number) ?? 0;
    const canUnlock = contractorStatus === "active" && creditBalance >= 1 &&
      !!leadId;

    // ── Build extraction snapshot ─────────────────────────────────
    stage = "build_extraction";
    const fullJson = (analysis.full_json ?? {}) as Record<string, unknown>;
    const extraction = (fullJson.extraction ?? {}) as Record<string, unknown>;
    const pillarScores = (fullJson.pillar_scores ?? {}) as Record<
      string,
      number
    >;
    const flags = Array.isArray(analysis.flags) ? analysis.flags : [];

    // ── Apply masking ─────────────────────────────────────────────
    const masked = !alreadyUnlocked;

    const dossierLead = lead
      ? {
        id: lead.id,
        first_name: masked
          ? maskString(lead.first_name as string, 1)
          : lead.first_name,
        last_name: masked
          ? maskString(lead.last_name as string, 1)
          : lead.last_name,
        email: masked ? maskEmail(lead.email as string) : lead.email,
        phone_e164: masked
          ? maskString(lead.phone_e164 as string, 4)
          : lead.phone_e164,
        city: lead.city,
        state: lead.state,
        county: lead.county,
        project_type: lead.project_type,
        quote_range: lead.quote_range,
        window_count: lead.window_count,
        estimated_savings_low: lead.estimated_savings_low,
        estimated_savings_high: lead.estimated_savings_high,
      }
      : null;

    const dossierAnalysis = {
      id: analysis.id,
      grade: analysis.grade,
      confidence_score: analysis.confidence_score,
      document_type: analysis.document_type,
      rubric_version: analysis.rubric_version,
      created_at: analysis.created_at,
      flag_count: flags.length,
      red_flag_count: flags.filter(
        (f: Record<string, unknown>) =>
          f.severity === "Critical" || f.severity === "High",
      ).length,
      amber_flag_count: flags.filter(
        (f: Record<string, unknown>) => f.severity === "Medium",
      ).length,
    };

    // ── Forensic signals (37+ extracted fields) ───────────────────
    // Most signals are descriptive booleans / counts and contain no PII —
    // they are safe to render in the locked preview as "sales ammunition".
    // Identifying fields (competitor name, raw quoted phone numbers in
    // line-item text, etc.) remain masked until unlock.
    const lineItems = Array.isArray(extraction.line_items)
      ? extraction.line_items
      : [];
    const itemsWithoutDp = lineItems.filter(
      (i: Record<string, unknown>) =>
        !i?.dp_rating || String(i.dp_rating).trim() === "",
    ).length;
    const itemsWithoutNoa = lineItems.filter(
      (i: Record<string, unknown>) =>
        !i?.noa_number || String(i.noa_number).trim() === "",
    ).length;
    const itemsWithIncompleteGlass = lineItems.filter(
      (i: Record<string, unknown>) => i?.glass_spec_complete !== true,
    ).length;

    const dossierExtraction = {
      // ── Pricing & scope (always safe) ─────────────────────────
      total_quoted_price: extraction.total_quoted_price ?? null,
      total_opening_count: extraction.total_opening_count ??
        extraction.opening_count ?? null,
      project_type: extraction.project_type ?? null,
      page_count: extraction.page_count ?? null,
      line_item_count: lineItems.length,

      // Mask competitor name when locked
      company_name: masked
        ? maskString(extraction.company_name as string, 0)
        : extraction.company_name ?? null,
      contractor_name: masked
        ? maskString((extraction.contractor_name as string) ?? null, 0)
        : extraction.contractor_name ?? null,

      // ── Pricing intelligence ──────────────────────────────────
      price_fairness: extraction.price_fairness ?? null,
      markup_estimate: extraction.markup_estimate ?? null,
      negotiation_leverage: extraction.negotiation_leverage ?? null,

      // ── Code / compliance ─────────────────────────────────────
      hvhz_zone: extraction.hvhz_zone ?? null,
      items_without_dp_rating: itemsWithoutDp,
      items_without_noa: itemsWithoutNoa,

      // ── Glass package ─────────────────────────────────────────
      opening_level_glass_specs_present:
        extraction.opening_level_glass_specs_present ?? null,
      blanket_glass_language_present:
        extraction.blanket_glass_language_present ?? null,
      mixed_glass_package_visibility:
        extraction.mixed_glass_package_visibility ?? null,
      items_with_incomplete_glass: itemsWithIncompleteGlass,

      // ── Opening schedule ──────────────────────────────────────
      opening_schedule_present: extraction.opening_schedule_present ?? null,
      opening_schedule_room_labels_present:
        extraction.opening_schedule_room_labels_present ?? null,
      opening_schedule_dimensions_complete:
        extraction.opening_schedule_dimensions_complete ?? null,
      opening_schedule_product_assignments_present:
        extraction.opening_schedule_product_assignments_present ?? null,
      bulk_scope_blob_present: extraction.bulk_scope_blob_present ?? null,

      // ── Installation method ───────────────────────────────────
      anchor_spacing_specified: extraction.anchor_spacing_specified ?? null,
      fastener_type_specified: extraction.fastener_type_specified ?? null,
      sealant_specified: extraction.sealant_specified ?? null,
      manufacturer_install_compliance_stated:
        extraction.manufacturer_install_compliance_stated ?? null,
      code_compliance_install_statement_present:
        extraction.code_compliance_install_statement_present ?? null,

      // ── Warranty execution ────────────────────────────────────
      warranty_labor_years:
        (extraction.warranty as Record<string, unknown> | undefined)
          ?.labor_years ?? null,
      warranty_manufacturer_years:
        (extraction.warranty as Record<string, unknown> | undefined)
          ?.manufacturer_years ?? null,
      warranty_transferable:
        (extraction.warranty as Record<string, unknown> | undefined)
          ?.transferable ?? null,
      warranty_execution_details_present:
        extraction.warranty_execution_details_present ?? null,
      warranty_service_provider_type:
        extraction.warranty_service_provider_type ?? null,
      leak_callback_sla_days: extraction.leak_callback_sla_days ?? null,
      labor_service_sla_days: extraction.labor_service_sla_days ?? null,
      post_install_stucco_excluded: extraction.post_install_stucco_excluded ??
        null,
      post_install_paint_excluded: extraction.post_install_paint_excluded ??
        null,
      water_intrusion_damage_excluded:
        extraction.water_intrusion_damage_excluded ?? null,

      // ── Permits ───────────────────────────────────────────────
      permits_included:
        (extraction.permits as Record<string, unknown> | undefined)?.included ??
          null,
      permits_responsible_party:
        (extraction.permits as Record<string, unknown> | undefined)
          ?.responsible_party ?? null,
      permit_fees_itemized: extraction.permit_fees_itemized ?? null,

      // ── Scope gaps ────────────────────────────────────────────
      stucco_repair_included: extraction.stucco_repair_included ?? null,
      drywall_repair_included: extraction.drywall_repair_included ?? null,
      paint_touchup_included: extraction.paint_touchup_included ?? null,
      debris_removal_included: extraction.debris_removal_included ?? null,
      disposal_included:
        (extraction.installation as Record<string, unknown> | undefined)
          ?.disposal_included ??
          null,
      engineering_mentioned: extraction.engineering_mentioned ?? null,
      engineering_fees_included: extraction.engineering_fees_included ?? null,

      // ── Payment traps ─────────────────────────────────────────
      deposit_percent: extraction.deposit_percent ?? null,
      deposit_amount: extraction.deposit_amount ?? null,
      final_payment_before_inspection:
        extraction.final_payment_before_inspection ?? null,
      subject_to_remeasure_present: extraction.subject_to_remeasure_present ??
        null,

      // ── Change-order protections ──────────────────────────────
      written_change_order_required: extraction.written_change_order_required ??
        null,
      homeowner_approval_required_for_change_orders:
        extraction.homeowner_approval_required_for_change_orders ?? null,
      unilateral_price_adjustment_allowed:
        extraction.unilateral_price_adjustment_allowed ?? null,
      remeasure_price_adjustment_cap_present:
        extraction.remeasure_price_adjustment_cap_present ?? null,

      // ── Trust signals ─────────────────────────────────────────
      insurance_proof_mentioned: extraction.insurance_proof_mentioned ?? null,
      licensing_proof_mentioned: extraction.licensing_proof_mentioned ?? null,
      lead_paint_disclosure_present: extraction.lead_paint_disclosure_present ??
        null,
      generic_product_description_present:
        extraction.generic_product_description_present ?? null,
      terms_conditions_present: extraction.terms_conditions_present ?? null,
      completion_timeline_text: masked
        ? null
        : (extraction.completion_timeline_text ?? null),
    };

    const dossierFlags = flags.map((f: Record<string, unknown>) => ({
      label: f.label ?? f.flag_key ?? "Flag",
      detail: f.detail ?? f.description ?? "",
      severity: f.severity ?? "Medium",
      pillar: f.pillar ?? null,
      tip: masked ? null : (f.tip ?? null),
    }));

    const dossier = {
      lead: dossierLead,
      analysis: dossierAnalysis,
      extraction: dossierExtraction,
      pillar_scores: pillarScores,
      flags: dossierFlags,
      proof_of_read: analysis.proof_of_read,
    };

    // ── Resolve marketplace contractor record + outcome (additive) ──
    // contractor_profiles.id == auth_user_id; the marketplace contractor row
    // is keyed by contractors.auth_user_id. contractor_outcomes.contractor_id
    // points at contractors.id, NOT at contractor_profiles.id, so we must
    // resolve the bridge before reading outcome state.
    let outcome:
      | {
        id: string;
        opportunity_id: string;
        lead_id: string | null;
        contractor_id: string;
        disposition_state: string;
        disposition_reason_code: string | null;
        projected_value_cents: number | null;
        final_value_cents: number | null;
        signed_contract_url: string | null;
        last_partner_action_at: string | null;
      }
      | null = null;
    let opportunityId: string | null = null;

    if (leadId) {
      stage = "fetch_marketplace_contractor";
      const { data: marketplaceContractor, error: marketplaceContractorErr } =
        await svc
          .from("contractors")
          .select("id")
          .eq("auth_user_id", contractorId)
          .maybeSingle();
      if (marketplaceContractorErr) {
        logStageError(stage, marketplaceContractorErr, {
          routeId,
          leadId,
          contractorId,
        });
      }

      const marketplaceContractorId = marketplaceContractor?.id as
        | string
        | undefined;

      if (marketplaceContractorId) {
        // Find the opportunity row that links this lead to this contractor
        stage = "fetch_opportunity";
        const { data: oppRow, error: oppErr } = await svc
          .from("contractor_opportunities")
          .select("id")
          .eq("lead_id", leadId)
          .or(
            `suggested_contractor_id.eq.${marketplaceContractorId},routed_at.not.is.null`,
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (oppErr) {
          logStageError(stage, oppErr, { routeId, leadId, contractorId });
        }

        if (!oppErr && oppRow?.id) {
          opportunityId = oppRow.id as string;
          stage = "fetch_outcome";
          const { data: outcomeRow, error: outcomeErr } = await svc
            .from("contractor_outcomes")
            .select(
              "id, opportunity_id, contractor_id, disposition_state, disposition_reason_code, projected_value_cents, final_value_cents, signed_contract_url, last_partner_action_at",
            )
            .eq("opportunity_id", opportunityId)
            .eq("contractor_id", marketplaceContractorId)
            .maybeSingle();
          if (outcomeErr) {
            logStageError(stage, outcomeErr, { routeId, leadId, contractorId });
          }

          if (!outcomeErr && outcomeRow) {
            outcome = {
              id: outcomeRow.id as string,
              opportunity_id: outcomeRow.opportunity_id as string,
              lead_id: leadId,
              contractor_id: outcomeRow.contractor_id as string,
              disposition_state: (outcomeRow.disposition_state as string) ??
                "new",
              disposition_reason_code:
                (outcomeRow.disposition_reason_code as string) ?? null,
              projected_value_cents:
                (outcomeRow.projected_value_cents as number) ?? null,
              final_value_cents: (outcomeRow.final_value_cents as number) ??
                null,
              signed_contract_url: (outcomeRow.signed_contract_url as string) ??
                null,
              last_partner_action_at:
                (outcomeRow.last_partner_action_at as string) ?? null,
            };
          }
        }
      }
    }

    stage = "build_response";
    const meta = {
      analysis_id: analysis.id,
      lead_id: leadId,
      contractor_id: contractorId,
      opportunity_id: opportunityId,
      credit_balance: creditBalance,
      already_unlocked: alreadyUnlocked,
      can_unlock: canUnlock,
      contractor_status: contractorStatus,
      masked,
    };

    return json({ dossier, meta, outcome });
  } catch (err) {
    logStageError(stage, err, { routeId, leadId, contractorId });
    return json(internalErrorBody(stage), 500);
  }
});
