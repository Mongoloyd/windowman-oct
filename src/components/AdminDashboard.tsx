/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD SNIPER CRM — Admin Dashboard v4.1
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { lazy, Suspense, useEffect, useState, useCallback, useRef } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { getAdminPageTitle } from "@/routes/adminDashboardTabs";
import { formatDistanceToNow } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminPrimaryTabs } from "@/components/admin/shell/AdminPrimaryTabs";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";

import { PreviewModeBadge } from "@/components/PreviewModeBadge";
// Phase 26 — legacy <CommandCenter /> removed. Canonical Mission Control
// engine is <MasterCommandCenter />. The legacy file is kept on disk as
// @deprecated for archaeology but is no longer imported anywhere.
import type { NeedsReviewLead } from "@/components/admin/NeedsReviewTab";

import {
  invokeAdminDataSafe,
  type AdminDataFailureInfo,
} from "@/services/adminDataService";
import {
  AdminBackendStatusBanner,
  type AdminBackendCallStatus,
} from "@/components/admin/system/AdminBackendStatusBanner";

import type { CRMLead, WebhookDelivery, CommandCenterKPIs, VoiceFollowupSummary } from "@/components/admin/types";

const MasterCommandCenter = lazy(() =>
  import("@/components/admin/MasterCommandCenter").then((module) => ({ default: module.MasterCommandCenter })),
);
const ActivePipeline = lazy(() =>
  import("@/components/admin/ActivePipeline").then((module) => ({ default: module.ActivePipeline })),
);
const GhostRecovery = lazy(() =>
  import("@/components/admin/GhostRecovery").then((module) => ({ default: module.GhostRecovery })),
);
const InternalCRMDesk = lazy(() =>
  import("@/components/admin/InternalCRMDesk").then((module) => ({ default: module.InternalCRMDesk })),
);
const NeedsReviewTab = lazy(() =>
  import("@/components/admin/NeedsReviewTab").then((module) => ({ default: module.NeedsReviewTab })),
);
const AttributionTab = lazy(() =>
  import("@/components/admin/AttributionTab").then((module) => ({ default: module.AttributionTab })),
);
const ContractorAccountsTab = lazy(() =>
  import("@/components/admin/ContractorAccountsTab").then((module) => ({ default: module.ContractorAccountsTab })),
);
const RoutingDesk = lazy(() =>
  import("@/components/admin/RoutingDesk").then((module) => ({ default: module.RoutingDesk })),
);
const OneContractorSummaryStrip = lazy(() =>
  import("@/components/admin/OneContractorSummaryStrip").then((module) => ({ default: module.OneContractorSummaryStrip })),
);
const MarketOpsFeed = lazy(() =>
  import("@/components/admin/MarketOpsFeed").then((module) => ({ default: module.MarketOpsFeed })),
);
const PilotReadiness = lazy(() =>
  import("@/components/admin/PilotReadiness").then((module) => ({ default: module.PilotReadiness })),
);
const PilotOpsLaunchControl = lazy(() =>
  import("@/components/admin/PilotOpsLaunchControl").then((module) => ({ default: module.PilotOpsLaunchControl })),
);
const OutcomeTrackingReport = lazy(() =>
  import("@/components/admin/OutcomeTrackingReport").then((module) => ({ default: module.OutcomeTrackingReport })),
);
const ContractorOnboardingSurface = lazy(() =>
  import("@/components/admin/ContractorOnboardingSurface").then((module) => ({ default: module.ContractorOnboardingSurface })),
);
const OperatorReportingSurface = lazy(() =>
  import("@/components/admin/OperatorReportingSurface").then((module) => ({ default: module.OperatorReportingSurface })),
);
const DeadStaleRecoveryWorkflowSurface = lazy(() =>
  import("@/components/admin/DeadStaleRecoveryWorkflowSurface").then((module) => ({ default: module.DeadStaleRecoveryWorkflowSurface })),
);
const ContractorFeedbackLoopSurface = lazy(() =>
  import("@/components/admin/ContractorFeedbackLoopSurface").then((module) => ({ default: module.ContractorFeedbackLoopSurface })),
);
const SharedMarketManualControlsSurface = lazy(() =>
  import("@/components/admin/SharedMarketManualControlsSurface").then((module) => ({ default: module.SharedMarketManualControlsSurface })),
);
const ClientFacingReportingPrepSurface = lazy(() =>
  import("@/components/admin/ClientFacingReportingPrepSurface").then((module) => ({ default: module.ClientFacingReportingPrepSurface })),
);
const PilotToPlatformAuditSurface = lazy(() =>
  import("@/components/admin/PilotToPlatformAuditSurface").then((module) => ({ default: module.PilotToPlatformAuditSurface })),
);
const LaunchReadinessSurface = lazy(() =>
  import("@/components/admin/LaunchReadinessSurface").then((module) => ({ default: module.LaunchReadinessSurface })),
);
const OperatorTrainingSOPSurface = lazy(() =>
  import("@/components/admin/OperatorTrainingSOPSurface").then((module) => ({ default: module.OperatorTrainingSOPSurface })),
);
const RolloutPlanningReadinessSurface = lazy(() =>
  import("@/components/admin/RolloutPlanningReadinessSurface").then((module) => ({ default: module.RolloutPlanningReadinessSurface })),
);
const DataQualityFieldIntegritySurface = lazy(() =>
  import("@/components/admin/DataQualityFieldIntegritySurface").then((module) => ({ default: module.DataQualityFieldIntegritySurface })),
);
const ExceptionHandlingManualEscalationSurface = lazy(() =>
  import("@/components/admin/ExceptionHandlingManualEscalationSurface").then((module) => ({ default: module.ExceptionHandlingManualEscalationSurface })),
);
const DocumentationHandoffReadinessSurface = lazy(() =>
  import("@/components/admin/DocumentationHandoffReadinessSurface").then((module) => ({ default: module.DocumentationHandoffReadinessSurface })),
);
const PostPilotLearningsDecisionSupportSurface = lazy(() =>
  import("@/components/admin/PostPilotLearningsDecisionSupportSurface").then((module) => ({ default: module.PostPilotLearningsDecisionSupportSurface })),
);
const ChangeManagementSafeUpdateReadinessSurface = lazy(() =>
  import("@/components/admin/ChangeManagementSafeUpdateReadinessSurface").then((module) => ({ default: module.ChangeManagementSafeUpdateReadinessSurface })),
);
const MinimumViableGovernanceDecisionBoundariesSurface = lazy(() =>
  import("@/components/admin/MinimumViableGovernanceDecisionBoundariesSurface").then((module) => ({ default: module.MinimumViableGovernanceDecisionBoundariesSurface })),
);
const OperatorScenarioDrillsSurface = lazy(() =>
  import("@/components/admin/OperatorScenarioDrillsSurface").then((module) => ({ default: module.OperatorScenarioDrillsSurface })),
);
const ExpansionPreconditionsMarketEntryReadinessSurface = lazy(() =>
  import("@/components/admin/ExpansionPreconditionsMarketEntryReadinessSurface").then((module) => ({ default: module.ExpansionPreconditionsMarketEntryReadinessSurface })),
);
const TechnicalDebtRefactorReadinessReviewSurface = lazy(() =>
  import("@/components/admin/TechnicalDebtRefactorReadinessReviewSurface").then((module) => ({ default: module.TechnicalDebtRefactorReadinessReviewSurface })),
);
const CrossSurfaceConsistencyStatusAlignmentAuditSurface = lazy(() =>
  import("@/components/admin/CrossSurfaceConsistencyStatusAlignmentAuditSurface").then((module) => ({ default: module.CrossSurfaceConsistencyStatusAlignmentAuditSurface })),
);
const AdminInformationArchitectureNavigationSimplificationSurface = lazy(() =>
  import("@/components/admin/AdminInformationArchitectureNavigationSimplificationSurface").then((module) => ({ default: module.AdminInformationArchitectureNavigationSimplificationSurface })),
);
const StrategicPrioritizationNextBuildDecisionFrameworkSurface = lazy(() =>
  import("@/components/admin/StrategicPrioritizationNextBuildDecisionFrameworkSurface").then((module) => ({ default: module.StrategicPrioritizationNextBuildDecisionFrameworkSurface })),
);
const DeliveryInspectorPage = lazy(() =>
  import("@/components/admin/deliveries/DeliveryInspectorPage").then((module) => ({ default: module.DeliveryInspectorPage })),
);
const SessionDiagnosticPanel = lazy(() =>
  import("@/components/admin/diagnostics/SessionDiagnosticPanel").then((module) => ({ default: module.SessionDiagnosticPanel })),
);
const TwilioObservabilityPanel = lazy(() =>
  import("@/components/admin/otp/TwilioObservabilityPanel").then((module) => ({ default: module.TwilioObservabilityPanel })),
);
const SignalDispatchTab = lazy(() =>
  import("@/components/admin/SignalDispatchTab").then((module) => ({ default: module.SignalDispatchTab })),
);
const RevenueDispatchReadiness = lazy(() =>
  import("@/components/admin/RevenueDispatchReadiness").then((module) => ({ default: module.RevenueDispatchReadiness })),
);
const RevenueSignalDryRunAudit = lazy(() =>
  import("@/components/admin/RevenueSignalDryRunAudit").then((module) => ({ default: module.RevenueSignalDryRunAudit })),
);
const ClientPlatformConfigs = lazy(() =>
  import("@/components/admin/ClientPlatformConfigs").then((module) => ({ default: module.ClientPlatformConfigs })),
);
const DispatchDryRunQueue = lazy(() =>
  import("@/components/admin/DispatchDryRunQueue").then((module) => ({ default: module.DispatchDryRunQueue })),
);
const DispatchOutboxControl = lazy(() =>
  import("@/components/admin/DispatchOutboxControl").then((module) => ({ default: module.DispatchOutboxControl })),
);
const DispatchAttemptReconciliation = lazy(() =>
  import("@/components/admin/DispatchAttemptReconciliation").then((module) => ({ default: module.DispatchAttemptReconciliation })),
);
const DispatchGovernanceConsole = lazy(() =>
  import("@/components/admin/DispatchGovernanceConsole").then((module) => ({ default: module.DispatchGovernanceConsole })),
);
const NextdoorReadinessPanel = lazy(() =>
  import("@/components/admin/NextdoorReadinessPanel").then((module) => ({ default: module.NextdoorReadinessPanel })),
);
const LeadAssignmentBoard = lazy(() =>
  import("@/components/admin/LeadAssignmentBoard").then((module) => ({ default: module.LeadAssignmentBoard })),
);
const ContractorOutcomeInspector = lazy(() =>
  import("@/components/admin/ContractorOutcomeInspector").then((module) => ({ default: module.ContractorOutcomeInspector })),
);
const SyndicateHealthDashboard = lazy(() =>
  import("@/components/admin/SyndicateHealthDashboard").then((module) => ({ default: module.SyndicateHealthDashboard })),
);
const LeadReleaseQueue = lazy(() =>
  import("@/components/admin/LeadReleaseQueue").then((module) => ({ default: module.LeadReleaseQueue })),
);
const ContractorPerformanceDashboard = lazy(() =>
  import("@/components/admin/ContractorPerformanceDashboard").then((module) => ({ default: module.ContractorPerformanceDashboard })),
);

const REFRESH_INTERVAL_MS = 120_000;

const INITIAL_BACKEND_CALLS: AdminBackendCallStatus[] = [
  { action: "fetch_leads", label: "Leads", status: "loading", severity: "critical" },
  {
    action: "fetch_webhook_deliveries",
    label: "Webhook deliveries",
    status: "loading",
    severity: "warning",
  },
  {
    action: "fetch_voice_followups",
    label: "Voice follow-ups",
    status: "loading",
    severity: "warning",
  },
  {
    action: "fetch_needs_review",
    label: "Needs review queue",
    status: "loading",
    severity: "warning",
  },
];

function patchBackendCall(
  calls: AdminBackendCallStatus[],
  action: string,
  patch: Partial<AdminBackendCallStatus>,
): AdminBackendCallStatus[] {
  return calls.map((call) => (call.action === action ? { ...call, ...patch } : call));
}

function failureToCallPatch(
  failure: AdminDataFailureInfo,
  checkedAt: string,
): Partial<AdminBackendCallStatus> {
  return {
    status: "failed",
    message: failure.message,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    failureKind: failure.kind,
    lastCheckedAt: checkedAt,
  };
}

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
  const location = useLocation();
  const pageTitle = getAdminPageTitle(location.pathname);
  useEffect(() => {
    document.title = `${pageTitle} · WindowMan Admin`;
  }, [pageTitle]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [latestFollowups, setLatestFollowups] = useState<Record<string, VoiceFollowupSummary>>({});
  const [needsReview, setNeedsReview] = useState<NeedsReviewLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendCalls, setBackendCalls] = useState<AdminBackendCallStatus[]>(INITIAL_BACKEND_CALLS);
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
    const checkedAt = new Date().toISOString();
    setIsLoading(true);
    setBackendCalls((prev) =>
      prev.map((call) => ({
        ...call,
        status: call.status === "idle" || call.status === "failed" || call.status === "success" ? "loading" : call.status,
      })),
    );

    let anySuccess = false;

    const leadsResult = await invokeAdminDataSafe("fetch_leads");
    if (leadsResult.ok) {
      anySuccess = true;
      setLeads((leadsResult.data ?? []).map(toLeadCRM));
      setBackendCalls((prev) =>
        patchBackendCall(prev, "fetch_leads", {
          status: "success",
          message: undefined,
          statusCode: null,
          errorCode: null,
          failureKind: null,
          lastCheckedAt: checkedAt,
        }),
      );
    } else {
      console.warn("[CRM] fetch_leads failed:", leadsResult.failure);
      setBackendCalls((prev) =>
        patchBackendCall(prev, "fetch_leads", failureToCallPatch(leadsResult.failure, checkedAt)),
      );
    }

    const [deliveriesResult, followupsResult, needsReviewResult] = await Promise.all([
      invokeAdminDataSafe("fetch_webhook_deliveries", { limit: 200 }),
      invokeAdminDataSafe("fetch_voice_followups"),
      invokeAdminDataSafe("fetch_needs_review"),
    ]);

    if (deliveriesResult.ok) {
      anySuccess = true;
      setDeliveries((deliveriesResult.data ?? []).map(toWebhookDelivery));
      setBackendCalls((prev) =>
        patchBackendCall(prev, "fetch_webhook_deliveries", {
          status: "success",
          message: undefined,
          statusCode: null,
          errorCode: null,
          failureKind: null,
          lastCheckedAt: checkedAt,
        }),
      );
    } else {
      console.warn("[CRM] fetch_webhook_deliveries failed:", deliveriesResult.failure);
      setBackendCalls((prev) =>
        patchBackendCall(
          prev,
          "fetch_webhook_deliveries",
          failureToCallPatch(deliveriesResult.failure, checkedAt),
        ),
      );
    }

    if (needsReviewResult.ok) {
      anySuccess = true;
      setNeedsReview((needsReviewResult.data ?? []) as NeedsReviewLead[]);
      setBackendCalls((prev) =>
        patchBackendCall(prev, "fetch_needs_review", {
          status: "success",
          message: undefined,
          statusCode: null,
          errorCode: null,
          failureKind: null,
          lastCheckedAt: checkedAt,
        }),
      );
    } else {
      console.warn("[CRM] fetch_needs_review failed:", needsReviewResult.failure);
      setBackendCalls((prev) =>
        patchBackendCall(
          prev,
          "fetch_needs_review",
          failureToCallPatch(needsReviewResult.failure, checkedAt),
        ),
      );
    }

    if (followupsResult.ok) {
      anySuccess = true;
      const followupsArr = (followupsResult.data ?? []) as Array<Record<string, unknown>>;
      const fMap: Record<string, VoiceFollowupSummary> = {};
      for (const f of followupsArr) {
        const lid = f.lead_id as string;
        if (!lid) continue;
        if (!fMap[lid] || new Date(f.created_at as string) > new Date(fMap[lid].created_at)) {
          fMap[lid] = {
            lead_id: lid,
            status: (f.status as string) ?? "unknown",
            call_outcome: (f.call_outcome as string | null) ?? null,
            created_at: f.created_at as string,
          };
        }
      }
      setLatestFollowups(fMap);
      setBackendCalls((prev) =>
        patchBackendCall(prev, "fetch_voice_followups", {
          status: "success",
          message: undefined,
          statusCode: null,
          errorCode: null,
          failureKind: null,
          lastCheckedAt: checkedAt,
        }),
      );
    } else {
      console.warn("[CRM] fetch_voice_followups failed:", followupsResult.failure);
      setBackendCalls((prev) =>
        patchBackendCall(
          prev,
          "fetch_voice_followups",
          failureToCallPatch(followupsResult.failure, checkedAt),
        ),
      );
    }

    if (anySuccess) {
      setLastSyncedAt(new Date());
    }

    setIsLoading(false);
    if (isInitial) initialLoadDone.current = true;
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
  const leadsCall = backendCalls.find((c) => c.action === "fetch_leads");
  const leadsLoadFailed = leadsCall?.status === "failed";
  const leadsLoadSucceeded = leadsCall?.status === "success";

  const lastSyncLabel = lastSyncedAt
    ? `Updated ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
    : isLoading
      ? "Loading…"
      : leadsLoadFailed
        ? "Could not load data"
        : "Not yet synced";

  const leadCountLabel = leadsLoadFailed
    ? "Lead count unavailable"
    : `${leads.length} lead${leads.length === 1 ? "" : "s"}`;

  const previewBadge =
    leadsLoadSucceeded && leads.length === 0 ? <PreviewModeBadge /> : null;

  return (
    <AdminShell
      eyebrow="Lead Sniper · Admin"
      title={pageTitle}
      subtitle={`${leadCountLabel} · ${lastSyncLabel}`}
      nav={<AdminGlobalNav />}
      headerActions={
        <div className="flex items-center gap-3">
          {previewBadge}
          <Link
            to="/admin/settings"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[#3b5874] bg-[#091725] px-4 py-2 text-sm font-extrabold text-[#e7f0f9] shadow-none transition-colors hover:bg-[#142a3e] hover:text-[#f7fbff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
            title="Admin Settings"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      }
      belowHeader={
        <AdminPrimaryTabs
          activePanel={activeTab}
          onPanelChange={setActiveTab}
          ghostCount={ghosts.length}
          needsReviewCount={needsReview.length}
        />
      }
    >
      <div className="space-y-4">
        <AdminBackendStatusBanner
          calls={backendCalls}
          isRefreshing={isLoading}
          onRetry={fetchAll}
        />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <Suspense fallback={<div className="flex items-center justify-center py-12 text-sm text-slate-500">Loading…</div>}>
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

          <TabsContent value="lead-release" className="w-full px-2 sm:px-6 pt-4">
            <LeadReleaseQueue />
          </TabsContent>

          <TabsContent value="syndicate-health" className="w-full px-2 sm:px-6 pt-4">
            <SyndicateHealthDashboard />
          </TabsContent>

          <TabsContent value="contractor-performance" className="w-full px-2 sm:px-6 pt-4">
            <ContractorPerformanceDashboard />
          </TabsContent>

          <TabsContent value="pipeline">
            <ActivePipeline leads={leads} isLoading={isLoading && !leadsLoadFailed} />
          </TabsContent>

          <TabsContent value="ghosts">
            <GhostRecovery ghosts={ghosts} isLoading={isLoading && !leadsLoadFailed} />
          </TabsContent>

          <TabsContent value="needs-review">
            <NeedsReviewTab
              needsReview={needsReview}
              isLoading={
                isLoading &&
                backendCalls.find((c) => c.action === "fetch_needs_review")?.status !== "failed"
              }
            />
          </TabsContent>

          <TabsContent value="engine">
            <InternalCRMDesk
              leads={leads}
              isLoading={isLoading && !leadsLoadFailed}
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
            <AttributionTab leads={leads} isLoading={isLoading && !leadsLoadFailed} />
          </TabsContent>

          <TabsContent value="signal-dispatch" className="w-full px-2 sm:px-6 pt-4">
            <SignalDispatchTab />
          </TabsContent>

          <TabsContent value="revenue-dispatch-readiness" className="w-full px-2 sm:px-6 pt-4">
            <RevenueDispatchReadiness />
          </TabsContent>

          <TabsContent value="revenue-dry-run" className="w-full px-2 sm:px-6 pt-4">
            <RevenueSignalDryRunAudit />
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

          <TabsContent value="dispatch-governance" className="w-full px-2 sm:px-6 pt-4 space-y-6">
            <NextdoorReadinessPanel />
            <DispatchGovernanceConsole />
          </TabsContent>

          <TabsContent value="pilot" className="w-full px-2 sm:px-6 pt-4">
            <PilotReadiness leads={leads} />
          </TabsContent>

          <TabsContent value="delivery-inspector" className="w-full px-2 sm:px-6 pt-4">
            <DeliveryInspectorPage />
          </TabsContent>

          <TabsContent value="outcome-inspector" className="w-full px-2 sm:px-6 pt-4">
            <ContractorOutcomeInspector />
          </TabsContent>

          <TabsContent value="session-diag" className="w-full px-0 pt-2 sm:px-2">
            <SessionDiagnosticPanel />
          </TabsContent>

          <TabsContent value="otp-ops" className="w-full px-0 pt-2 sm:px-2">
            <TwilioObservabilityPanel />
          </TabsContent>
        </Suspense>
      </Tabs>
      </div>
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
