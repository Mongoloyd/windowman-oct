import {
  type AppRole,
  corsHeaders,
  errorResponse,
  successResponse,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type CAPIEvent,
  classifyMetaError,
  diagnoseRoute,
  dispatchCapiEvent,
  redactToken as sharedRedactToken,
  resolvePixelConfig,
  summarizeTokenPresence,
} from "../_shared/capiRouting.ts";

/**
 * admin-data v2.4
 * Added: list_contractor_accounts, get_contractor_ledger,
 *        adjust_contractor_credits, get_contractor_unlocks
 */

type ActionName =
  | "fetch_leads"
  | "update_lead_status"
  | "update_lead_deal_status"
  | "fetch_opportunities"
  | "fetch_contractors"
  | "fetch_routes"
  | "fetch_billable"
  | "route_opportunity"
  | "mark_dead"
  | "fetch_voice_followups"
  | "fetch_lead_voice_followups"
  | "trigger_voice_followup"
  | "manage_user_roles"
  | "list_user_roles"
  | "get_role_audit_log"
  | "fetch_lead_events"
  | "fetch_webhook_deliveries"
  | "fetch_lead_analysis"
  | "fetch_needs_review"
  | "rescan_lead"
  | "update_lead_manual_entry"
  | "list_contractor_accounts"
  | "get_contractor_ledger"
  | "adjust_contractor_credits"
  | "get_contractor_unlocks"
  | "list_invitations"
  | "create_invitation"
  | "revoke_invitation"
  // CAPI control-plane (Meta multi-pixel routing)
  | "list_meta_configurations"
  | "create_meta_client_config"
  | "save_client_config"
  | "set_meta_client_active"
  | "preview_meta_route"
  | "smoke_send_meta_event"
  | "diagnose_token_health"
  | "summarize_meta_fleet_health"
  // Lead workspace (Sprint 4 + 5)
  | "fetch_lead_detail"
  | "update_lead_funnel_stage"
  | "list_lead_notes"
  | "create_lead_note"
  | "delete_lead_note"
  | "list_lead_tasks"
  | "create_lead_task"
  | "update_lead_task"
  | "delete_lead_task"
  // Phase 10 — Human Context Layer
  | "update_lead_human_context"
  // Phase 26 — Mission Control Truth Strip drilldown
  | "fetch_quote_evidence"
  | "fetch_lead_evidence"
  | "fetch_stage_leads"
  // Sprint 1D — Partner outcome rollup (read-only admin bridge)
  | "fetch_partner_outcome_rollup";

const ACTION_ROLES: Record<ActionName, AppRole[]> = {
  fetch_leads: ["super_admin", "operator", "viewer"],
  update_lead_status: ["super_admin", "operator"],
  update_lead_deal_status: ["super_admin", "operator"],
  fetch_opportunities: ["super_admin", "operator", "viewer"],
  fetch_contractors: ["super_admin", "operator", "viewer"],
  fetch_routes: ["super_admin", "operator", "viewer"],
  fetch_billable: ["super_admin", "operator", "viewer"],
  route_opportunity: ["super_admin", "operator"],
  mark_dead: ["super_admin", "operator"],
  fetch_voice_followups: ["super_admin", "operator", "viewer"],
  fetch_lead_voice_followups: ["super_admin", "operator", "viewer"],
  trigger_voice_followup: ["super_admin", "operator"],
  manage_user_roles: ["super_admin"],
  list_user_roles: ["super_admin"],
  get_role_audit_log: ["super_admin"],
  fetch_lead_events: ["super_admin", "operator", "viewer"],
  fetch_webhook_deliveries: ["super_admin", "operator", "viewer"],
  fetch_lead_analysis: ["super_admin", "operator", "viewer"],
  fetch_needs_review: ["super_admin", "operator", "viewer"],
  rescan_lead: ["super_admin", "operator"],
  update_lead_manual_entry: ["super_admin", "operator"],
  // Contractor account management
  list_contractor_accounts: ["super_admin", "operator", "viewer"],
  get_contractor_ledger: ["super_admin", "operator", "viewer"],
  adjust_contractor_credits: ["super_admin", "operator"],
  get_contractor_unlocks: ["super_admin", "operator", "viewer"],
  // Invitation management
  list_invitations: ["super_admin", "operator", "viewer"],
  create_invitation: ["super_admin", "operator"],
  revoke_invitation: ["super_admin", "operator"],
  // CAPI control-plane — super_admin only for mutations & live-network sends;
  // viewers may inspect & dry-run.
  list_meta_configurations: ["super_admin", "operator", "viewer"],
  create_meta_client_config: ["super_admin"],
  save_client_config: ["super_admin"],
  set_meta_client_active: ["super_admin"],
  preview_meta_route: ["super_admin", "operator", "viewer"],
  smoke_send_meta_event: ["super_admin"],
  diagnose_token_health: ["super_admin", "operator", "viewer"],
  summarize_meta_fleet_health: ["super_admin", "operator", "viewer"],
  // Lead workspace
  fetch_lead_detail: ["super_admin", "operator", "viewer"],
  update_lead_funnel_stage: ["super_admin", "operator"],
  list_lead_notes: ["super_admin", "operator", "viewer"],
  create_lead_note: ["super_admin", "operator"],
  delete_lead_note: ["super_admin", "operator"],
  list_lead_tasks: ["super_admin", "operator", "viewer"],
  create_lead_task: ["super_admin", "operator"],
  update_lead_task: ["super_admin", "operator"],
  delete_lead_task: ["super_admin", "operator"],
  // Phase 10
  update_lead_human_context: ["super_admin", "operator"],
  // Phase 26 — Mission Control Truth Strip drilldown
  fetch_quote_evidence: ["super_admin", "operator", "viewer"],
  fetch_lead_evidence: ["super_admin", "operator", "viewer"],
  fetch_stage_leads: ["super_admin", "operator", "viewer"],
  // Sprint 1D — read-only partner outcome rollup
  fetch_partner_outcome_rollup: ["super_admin", "operator", "viewer"],
};

// Allowed funnel stages (Sprint 5 — kept in sync with frontend constants)
const ALLOWED_FUNNEL_STAGES = new Set([
  "new",
  "qualified",
  "analyzing",
  "routed",
  "contacted",
  "booked",
  "closed",
  "stale",
  "ghost",
]);
const ALLOWED_NOTE_CATEGORIES = new Set([
  "general",
  "call",
  "email",
  "sms",
  "meeting",
  "internal",
]);

// ── CAPI helpers ────────────────────────────────────────────────────────────
// Token redaction is delegated to the shared module so admin-data, capi-event
// and any future surface use ONE redaction implementation. Local alias kept
// for backwards source-compatibility within this file only.
const redactToken = sharedRedactToken;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PIXEL_RE = /^[0-9]{6,20}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST");
  }

  try {
    const body = await req.json();
    const { action, payload = {} } = body;
    const requiredRoles = ACTION_ROLES[action as ActionName];

    if (!requiredRoles) {
      return errorResponse(400, "invalid_action", `Unknown action: ${action}`);
    }

    // Verify Identity & Role
    const validation = await validateAdminRequestWithRole(req, requiredRoles);
    if (!validation.ok) return validation.response;

    const { userId, supabaseAdmin } = validation;
    const now = new Date().toISOString();

    // ─── READ ACTIONS ──────────────────────────────────────────────

    if (action === "fetch_leads") {
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_opportunities") {
      const { data, error } = await supabaseAdmin.from(
        "contractor_opportunities",
      ).select("*").order("priority_score", { ascending: false });
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_contractors") {
      const { data, error } = await supabaseAdmin.from("contractors").select(
        "*",
      ).eq("status", "active");
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_routes") {
      const { opportunity_id } = payload;
      let query = supabaseAdmin.from("contractor_opportunity_routes").select(
        "*",
      ).order("created_at", { ascending: false });
      if (opportunity_id) query = query.eq("opportunity_id", opportunity_id);
      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "fetch_billable") {
      const { data: intros, error: e1 } = await supabaseAdmin.from(
        "billable_intros",
      ).select("*").order("created_at", { ascending: false });
      const { data: outcomes, error: e2 } = await supabaseAdmin.from(
        "contractor_outcomes",
      ).select("*");
      if (e1 || e2) throw e1 || e2;
      return successResponse({ intros, outcomes, data: { intros, outcomes } });
    }

    // Sprint 1D — Read-only partner outcome rollup for admin (Mission Control bridge)
    // Returns aggregate truth pulled from contractor_outcomes. Read-only, no writes.
    if (action === "fetch_partner_outcome_rollup") {
      const { data: outcomes, error: rollupErr } = await supabaseAdmin
        .from("contractor_outcomes")
        .select(
          "id, contractor_id, disposition_state, final_value_cents, signed_contract_url, last_partner_action_at, created_at, updated_at",
        );
      if (rollupErr) throw rollupErr;

      const rows = outcomes ?? [];
      const nowMs = Date.now();
      const DAY_MS = 86_400_000;

      const partner_sold_count = rows.filter((r) =>
        r.disposition_state === "sold_closed"
      ).length;
      const partner_lost_count = rows.filter((r) =>
        r.disposition_state === "lost_dead"
      ).length;
      const managed_revenue_cents = rows.reduce(
        (sum, r) =>
          sum +
          ((r.disposition_state === "sold_closed" &&
              typeof r.final_value_cents === "number")
            ? r.final_value_cents
            : 0),
        0,
      );
      const untouched_new_over_24h = rows.filter((r) => {
        if (r.disposition_state !== "new") return false;
        const anchor = (r.last_partner_action_at as string | null) ??
          (r.created_at as string | null);
        if (!anchor) return false;
        return (nowMs - new Date(anchor).getTime()) > DAY_MS;
      }).length;
      const sold_missing_value = rows.filter(
        (r) =>
          r.disposition_state === "sold_closed" &&
          (r.final_value_cents == null || r.final_value_cents <= 0),
      ).length;
      const sold_missing_proof = rows.filter(
        (r) => r.disposition_state === "sold_closed" && !r.signed_contract_url,
      ).length;

      return successResponse({
        data: {
          partner_sold_count,
          partner_lost_count,
          managed_revenue_cents,
          managed_revenue_dollars: Math.round(managed_revenue_cents / 100),
          untouched_new_over_24h,
          sold_missing_value,
          sold_missing_proof,
          total_outcome_rows: rows.length,
        },
      });
    }

    if (action === "fetch_voice_followups") {
      const { data, error } = await supabaseAdmin.from("voice_followups")
        .select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_lead_voice_followups") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }
      const { data, error } = await supabaseAdmin
        .from("voice_followups")
        .select(`
          id, lead_id, call_intent, status,
          call_outcome, failure_reason,
          duration_seconds, recording_url,
          transcript_url, transcript_text,
          summary, booking_intent_detected,
          appointment_booked, scan_session_id,
          phone_e164, queued_at, started_at,
          answered_at, completed_at, created_at
        `)
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return successResponse({ data: data });
    }

    // ─── NEEDS REVIEW ──────────────────────────────────────────────

    if (action === "fetch_needs_review") {
      // Query A: Leads with no analysis, not manually reviewed
      const { data: noAnalysis } = await supabaseAdmin
        .from("leads")
        .select(`
          id, first_name, last_name, email, phone_e164, city, created_at,
          latest_analysis_id, latest_scan_session_id,
          grade, flag_count, manually_reviewed, manual_entry_data
        `)
        .is("latest_analysis_id", null)
        .or("manually_reviewed.is.null,manually_reviewed.eq.false")
        .order("created_at", { ascending: false });

      // deno-lint-ignore no-explicit-any
      const taggedNoAnalysis = (noAnalysis ?? []).map((l: any) => ({
        ...l,
        review_reason: "no_scan",
        analysis_status: null,
        confidence_score: null,
        analysis_error: null,
        full_json: null,
        quote_image_url: null,
      }));

      // Query B: Analyses that failed or have low confidence
      const { data: failedAnalyses } = await supabaseAdmin
        .from("analyses")
        .select(
          "id, analysis_status, confidence_score, full_json, lead_id, scan_session_id",
        )
        .or(
          "analysis_status.eq.invalid_document,analysis_status.eq.needs_better_upload,confidence_score.lt.0.70",
        )
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false });

      // deno-lint-ignore no-explicit-any
      const failedLeadIds = (failedAnalyses ?? []).map((a: any) => a.lead_id)
        .filter(Boolean);

      // deno-lint-ignore no-explicit-any
      let failedLeads: any[] = [];
      if (failedLeadIds.length > 0) {
        const { data: leads } = await supabaseAdmin
          .from("leads")
          .select(`
            id, first_name, last_name, email, phone_e164, city, created_at,
            latest_analysis_id, latest_scan_session_id,
            grade, flag_count, manually_reviewed, manual_entry_data
          `)
          .in("id", failedLeadIds)
          .or("manually_reviewed.is.null,manually_reviewed.eq.false");

        // deno-lint-ignore no-explicit-any
        failedLeads = (leads ?? []).map((lead: any) => {
          // deno-lint-ignore no-explicit-any
          const analysis = (failedAnalyses ?? []).find((a: any) =>
            a.lead_id === lead.id
          );
          const isFailed = analysis?.analysis_status === "invalid_document" ||
            analysis?.analysis_status === "needs_better_upload";
          return {
            ...lead,
            review_reason: isFailed ? "parse_failed" : "low_confidence",
            analysis_status: analysis?.analysis_status ?? null,
            confidence_score: analysis?.confidence_score ?? null,
            // deno-lint-ignore no-explicit-any
            analysis_error: (analysis?.full_json as any)?.error ?? null,
            full_json: analysis?.full_json ?? null,
            quote_image_url: null,
          };
        });
      }

      // Merge + deduplicate
      const allLeadIds = new Set<string>();
      const merged = [...taggedNoAnalysis, ...failedLeads]
        // deno-lint-ignore no-explicit-any
        .filter((lead: any) => {
          if (allLeadIds.has(lead.id)) return false;
          allLeadIds.add(lead.id);
          return true;
        })
        // deno-lint-ignore no-explicit-any
        .sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      // Generate signed URLs for quote images
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const storageClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const sessionIds = merged
        // deno-lint-ignore no-explicit-any
        .map((l: any) => l.latest_scan_session_id)
        .filter(Boolean);

      if (sessionIds.length > 0) {
        const { data: sessions } = await supabaseAdmin
          .from("scan_sessions")
          .select("id, quote_file_id")
          .in("id", sessionIds);

        const fileIds = (sessions ?? [])
          // deno-lint-ignore no-explicit-any
          .map((s: any) => s.quote_file_id)
          .filter(Boolean);

        const fileMap: Record<string, string> = {};
        if (fileIds.length > 0) {
          const { data: files } = await supabaseAdmin
            .from("quote_files")
            .select("id, storage_path")
            .in("id", fileIds);

          for (const f of files ?? []) {
            fileMap[f.id] = f.storage_path;
          }
        }

        const sessionToPath: Record<string, string> = {};
        for (const s of sessions ?? []) {
          if (s.quote_file_id && fileMap[s.quote_file_id]) {
            sessionToPath[s.id] = fileMap[s.quote_file_id];
          }
        }

        for (const lead of merged) {
          const path = sessionToPath[lead.latest_scan_session_id];
          if (path) {
            const { data: signedData } = await storageClient.storage
              .from("quotes")
              .createSignedUrl(path, 3600);
            if (signedData?.signedUrl) {
              lead.quote_image_url = signedData.signedUrl;
            }
          }
        }
      }

      return successResponse({ data: merged });
    }

    // ─── RESCAN LEAD ───────────────────────────────────────────────

    if (action === "rescan_lead") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id required");
      }

      const { data: lead, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("latest_scan_session_id")
        .eq("id", lead_id)
        .single();

      if (leadErr || !lead?.latest_scan_session_id) {
        return errorResponse(
          400,
          "no_session",
          "No scan session found for this lead",
        );
      }

      const ssId = lead.latest_scan_session_id;

      await supabaseAdmin
        .from("scan_sessions")
        .update({ status: "idle" })
        .eq("id", ssId);

      await supabaseAdmin
        .from("analyses")
        .delete()
        .eq("scan_session_id", ssId);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const scanResp = await fetch(`${supabaseUrl}/functions/v1/scan-quote`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scan_session_id: ssId }),
      });

      if (scanResp.ok) {
        return successResponse({ data: { success: true } });
      } else {
        const err = await scanResp.json().catch(() => ({}));
        return errorResponse(
          500,
          "rescan_failed",
          err.error ?? `scan-quote returned ${scanResp.status}`,
        );
      }
    }

    // ─── UPDATE LEAD MANUAL ENTRY ──────────────────────────────────

    if (action === "update_lead_manual_entry") {
      const { lead_id, manual_entry_data, manually_reviewed } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id required");
      }

      const updateFields: Record<string, unknown> = { updated_at: now };
      if (typeof manually_reviewed === "boolean") {
        updateFields.manually_reviewed = manually_reviewed;
      } else if (manual_entry_data) {
        updateFields.manually_reviewed = true;
      }
      if (manual_entry_data !== undefined) {
        updateFields.manual_entry_data = manual_entry_data;
      }

      const { error } = await supabaseAdmin
        .from("leads")
        .update(updateFields)
        .eq("id", lead_id);

      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    // ─── WRITE ACTIONS ─────────────────────────────────────────────

    if (action === "update_lead_status") {
      const { lead_id, status } = payload;
      const { error } = await supabaseAdmin.from("leads").update({
        status,
        updated_at: now,
      }).eq("id", lead_id);
      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    if (action === "update_lead_deal_status") {
      const { lead_id, deal_status } = payload;
      if (!lead_id || !deal_status) {
        return errorResponse(
          400,
          "missing_param",
          "lead_id and deal_status are required",
        );
      }
      const { error } = await supabaseAdmin.from("leads").update({
        deal_status,
        updated_at: now,
      }).eq("id", lead_id);
      if (error) throw error;
      await supabaseAdmin.from("lead_events").insert({
        lead_id,
        event_name: "deal_status_changed",
        event_source: "admin_crm",
        metadata: { deal_status, changed_by: userId, timestamp: now },
      });
      return successResponse({ data: { success: true } });
    }

    if (action === "route_opportunity") {
      const { opportunity_id, contractor_id, scan_session_id } = payload;

      const { error: routeErr } = await supabaseAdmin.from(
        "contractor_opportunity_routes",
      ).insert({
        opportunity_id,
        contractor_id,
        route_status: "sent",
        sent_at: now,
        assigned_by: "operator",
        routing_reason: "manual_assignment",
      });
      if (routeErr) throw routeErr;

      await supabaseAdmin.from("contractor_opportunities").update({
        status: "sent_to_contractor",
        routed_at: now,
      }).eq("id", opportunity_id);

      await supabaseAdmin.from("event_logs").insert({
        event_name: "contractor_intro_routed",
        session_id: scan_session_id || null,
        route: "/admin",
        metadata: { opportunity_id, contractor_id, timestamp: now },
      });

      return successResponse({ data: { success: true } });
    }

    if (action === "mark_dead") {
      const { opportunity_id, scan_session_id } = payload;
      await supabaseAdmin.from("contractor_opportunities").update({
        status: "dead",
      }).eq("id", opportunity_id);

      await supabaseAdmin.from("event_logs").insert({
        event_name: "contractor_opportunity_marked_dead",
        session_id: scan_session_id || null,
        route: "/admin",
        metadata: { opportunity_id },
      });

      return successResponse({ data: { success: true } });
    }

    if (action === "trigger_voice_followup") {
      const { scan_session_id, phone_e164, opportunity_id } = payload;
      const { data, error } = await supabaseAdmin.functions.invoke(
        "voice-followup",
        {
          body: {
            scan_session_id,
            phone_e164,
            opportunity_id,
            call_intent: "manual_admin_trigger",
          },
        },
      );
      if (error) throw error;
      return successResponse({ data: { success: true, invokeResult: data } });
    }

    if (action === "manage_user_roles") {
      const { target_user_id, new_role } = payload;
      if (target_user_id === userId && new_role !== "super_admin") {
        throw new Error("Self-demotion blocked.");
      }
      const { error } = await supabaseAdmin.from("user_roles").upsert({
        id: target_user_id,
        role: new_role,
        updated_at: now,
      });
      if (error) throw error;
      await supabaseAdmin.from("user_role_audit_log").insert({
        target_user_id,
        changed_by_user_id: userId,
        new_role,
        action: "change",
      });
      return successResponse({ data: { success: true } });
    }

    if (action === "list_user_roles") {
      const { data: roles, error } = await supabaseAdmin.from("user_roles")
        .select("*");
      if (error) throw error;

      const roleRows = roles ?? [];
      const userIds: string[] = roleRows.map((r: { id: string }) => r.id);

      const authInfoMap = new Map<
        string,
        { email: string; last_sign_in: string | null }
      >();
      await Promise.all(
        userIds.map(async (uid) => {
          const { data: authData, error: uidErr } = await supabaseAdmin.auth
            .admin.getUserById(uid);
          if (!uidErr && authData?.user) {
            authInfoMap.set(uid, {
              email: authData.user.email ?? "",
              last_sign_in: authData.user.last_sign_in_at ?? null,
            });
          }
        }),
      );

      const enriched = roleRows.map((
        r: { id: string; role: string; updated_at?: string },
      ) => ({
        id: r.id,
        user_id: r.id,
        role: r.role,
        updated_at: r.updated_at ?? null,
        email: authInfoMap.get(r.id)?.email ?? "",
        last_sign_in: authInfoMap.get(r.id)?.last_sign_in ?? null,
      }));

      return successResponse({ data: { users: enriched } });
    }

    if (action === "get_role_audit_log") {
      const rawLimit = payload?.limit;
      const limit = Math.min(
        500,
        Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100),
      );

      const { data: entries, error } = await supabaseAdmin
        .from("user_role_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const auditRows = entries ?? [];

      const involvedIds = new Set<string>();
      for (const e of auditRows) {
        involvedIds.add(e.target_user_id);
        involvedIds.add(e.changed_by_user_id);
      }

      const emailMap = new Map<string, string>();
      await Promise.all(
        Array.from(involvedIds).map(async (uid) => {
          const { data: authData, error: uidErr } = await supabaseAdmin.auth
            .admin.getUserById(uid);
          if (!uidErr && authData?.user?.email) {
            emailMap.set(uid, authData.user.email);
          }
        }),
      );

      const enriched = auditRows.map((e: {
        id: string;
        target_user_id: string;
        changed_by_user_id: string;
        old_role?: string | null;
        new_role: string;
        action: string;
        created_at: string;
      }) => ({
        ...e,
        target_email: emailMap.get(e.target_user_id) ?? e.target_user_id,
        changed_by_email: emailMap.get(e.changed_by_user_id) ??
          e.changed_by_user_id,
      }));

      return successResponse({ data: { entries: enriched } });
    }

    // ─── CRM: LEAD EVENTS ─────────────────────────────────────────────

    if (action === "fetch_lead_events") {
      const { lead_id, limit: rawLimit } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }
      const limit = Math.min(
        200,
        Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 50),
      );
      const { data, error } = await supabaseAdmin
        .from("lead_events")
        .select("*")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return successResponse({ data: data });
    }

    // ─── CRM: WEBHOOK DELIVERIES ───────────────────────────────────────

    if (action === "fetch_webhook_deliveries") {
      const { status: filterStatus, limit: rawLimit } = payload;
      const limit = Math.min(
        500,
        Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 200),
      );
      let query = supabaseAdmin
        .from("webhook_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (filterStatus) query = query.eq("status", filterStatus);
      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ data: data });
    }

    // ─── CRM: FETCH LEAD ANALYSIS ────────────────────────────────────────

    if (action === "fetch_lead_analysis") {
      const { analysis_id } = payload;
      if (!analysis_id) {
        return errorResponse(400, "missing_param", "analysis_id is required");
      }
      const { data, error } = await supabaseAdmin
        .from("analyses")
        .select("grade, dollar_delta, confidence_score, flags, full_json")
        .eq("id", analysis_id)
        .maybeSingle();
      if (error) throw error;
      return successResponse({ data: data });
    }

    // ─── CONTRACTOR ACCOUNT MANAGEMENT ──────────────────────────────────

    if (action === "list_contractor_accounts") {
      // Join contractor_profiles with contractor_credits and unlock counts
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("contractor_profiles")
        .select("id, company_name, contact_email, status, created_at");
      if (pErr) throw pErr;

      // deno-lint-ignore no-explicit-any
      const profileIds = (profiles ?? []).map((p: any) => p.id);

      // Fetch credits
      const creditsMap: Record<string, number> = {};
      if (profileIds.length > 0) {
        const { data: credits } = await supabaseAdmin
          .from("contractor_credits")
          .select("contractor_id, balance")
          .in("contractor_id", profileIds);
        for (const c of credits ?? []) {
          creditsMap[c.contractor_id] = c.balance;
        }
      }

      // Fetch unlock counts
      const unlockCountMap: Record<string, number> = {};
      if (profileIds.length > 0) {
        const { data: unlocks } = await supabaseAdmin
          .from("contractor_unlocked_leads")
          .select("contractor_id");
        // Count per contractor
        for (const u of unlocks ?? []) {
          unlockCountMap[u.contractor_id] =
            (unlockCountMap[u.contractor_id] || 0) + 1;
        }
      }

      // Fetch auth bridge from contractors table
      const authBridgeMap: Record<
        string,
        {
          contractor_record_id: string;
          company_name: string;
          routing_setup_completed_at: string | null;
        } | null
      > = {};
      if (profileIds.length > 0) {
        const { data: contractors } = await supabaseAdmin
          .from("contractors")
          .select("id, auth_user_id, company_name, routing_setup_completed_at")
          .in("auth_user_id", profileIds);
        for (const c of contractors ?? []) {
          if (c.auth_user_id) {
            authBridgeMap[c.auth_user_id] = {
              contractor_record_id: c.id,
              company_name: c.company_name,
              routing_setup_completed_at: c.routing_setup_completed_at ?? null,
            };
          }
        }
      }

      // Fetch auth user emails
      const authEmailMap = new Map<
        string,
        { email: string; last_sign_in: string | null }
      >();
      await Promise.all(
        profileIds.map(async (uid: string) => {
          const { data: authData, error: uidErr } = await supabaseAdmin.auth
            .admin.getUserById(uid);
          if (!uidErr && authData?.user) {
            authEmailMap.set(uid, {
              email: authData.user.email ?? "",
              last_sign_in: authData.user.last_sign_in_at ?? null,
            });
          }
        }),
      );

      // deno-lint-ignore no-explicit-any
      const enriched = (profiles ?? []).map((p: any) => ({
        id: p.id,
        company_name: p.company_name,
        contact_email: p.contact_email,
        status: p.status,
        created_at: p.created_at,
        credit_balance: creditsMap[p.id] ?? 0,
        unlock_count: unlockCountMap[p.id] ?? 0,
        auth_email: authEmailMap.get(p.id)?.email ?? null,
        last_sign_in: authEmailMap.get(p.id)?.last_sign_in ?? null,
        has_contractor_record: !!authBridgeMap[p.id],
        contractor_record_id: authBridgeMap[p.id]?.contractor_record_id ?? null,
        marketplace_company_name: authBridgeMap[p.id]?.company_name ?? null,
        routing_setup_completed_at:
          authBridgeMap[p.id]?.routing_setup_completed_at ?? null,
      }));

      return successResponse({ data: enriched });
    }

    if (action === "get_contractor_ledger") {
      const { contractor_id, limit: rawLimit } = payload;
      if (!contractor_id) {
        return errorResponse(400, "missing_param", "contractor_id is required");
      }
      const limit = Math.min(
        500,
        Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100),
      );

      const { data, error } = await supabaseAdmin
        .from("contractor_credit_ledger")
        .select("*")
        .eq("contractor_id", contractor_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return successResponse({ data: data ?? [] });
    }

    if (action === "adjust_contractor_credits") {
      const { contractor_id, delta, entry_type, notes } = payload;
      if (!contractor_id) {
        return errorResponse(400, "missing_param", "contractor_id is required");
      }
      if (!delta || typeof delta !== "number") {
        return errorResponse(
          400,
          "missing_param",
          "delta (non-zero integer) is required",
        );
      }
      if (!entry_type) {
        return errorResponse(400, "missing_param", "entry_type is required");
      }

      const { data, error } = await supabaseAdmin.rpc(
        "admin_adjust_contractor_credits",
        {
          p_contractor_id: contractor_id,
          p_delta: delta,
          p_entry_type: entry_type,
          p_notes: notes ?? null,
          p_admin_user_id: userId === "dev-sandbox-bypass" ? null : userId,
        },
      );
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "get_contractor_unlocks") {
      const { contractor_id, limit: rawLimit } = payload;
      if (!contractor_id) {
        return errorResponse(400, "missing_param", "contractor_id is required");
      }
      const limit = Math.min(
        500,
        Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100),
      );

      const { data: unlocks, error } = await supabaseAdmin
        .from("contractor_unlocked_leads")
        .select("id, contractor_id, lead_id, unlocked_at")
        .eq("contractor_id", contractor_id)
        .order("unlocked_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      // Enrich with basic lead info
      // deno-lint-ignore no-explicit-any
      const leadIds = (unlocks ?? []).map((u: any) => u.lead_id);
      // deno-lint-ignore no-explicit-any
      const leadMap: Record<string, any> = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabaseAdmin
          .from("leads")
          .select(
            "id, first_name, last_name, county, grade, window_count, quote_amount",
          )
          .in("id", leadIds);
        for (const l of leads ?? []) {
          leadMap[l.id] = l;
        }
      }

      // deno-lint-ignore no-explicit-any
      const enriched = (unlocks ?? []).map((u: any) => ({
        ...u,
        lead: leadMap[u.lead_id] ?? null,
      }));

      return successResponse({ data: enriched });
    }

    // ─── INVITATION MANAGEMENT ──────────────────────────────────────────

    if (action === "list_invitations") {
      const { data, error } = await supabaseAdmin
        .from("contractor_invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return successResponse({ data: data ?? [] });
    }

    if (action === "create_invitation") {
      const { invited_email, contractor_id, initial_credits, expires_in_days } =
        payload;
      if (!invited_email || !contractor_id) {
        return errorResponse(
          400,
          "missing_param",
          "invited_email and contractor_id are required",
        );
      }

      // Verify contractor exists
      const { data: contractor } = await supabaseAdmin
        .from("contractors")
        .select("id, company_name")
        .eq("id", contractor_id)
        .maybeSingle();

      if (!contractor) {
        return errorResponse(
          404,
          "contractor_not_found",
          "Contractor business record not found",
        );
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expires_in_days ?? 7));

      const { data: invite, error: invErr } = await supabaseAdmin
        .from("contractor_invitations")
        .insert({
          invited_email: invited_email.toLowerCase().trim(),
          contractor_id,
          initial_credits: initial_credits ?? 0,
          expires_at: expiresAt.toISOString(),
          created_by: userId === "dev-sandbox-bypass" ? null : userId,
        })
        .select("id, invite_token, invited_email, expires_at, initial_credits")
        .single();

      if (invErr) throw invErr;
      return successResponse({ data: invite });
    }

    if (action === "revoke_invitation") {
      const { invitation_id } = payload;
      if (!invitation_id) {
        return errorResponse(400, "missing_param", "invitation_id is required");
      }

      const { error } = await supabaseAdmin
        .from("contractor_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation_id)
        .eq("status", "pending");

      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    // ─── CAPI CONTROL-PLANE ──────────────────────────────────────
    // Read-only listing. Tokens are ALWAYS redacted before leaving the server.
    if (action === "list_meta_configurations") {
      const { data: configs, error } = await supabaseAdmin
        .from("meta_configurations")
        .select(
          "id, client_id, pixel_id, access_token, test_event_code, is_default, updated_at",
        )
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, slug, name, is_active");
      // deno-lint-ignore no-explicit-any
      const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]));

      // deno-lint-ignore no-explicit-any
      const rows = (configs ?? []).map((c: any) => {
        const client = c.client_id ? clientMap.get(c.client_id) : null;
        return {
          id: c.id,
          role: c.is_default ? "default" : "client",
          client_id: c.client_id,
          client_slug: client?.slug ?? null,
          client_name: client?.name ?? null,
          client_is_active: client?.is_active ?? null,
          pixel_id: c.pixel_id,
          access_token_preview: redactToken(c.access_token),
          test_event_code: c.test_event_code,
          updated_at: c.updated_at,
        };
      });
      return successResponse({ data: { rows } });
    }

    // Atomic create-or-update of a client + its meta_configuration row.
    // Validation is done in code AND enforced by DB constraints.
    if (action === "create_meta_client_config") {
      const {
        client_slug,
        client_name,
        pixel_id,
        access_token,
        test_event_code = null,
      } = payload ?? {};

      if (typeof client_slug !== "string" || !SLUG_RE.test(client_slug)) {
        return errorResponse(
          400,
          "invalid_slug",
          "client_slug must be 1-40 chars, lowercase a-z, 0-9, hyphens.",
        );
      }
      if (typeof client_name !== "string" || client_name.trim().length < 2) {
        return errorResponse(
          400,
          "invalid_name",
          "client_name is required (min 2 chars).",
        );
      }
      if (typeof pixel_id !== "string" || !PIXEL_RE.test(pixel_id)) {
        return errorResponse(
          400,
          "invalid_pixel_id",
          "pixel_id must be a 6-20 digit Meta Pixel ID.",
        );
      }
      if (typeof access_token !== "string" || access_token.trim().length < 20) {
        return errorResponse(
          400,
          "invalid_token",
          "access_token must be a non-empty Meta CAPI token (min 20 chars).",
        );
      }

      // Upsert client (slug is unique).
      const { data: existingClient } = await supabaseAdmin
        .from("clients").select("id, name, is_active").eq("slug", client_slug)
        .maybeSingle();

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id;
        if (
          existingClient.name !== client_name ||
          existingClient.is_active !== true
        ) {
          await supabaseAdmin.from("clients")
            .update({ name: client_name, is_active: true })
            .eq("id", clientId);
        }
      } else {
        const { data: newClient, error: cErr } = await supabaseAdmin
          .from("clients")
          .insert({ slug: client_slug, name: client_name, is_active: true })
          .select("id").single();
        if (cErr) {
          return errorResponse(400, "client_insert_failed", cErr.message);
        }
        clientId = newClient.id;
      }

      // Upsert config (one row per client_id, enforced by partial unique index).
      const { data: existingCfg } = await supabaseAdmin
        .from("meta_configurations")
        .select("id").eq("client_id", clientId).maybeSingle();

      const cfgPayload = {
        client_id: clientId,
        pixel_id,
        access_token,
        test_event_code: test_event_code || null,
        is_default: false,
        updated_at: new Date().toISOString(),
      };

      if (existingCfg) {
        const { error: uErr } = await supabaseAdmin
          .from("meta_configurations").update(cfgPayload).eq(
            "id",
            existingCfg.id,
          );
        if (uErr) {
          return errorResponse(400, "config_update_failed", uErr.message);
        }
      } else {
        const { error: iErr } = await supabaseAdmin
          .from("meta_configurations").insert(cfgPayload);
        if (iErr) {
          return errorResponse(400, "config_insert_failed", iErr.message);
        }
      }

      return successResponse({
        data: {
          success: true,
          client_id: clientId,
          client_slug,
          mode: existingCfg ? "updated" : "created",
        },
      });
    }

    if (action === "save_client_config") {
      const {
        client_id,
        google_ads_conversion_id = null,
        google_ads_label = null,
        meta_pixel_id = null,
        meta_dataset_id = null,
        gtm_server_url = null,
        capi_token = null,
      } = payload ?? {};
      if (
        typeof client_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(client_id)
      ) {
        return errorResponse(
          400,
          "invalid_client_id",
          "client_id must be a valid UUID.",
        );
      }
      const clean = (value: unknown, max = 255) =>
        typeof value === "string" && value.trim()
          ? value.trim().slice(0, max)
          : null;
      const googleId = clean(google_ads_conversion_id, 32),
        googleLabel = clean(google_ads_label, 120),
        metaPixelId = clean(meta_pixel_id, 32),
        metaDatasetId = clean(meta_dataset_id, 80),
        serverGtmUrl = clean(gtm_server_url, 255),
        token = clean(capi_token, 4096);
      if (googleId && !/^(AW-)?[0-9]{6,20}$/.test(googleId)) {
        return errorResponse(
          400,
          "invalid_google_ads_conversion_id",
          "Google Ads Conversion ID must look like AW-123456789 or digits only.",
        );
      }
      if (metaPixelId && !PIXEL_RE.test(metaPixelId)) {
        return errorResponse(
          400,
          "invalid_meta_pixel_id",
          "Meta Pixel ID must be 6–20 digits.",
        );
      }
      if (serverGtmUrl) {
        try {
          if (new URL(serverGtmUrl).protocol !== "https:") {
            return errorResponse(
              400,
              "invalid_gtm_server_url",
              "Server GTM URL must use HTTPS.",
            );
          }
        } catch {
          return errorResponse(
            400,
            "invalid_gtm_server_url",
            "Server GTM URL must be a valid HTTPS URL.",
          );
        }
      }
      if (token && token.length < 20) {
        return errorResponse(
          400,
          "invalid_capi_token",
          "CAPI token must be at least 20 characters when provided.",
        );
      }

      const { data: existingClient, error: clientErr } = await supabaseAdmin
        .from("clients").select("id").eq("id", client_id).maybeSingle();
      if (clientErr) throw clientErr;
      if (!existingClient) {
        return errorResponse(404, "client_not_found", "Client not found.");
      }

      let secretId: string | null = null;
      if (token) {
        const { data: savedSecretId, error: secretErr } = await supabaseAdmin
          .rpc(
            "vault_upsert_client_capi_token" as never,
            { p_client_id: client_id, p_token: token } as never,
          );
        if (secretErr) {
          return errorResponse(
            500,
            "vault_write_failed",
            "Unable to store CAPI token securely.",
          );
        }
        secretId = String(savedSecretId);
      }

      const { data: existingConfig, error: existingErr } = await supabaseAdmin
        .from("client_configs").select("id, capi_token_secret_id").eq(
          "client_id",
          client_id,
        ).maybeSingle();
      if (existingErr) throw existingErr;
      const configPayload: Record<string, unknown> = {
        client_id,
        google_ads_conversion_id: googleId,
        google_ads_label: googleLabel,
        meta_pixel_id: metaPixelId,
        meta_dataset_id: metaDatasetId,
        gtm_server_url: serverGtmUrl,
        updated_at: now,
      };
      if (secretId) configPayload.capi_token_secret_id = secretId;
      const result = existingConfig
        ? await supabaseAdmin.from("client_configs").update(configPayload).eq(
          "id",
          existingConfig.id,
        )
        : await supabaseAdmin.from("client_configs").insert({
          ...configPayload,
          created_at: now,
        });
      if (result.error) {
        return errorResponse(
          400,
          existingConfig
            ? "client_config_update_failed"
            : "client_config_insert_failed",
          result.error.message,
        );
      }
      return successResponse({
        data: {
          success: true,
          client_id,
          capi_token_configured: Boolean(
            secretId || existingConfig?.capi_token_secret_id,
          ),
          capi_token_rotated: Boolean(secretId),
        },
      });
    }

    // Toggle a client's active flag. Inactive clients fall through to default/env.
    if (action === "set_meta_client_active") {
      const { client_slug, is_active } = payload ?? {};
      if (typeof client_slug !== "string" || !SLUG_RE.test(client_slug)) {
        return errorResponse(400, "invalid_slug", "client_slug is required.");
      }
      if (typeof is_active !== "boolean") {
        return errorResponse(400, "invalid_flag", "is_active must be boolean.");
      }
      const { data, error } = await supabaseAdmin
        .from("clients").update({ is_active }).eq("slug", client_slug)
        .select("id, slug, is_active").maybeSingle();
      if (error) return errorResponse(400, "update_failed", error.message);
      if (!data) {
        return errorResponse(
          404,
          "client_not_found",
          `No client with slug "${client_slug}".`,
        );
      }
      return successResponse({ data: { success: true, client: data } });
    }

    // Dry-run: delegates to diagnoseRoute() which wraps the canonical
    // resolvePixelConfig() used by capi-event. Preview NEVER calls Meta and
    // NEVER writes to capi_signal_logs. Reasons are stable enums (see
    // RouteDiagnostic in capi-event/index.ts).
    if (action === "preview_meta_route") {
      const { client_slug } = payload ?? {};
      const slug = typeof client_slug === "string" && client_slug.length > 0
        ? client_slug
        : undefined;

      // Validate slug shape only when present — empty/missing is a valid
      // "preview the global default tier" request.
      if (slug && !SLUG_RE.test(slug)) {
        return errorResponse(
          400,
          "invalid_slug",
          "client_slug must match [a-z0-9-]{1,40}.",
        );
      }

      const diagnostic = await diagnoseRoute(supabaseAdmin as never, slug);

      // Mask the resolved pixel ID for logs/UI — last 4 digits only.
      const masked_pixel_id = diagnostic.resolved_pixel_id
        ? `…${diagnostic.resolved_pixel_id.slice(-4)}`
        : null;

      return successResponse({
        data: {
          ...diagnostic,
          masked_pixel_id,
          preview_only: true, // explicit marker — this never sent to Meta
        },
      });
    }

    // Operator-only smoke-send — fires a controlled Meta event through the
    // REAL controller code path (resolvePixelConfig + dispatchCapiEvent).
    //
    // Hard rules enforced here:
    //   1. Caller MUST provide a test_event_code OR rely on the resolved
    //      config carrying one. If neither is present, we refuse to send so
    //      smoke traffic can never be silently logged as production traffic.
    //   2. The event_id is namespaced ("wm-smoke-…") so it can never collide
    //      with real funnel events.
    //   3. capi_signal_logs.client_slug is prefixed with "smoke:" so logs
    //      are easy to filter out of business reporting.
    //   4. Tokens are NEVER returned. Only a masked pixel ID is exposed.
    if (action === "smoke_send_meta_event") {
      const {
        client_slug,
        test_event_code,
        event_name = "PageView",
        event_source_url = "https://wmmvp.lovable.app/__smoke__",
      } = payload ?? {};

      const slug = typeof client_slug === "string" && client_slug.length > 0
        ? client_slug
        : undefined;
      if (slug && !SLUG_RE.test(slug)) {
        return errorResponse(
          400,
          "invalid_slug",
          "client_slug must match [a-z0-9-]{1,40}.",
        );
      }

      const allowedEvents = new Set([
        "PageView",
        "ViewContent",
        "Lead",
        "CompleteRegistration",
      ]);
      if (!allowedEvents.has(event_name)) {
        return errorResponse(
          400,
          "invalid_event_name",
          `event_name must be one of: ${[...allowedEvents].join(", ")}`,
        );
      }

      const overrideTestCode =
        typeof test_event_code === "string" && test_event_code.trim().length > 0
          ? test_event_code.trim()
          : undefined;

      // Resolve the route using the SAME resolver used in production.
      const config = await resolvePixelConfig(supabaseAdmin as never, slug);
      const diagnostic = await diagnoseRoute(supabaseAdmin as never, slug);

      if (!config) {
        // Degraded — never attempt a send. Surface diagnostic so operator
        // knows exactly what's missing.
        return successResponse({
          data: {
            attempted: false,
            sent: false,
            mode: "test",
            reason: "no_route_resolved",
            route: diagnostic,
            preview_only: true,
          },
        });
      }

      const effectiveTestCode = overrideTestCode ?? config.testEventCode;
      if (!effectiveTestCode) {
        // Refuse to send: explicit test mode is mandatory.
        return errorResponse(
          400,
          "test_event_code_required",
          "Smoke-send requires test_event_code (either passed in payload or configured on the resolved row).",
        );
      }

      // Build a controlled, namespaced test event. event_id prefix ensures
      // the smoke event can never collide with real funnel telemetry.
      const eventId = `wm-smoke-${crypto.randomUUID()}`;
      const event: CAPIEvent = {
        event_name: event_name as CAPIEvent["event_name"],
        event_id: eventId,
        event_source_url,
        action_source: "website",
        client_slug: slug,
        user_data: {
          // Deterministic synthetic identity so Meta dedupes test sends per pixel.
          external_id: `smoke-${slug ?? "default"}`,
        },
      };

      let dispatch;
      try {
        dispatch = await dispatchCapiEvent(event, config, {
          clientIp: req.headers.get("cf-connecting-ip") ?? "0.0.0.0",
          userAgent: req.headers.get("user-agent"),
          forceTestEventCode: effectiveTestCode,
        });
      } catch (sendErr) {
        // Network-level failure (DNS, TLS, etc) — never silently swallowed.
        return successResponse({
          data: {
            attempted: true,
            sent: false,
            mode: "test",
            reason: "network_error",
            error: String(sendErr),
            route: {
              ...diagnostic,
              masked_pixel_id: `…${config.pixelId.slice(-4)}`,
            },
            test_event_code_used: effectiveTestCode,
            event_id: eventId,
          },
        });
      }

      // Log to capi_signal_logs with a "smoke:" client_slug prefix so business
      // reporting can filter it out trivially.
      await supabaseAdmin.from("capi_signal_logs").insert({
        client_slug: `smoke:${slug ?? "default"}`,
        pixel_id: config.pixelId,
        event_name,
        status_code: dispatch.status,
        payload: dispatch.capiPayload,
        response: dispatch.response,
        fired_at: new Date().toISOString(),
      });

      // Classify Meta's response so operators can distinguish a token problem
      // from a routing problem from a Meta-side payload rejection. Never
      // includes raw token bytes — only the documented Meta error.code path.
      const failure = classifyMetaError(dispatch.status, dispatch.response);

      return successResponse({
        data: {
          attempted: true,
          sent: dispatch.ok,
          mode: dispatch.mode, // always "test" because forceTestEventCode set
          status: dispatch.status,
          meta_response: dispatch.response,
          failure_class: failure.class,
          failure_subcode: failure.subcode,
          failure_hint: failure.hint,
          masked_pixel_id: dispatch.masked_pixel_id,
          test_event_code_used: dispatch.test_event_code_used,
          event_id: eventId,
          route: { ...diagnostic, masked_pixel_id: dispatch.masked_pixel_id },
        },
      });
    }

    // ─── TOKEN HYGIENE DIAGNOSTIC ──────────────────────────────────
    // Read-only inspector for the operator to verify, without ever exposing
    // raw secrets, whether each routing tier currently holds a usable token:
    //
    //   • per-client config (if client_slug provided)
    //   • the global default row
    //   • the env-fallback (META_PIXEL_ID + META_CAPI_TOKEN)
    //
    // Returns booleans + masked previews ONLY. Never returns raw tokens or
    // raw env values. Safe for super_admin / operator / viewer.
    if (action === "diagnose_token_health") {
      const { client_slug } = payload ?? {};
      const slug = typeof client_slug === "string" && client_slug.length > 0
        ? client_slug
        : undefined;
      if (slug && !SLUG_RE.test(slug)) {
        return errorResponse(
          400,
          "invalid_slug",
          "client_slug must match [a-z0-9-]{1,40}.",
        );
      }

      // Per-client tier (optional)
      let clientTier: {
        resolved: boolean;
        reason: string;
        presence: ReturnType<typeof summarizeTokenPresence> | null;
      } | null = null;
      if (slug) {
        const { data: client } = await supabaseAdmin
          .from("clients").select("id, is_active").eq("slug", slug)
          .maybeSingle();
        if (!client) {
          clientTier = {
            resolved: false,
            reason: "client_not_found",
            presence: null,
          };
        } else if (!(client as { is_active: boolean }).is_active) {
          clientTier = {
            resolved: false,
            reason: "client_inactive",
            presence: null,
          };
        } else {
          const { data: cfg } = await supabaseAdmin
            .from("meta_configurations")
            .select("pixel_id, access_token, test_event_code")
            .eq("client_id", (client as { id: string }).id)
            .maybeSingle();
          const presence = summarizeTokenPresence(cfg as never);
          clientTier = {
            resolved: presence.pixel_id_present &&
              presence.access_token_present,
            reason: !cfg
              ? "client_config_missing"
              : !presence.pixel_id_present
              ? "client_config_missing_pixel"
              : !presence.access_token_present
              ? "client_config_missing_token"
              : "ok",
            presence,
          };
        }
      }

      // Default tier
      const { data: defaultRow } = await supabaseAdmin
        .from("meta_configurations")
        .select("pixel_id, access_token, test_event_code")
        .eq("is_default", true)
        .maybeSingle();
      const defaultPresence = summarizeTokenPresence(defaultRow as never);
      const defaultTier = {
        resolved: defaultPresence.pixel_id_present &&
          defaultPresence.access_token_present,
        reason: !defaultRow
          ? "default_missing"
          : !defaultPresence.pixel_id_present
          ? "default_missing_pixel"
          : !defaultPresence.access_token_present
          ? "default_missing_token"
          : "ok",
        presence: defaultPresence,
      };

      // Env tier — booleans only. We MUST NOT echo env values.
      const envPixel = Deno.env.get("META_PIXEL_ID") ?? null;
      const envToken = Deno.env.get("META_CAPI_TOKEN") ?? null;
      const envTestCode = Deno.env.get("META_TEST_EVENT_CODE") ?? null;
      const envPresence = summarizeTokenPresence({
        pixel_id: envPixel,
        access_token: envToken,
        test_event_code: envTestCode,
      });
      const envTier = {
        resolved: envPresence.pixel_id_present &&
          envPresence.access_token_present,
        reason: envPresence.pixel_id_present && envPresence.access_token_present
          ? "ok"
          : !envPresence.pixel_id_present && !envPresence.access_token_present
          ? "env_missing"
          : !envPresence.pixel_id_present
          ? "env_missing_pixel"
          : "env_missing_token",
        presence: envPresence,
      };

      // Effective resolution mirrors capi-event precedence.
      const effective_tier = clientTier?.resolved
        ? "client"
        : defaultTier.resolved
        ? "default"
        : envTier.resolved
        ? "env"
        : "degraded";

      return successResponse({
        data: {
          client_slug: slug ?? null,
          effective_tier,
          is_send_safe: effective_tier !== "degraded",
          tiers: {
            client: clientTier,
            default: defaultTier,
            env: envTier,
          },
          // Reminder for operator UI — never display raw tokens anywhere.
          contract: {
            tokens_returned: false,
            env_values_returned: false,
            mask_format: "first4…last4",
          },
        },
      });
    }

    // ─── FLEET HEALTH (read-only aggregate across all clients) ─────
    // Aggregates the last N hours of capi_signal_logs per client_slug,
    // joins with clients + meta_configurations, and classifies each
    // client into healthy / warning / incident with a recommended next
    // step. Smoke traffic (client_slug LIKE 'smoke:%') is excluded so it
    // never inflates production health signals.
    //
    // Hard rules:
    //   • Read-only. Never mutates config or sends Meta traffic.
    //   • Never returns access tokens. Pixel IDs are masked (last 4).
    //   • Smoke rows are filtered out of business signals.
    //   • Health states are evidence-backed (counts + thresholds), not vibes.
    if (action === "summarize_meta_fleet_health") {
      const { window_hours } = payload ?? {};
      const hours = typeof window_hours === "number" && window_hours > 0 &&
          window_hours <= 168
        ? Math.floor(window_hours)
        : 24;
      const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();

      // 1. Load fleet inventory: every client + its config + the default row.
      const { data: clients, error: clientsErr } = await supabaseAdmin
        .from("clients")
        .select("id, slug, name, is_active");
      if (clientsErr) throw clientsErr;

      const { data: configs, error: cfgErr } = await supabaseAdmin
        .from("meta_configurations")
        .select("client_id, pixel_id, access_token, is_default");
      if (cfgErr) throw cfgErr;

      const cfgByClientId = new Map<
        string,
        { pixel_id: string | null; token_present: boolean }
      >();
      let defaultPixelId: string | null = null;
      let defaultTokenPresent = false;
      for (const c of configs ?? []) {
        const tokenPresent = typeof c.access_token === "string" &&
          c.access_token.trim().length >= 20;
        if (c.is_default) {
          defaultPixelId = c.pixel_id ?? null;
          defaultTokenPresent = tokenPresent;
        } else if (c.client_id) {
          cfgByClientId.set(c.client_id, {
            pixel_id: c.pixel_id ?? null,
            token_present: tokenPresent,
          });
        }
      }

      // 2. Pull recent capi_signal_logs for production traffic only.
      //    Smoke traffic is prefixed "smoke:" by smoke_send_meta_event and
      //    must never inflate fleet health. NULL client_slug rows fall to
      //    the default tier bucket.
      const { data: logs, error: logsErr } = await supabaseAdmin
        .from("capi_signal_logs")
        .select("client_slug, pixel_id, status_code, fired_at, response")
        .gte("fired_at", sinceIso)
        .or("client_slug.is.null,client_slug.not.like.smoke:%")
        .order("fired_at", { ascending: false })
        .limit(10000);
      if (logsErr) throw logsErr;

      // 3. Bucket logs by client_slug (NULL → "__default__").
      type Bucket = {
        total: number;
        success: number; // 2xx
        non_2xx: number;
        meta_reject: number; // classified as meta_rejected_payload / unknown_failure
        token_failure: number; // token_invalid_or_revoked / pixel_token_mismatch / token_permission_denied
        rate_limited: number;
        meta_server_error: number;
        pixel_ids_seen: Set<string>;
        last_seen_at: string | null;
      };
      const newBucket = (): Bucket => ({
        total: 0,
        success: 0,
        non_2xx: 0,
        meta_reject: 0,
        token_failure: 0,
        rate_limited: 0,
        meta_server_error: 0,
        pixel_ids_seen: new Set(),
        last_seen_at: null,
      });
      const buckets = new Map<string, Bucket>();
      for (const row of logs ?? []) {
        const key = (row.client_slug as string | null) ?? "__default__";
        let b = buckets.get(key);
        if (!b) {
          b = newBucket();
          buckets.set(key, b);
        }
        b.total++;
        const status = typeof row.status_code === "number"
          ? row.status_code
          : null;
        if (status !== null && status >= 200 && status < 300) {
          b.success++;
        } else {
          b.non_2xx++;
          const failure = classifyMetaError(status ?? 0, row.response);
          if (
            failure.class === "token_invalid_or_revoked" ||
            failure.class === "pixel_token_mismatch" ||
            failure.class === "token_permission_denied"
          ) {
            b.token_failure++;
          } else if (failure.class === "rate_limited") {
            b.rate_limited++;
          } else if (failure.class === "meta_server_error") {
            b.meta_server_error++;
          } else if (
            failure.class === "meta_rejected_payload" ||
            failure.class === "unknown_failure"
          ) {
            b.meta_reject++;
          }
        }
        if (typeof row.pixel_id === "string") {
          b.pixel_ids_seen.add(row.pixel_id);
        }
        if (!b.last_seen_at || (row.fired_at as string) > b.last_seen_at) {
          b.last_seen_at = row.fired_at as string;
        }
      }

      // 4. Per-client classification.
      const maskPixel = (p: string | null) => (p ? `…${p.slice(-4)}` : null);

      const summarizeClient = (
        slug: string,
        is_active: boolean,
        expected_pixel: string | null,
        token_present: boolean,
        config_present: boolean,
      ) => {
        const b = buckets.get(slug);
        const total = b?.total ?? 0;
        const success = b?.success ?? 0;
        const non_2xx = b?.non_2xx ?? 0;
        const errPct = total > 0 ? non_2xx / total : 0;

        // Determine dominant route from observed pixel_ids vs expected.
        let dominant_route: "client" | "default" | "mixed" | "unknown" =
          "unknown";
        let recent_fallback_count = 0;
        if (b && b.pixel_ids_seen.size > 0) {
          const seen = [...b.pixel_ids_seen];
          const matchesExpected = expected_pixel
            ? seen.filter((p) => p === expected_pixel)
            : [];
          const others = seen.filter((p) => p !== expected_pixel);
          if (
            expected_pixel && matchesExpected.length > 0 && others.length === 0
          ) {
            dominant_route = "client";
          } else if (!expected_pixel || matchesExpected.length === 0) {
            dominant_route = "default";
            recent_fallback_count = total;
          } else {
            dominant_route = "mixed";
            // crude approximation: rows attributed to non-expected pixel
            recent_fallback_count = Math.max(0, total - matchesExpected.length);
          }
        }

        // Classify health.
        let health_state: "healthy" | "warning" | "incident";
        let suspected_issue_class: string;
        let recommended_next_step: string;

        if (!is_active) {
          health_state = "warning";
          suspected_issue_class = "client_inactive";
          recommended_next_step =
            "Client is inactive — traffic falls to default. Re-run go-live gate before enabling.";
        } else if (!config_present) {
          health_state = "incident";
          suspected_issue_class = "config_missing";
          recommended_next_step =
            "Active client has no meta_configurations row. Run create_meta_client_config.";
        } else if (!expected_pixel || !token_present) {
          health_state = "incident";
          suspected_issue_class = "config_incomplete";
          recommended_next_step =
            "Config row missing pixel_id or access_token. Re-run create_meta_client_config.";
        } else if (total === 0) {
          health_state = "warning";
          suspected_issue_class = "no_recent_traffic";
          recommended_next_step =
            `No production events in last ${hours}h. Confirm caller traffic; run preview_meta_route + smoke_send_meta_event.`;
        } else if (b!.token_failure > 0) {
          health_state = "incident";
          suspected_issue_class = "token_failure";
          recommended_next_step =
            "Token rejected by Meta. Run diagnose_token_health, then rotate via create_meta_client_config.";
        } else if (dominant_route === "default" || dominant_route === "mixed") {
          health_state = "incident";
          suspected_issue_class = "unexpected_fallback";
          recommended_next_step =
            "Live traffic hitting non-expected pixel. Run preview_meta_route. See CAPI_PRODUCTION_RECOVERY_RUNBOOK §3.";
        } else if (errPct >= 0.05) {
          health_state = "incident";
          suspected_issue_class = b!.meta_reject > 0
            ? "meta_reject"
            : "elevated_errors";
          recommended_next_step =
            "Non-2xx rate ≥5%. Inspect Edge Function logs + capi_signal_logs.response for this slug.";
        } else if (
          errPct >= 0.01 || b!.rate_limited > 0 || b!.meta_server_error > 0
        ) {
          health_state = "warning";
          suspected_issue_class = b!.rate_limited > 0
            ? "rate_limited"
            : (b!.meta_server_error > 0 ? "meta_transient" : "elevated_errors");
          recommended_next_step =
            "Non-2xx rate 1–5% or transient Meta errors. Watch per CAPI_POST_LAUNCH_WATCHTOWER §4.3.";
        } else {
          health_state = "healthy";
          suspected_issue_class = "none";
          recommended_next_step =
            "No action required. Continue scheduled watchtower checks.";
        }

        return {
          client_slug: slug,
          is_active,
          config_present,
          expected_pixel_masked: maskPixel(expected_pixel),
          token_present,
          health_state,
          dominant_route,
          recent_total_count: total,
          recent_success_count: success,
          recent_non_2xx_count: non_2xx,
          recent_fallback_count,
          recent_token_failure_count: b?.token_failure ?? 0,
          recent_meta_reject_count: b?.meta_reject ?? 0,
          recent_rate_limited_count: b?.rate_limited ?? 0,
          recent_meta_server_error_count: b?.meta_server_error ?? 0,
          last_seen_at: b?.last_seen_at ?? null,
          suspected_issue_class,
          recommended_next_step,
        };
      };

      // deno-lint-ignore no-explicit-any
      const clientRows = (clients ?? []).map((c: any) => {
        const cfg = cfgByClientId.get(c.id);
        return summarizeClient(
          c.slug,
          c.is_active === true,
          cfg?.pixel_id ?? null,
          cfg?.token_present ?? false,
          !!cfg,
        );
      });

      // 5. Default tier summary (NULL client_slug rows).
      const defaultBucket = buckets.get("__default__");
      const defaultTotal = defaultBucket?.total ?? 0;
      const defaultSuccess = defaultBucket?.success ?? 0;
      const defaultNon2xx = defaultBucket?.non_2xx ?? 0;
      const defaultErrPct = defaultTotal > 0 ? defaultNon2xx / defaultTotal : 0;
      let defaultHealth: "healthy" | "warning" | "incident";
      let defaultIssue: string;
      let defaultNextStep: string;
      if (!defaultPixelId || !defaultTokenPresent) {
        defaultHealth = "incident";
        defaultIssue = "default_config_incomplete";
        defaultNextStep =
          "Default tier missing pixel_id or access_token. This breaks every fallback. Repair immediately.";
      } else if (defaultBucket && defaultBucket.token_failure > 0) {
        defaultHealth = "incident";
        defaultIssue = "token_failure";
        defaultNextStep =
          "Default token rejected. Rotate via create_meta_client_config (is_default = true).";
      } else if (defaultErrPct >= 0.05) {
        defaultHealth = "incident";
        defaultIssue = "elevated_errors";
        defaultNextStep =
          "Default tier non-2xx ≥5%. Inspect logs + recovery runbook §3.";
      } else if (defaultErrPct >= 0.01) {
        defaultHealth = "warning";
        defaultIssue = "elevated_errors";
        defaultNextStep = "Default tier non-2xx 1–5%. Monitor.";
      } else {
        defaultHealth = "healthy";
        defaultIssue = "none";
        defaultNextStep = "Default tier healthy.";
      }

      const defaultSummary = {
        tier: "default" as const,
        config_present: !!defaultPixelId,
        expected_pixel_masked: maskPixel(defaultPixelId),
        token_present: defaultTokenPresent,
        health_state: defaultHealth,
        recent_total_count: defaultTotal,
        recent_success_count: defaultSuccess,
        recent_non_2xx_count: defaultNon2xx,
        recent_token_failure_count: defaultBucket?.token_failure ?? 0,
        recent_meta_reject_count: defaultBucket?.meta_reject ?? 0,
        last_seen_at: defaultBucket?.last_seen_at ?? null,
        suspected_issue_class: defaultIssue,
        recommended_next_step: defaultNextStep,
      };

      // 6. Fleet roll-up.
      const stateCounts = clientRows.reduce(
        (acc, r) => {
          acc[r.health_state]++;
          return acc;
        },
        { healthy: 0, warning: 0, incident: 0 } as Record<string, number>,
      );

      return successResponse({
        data: {
          window_hours: hours,
          window_start: sinceIso,
          generated_at: new Date().toISOString(),
          fleet_summary: {
            client_count: clientRows.length,
            healthy: stateCounts.healthy,
            warning: stateCounts.warning,
            incident: stateCounts.incident,
            total_events_observed: (logs ?? []).length,
          },
          default_tier: defaultSummary,
          clients: clientRows.sort((a, b) => {
            const order = { incident: 0, warning: 1, healthy: 2 } as const;
            return order[a.health_state] - order[b.health_state];
          }),
          contract: {
            tokens_returned: false,
            pixel_mask_format: "…last4",
            smoke_traffic_excluded: true,
            data_source: "capi_signal_logs",
          },
        },
      });
    }

    // ─── LEAD WORKSPACE: DETAIL + STATUS + NOTES + TASKS ─────────────

    if (action === "fetch_lead_detail") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }

      // Lead row (canonical)
      const { data: lead, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();
      if (leadErr) throw leadErr;
      if (!lead) return errorResponse(404, "not_found", "Lead not found");

      // Phase 10 — joined human-context payload (single round-trip).
      // Each is best-effort: failure to fetch any one of these must not
      // break the dossier load. Operators always get the lead row.
      // deno-lint-ignore no-explicit-any
      let diagnosis_intake: any = null;
      try {
        const { data } = await supabaseAdmin
          .from("diagnosis_intakes")
          .select(
            "primary_diagnosis, secondary_clarifiers, other_text, window_intelligence, counter_offer, prescription_path, confidence, created_at",
          )
          .eq("lead_id", lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        diagnosis_intake = data ?? null;
      } catch (e) {
        console.warn("[fetch_lead_detail] diagnosis_intakes fetch failed", e);
      }

      // deno-lint-ignore no-explicit-any
      let latest_opportunity: any = null;
      // deno-lint-ignore no-explicit-any
      let latest_route: any = null;
      try {
        const { data: opp } = await supabaseAdmin
          .from("contractor_opportunities")
          .select("*")
          .eq("lead_id", lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latest_opportunity = opp ?? null;

        if (latest_opportunity?.id) {
          const { data: route } = await supabaseAdmin
            .from("contractor_opportunity_routes")
            .select("*, contractors:contractor_id(company_name)")
            .eq("opportunity_id", latest_opportunity.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (route) {
            latest_route = {
              ...route,
              contractor_company_name:
                // deno-lint-ignore no-explicit-any
                (route as any).contractors?.company_name ?? null,
            };
            delete latest_route.contractors;
          }
        }
      } catch (e) {
        console.warn("[fetch_lead_detail] opportunity/route fetch failed", e);
      }

      return successResponse({
        data: {
          ...lead,
          diagnosis_intake,
          latest_opportunity,
          latest_route,
        },
      });
    }

    if (action === "update_lead_human_context") {
      const {
        lead_id,
        property_type_detail,
        hoa_or_condo_complexity,
        handoff_consent_status,
      } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }

      const ALLOWED_PROPERTY = new Set([
        "single_family",
        "condo",
        "townhouse_villa",
        "high_rise",
        "multifamily_investment",
      ]);
      const ALLOWED_HOA = new Set([
        "none",
        "hoa_simple",
        "hoa_complex",
        "high_rise_engineering",
        "unknown",
      ]);
      const ALLOWED_CONSENT = new Set([
        "accepted_today",
        "accepted_tomorrow",
        "text_or_email_first",
        "report_only",
        "unknown",
      ]);

      const update: Record<string, unknown> = { updated_at: now };
      if (property_type_detail !== undefined) {
        if (
          property_type_detail !== null &&
          !ALLOWED_PROPERTY.has(property_type_detail)
        ) {
          return errorResponse(
            400,
            "invalid_value",
            "invalid property_type_detail",
          );
        }
        update.property_type_detail = property_type_detail;
      }
      if (hoa_or_condo_complexity !== undefined) {
        if (
          hoa_or_condo_complexity !== null &&
          !ALLOWED_HOA.has(hoa_or_condo_complexity)
        ) {
          return errorResponse(
            400,
            "invalid_value",
            "invalid hoa_or_condo_complexity",
          );
        }
        update.hoa_or_condo_complexity = hoa_or_condo_complexity;
      }
      if (handoff_consent_status !== undefined) {
        if (
          handoff_consent_status !== null &&
          !ALLOWED_CONSENT.has(handoff_consent_status)
        ) {
          return errorResponse(
            400,
            "invalid_value",
            "invalid handoff_consent_status",
          );
        }
        update.handoff_consent_status = handoff_consent_status;
      }

      const { data, error } = await supabaseAdmin
        .from("leads")
        .update(update)
        .eq("id", lead_id)
        .select(
          "id, property_type_detail, hoa_or_condo_complexity, handoff_consent_status, updated_at",
        )
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse(404, "not_found", "Lead not found");

      await supabaseAdmin.from("lead_events").insert({
        lead_id,
        event_name: "human_context_updated",
        event_source: "admin_console",
        metadata: { actor: userId, ...update },
      });

      return successResponse({ data });
    }

    if (action === "update_lead_funnel_stage") {
      const { lead_id, funnel_stage } = payload;
      if (!lead_id || !funnel_stage) {
        return errorResponse(
          400,
          "missing_param",
          "lead_id and funnel_stage are required",
        );
      }
      if (!ALLOWED_FUNNEL_STAGES.has(funnel_stage)) {
        return errorResponse(
          400,
          "invalid_stage",
          `funnel_stage must be one of: ${
            [...ALLOWED_FUNNEL_STAGES].join(", ")
          }`,
        );
      }
      const { data, error } = await supabaseAdmin
        .from("leads")
        .update({ funnel_stage, updated_at: now })
        .eq("id", lead_id)
        .select("id, funnel_stage, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse(404, "not_found", "Lead not found");

      // Audit trail in lead_events
      await supabaseAdmin.from("lead_events").insert({
        lead_id,
        event_name: "funnel_stage_changed",
        event_source: "admin_console",
        metadata: { funnel_stage, actor: userId },
      });

      return successResponse({ data });
    }

    if (action === "list_lead_notes") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }
      const { data, error } = await supabaseAdmin
        .from("lead_notes")
        .select("*")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return successResponse({ data: data ?? [] });
    }

    if (action === "create_lead_note") {
      const { lead_id, body: noteBody, category } = payload;
      if (!lead_id || !noteBody || typeof noteBody !== "string") {
        return errorResponse(
          400,
          "missing_param",
          "lead_id and body are required",
        );
      }
      const trimmed = noteBody.trim();
      if (trimmed.length === 0 || trimmed.length > 4000) {
        return errorResponse(
          400,
          "invalid_body",
          "Note body must be 1–4000 characters",
        );
      }
      if (category && !ALLOWED_NOTE_CATEGORIES.has(category)) {
        return errorResponse(400, "invalid_category", "Invalid category");
      }

      // Resolve actor email (best-effort)
      const { data: actor } = await supabaseAdmin.auth.admin.getUserById(
        userId,
      );
      const actorEmail = actor?.user?.email ?? null;

      const { data, error } = await supabaseAdmin
        .from("lead_notes")
        .insert({
          lead_id,
          body: trimmed,
          category: category ?? "general",
          created_by: userId,
          created_by_email: actorEmail,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "delete_lead_note") {
      const { note_id } = payload;
      if (!note_id) {
        return errorResponse(400, "missing_param", "note_id is required");
      }
      const { error } = await supabaseAdmin.from("lead_notes").delete().eq(
        "id",
        note_id,
      );
      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    if (action === "list_lead_tasks") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }
      const { data, error } = await supabaseAdmin
        .from("lead_tasks")
        .select("*")
        .eq("lead_id", lead_id)
        .order("completed", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return successResponse({ data: data ?? [] });
    }

    if (action === "create_lead_task") {
      const { lead_id, title, details, due_at } = payload;
      if (!lead_id || !title || typeof title !== "string") {
        return errorResponse(
          400,
          "missing_param",
          "lead_id and title are required",
        );
      }
      const trimmedTitle = title.trim();
      if (trimmedTitle.length === 0 || trimmedTitle.length > 200) {
        return errorResponse(
          400,
          "invalid_title",
          "Title must be 1–200 characters",
        );
      }
      if (details && (typeof details !== "string" || details.length > 4000)) {
        return errorResponse(
          400,
          "invalid_details",
          "Details must be ≤4000 characters",
        );
      }
      if (due_at && typeof due_at !== "string") {
        return errorResponse(
          400,
          "invalid_due_at",
          "due_at must be an ISO string",
        );
      }

      const { data: actor } = await supabaseAdmin.auth.admin.getUserById(
        userId,
      );
      const actorEmail = actor?.user?.email ?? null;

      const { data, error } = await supabaseAdmin
        .from("lead_tasks")
        .insert({
          lead_id,
          title: trimmedTitle,
          details: details?.trim() || null,
          due_at: due_at || null,
          created_by: userId,
          created_by_email: actorEmail,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "update_lead_task") {
      const { task_id, completed, title, details, due_at } = payload;
      if (!task_id) {
        return errorResponse(400, "missing_param", "task_id is required");
      }
      const patch: Record<string, unknown> = { updated_at: now };
      if (typeof completed === "boolean") {
        patch.completed = completed;
        patch.completed_at = completed ? now : null;
        patch.completed_by = completed ? userId : null;
      }
      if (typeof title === "string") {
        const t = title.trim();
        if (t.length === 0 || t.length > 200) {
          return errorResponse(
            400,
            "invalid_title",
            "Title must be 1–200 characters",
          );
        }
        patch.title = t;
      }
      if (typeof details === "string") patch.details = details.trim() || null;
      if (typeof due_at !== "undefined") patch.due_at = due_at || null;

      const { data, error } = await supabaseAdmin
        .from("lead_tasks")
        .update(patch)
        .eq("id", task_id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse(404, "not_found", "Task not found");
      return successResponse({ data });
    }

    if (action === "delete_lead_task") {
      const { task_id } = payload;
      if (!task_id) {
        return errorResponse(400, "missing_param", "task_id is required");
      }
      const { error } = await supabaseAdmin.from("lead_tasks").delete().eq(
        "id",
        task_id,
      );
      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    // ─── PHASE 26 — TRUTH STRIP DRILLDOWN ────────────────────────────
    // Forensic surface for the Mission Control Truth Strip. Read-only.
    // Mirrors the exact quote-file resolution path used by fetch_needs_review:
    //   leads.id -> quote_files.lead_id (latest by created_at) -> storage signed URL.
    // Storage bucket "quotes" — already private; we only mint a 1h signed URL.

    if (action === "fetch_quote_evidence") {
      const { lead_id } = payload;
      if (!lead_id) {
        return errorResponse(400, "missing_param", "lead_id is required");
      }

      // Pull the lead's latest scan session (for the operator's context only)
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("latest_scan_session_id")
        .eq("id", lead_id)
        .maybeSingle();

      const scan_session_id = lead?.latest_scan_session_id ?? null;

      // Resolve the latest quote_file for this lead — column set verified:
      // (id, created_at, lead_id, storage_path, status). No filename column on
      // this table, so file_name is intentionally null.
      const { data: file } = await supabaseAdmin
        .from("quote_files")
        .select("id, storage_path, created_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!file?.storage_path) {
        return successResponse({
          data: {
            signed_url: null,
            file_name: null,
            scan_session_id,
            expires_in: 3600,
          },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const storageClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: signed } = await storageClient.storage
        .from("quotes")
        .createSignedUrl(file.storage_path, 3600);

      return successResponse({
        data: {
          signed_url: signed?.signedUrl ?? null,
          file_name: null,
          scan_session_id,
          expires_in: 3600,
        },
      });
    }

    if (action === "fetch_stage_leads") {
      const { stage, scope, limit } = payload as {
        stage?: string;
        scope?: string;
        limit?: number;
      };
      if (!stage) {
        return errorResponse(400, "missing_param", "stage is required");
      }
      if (!scope) {
        return errorResponse(400, "missing_param", "scope is required");
      }

      const ALLOWED_STAGES = new Set([
        "captured",
        "verified",
        "scanned",
        "routed",
        "booked",
        "closed",
      ]);
      if (!ALLOWED_STAGES.has(stage)) {
        return errorResponse(400, "invalid_stage", `Unknown stage: ${stage}`);
      }
      if (!["today", "7d", "all"].includes(scope)) {
        return errorResponse(400, "invalid_scope", `Unknown scope: ${scope}`);
      }

      // Compute window
      let sinceIso: string | null = null;
      if (scope === "today") {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        sinceIso = d.toISOString();
      } else if (scope === "7d") {
        sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      const cap = Math.min(
        Math.max(typeof limit === "number" ? limit : 200, 1),
        500,
      );

      // Compact column projection
      const cols = `
        id, first_name, last_name, city, county,
        grade, flag_count, red_flag_count,
        latest_analysis_id, latest_scan_session_id, latest_opportunity_id,
        deal_value, revenue_amount, deal_status,
        created_at, phone_verified_at, updated_at,
        routed_to_contractor_at, appointment_booked_at, closed_at, scan_count
      `;

      let q = supabaseAdmin.from("leads").select(cols).limit(cap);

      // Stage-specific predicates — canonical timestamps only
      if (stage === "captured") {
        if (sinceIso) q = q.gte("created_at", sinceIso);
        q = q.order("created_at", { ascending: false });
      } else if (stage === "verified") {
        q = q.not("phone_verified_at", "is", null);
        if (sinceIso) q = q.gte("phone_verified_at", sinceIso);
        q = q.order("phone_verified_at", { ascending: false });
      } else if (stage === "scanned") {
        // Repo-real Scanned predicate: scan_count > 0 AND updated_at in scope.
        q = q.gt("scan_count", 0);
        if (sinceIso) q = q.gte("updated_at", sinceIso);
        q = q.order("updated_at", { ascending: false });
      } else if (stage === "routed") {
        q = q.not("routed_to_contractor_at", "is", null);
        if (sinceIso) q = q.gte("routed_to_contractor_at", sinceIso);
        q = q.order("routed_to_contractor_at", { ascending: false });
      } else if (stage === "booked") {
        q = q.not("appointment_booked_at", "is", null);
        if (sinceIso) q = q.gte("appointment_booked_at", sinceIso);
        q = q.order("appointment_booked_at", { ascending: false });
      } else if (stage === "closed") {
        q = q.not("closed_at", "is", null)
          .in("deal_status", [
            "won",
            "sold",
            "sold_closed",
            "closed_won",
            "closed",
          ]);
        if (sinceIso) q = q.gte("closed_at", sinceIso);
        q = q.order("closed_at", { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;

      // Tag each row with the stage_timestamp that matched (for UI display)
      // deno-lint-ignore no-explicit-any
      const stamped = (data ?? []).map((l: any) => {
        const ts = stage === "captured"
          ? l.created_at
          : stage === "verified"
          ? l.phone_verified_at
          : stage === "scanned"
          ? l.updated_at
          : stage === "routed"
          ? l.routed_to_contractor_at
          : stage === "booked"
          ? l.appointment_booked_at
          : stage === "closed"
          ? l.closed_at
          : null;
        return { ...l, stage_timestamp: ts };
      });

      return successResponse({ data: { leads: stamped } });
    }

    return errorResponse(
      400,
      "unhandled_action",
      `Action ${action} not implemented`,
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[admin-data] Error:`, errMsg);
    return errorResponse(500, "server_error", "Internal server error");
  }
});
