/**
 * AdminLeadReport — Admin-gated analysis evidence viewer.
 * Route: /admin/leads/:id/report
 *
 * Loads bounded admin evidence via `fetch_lead_analysis` (evidence_projection).
 * Does not fetch or render homeowner `full_json` / full Truth Report payload.
 * Admin RBAC inside admin-data is the gate.
 */

import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, ArrowLeft, ShieldCheck, Flag } from "lucide-react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";
import {
  fetchLeadDetail,
  fetchLeadAnalysis,
  getErrorMessage,
} from "@/services/adminDataService";
import { isValidLeadId, isValidScanSessionId } from "@/lib/routeIdGuards";
import {
  buildAdminLeadReportEvidenceView,
  type AdminLeadAnalysisResponse,
} from "@/pages/adminLeadReportEvidence";

const PILLAR_LABELS: Record<string, string> = {
  safety: "Safety & Code",
  install: "Install & Scope",
  price: "Price Fairness",
  finePrint: "Fine Print",
  warranty: "Warranty Value",
};

const REPORT_EYEBROW = "Operator · Analysis evidence";
const WORKSPACE_BACK_LABEL = "Back to lead workspace";
const INBOX_BACK_LABEL = "Back to Lead Inbox";

function formatConfidence(score: number | null): string {
  if (score == null) return "—";
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `${pct}%`;
}

export default function AdminLeadReport() {
  const { id: leadId } = useParams<{ id: string }>();
  const leadIdValid = isValidLeadId(leadId);

  useEffect(() => {
    document.title = "Analysis evidence · Admin";
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

  const evidenceView = useMemo(() => {
    if (!analysis || !analysisId) return null;
    return buildAdminLeadReportEvidenceView(
      analysisId,
      analysis as AdminLeadAnalysisResponse,
    );
  }, [analysis, analysisId]);

  const backTo = leadIdValid ? `/admin/leads/${leadId}` : "/admin/leads";

  if (!leadIdValid) {
    return (
      <AdminShell
        eyebrow={REPORT_EYEBROW}
        title="Invalid lead ID"
        backTo="/admin/leads"
        backLabel={INBOX_BACK_LABEL}
        nav={<AdminGlobalNav />}
      >
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
      <AdminShell
        eyebrow={REPORT_EYEBROW}
        title="Loading analysis evidence…"
        backTo={backTo}
        backLabel={WORKSPACE_BACK_LABEL}
        nav={<AdminGlobalNav />}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="wm-on-canvas-text h-6 w-6 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  if (leadErr || !lead) {
    return (
      <AdminShell
        eyebrow={REPORT_EYEBROW}
        title="Couldn't load report"
        backTo={backTo}
        backLabel={WORKSPACE_BACK_LABEL}
        nav={<AdminGlobalNav />}
      >
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
      <AdminShell
        eyebrow={REPORT_EYEBROW}
        title="Analysis evidence"
        backTo={backTo}
        backLabel={WORKSPACE_BACK_LABEL}
        nav={<AdminGlobalNav />}
      >
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">No analysis on file yet</p>
            <p className="mt-0.5 opacity-90">
              This lead has no completed Truth Engine analysis. Once a quote is scanned,
              safe admin evidence will appear here.
            </p>
          </div>
        </div>
      </AdminShell>
    );
  }

  if (analysisErr || !evidenceView) {
    return (
      <AdminShell
        eyebrow={REPORT_EYEBROW}
        title="Analysis evidence"
        backTo={backTo}
        backLabel={WORKSPACE_BACK_LABEL}
        nav={<AdminGlobalNav />}
      >
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
  const pillarEntries = evidenceView.pillarScores
    ? Object.entries(evidenceView.pillarScores)
    : [];
  const extraction = evidenceView.operatorExtraction;

  return (
    <AdminShell
      eyebrow={REPORT_EYEBROW}
      title={`Analysis evidence · ${homeownerName}`}
      backTo={backTo}
      backLabel={WORKSPACE_BACK_LABEL}
      nav={<AdminGlobalNav />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Admin safe projection</span> · Grade, flags, and preview pillars only.
          Homeowner full report remains verify-to-reveal.
        </span>
        {isValidScanSessionId(lead.latest_scan_session_id) ? (
          <Link
            to={`/report/classic/${lead.latest_scan_session_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto underline hover:no-underline inline-flex items-center gap-1"
          >
            Homeowner route ↗
          </Link>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs uppercase text-slate-600">Grade</p>
            <p className="text-2xl font-bold">{evidenceView.grade ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-600">Confidence</p>
            <p className="font-mono font-medium">{formatConfidence(evidenceView.confidenceScore)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-600">Dollar delta</p>
            <p className="font-bold tabular-nums">
              {evidenceView.dollarDelta != null
                ? `${evidenceView.dollarDelta > 0 ? "+" : ""}$${Math.abs(evidenceView.dollarDelta).toLocaleString()}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-600">Flags</p>
            <p className="font-medium">{evidenceView.flags.length}</p>
          </div>
        </div>

        {evidenceView.pillarDetailUnavailable && (
          <p className="text-sm text-slate-700 border border-dashed border-border rounded-lg px-4 py-3">
            Detailed pillar evidence is not available in this admin projection.
          </p>
        )}

        {pillarEntries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {pillarEntries.map(([key, score]) => (
              <div key={key} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-xs uppercase text-slate-600">{PILLAR_LABELS[key] ?? key}</p>
                <p className="text-lg font-bold font-mono">{score}/100</p>
              </div>
            ))}
          </div>
        )}

        {evidenceView.flags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flag className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Flagged issues</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {evidenceView.flags.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-xs font-bold uppercase text-destructive shrink-0">{f.severity}</span>
                  <span>{f.flag}{f.detail ? ` — ${f.detail}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {evidenceView.proofOfRead && (
          <div className="text-sm text-slate-700">
            <p className="text-xs uppercase font-semibold mb-1">Proof of read</p>
            <p className="font-mono text-xs">
              {evidenceView.proofOfRead.document_read === true ? "Document read confirmed" : "Summary available"}
            </p>
          </div>
        )}

        {extraction && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-sm space-y-1">
            <p className="text-xs uppercase font-semibold text-slate-600">Operator summary</p>
            {extraction.contractor_name && (
              <p><span className="text-slate-600">Contractor:</span> {String(extraction.contractor_name)}</p>
            )}
            {extraction.total_quoted_price != null && (
              <p><span className="text-slate-600">Quoted:</span> ${Number(extraction.total_quoted_price).toLocaleString()}</p>
            )}
            {extraction.opening_count != null && (
              <p><span className="text-slate-600">Openings:</span> {String(extraction.opening_count)}</p>
            )}
          </div>
        )}

        <p className="text-xs text-slate-600 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Use the lead dossier for CRM actions. This page does not render the homeowner Truth Report skin.
        </p>
      </div>
    </AdminShell>
  );
}
