/**
 * AdminLeadReport — Admin-gated Truth Report viewer.
 * Route: /admin/leads/:id/report
 *
 * Renders the SAME TruthReportClassic UI homeowners see, but uses the
 * admin-authorized `admin-data` RPC (fetch_lead_detail + fetch_lead_analysis)
 * to load the full analysis payload server-side. No homeowner OTP gate is
 * involved — admin RBAC inside admin-data is the gate.
 *
 * Why this exists:
 * The previous "Open Truth Report" link sent admins to /report/classic/:sid,
 * which is the public homeowner route guarded by the SMS OTP LockedOverlay.
 * Admins have no homeowner phone to verify, so the report appeared "broken".
 * This page is the read-only admin-side equivalent. The homeowner-facing
 * /report/classic/:sid route remains untouched and OTP-gated per the
 * Verify-to-Reveal contract.
 */

import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import {
  fetchLeadDetail,
  fetchLeadAnalysis,
  getErrorMessage,
} from "@/services/adminDataService";
import TruthReportClassic from "@/components/TruthReportClassic";
import { buildFullData } from "@/hooks/useAnalysisData";
import type { RawFullRow } from "@/types/serviceResults";

export default function AdminLeadReport() {
  const { id: leadId } = useParams<{ id: string }>();

  useEffect(() => {
    document.title = "Truth Report · Admin";
  }, []);

  const { data: lead, isLoading: leadLoading, isError: leadErr, error: leadErrObj } = useQuery({
    queryKey: ["admin", "lead-detail", leadId],
    queryFn: () => fetchLeadDetail(leadId!),
    enabled: !!leadId,
  });

  const analysisId: string | null = lead?.latest_analysis_id ?? null;

  const {
    data: analysis,
    isLoading: analysisLoading,
    isError: analysisErr,
    error: analysisErrObj,
  } = useQuery({
    queryKey: ["admin", "lead-analysis", analysisId],
    queryFn: () => fetchLeadAnalysis(analysisId!),
    enabled: !!analysisId,
  });

  const reportData = useMemo(() => {
    if (!analysis) return null;
    // admin-data returns: grade, dollar_delta, confidence_score, flags, full_json
    // Map into the shape buildFullData expects (RawFullRow).
    const row: RawFullRow = {
      analysis_id: analysisId,
      grade: analysis.grade ?? "C",
      flags: analysis.flags ?? [],
      full_json: analysis.full_json ?? null,
      preview_json: analysis.full_json?.preview_json ?? analysis.full_json ?? null,
      proof_of_read: analysis.full_json?.proof_of_read ?? null,
      confidence_score: analysis.confidence_score ?? null,
      document_type: analysis.full_json?.document_type ?? null,
      rubric_version: analysis.full_json?.rubric_version ?? null,
    } as RawFullRow;
    return buildFullData(row);
  }, [analysis, analysisId]);

  const backTo = leadId ? `/admin/leads/${leadId}` : "/admin/leads";

  if (!leadId) {
    return (
      <AdminShell title="Lead not found" backTo="/admin/leads" backLabel="Back to inbox">
        <p className="text-sm text-muted-foreground">No lead ID provided.</p>
      </AdminShell>
    );
  }

  if (leadLoading || analysisLoading) {
    return (
      <AdminShell title="Loading Truth Report…" backTo={backTo} backLabel="Back to dossier">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (leadErr || !lead) {
    return (
      <AdminShell title="Couldn't load report" backTo={backTo} backLabel="Back to dossier">
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Lead unavailable</p>
            <p className="mt-0.5 opacity-90">{getErrorMessage(leadErrObj) || "Lead not found."}</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (!analysisId) {
    return (
      <AdminShell title="Truth Report" backTo={backTo} backLabel="Back to dossier">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">No analysis on file yet</p>
            <p className="mt-0.5 opacity-90">
              This lead has no completed Truth Engine analysis. Once a quote is scanned,
              the full report will appear here.
            </p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (analysisErr || !reportData) {
    return (
      <AdminShell title="Truth Report" backTo={backTo} backLabel="Back to dossier">
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Analysis failed to load</p>
            <p className="mt-0.5 opacity-90">{getErrorMessage(analysisErrObj) || "Unable to load analysis."}</p>
          </div>
        </div>
      </AdminShell>
    );
  }

  const homeownerName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const county = lead.county || "Florida";

  return (
    <AdminShell
      title={`Truth Report · ${homeownerName}`}
      backTo={backTo}
      backLabel="Back to dossier"
    >
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Admin view</span> · OTP gate bypassed via admin RBAC.
          Homeowner-facing route remains verify-to-reveal.
        </span>
        {lead.latest_scan_session_id && (
          <Link
            to={`/report/classic/${lead.latest_scan_session_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto underline hover:no-underline"
          >
            Open homeowner view ↗
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <TruthReportClassic
          grade={reportData.grade}
          flags={reportData.flags}
          pillarScores={reportData.pillarScores}
          contractorName={reportData.contractorName}
          county={county}
          confidenceScore={reportData.confidenceScore}
          documentType={reportData.documentType}
          accessLevel="full"
          qualityBand={reportData.qualityBand}
          hasWarranty={reportData.hasWarranty}
          hasPermits={reportData.hasPermits}
          pageCount={reportData.pageCount}
          lineItemCount={reportData.lineItemCount}
          flagCount={reportData.flagCount}
          flagRedCount={reportData.flagRedCount}
          flagAmberCount={reportData.flagAmberCount}
          onContractorMatchClick={() => {
            /* admin viewer is read-only — CTA is no-op */
          }}
          onReportHelpCall={() => {
            /* admin viewer is read-only — CTA is no-op */
          }}
          onSecondScan={() => {
            window.location.href = backTo;
          }}
          derivedMetrics={reportData.derivedMetrics as any}
          priceFairness={reportData.priceFairness}
          markupEstimate={reportData.markupEstimate}
          negotiationLeverage={reportData.negotiationLeverage}
          warnings={reportData.warnings}
          missingItems={reportData.missingItems}
          summary={reportData.summary}
          topWarning={reportData.topWarning}
          topMissingItem={reportData.topMissingItem}
          pricePerOpening={reportData.pricePerOpening}
          pricePerOpeningBand={reportData.pricePerOpeningBand}
          paymentRiskDetected={reportData.paymentRiskDetected}
          scopeGapDetected={reportData.scopeGapDetected}
          summaryTeaser={reportData.summaryTeaser}
          missingItemsCount={reportData.missingItemsCount}
          ctaLabel="Admin View"
        />
      </div>
    </AdminShell>
  );
}
