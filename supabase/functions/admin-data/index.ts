import { corsHeaders, errorResponse, successResponse, validateAdminRequestWithRole, type AppRole } from "../_shared/adminAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { diagnoseRoute, dispatchCapiEvent, resolvePixelConfig, type CAPIEvent } from "../capi-event/index.ts";

/**
 * admin-data v2.4
 * Added: list_contractor_accounts, get_contractor_ledger,
 *        adjust_contractor_credits, get_contractor_unlocks
 */

type ActionName = 
  | "fetch_leads" | "update_lead_status" | "update_lead_deal_status"
  | "fetch_opportunities" | "fetch_contractors" | "fetch_routes" | "fetch_billable"
  | "route_opportunity" | "mark_dead"
  | "fetch_voice_followups" | "fetch_lead_voice_followups" | "trigger_voice_followup"
  | "manage_user_roles" | "list_user_roles" | "get_role_audit_log"
  | "fetch_lead_events" | "fetch_webhook_deliveries"
  | "fetch_lead_analysis"
  | "fetch_needs_review" | "rescan_lead" | "update_lead_manual_entry"
  | "list_contractor_accounts" | "get_contractor_ledger"
  | "adjust_contractor_credits" | "get_contractor_unlocks"
  | "list_invitations" | "create_invitation" | "revoke_invitation"
  // CAPI control-plane (Meta multi-pixel routing)
  | "list_meta_configurations" | "create_meta_client_config"
  | "set_meta_client_active"   | "preview_meta_route"
  | "smoke_send_meta_event";

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
  set_meta_client_active:    ["super_admin"],
  preview_meta_route:        ["super_admin", "operator", "viewer"],
  smoke_send_meta_event:     ["super_admin"],
};

// ── CAPI helpers ────────────────────────────────────────────────────────────
// Token redaction so admin reads never leak access tokens.
function redactToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = String(token);
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PIXEL_RE = /^[0-9]{6,20}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Use POST");

  try {
    const body = await req.json();
    const { action, payload = {} } = body;
    const requiredRoles = ACTION_ROLES[action as ActionName];

    if (!requiredRoles) return errorResponse(400, "invalid_action", `Unknown action: ${action}`);

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
      const { data, error } = await supabaseAdmin.from("contractor_opportunities").select("*").order("priority_score", { ascending: false });
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_contractors") {
      const { data, error } = await supabaseAdmin.from("contractors").select("*").eq("status", "active");
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_routes") {
      const { opportunity_id } = payload;
      let query = supabaseAdmin.from("contractor_opportunity_routes").select("*").order("created_at", { ascending: false });
      if (opportunity_id) query = query.eq("opportunity_id", opportunity_id);
      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "fetch_billable") {
      const { data: intros, error: e1 } = await supabaseAdmin.from("billable_intros").select("*").order("created_at", { ascending: false });
      const { data: outcomes, error: e2 } = await supabaseAdmin.from("contractor_outcomes").select("*");
      if (e1 || e2) throw e1 || e2;
      return successResponse({ intros, outcomes, data: { intros, outcomes } });
    }

    if (action === "fetch_voice_followups") {
      const { data, error } = await supabaseAdmin.from("voice_followups").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return successResponse({ data: data });
    }

    if (action === "fetch_lead_voice_followups") {
      const { lead_id } = payload;
      if (!lead_id) return errorResponse(400, "missing_param", "lead_id is required");
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
        .select("id, analysis_status, confidence_score, full_json, lead_id, scan_session_id")
        .or("analysis_status.eq.invalid_document,analysis_status.eq.needs_better_upload,confidence_score.lt.0.70")
        .not("lead_id", "is", null)
        .order("created_at", { ascending: false });

      const failedLeadIds = (failedAnalyses ?? []).map((a: any) => a.lead_id).filter(Boolean);

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

        failedLeads = (leads ?? []).map((lead: any) => {
          const analysis = (failedAnalyses ?? []).find((a: any) => a.lead_id === lead.id);
          const isFailed = analysis?.analysis_status === "invalid_document" || analysis?.analysis_status === "needs_better_upload";
          return {
            ...lead,
            review_reason: isFailed ? "parse_failed" : "low_confidence",
            analysis_status: analysis?.analysis_status ?? null,
            confidence_score: analysis?.confidence_score ?? null,
            analysis_error: (analysis?.full_json as any)?.error ?? null,
            full_json: analysis?.full_json ?? null,
            quote_image_url: null,
          };
        });
      }

      // Merge + deduplicate
      const allLeadIds = new Set<string>();
      const merged = [...taggedNoAnalysis, ...failedLeads]
        .filter((lead: any) => {
          if (allLeadIds.has(lead.id)) return false;
          allLeadIds.add(lead.id);
          return true;
        })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Generate signed URLs for quote images
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const storageClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const sessionIds = merged
        .map((l: any) => l.latest_scan_session_id)
        .filter(Boolean);

      if (sessionIds.length > 0) {
        const { data: sessions } = await supabaseAdmin
          .from("scan_sessions")
          .select("id, quote_file_id")
          .in("id", sessionIds);

        const fileIds = (sessions ?? [])
          .map((s: any) => s.quote_file_id)
          .filter(Boolean);

        let fileMap: Record<string, string> = {};
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
      if (!lead_id) return errorResponse(400, "missing_param", "lead_id required");

      const { data: lead, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("latest_scan_session_id")
        .eq("id", lead_id)
        .single();

      if (leadErr || !lead?.latest_scan_session_id) {
        return errorResponse(400, "no_session", "No scan session found for this lead");
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
        return errorResponse(500, "rescan_failed", err.error ?? `scan-quote returned ${scanResp.status}`);
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
      const { error } = await supabaseAdmin.from("leads").update({ status, updated_at: now }).eq("id", lead_id);
      if (error) throw error;
      return successResponse({ data: { success: true } });
    }

    if (action === "update_lead_deal_status") {
      const { lead_id, deal_status } = payload;
      if (!lead_id || !deal_status) return errorResponse(400, "missing_param", "lead_id and deal_status are required");
      const { error } = await supabaseAdmin.from("leads").update({ deal_status, updated_at: now }).eq("id", lead_id);
      if (error) throw error;
      await supabaseAdmin.from("lead_events").insert({
        lead_id, event_name: "deal_status_changed", event_source: "admin_crm",
        metadata: { deal_status, changed_by: userId, timestamp: now },
      });
      return successResponse({ data: { success: true } });
    }

    if (action === "route_opportunity") {
      const { opportunity_id, contractor_id, scan_session_id } = payload;
      
      const { error: routeErr } = await supabaseAdmin.from("contractor_opportunity_routes").insert({
        opportunity_id, contractor_id, route_status: "sent", sent_at: now, assigned_by: "operator", routing_reason: "manual_assignment",
      });
      if (routeErr) throw routeErr;

      await supabaseAdmin.from("contractor_opportunities").update({ status: "sent_to_contractor", routed_at: now }).eq("id", opportunity_id);

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
      await supabaseAdmin.from("contractor_opportunities").update({ status: "dead" }).eq("id", opportunity_id);

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
      const { data, error } = await supabaseAdmin.functions.invoke("voice-followup", {
        body: { scan_session_id, phone_e164, opportunity_id, call_intent: "manual_admin_trigger" },
      });
      if (error) throw error;
      return successResponse({ data: { success: true, invokeResult: data } });

    }

    if (action === "manage_user_roles") {
      const { target_user_id, new_role } = payload;
      if (target_user_id === userId && new_role !== "super_admin") throw new Error("Self-demotion blocked.");
      const { error } = await supabaseAdmin.from("user_roles").upsert({ id: target_user_id, role: new_role, updated_at: now });
      if (error) throw error;
      await supabaseAdmin.from("user_role_audit_log").insert({ target_user_id, changed_by_user_id: userId, new_role, action: "change" });
      return successResponse({ data: { success: true } });
    }

    if (action === "list_user_roles") {
      const { data: roles, error } = await supabaseAdmin.from("user_roles").select("*");
      if (error) throw error;

      const roleRows = roles ?? [];
      const userIds: string[] = roleRows.map((r: { id: string }) => r.id);

      const authInfoMap = new Map<string, { email: string; last_sign_in: string | null }>();
      await Promise.all(
        userIds.map(async (uid) => {
          const { data: authData, error: uidErr } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (!uidErr && authData?.user) {
            authInfoMap.set(uid, {
              email: authData.user.email ?? "",
              last_sign_in: authData.user.last_sign_in_at ?? null,
            });
          }
        })
      );

      const enriched = roleRows.map((r: { id: string; role: string; updated_at?: string }) => ({
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
      const limit = Math.min(500, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100));

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
          const { data: authData, error: uidErr } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (!uidErr && authData?.user?.email) {
            emailMap.set(uid, authData.user.email);
          }
        })
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
        changed_by_email: emailMap.get(e.changed_by_user_id) ?? e.changed_by_user_id,
      }));

      return successResponse({ data: { entries: enriched } });
    }

    // ─── CRM: LEAD EVENTS ─────────────────────────────────────────────

    if (action === "fetch_lead_events") {
      const { lead_id, limit: rawLimit } = payload;
      if (!lead_id) return errorResponse(400, "missing_param", "lead_id is required");
      const limit = Math.min(200, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 50));
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
      const limit = Math.min(500, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 200));
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
      if (!analysis_id) return errorResponse(400, "missing_param", "analysis_id is required");
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

      const profileIds = (profiles ?? []).map((p: any) => p.id);

      // Fetch credits
      let creditsMap: Record<string, number> = {};
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
      let unlockCountMap: Record<string, number> = {};
      if (profileIds.length > 0) {
        const { data: unlocks } = await supabaseAdmin
          .from("contractor_unlocked_leads")
          .select("contractor_id");
        // Count per contractor
        for (const u of unlocks ?? []) {
          unlockCountMap[u.contractor_id] = (unlockCountMap[u.contractor_id] || 0) + 1;
        }
      }

      // Fetch auth bridge from contractors table
      let authBridgeMap: Record<string, { contractor_record_id: string; company_name: string } | null> = {};
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
      const authEmailMap = new Map<string, { email: string; last_sign_in: string | null }>();
      await Promise.all(
        profileIds.map(async (uid: string) => {
          const { data: authData, error: uidErr } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (!uidErr && authData?.user) {
            authEmailMap.set(uid, {
              email: authData.user.email ?? "",
              last_sign_in: authData.user.last_sign_in_at ?? null,
            });
          }
        })
      );

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
        routing_setup_completed_at: authBridgeMap[p.id]?.routing_setup_completed_at ?? null,
      }));

      return successResponse({ data: enriched });
    }

    if (action === "get_contractor_ledger") {
      const { contractor_id, limit: rawLimit } = payload;
      if (!contractor_id) return errorResponse(400, "missing_param", "contractor_id is required");
      const limit = Math.min(500, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100));

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
      if (!contractor_id) return errorResponse(400, "missing_param", "contractor_id is required");
      if (!delta || typeof delta !== "number") return errorResponse(400, "missing_param", "delta (non-zero integer) is required");
      if (!entry_type) return errorResponse(400, "missing_param", "entry_type is required");

      const { data, error } = await supabaseAdmin.rpc("admin_adjust_contractor_credits", {
        p_contractor_id: contractor_id,
        p_delta: delta,
        p_entry_type: entry_type,
        p_notes: notes ?? null,
        p_admin_user_id: userId === "dev-sandbox-bypass" ? null : userId,
      });
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "get_contractor_unlocks") {
      const { contractor_id, limit: rawLimit } = payload;
      if (!contractor_id) return errorResponse(400, "missing_param", "contractor_id is required");
      const limit = Math.min(500, Math.max(1, Number.isInteger(rawLimit) ? rawLimit : 100));

      const { data: unlocks, error } = await supabaseAdmin
        .from("contractor_unlocked_leads")
        .select("id, contractor_id, lead_id, unlocked_at")
        .eq("contractor_id", contractor_id)
        .order("unlocked_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      // Enrich with basic lead info
      const leadIds = (unlocks ?? []).map((u: any) => u.lead_id);
      let leadMap: Record<string, any> = {};
      if (leadIds.length > 0) {
        const { data: leads } = await supabaseAdmin
          .from("leads")
          .select("id, first_name, last_name, county, grade, window_count, quote_amount")
          .in("id", leadIds);
        for (const l of leads ?? []) {
          leadMap[l.id] = l;
        }
      }

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
      const { invited_email, contractor_id, initial_credits, expires_in_days } = payload;
      if (!invited_email || !contractor_id) {
        return errorResponse(400, "missing_param", "invited_email and contractor_id are required");
      }

      // Verify contractor exists
      const { data: contractor } = await supabaseAdmin
        .from("contractors")
        .select("id, company_name")
        .eq("id", contractor_id)
        .maybeSingle();

      if (!contractor) {
        return errorResponse(404, "contractor_not_found", "Contractor business record not found");
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
      if (!invitation_id) return errorResponse(400, "missing_param", "invitation_id is required");

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
        .select("id, client_id, pixel_id, access_token, test_event_code, is_default, updated_at")
        .order("is_default", { ascending: false })
        .order("updated_at",  { ascending: false });
      if (error) throw error;

      const { data: clients } = await supabaseAdmin
        .from("clients")
        .select("id, slug, name, is_active");
      const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]));

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
        client_slug, client_name,
        pixel_id, access_token, test_event_code = null,
      } = payload ?? {};

      if (typeof client_slug !== "string" || !SLUG_RE.test(client_slug)) {
        return errorResponse(400, "invalid_slug",
          "client_slug must be 1-40 chars, lowercase a-z, 0-9, hyphens.");
      }
      if (typeof client_name !== "string" || client_name.trim().length < 2) {
        return errorResponse(400, "invalid_name", "client_name is required (min 2 chars).");
      }
      if (typeof pixel_id !== "string" || !PIXEL_RE.test(pixel_id)) {
        return errorResponse(400, "invalid_pixel_id",
          "pixel_id must be a 6-20 digit Meta Pixel ID.");
      }
      if (typeof access_token !== "string" || access_token.trim().length < 20) {
        return errorResponse(400, "invalid_token",
          "access_token must be a non-empty Meta CAPI token (min 20 chars).");
      }

      // Upsert client (slug is unique).
      const { data: existingClient } = await supabaseAdmin
        .from("clients").select("id, name, is_active").eq("slug", client_slug).maybeSingle();

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id;
        if (existingClient.name !== client_name || existingClient.is_active !== true) {
          await supabaseAdmin.from("clients")
            .update({ name: client_name, is_active: true })
            .eq("id", clientId);
        }
      } else {
        const { data: newClient, error: cErr } = await supabaseAdmin
          .from("clients")
          .insert({ slug: client_slug, name: client_name, is_active: true })
          .select("id").single();
        if (cErr) return errorResponse(400, "client_insert_failed", cErr.message);
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
          .from("meta_configurations").update(cfgPayload).eq("id", existingCfg.id);
        if (uErr) return errorResponse(400, "config_update_failed", uErr.message);
      } else {
        const { error: iErr } = await supabaseAdmin
          .from("meta_configurations").insert(cfgPayload);
        if (iErr) return errorResponse(400, "config_insert_failed", iErr.message);
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
      if (!data)  return errorResponse(404, "client_not_found", `No client with slug "${client_slug}".`);
      return successResponse({ data: { success: true, client: data } });
    }

    // Dry-run: delegates to diagnoseRoute() which wraps the canonical
    // resolvePixelConfig() used by capi-event. Preview NEVER calls Meta and
    // NEVER writes to capi_signal_logs. Reasons are stable enums (see
    // RouteDiagnostic in capi-event/index.ts).
    if (action === "preview_meta_route") {
      const { client_slug } = payload ?? {};
      const slug = typeof client_slug === "string" && client_slug.length > 0 ? client_slug : undefined;

      // Validate slug shape only when present — empty/missing is a valid
      // "preview the global default tier" request.
      if (slug && !SLUG_RE.test(slug)) {
        return errorResponse(400, "invalid_slug", "client_slug must match [a-z0-9-]{1,40}.");
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

    return errorResponse(400, "unhandled_action", `Action ${action} not implemented`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[admin-data] Error:`, errMsg);
    return errorResponse(500, "server_error", "Internal server error");
  }
});
