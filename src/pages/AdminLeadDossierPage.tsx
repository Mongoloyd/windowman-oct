/**
 * AdminLeadDossierPage — Sprint 4 + 5
 *
 * Full-page lead workspace at /admin/leads/:id.
 * Sections: Intake summary, Status workflow, Notes, Tasks, Timeline,
 * Scan/report snapshot, Attachments link.
 */

import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, AlertCircle, Mail, Phone, MapPin, Hash, DollarSign,
  CheckCircle2, ExternalLink, FileText, Flag, ArrowLeft, GitBranch,
} from "lucide-react";
import { format } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";
import {
  fetchLeadDetail, fetchLeadAnalysis, getErrorMessage,
} from "@/services/adminDataService";
import { isValidLeadId, isValidScanSessionId } from "@/lib/routeIdGuards";
import { LeadStatusPanel } from "@/components/admin/lead-workspace/LeadStatusPanel";
import { LeadNotesPanel } from "@/components/admin/lead-workspace/LeadNotesPanel";
import { LeadTasksPanel } from "@/components/admin/lead-workspace/LeadTasksPanel";
import { LeadTimelinePanel } from "@/components/admin/lead-workspace/LeadTimelinePanel";
import { LeadHumanContextPanel } from "@/components/admin/lead-workspace/LeadHumanContextPanel";
import { QuoteViewerButton } from "@/components/admin/QuoteViewerButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadIdentity } from "@/components/admin/LeadIdentity";

interface DossierAnalysisFlag {
  severity?: string;
  flag?: string;
}

type HumanContextProps = React.ComponentProps<typeof LeadHumanContextPanel>;

interface DossierLeadContext {
  property_type_detail?: string | null;
  hoa_or_condo_complexity?: string | null;
  handoff_consent_status?: string | null;
  timeline_bucket?: string | null;
  diagnosis_intake?: HumanContextProps["diagnosisIntake"];
  latest_route?: HumanContextProps["latestRoute"];
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-emerald-900 text-white border-emerald-950";
    case "B": return "bg-emerald-100 text-emerald-950 border-emerald-300";
    case "C": return "bg-amber-100 text-amber-950 border-amber-300";
    case "D": return "bg-orange-100 text-orange-950 border-orange-300";
    case "F": return "bg-red-100 text-red-950 border-red-300";
    default:  return "bg-white text-slate-950 border-slate-400";
  }
}

function InfoCell({
  label, value, icon: Icon,
}: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">{label}</p>
      <div className="wm-lead-break flex min-w-0 items-start gap-1.5 text-base font-semibold text-slate-950">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-700 shrink-0" />}
        {value || <span className="text-slate-700">—</span>}
      </div>
    </div>
  );
}

export default function AdminLeadDossierPage() {
  const { id: leadId } = useParams<{ id: string }>();
  const leadIdValid = isValidLeadId(leadId);

  useEffect(() => {
    document.title = "Lead Dossier · WindowMan Admin";
  }, []);

  const { data: lead, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "lead-detail", leadId],
    queryFn: () => fetchLeadDetail(leadId!),
    enabled: leadIdValid,
  });

  const { data: analysis } = useQuery({
    queryKey: ["admin", "lead-analysis", lead?.latest_analysis_id],
    queryFn: () => fetchLeadAnalysis(lead!.latest_analysis_id!),
    enabled: !!lead?.latest_analysis_id,
  });

  if (!leadIdValid) {
    return (
      <AdminShell title="Invalid lead ID" backTo="/admin/leads" backLabel="Back to inbox" nav={<AdminGlobalNav />}>
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

  if (isLoading) {
    return (
      <AdminShell title="Loading lead…" backTo="/admin/leads" backLabel="Back to inbox" nav={<AdminGlobalNav />}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="wm-on-canvas-text h-6 w-6 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  if (isError || !lead) {
    return (
      <AdminShell title="Couldn't load lead" backTo="/admin/leads" backLabel="Back to inbox" nav={<AdminGlobalNav />}>
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Lead unavailable</p>
            <p className="mt-0.5 opacity-90">{getErrorMessage(error) || "Lead not found."}</p>
            <button onClick={() => refetch()} className="mt-2 text-xs underline">Retry</button>
          </div>
        </div>
      </AdminShell>
    );
  }

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const flags: DossierAnalysisFlag[] = Array.isArray(analysis?.flags) ? analysis.flags : [];
  const leadContext = lead as DossierLeadContext;

  return (
    <AdminShell
      eyebrow="Operator · Lead Workspace"
      title={name}
      subtitle={`Created ${format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}`}
      backTo="/admin/leads"
      backLabel="Back to inbox"
      nav={<AdminGlobalNav variant="lead-dossier" />}
      variant="lead-dossier"
    >
      <div
        className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="admin-lead-dossier-page"
      >
        <LeadIdentity leadId={lead.id} full className="text-xs font-semibold text-slate-700" />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/leads" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Lead Inbox
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/pipeline?lead_id=${lead.id}`} className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Open in Pipeline
            </Link>
          </Button>
        </div>
      </div>

      <div className="wm-lead-dossier-grid">
        <section className="wm-lead-dossier-panel wm-lead-dossier-intake">
          <header className="flex items-center justify-between mb-4">
            <div>
              <p className="wm-lead-dossier-kicker">
                Intake
              </p>
              <h2 className="wm-lead-dossier-heading">
                Contact &amp; project
              </h2>
            </div>
            {lead.phone_verified && (
              <span className="wm-admin-badge border-emerald-300 bg-emerald-100 text-emerald-950">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </span>
            )}
          </header>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCell label="Name" value={name} />
            <InfoCell label="Email" icon={Mail} value={lead.email && (
              <a href={`mailto:${lead.email}`} className="min-w-0 break-words text-primary hover:underline">{lead.email}</a>
            )} />
            <InfoCell label="Phone" icon={Phone} value={lead.phone_e164 && (
              <a href={`tel:${lead.phone_e164}`} className="text-primary hover:underline font-mono">{lead.phone_e164}</a>
            )} />
            <InfoCell label="Location" icon={MapPin} value={[lead.county, lead.state, lead.zip].filter(Boolean).join(", ") || null} />
            <InfoCell label="Window count" icon={Hash} value={lead.window_count} />
            <InfoCell label="Project type" value={lead.project_type} />
            <InfoCell label="Quote range" value={lead.quote_range} />
            <InfoCell label="Quote amount" icon={DollarSign} value={lead.quote_amount ? `$${Number(lead.quote_amount).toLocaleString()}` : null} />
            <InfoCell label="Source" value={lead.utm_source ?? lead.source ?? null} />
          </div>
        </section>

        <div className="wm-lead-dossier-stage">
          <LeadStatusPanel leadId={leadId} currentStage={lead.funnel_stage} />
        </div>

        <section className="wm-lead-dossier-panel wm-lead-dossier-truth">
            <header className="flex items-center justify-between mb-4">
              <div>
                <p className="wm-lead-dossier-kicker">
                  Scan &amp; Report
                </p>
                <h2 className="wm-lead-dossier-heading">
                  Truth Engine
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <QuoteViewerButton leadId={lead.id} />
                {lead.grade && (
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-extrabold shadow-sm ${gradeColor(lead.grade)}`}>
                    {lead.grade}
                  </span>
                )}
              </div>
            </header>
            {!lead.latest_analysis_id ? (
              <p className="text-sm text-slate-700 italic">No analysis yet for this lead.</p>
            ) : (
              <div className="space-y-3">
                <div className="wm-lead-dossier-metrics">
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Confidence</p>
                    <p className="font-mono text-base font-bold text-slate-950">{analysis?.confidence_score ?? lead.confidence_score ?? "—"}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Flags</p>
                    <p className="text-base font-bold text-slate-950">{flags.length || lead.flag_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700">Critical</p>
                    <p className="text-base font-bold text-red-800">{lead.critical_flag_count ?? 0}</p>
                  </div>
                </div>

                {flags.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-[0.14em] text-slate-700">
                      <Flag className="h-4 w-4" /> Top flags
                    </p>
                    <ul className="space-y-1.5">
                      {flags.slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-950">
                          <Badge
                            className={`shrink-0 px-2 py-0.5 text-xs font-extrabold uppercase ${
                              f.severity === "Critical" || f.severity === "High"
                                ? "border border-rose-300 bg-rose-100 text-rose-950"
                                : f.severity === "Medium"
                                ? "border border-amber-300 bg-amber-100 text-amber-950"
                                : "border border-slate-300 bg-slate-100 text-slate-950"
                            }`}
                          >
                            {f.severity}
                          </Badge>
                          <span>{f.flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lead.latest_analysis_id ? (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <Link
                      to={`/admin/leads/${leadId}/report`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-extrabold text-blue-800 shadow-sm hover:text-blue-950 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Open Truth Report
                    </Link>
                    {isValidScanSessionId(lead.latest_scan_session_id) ? (
                      <Link
                        to={`/report/classic/${lead.latest_scan_session_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-800 shadow-sm hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        Homeowner view
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold italic text-slate-700">
                        No valid homeowner report link
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}
        </section>

        <div className="wm-lead-dossier-context">
          <LeadHumanContextPanel
            lead={{
              first_name: lead.first_name,
              last_name: lead.last_name,
              county: lead.county,
              property_type_detail: leadContext.property_type_detail ?? null,
              hoa_or_condo_complexity: leadContext.hoa_or_condo_complexity ?? null,
              handoff_consent_status: leadContext.handoff_consent_status ?? null,
              timeline_bucket: leadContext.timeline_bucket ?? null,
            }}
            diagnosisIntake={leadContext.diagnosis_intake ?? null}
            analysis={analysis ?? null}
            latestRoute={leadContext.latest_route ?? null}
          />
        </div>

        <div className="wm-lead-dossier-tasks">
          <LeadTasksPanel leadId={leadId} />
        </div>
        <div className="wm-lead-dossier-notes">
          <LeadNotesPanel leadId={leadId} />
        </div>
        <div className="wm-lead-dossier-timeline">
          <LeadTimelinePanel leadId={leadId} />
        </div>
      </div>
    </AdminShell>
  );
}
