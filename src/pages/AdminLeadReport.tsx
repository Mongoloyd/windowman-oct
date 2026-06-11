/**
 * AdminLeadReport — Admin-gated Truth Report viewer.
 * Route: /admin/leads/:id/report
 *
 * Renders the same dark forensic V3 report homeowners see after verify-to-reveal,
 * using the admin-authorized `admin-data` RPC (fetch_lead_detail + fetch_lead_analysis)
 * to load the full analysis payload server-side. No homeowner OTP gate is
 * involved — admin RBAC inside admin-data is the gate.
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
import ReportClassicDarkV2Full from "@/components/forensic-report/ReportClassicDarkV2Full";
import { rawFullRowToV2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.source";
import { buildFullData } from "@/hooks/useAnalysisData";
import { isValidLeadId, isValidScanSessionId } from "@/lib/routeIdGuards";
import type { RawFullRow } from "@/types/serviceResults";

export default function AdminLeadReport() {
  const { id: leadId } = useParams<{ id: string }>();
  const leadIdValid = isValidLeadId(leadId);

  useEffect(() => {
    document.title = "Truth Report · Admin";
  }, []);

  const { data: lead, isLoading: leadLoading, isError: leadErr, error: leadErrObj } = useQuery({
    queryKey: ["admin", "lead-detail", leadId],
    queryFn: () => fetchLeadDetail(leadId!),
    enabled: leadIdValid,
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

  const { reportData, v2ReportSource } = useMemo(() => {
    if (!analysis) return { reportData: null, v2ReportSource: null };
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
    return {
      reportData: buildFullData(row),
      v2ReportSource: rawFullRowToV2ReportSource(row),
    };
  }, [analysis, analysisId]);

  const backTo = leadIdValid ? `/admin/leads/${leadId}` : "/admin/leads";

  if (!leadIdValid) {
    return (
      <AdminShell title="Invalid lead ID" backTo="/admin/leads" backLabel="Back to inbox">
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Invalid lead ID</p>
            <p className="mt-0.5 opacity-90">
              This admin URL does not contain a valid lead UUID.
              {leadId ? <> Received: <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-xs">{leadId}</code></> : null}
            </p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (leadLoading || analysisLoading) {
    return (
      <AdminShell title="Loading Truth Report…" backTo={backTo} backLabel="Back to dossier">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
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
        {isValidScanSessionId(lead.latest_scan_session_id) ? (
          <Link
            to={`/report/classic/${lead.latest_scan_session_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto underline hover:no-underline"
          >
            Open homeowner view ↗
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <ReportClassicDarkV2Full
          analysisData={reportData}
          v2ReportSource={v2ReportSource}
          county={county}
        />
      </div>
    </AdminShell>
  );
}
