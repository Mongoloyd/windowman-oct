/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD SNIPER CRM — Admin Dashboard v4.1
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminPrimaryTabs } from "@/components/admin/shell/AdminPrimaryTabs";

import { PreviewModeBadge } from "@/components/PreviewModeBadge";
// Phase 26 — legacy <CommandCenter /> removed. Canonical Mission Control
// engine is <MasterCommandCenter />. The legacy file is kept on disk as
// @deprecated for archaeology but is no longer imported anywhere.
import { MasterCommandCenter } from "@/components/admin/MasterCommandCenter";
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
import { PilotOpsLaunchControl } from "@/components/admin/PilotOpsLaunchControl";
import { OutcomeTrackingReport } from "@/components/admin/OutcomeTrackingReport";
import { ContractorOnboardingSurface } from "@/components/admin/ContractorOnboardingSurface";
import { OperatorReportingSurface } from "@/components/admin/OperatorReportingSurface";
import { DeadStaleRecoveryWorkflowSurface } from "@/components/admin/DeadStaleRecoveryWorkflowSurface";
import { ContractorFeedbackLoopSurface } from "@/components/admin/ContractorFeedbackLoopSurface";
import { SharedMarketManualControlsSurface } from "@/components/admin/SharedMarketManualControlsSurface";
import { ClientFacingReportingPrepSurface } from "@/components/admin/ClientFacingReportingPrepSurface";
import { PilotToPlatformAuditSurface } from "@/components/admin/PilotToPlatformAuditSurface";
import { LaunchReadinessSurface } from "@/components/admin/LaunchReadinessSurface";
import { OperatorTrainingSOPSurface } from "@/components/admin/OperatorTrainingSOPSurface";
import { RolloutPlanningReadinessSurface } from "@/components/admin/RolloutPlanningReadinessSurface";
import { DataQualityFieldIntegritySurface } from "@/components/admin/DataQualityFieldIntegritySurface";
import { ExceptionHandlingManualEscalationSurface } from "@/components/admin/ExceptionHandlingManualEscalationSurface";
import { DocumentationHandoffReadinessSurface } from "@/components/admin/DocumentationHandoffReadinessSurface";
import { PostPilotLearningsDecisionSupportSurface } from "@/components/admin/PostPilotLearningsDecisionSupportSurface";
import { ChangeManagementSafeUpdateReadinessSurface } from "@/components/admin/ChangeManagementSafeUpdateReadinessSurface";
import { MinimumViableGovernanceDecisionBoundariesSurface } from "@/components/admin/MinimumViableGovernanceDecisionBoundariesSurface";
import { OperatorScenarioDrillsSurface } from "@/components/admin/OperatorScenarioDrillsSurface";
import { ExpansionPreconditionsMarketEntryReadinessSurface } from "@/components/admin/ExpansionPreconditionsMarketEntryReadinessSurface";
import { TechnicalDebtRefactorReadinessReviewSurface } from "@/components/admin/TechnicalDebtRefactorReadinessReviewSurface";
import { CrossSurfaceConsistencyStatusAlignmentAuditSurface } from "@/components/admin/CrossSurfaceConsistencyStatusAlignmentAuditSurface";
import { AdminInformationArchitectureNavigationSimplificationSurface } from "@/components/admin/AdminInformationArchitectureNavigationSimplificationSurface";
import { StrategicPrioritizationNextBuildDecisionFrameworkSurface } from "@/components/admin/StrategicPrioritizationNextBuildDecisionFrameworkSurface";
import { DeliveryInspectorPage } from "@/components/admin/deliveries/DeliveryInspectorPage";
import { SessionDiagnosticPanel } from "@/components/admin/diagnostics/SessionDiagnosticPanel";
import { SignalDispatchTab } from "@/components/admin/SignalDispatchTab";
import { AdminOutcomeInspector } from "@/components/admin/AdminOutcomeInspector";
import { RevenueDispatchReadiness } from "@/components/admin/RevenueDispatchReadiness";
import { ClientPlatformConfigs } from "@/components/admin/ClientPlatformConfigs";
import { DispatchDryRunQueue } from "@/components/admin/DispatchDryRunQueue";
import { DispatchOutboxControl } from "@/components/admin/DispatchOutboxControl";
import { DispatchAttemptReconciliation } from "@/components/admin/DispatchAttemptReconciliation";
import { DispatchGovernanceConsole } from "@/components/admin/DispatchGovernanceConsole";
import { LeadAssignmentBoard } from "@/components/admin/LeadAssignmentBoard";

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
    // Phase 25 — Revenue fields (repo-real on `leads`)
    deal_value: raw.deal_value ?? null,
    revenue_amount: raw.revenue_amount ?? null,
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

interface DashboardContentProps {
  initialTab?: string;
}

function DashboardContent({ initialTab }: DashboardContentProps) {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [latestFollowups, setLatestFollowups] = useState<Record<string, VoiceFollowupSummary>>({});
  const [needsReview, setNeedsReview] = useState<NeedsReviewLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "mission-control");

  // Route-reactive sync: when a parent route remounts this component with a new
  // `initialTab` (e.g. navigating /admin/launch → /admin/pipeline) React may reuse
  // the same instance. Mirror prop changes into local state so the visible tab
  // tracks the URL alias.
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

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

  const previewBadge =
    leads.length === 0 && initialLoadDone.current ? <PreviewModeBadge /> : null;

  return (
    <AdminShell
      eyebrow="Lead Sniper · Admin"
      title="Operator Command Center"
      subtitle={`${leads.length} leads · ${lastSyncLabel}`}
      belowHeader={
        <div className="flex items-center gap-3">
          {previewBadge}
          <Link
            to="/admin/settings"
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-extrabold text-slate-950 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
            title="Admin Settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <AdminPrimaryTabs
          ghostCount={ghosts.length}
          needsReviewCount={needsReview.length}
        />

          <TabsContent value="mission-control" className="w-full pt-1">
            <MasterCommandCenter
              leads={leads}
              deliveries={deliveries}
              ghosts={ghosts}
              needsReviewCount={needsReview.length}
              onNavigateTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="surface-map" className="w-full pt-1">
            <AdminInformationArchitectureNavigationSimplificationSurface
              onNavigateTab={setActiveTab}
              activeTab={activeTab}
            />
          </TabsContent>

          <TabsContent value="prioritization" className="w-full pt-1">
            <StrategicPrioritizationNextBuildDecisionFrameworkSurface
              onNavigateTab={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="launch" className="w-full pt-1">
            <PilotOpsLaunchControl leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="command" className="space-y-6">
            {/* Phase 26 — legacy <CommandCenter /> removed; canonical Mission
                Control engine renders here so funnel counts cannot disagree
                across tabs. OneContractorSummaryStrip + MarketOpsFeed retained. */}
            <OneContractorSummaryStrip leads={leads} />
            <MasterCommandCenter
              leads={leads}
              deliveries={deliveries}
              ghosts={ghosts}
              needsReviewCount={needsReview.length}
              onNavigateTab={setActiveTab}
            />
            <MarketOpsFeed leads={leads} />
          </TabsContent>

          <TabsContent value="routing">
            <RoutingDesk leads={leads} />
          </TabsContent>

          <TabsContent value="lead-assignments" className="w-full px-2 sm:px-6 pt-4">
            <LeadAssignmentBoard />
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

          <TabsContent value="onboarding" className="w-full px-2 sm:px-6 pt-4">
            <ContractorOnboardingSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="outcomes" className="w-full px-2 sm:px-6 pt-4">
            <OutcomeTrackingReport leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="reporting" className="w-full px-2 sm:px-6 pt-4">
            <OperatorReportingSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="lifecycle" className="w-full px-2 sm:px-6 pt-4">
            <DeadStaleRecoveryWorkflowSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="feedback" className="w-full px-2 sm:px-6 pt-4">
            <ContractorFeedbackLoopSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="shared-market" className="w-full px-2 sm:px-6 pt-4">
            <SharedMarketManualControlsSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="report-prep" className="w-full px-2 sm:px-6 pt-4">
            <ClientFacingReportingPrepSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="audit" className="w-full px-2 sm:px-6 pt-4">
            <PilotToPlatformAuditSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="readiness" className="w-full px-2 sm:px-6 pt-4">
            <LaunchReadinessSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="training" className="w-full px-2 sm:px-6 pt-4">
            <OperatorTrainingSOPSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="rollout" className="w-full px-2 sm:px-6 pt-4">
            <RolloutPlanningReadinessSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="data-quality" className="w-full px-2 sm:px-6 pt-4">
            <DataQualityFieldIntegritySurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="exceptions" className="w-full px-2 sm:px-6 pt-4">
            <ExceptionHandlingManualEscalationSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="docs" className="w-full px-2 sm:px-6 pt-4">
            <DocumentationHandoffReadinessSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="learnings" className="w-full px-2 sm:px-6 pt-4">
            <PostPilotLearningsDecisionSupportSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="change-mgmt" className="w-full px-2 sm:px-6 pt-4">
            <ChangeManagementSafeUpdateReadinessSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="governance" className="w-full px-2 sm:px-6 pt-4">
            <MinimumViableGovernanceDecisionBoundariesSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="drills" className="w-full px-2 sm:px-6 pt-4">
            <OperatorScenarioDrillsSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="expansion" className="w-full px-2 sm:px-6 pt-4">
            <ExpansionPreconditionsMarketEntryReadinessSurface leads={leads} onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="tech-debt" className="w-full px-2 sm:px-6 pt-4">
            <TechnicalDebtRefactorReadinessReviewSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="consistency" className="w-full px-2 sm:px-6 pt-4">
            <CrossSurfaceConsistencyStatusAlignmentAuditSurface onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="attribution">
            <AttributionTab leads={leads} isLoading={false} />
          </TabsContent>

          <TabsContent value="signal-dispatch" className="w-full px-2 sm:px-6 pt-4">
            <SignalDispatchTab />
          </TabsContent>

          <TabsContent value="revenue-dispatch-readiness" className="w-full px-2 sm:px-6 pt-4">
            <RevenueDispatchReadiness />
          </TabsContent>

          <TabsContent value="client-platform-configs" className="w-full px-2 sm:px-6 pt-4">
            <ClientPlatformConfigs />
          </TabsContent>

          <TabsContent value="dispatch-dry-run" className="w-full px-2 sm:px-6 pt-4">
            <DispatchDryRunQueue />
          </TabsContent>

          <TabsContent value="dispatch-outbox" className="w-full px-2 sm:px-6 pt-4">
            <DispatchOutboxControl />
          </TabsContent>

          <TabsContent value="dispatch-attempts" className="w-full px-2 sm:px-6 pt-4">
            <DispatchAttemptReconciliation />
          </TabsContent>

          <TabsContent value="dispatch-governance" className="w-full px-2 sm:px-6 pt-4">
            <DispatchGovernanceConsole />
          </TabsContent>

          <TabsContent value="pilot" className="w-full px-2 sm:px-6 pt-4">
            <PilotReadiness leads={leads} />
          </TabsContent>

          <TabsContent value="delivery-inspector" className="w-full px-2 sm:px-6 pt-4">
            <DeliveryInspectorPage />
          </TabsContent>

          <TabsContent value="outcome-inspector" className="w-full px-2 sm:px-6 pt-4">
            <AdminOutcomeInspector />
          </TabsContent>

          <TabsContent value="session-diag" className="w-full px-0 pt-2 sm:px-2">
            <SessionDiagnosticPanel />
          </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

/* ── Exported — renders publicly, data-fetch failures show preview ──── */

interface AdminDashboardProps {
  initialTab?: string;
}

export default function AdminDashboard({ initialTab }: AdminDashboardProps = {}) {
  return <DashboardContent initialTab={initialTab} />;
}
