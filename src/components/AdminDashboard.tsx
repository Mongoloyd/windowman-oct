/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD SNIPER CRM — Admin Dashboard v4.1
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

import { PreviewModeBadge } from "@/components/PreviewModeBadge";
import { CommandCenter } from "@/components/admin/CommandCenter";
import { ActivePipeline } from "@/components/admin/ActivePipeline";
import { GhostRecovery } from "@/components/admin/GhostRecovery";
import { InternalCRMDesk } from "@/components/admin/InternalCRMDesk";
import { NeedsReviewTab, type NeedsReviewLead } from "@/components/admin/NeedsReviewTab";
import { AttributionTab } from "@/components/admin/AttributionTab";
import { ContractorAccountsTab } from "@/components/admin/ContractorAccountsTab";
import { RoutingDesk } from "@/components/admin/RoutingDesk";
import { OneContractorSummaryStrip } from "@/components/admin/OneContractorSummaryStrip";
import { MarketOpsFeed } from "@/components/admin/MarketOpsFeed";
import { PilotReadiness } from "@/components/admin/PilotReadiness";

import {
  invokeAdminData,
  fetchWebhookDeliveries,
} from "@/services/adminDataService";

import type { CRMLead, WebhookDelivery, CommandCenterKPIs, VoiceFollowupSummary } from "@/components/admin/types";

const REFRESH_INTERVAL_MS = 120_000;

/* ── Map raw DB row → CRMLead ────────────────────────────────────────── */

function toLeadCRM(raw: Record<string, any>): CRMLead {
  return {
    id: raw.id,
    session_id: raw.session_id,
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    phone_e164: raw.phone_e164 ?? null,
    county: raw.county ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    zip: raw.zip ?? null,
    grade: raw.grade ?? null,
    grade_score: raw.grade_score ?? null,
    window_count: raw.window_count ?? null,
    quote_amount: raw.quote_amount ?? null,
    phone_verified: raw.phone_verified ?? false,
    phone_verified_at: raw.phone_verified_at ?? null,
    latest_analysis_id: raw.latest_analysis_id ?? null,
    latest_scan_session_id: raw.latest_scan_session_id ?? null,
    latest_opportunity_id: raw.latest_opportunity_id ?? null,
    status: raw.status ?? null,
    funnel_stage: raw.funnel_stage ?? null,
    flag_count: raw.flag_count ?? 0,
    red_flag_count: raw.red_flag_count ?? 0,
    amber_flag_count: raw.amber_flag_count ?? 0,
    critical_flag_count: raw.critical_flag_count ?? 0,
    confidence_score: raw.confidence_score ?? null,
    lead_score: raw.lead_score ?? null,
    scan_count: raw.scan_count ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deal_status: raw.deal_status ?? null,
    last_call_intent: raw.last_call_intent ?? null,
    assigned_partner: "Primary Client",
    project_type: raw.project_type ?? null,
    quote_range: raw.quote_range ?? null,
    utm_source: raw.utm_source ?? null,
    utm_medium: raw.utm_medium ?? null,
    utm_campaign: raw.utm_campaign ?? null,
    gclid: raw.gclid ?? null,
    fbclid: raw.fbclid ?? null,
    landing_page_url: raw.landing_page_url ?? null,
    initial_referrer: raw.initial_referrer ?? null,
    report_unlocked_at: raw.report_unlocked_at ?? null,
    intro_requested_at: raw.intro_requested_at ?? null,
    // Phase 7 — Ownership / Lifecycle (repo-real columns on `leads`)
    routed_to_contractor_at: raw.routed_to_contractor_at ?? null,
    appointment_booked_at: raw.appointment_booked_at ?? null,
    replacement_quote_submitted_at: raw.replacement_quote_submitted_at ?? null,
    closed_at: raw.closed_at ?? null,
    reactivation_email_sent_at: raw.reactivation_email_sent_at ?? null,
    last_call_completed_at: raw.last_call_completed_at ?? null,
    last_call_status: raw.last_call_status ?? null,
    last_call_outcome: raw.last_call_outcome ?? null,
    last_call_summary: raw.last_call_summary ?? null,
  };
}

function toWebhookDelivery(raw: Record<string, any>): WebhookDelivery {
  return {
    id: raw.id,
    lead_id: raw.lead_id,
    event_type: raw.event_type,
    status: raw.status,
    attempt_count: raw.attempt_count ?? 0,
    max_attempts: raw.max_attempts ?? 5,
    last_http_status: raw.last_http_status ?? null,
    last_error: raw.last_error ?? null,
    last_attempt_at: raw.last_attempt_at ?? null,
    next_retry_at: raw.next_retry_at ?? null,
    webhook_url: raw.webhook_url ?? null,
    payload_json: raw.payload_json ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/* ── Compute KPIs ────────────────────────────────────────────────────── */

function computeKPIs(leads: CRMLead[], deliveries: WebhookDelivery[]): CommandCenterKPIs {
  const totalScans = leads.filter((l) => l.latest_analysis_id).length;
  const verifiedLeads = leads.filter((l) => l.phone_verified && l.latest_analysis_id).length;
  const ghostLeads = leads.filter((l) => l.latest_analysis_id && !l.phone_verified).length;

  return {
    totalScans,
    verifiedLeads,
    ghostLeads,
    webhooksPending: deliveries.filter((d) => d.status === "pending").length,
    webhooksDelivered: deliveries.filter((d) => ["delivered", "mock_delivered"].includes(d.status)).length,
    webhooksFailed: deliveries.filter((d) => d.status === "failed").length,
    webhooksDeadLetter: deliveries.filter((d) => d.status === "dead_letter").length,
  };
}

/* ── Dashboard Shell ─────────────────────────────────────────────────── */

function DashboardContent() {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [latestFollowups, setLatestFollowups] = useState<Record<string, VoiceFollowupSummary>>({});
  const [needsReview, setNeedsReview] = useState<NeedsReviewLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0); // force re-render for relative time
  const initialLoadDone = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const isInitial = !initialLoadDone.current;
    try {
      // Tier 1: fetch leads first for fast initial render
      const rawLeads = await invokeAdminData("fetch_leads");
      setLeads((rawLeads ?? []).map(toLeadCRM));

      // Tier 2: fetch remaining data in background (don't block leads render)
      const [rawDeliveries, rawFollowups, rawNeedsReview] = await Promise.all([
        fetchWebhookDeliveries(),
        invokeAdminData("fetch_voice_followups"),
        invokeAdminData("fetch_needs_review"),
      ]);
      setDeliveries((rawDeliveries ?? []).map(toWebhookDelivery));
      setNeedsReview((rawNeedsReview ?? []) as NeedsReviewLead[]);

      // Build latestFollowups map
      const followupsArr = (rawFollowups ?? []) as Array<Record<string, any>>;
      const fMap: Record<string, VoiceFollowupSummary> = {};
      for (const f of followupsArr) {
        const lid = f.lead_id as string;
        if (!lid) continue;
        if (!fMap[lid] || new Date(f.created_at) > new Date(fMap[lid].created_at)) {
          fMap[lid] = {
            lead_id: lid,
            status: f.status ?? "unknown",
            call_outcome: f.call_outcome ?? null,
            created_at: f.created_at,
          };
        }
      }
      setLatestFollowups(fMap);
      setLastSyncedAt(new Date());
    } catch (err: unknown) {
      console.warn("[CRM] fetch error (preview mode):", err);
    } finally {
      if (isInitial) initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  // Tick every 30s to keep "Updated X ago" fresh
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const kpis = computeKPIs(leads, deliveries);
  const ghosts = leads.filter((l) => l.latest_analysis_id && !l.phone_verified);

  const lastSyncLabel = lastSyncedAt
    ? `Updated ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
    : "Loading…";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Lead Sniper CRM</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leads.length} leads · {lastSyncLabel}
              </p>
            </div>
            {leads.length === 0 && initialLoadDone.current && <PreviewModeBadge />}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/settings"
              className="rounded-md p-2 hover:bg-muted transition-colors"
              title="Admin Settings"
            >
              <Settings className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6">
        <Tabs defaultValue="command" className="space-y-6">
          <TabsList className="flex w-full flex-wrap h-auto gap-1 max-w-6xl">
            <TabsTrigger value="command" className="flex-1 min-w-[110px]">Command Center</TabsTrigger>
            <TabsTrigger value="pipeline" className="flex-1 min-w-[110px]">Active Pipeline</TabsTrigger>
            <TabsTrigger value="routing" className="flex-1 min-w-[90px]">Routing</TabsTrigger>
            <TabsTrigger value="ghosts" className="relative flex-1 min-w-[120px]">
              Ghost Recovery
              {ghosts.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px]">
                  {ghosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="needs-review" className="relative flex-1 min-w-[110px]">
              Needs Review
              {needsReview.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground">
                  {needsReview.length > 9 ? "9+" : needsReview.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="engine" className="flex-1 min-w-[100px]">Dialer Desk</TabsTrigger>
            <TabsTrigger value="contractors" className="flex-1 min-w-[110px]">Contractors</TabsTrigger>
            <TabsTrigger value="attribution" className="flex-1 min-w-[100px]">Attribution</TabsTrigger>
            <TabsTrigger value="pilot" className="flex-1 min-w-[120px]">Pilot Readiness</TabsTrigger>
          </TabsList>

          <TabsContent value="command" className="space-y-6">
            <OneContractorSummaryStrip leads={leads} />
            <CommandCenter kpis={kpis} isLoading={false} leads={leads} />
            <MarketOpsFeed leads={leads} />
          </TabsContent>

          <TabsContent value="routing">
            <RoutingDesk leads={leads} />
          </TabsContent>

          <TabsContent value="pipeline">
            <ActivePipeline leads={leads} isLoading={false} />
          </TabsContent>

          <TabsContent value="ghosts">
            <GhostRecovery ghosts={ghosts} isLoading={false} />
          </TabsContent>

          <TabsContent value="needs-review">
            <NeedsReviewTab needsReview={needsReview} isLoading={false} />
          </TabsContent>

          <TabsContent value="engine">
            <InternalCRMDesk
              leads={leads}
              isLoading={false}
              onStatusChange={() => fetchAll()}
              latestFollowups={latestFollowups}
            />
          </TabsContent>

          <TabsContent value="contractors">
            <ContractorAccountsTab />
          </TabsContent>

          <TabsContent value="attribution">
            <AttributionTab leads={leads} isLoading={false} />
          </TabsContent>

          <TabsContent value="pilot" className="w-full px-2 sm:px-6 pt-4">
            <PilotReadiness leads={leads} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ── Exported — renders publicly, data-fetch failures show preview ──── */

export default function AdminDashboard() {
  return <DashboardContent />;
}
