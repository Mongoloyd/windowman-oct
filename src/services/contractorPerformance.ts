import { supabase } from "@/integrations/supabase/client";

export type ContractorPerformanceWindow = "7d" | "30d" | "90d" | "all";
export type ContractorPerformanceStatus = "insufficient_data" | "healthy" | "watch" | "coach" | "pause";

export interface ContractorPerformanceMetrics {
  assignedCount: number;
  releasedCount: number;
  attemptingContactCount: number;
  contactedCount: number;
  meetingScheduledCount: number;
  scheduledCount: number;
  quoteDeliveredCount: number;
  soldCount: number;
  lostCount: number;
  manualReviewCount: number;
  contactRate: number | null;
  appointmentRate: number | null;
  proposalRate: number | null;
  closeRate: number | null;
  lossRate: number | null;
  attemptingContactRate: number | null;
  soldValueCents: number;
  estimatedSoldValueCents: number;
  confirmedSoldValueCents: number;
  marginValueCents: number;
  averageTimeToFirstUpdateHours: number | null;
  lastActivityAt: string | null;
  performanceStatus: ContractorPerformanceStatus;
  warnings: string[];
  lostReasonBreakdown: Record<string, number>;
}

export interface ContractorPerformanceSummary extends ContractorPerformanceMetrics {
  contractorAccountId: string;
  contractorAccountIdMasked: string;
  contractorDisplayName: string;
  clientSlug: string;
}

export interface ContractorPerformanceResult {
  success: boolean;
  window: ContractorPerformanceWindow;
  denominator: "released_leads";
  summaries: ContractorPerformanceSummary[];
  message?: string;
  failed_sources?: string[];
}

type EdgeSummary = Partial<ContractorPerformanceSummary>;
type EdgeResponse = {
  success?: boolean;
  window?: ContractorPerformanceWindow;
  denominator?: "released_leads";
  summaries?: EdgeSummary[];
  message?: string;
  error?: string;
  failed_sources?: string[];
};

const EMPTY_METRICS: ContractorPerformanceMetrics = {
  assignedCount: 0,
  releasedCount: 0,
  attemptingContactCount: 0,
  contactedCount: 0,
  meetingScheduledCount: 0,
  scheduledCount: 0,
  quoteDeliveredCount: 0,
  soldCount: 0,
  lostCount: 0,
  manualReviewCount: 0,
  contactRate: null,
  appointmentRate: null,
  proposalRate: null,
  closeRate: null,
  lossRate: null,
  attemptingContactRate: null,
  soldValueCents: 0,
  estimatedSoldValueCents: 0,
  confirmedSoldValueCents: 0,
  marginValueCents: 0,
  averageTimeToFirstUpdateHours: null,
  lastActivityAt: null,
  performanceStatus: "insufficient_data",
  warnings: [],
  lostReasonBreakdown: {},
};

function normalizeSummary(row: EdgeSummary): ContractorPerformanceSummary {
  const metrics = { ...EMPTY_METRICS, ...row } as ContractorPerformanceMetrics;
  return {
    ...metrics,
    contractorAccountId: row.contractorAccountId ?? "unknown",
    contractorAccountIdMasked: row.contractorAccountIdMasked ?? "unknown",
    contractorDisplayName: row.contractorDisplayName ?? "Unnamed contractor",
    clientSlug: row.clientSlug ?? "unknown",
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    lostReasonBreakdown: row.lostReasonBreakdown && typeof row.lostReasonBreakdown === "object" ? row.lostReasonBreakdown : {},
    performanceStatus: deriveContractorPerformanceStatus(metrics),
  };
}

async function invokePerformanceFunction(functionName: string, window: ContractorPerformanceWindow): Promise<ContractorPerformanceResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { success: false, window, denominator: "released_leads", summaries: [], message: "Session unavailable." };
  }

  const { data, error } = await supabase.functions.invoke<EdgeResponse>(functionName, {
    body: { window },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    return { success: false, window, denominator: "released_leads", summaries: [], message: error.message || "Contractor performance failed safely." };
  }

  if (!data?.success) {
    return { success: false, window, denominator: "released_leads", summaries: [], message: data?.message ?? data?.error ?? "Contractor performance failed safely.", failed_sources: data?.failed_sources };
  }

  return {
    success: true,
    window: data.window ?? window,
    denominator: "released_leads",
    summaries: Array.isArray(data.summaries) ? data.summaries.map(normalizeSummary) : [],
  };
}

export function deriveContractorPerformanceStatus(metrics: ContractorPerformanceMetrics): ContractorPerformanceStatus {
  if (metrics.releasedCount < 5) return "insufficient_data";
  if (metrics.releasedCount >= 10 && metrics.soldCount === 0) return "pause";
  if ((metrics.attemptingContactRate ?? 0) > 0.7) return "pause";
  if (metrics.releasedCount >= 5 && (metrics.attemptingContactRate ?? 0) > 0.5) return "coach";
  if ((metrics.closeRate ?? 0) < 0.1 || (metrics.attemptingContactRate ?? 0) > 0.35) return "watch";
  if ((metrics.closeRate ?? 0) >= 0.2 && (metrics.attemptingContactRate ?? 0) <= 0.25) return "healthy";
  return "watch";
}

export async function fetchAdminContractorPerformance(window: ContractorPerformanceWindow): Promise<ContractorPerformanceResult> {
  return invokePerformanceFunction("admin-contractor-performance", window);
}

export async function fetchContractorSelfPerformance(window: ContractorPerformanceWindow): Promise<ContractorPerformanceResult> {
  return invokePerformanceFunction("contractor-performance-summary", window);
}

export function formatPerformanceRate(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function formatPerformanceCurrency(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function formatPerformanceStatus(status: ContractorPerformanceStatus): string {
  const labels: Record<ContractorPerformanceStatus, string> = {
    insufficient_data: "Insufficient data",
    healthy: "Healthy",
    watch: "Watch",
    coach: "Coach",
    pause: "Pause",
  };
  return labels[status];
}

export function formatPerformanceWindow(window: ContractorPerformanceWindow): string {
  const labels: Record<ContractorPerformanceWindow, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    all: "All time",
  };
  return labels[window];
}
