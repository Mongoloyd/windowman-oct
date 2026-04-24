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
  CheckCircle2, ExternalLink, FileText, Flag, ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import {
  fetchLeadDetail, fetchLeadAnalysis, getErrorMessage,
} from "@/services/adminDataService";
import { isValidLeadId, isValidScanSessionId } from "@/lib/routeIdGuards";
import { LeadStatusPanel } from "@/components/admin/lead-workspace/LeadStatusPanel";
import { LeadNotesPanel } from "@/components/admin/lead-workspace/LeadNotesPanel";
import { LeadTasksPanel } from "@/components/admin/lead-workspace/LeadTasksPanel";
import { LeadTimelinePanel } from "@/components/admin/lead-workspace/LeadTimelinePanel";
import { LeadHumanContextPanel } from "@/components/admin/lead-workspace/LeadHumanContextPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-green-600 text-white border-green-700";
    case "B": return "bg-emerald-500 text-white border-emerald-600";
    case "C": return "bg-amber-500 text-white border-amber-600";
    case "D": return "bg-orange-600 text-white border-orange-700";
    case "F": return "bg-destructive text-destructive-foreground border-destructive";
    default:  return "bg-muted text-muted-foreground border-border";
  }
}

function InfoCell({
  label, value, icon: Icon,
}: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground flex items-center gap-1.5 break-all">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        {value || <span className="text-muted-foreground">—</span>}
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

  if (isLoading) {
    return (
      <AdminShell title="Loading lead…" backTo="/admin/leads" backLabel="Back to inbox">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (isError || !lead) {
    return (
      <AdminShell title="Couldn't load lead" backTo="/admin/leads" backLabel="Back to inbox">
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
  const flags = Array.isArray(analysis?.flags) ? analysis!.flags : [];

  return (
    <AdminShell
      eyebrow="Operator · Lead Workspace"
      title={name}
      subtitle={`Lead ID: ${lead.id.slice(0, 8)}… · Created ${format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}`}
      backTo="/admin/leads"
      backLabel="Back to inbox"
    >
      {/* Prominent "Back to Inbox" affordance — the AdminShell breadcrumb is small;
          this is the canonical exit so operators can't miss it on the dossier page. */}
      <div className="mb-5 flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/leads" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Inbox
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: Intake + Scan + Timeline ─────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Intake
                </p>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
                  Contact &amp; project
                </h3>
              </div>
              {lead.phone_verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </span>
              )}
            </header>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoCell label="Name" value={name} />
              <InfoCell label="Email" icon={Mail} value={lead.email && (
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline truncate">{lead.email}</a>
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

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <header className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Scan &amp; Report
                </p>
                <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
                  Truth Engine
                </h3>
              </div>
              {lead.grade && (
                <span className={`inline-flex items-center justify-center rounded-full border-2 w-9 h-9 text-base font-extrabold ${gradeColor(lead.grade)}`}>
                  {lead.grade}
                </span>
              )}
            </header>
            {!lead.latest_analysis_id ? (
              <p className="text-sm text-muted-foreground italic">No analysis yet for this lead.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</p>
                    <p className="font-mono font-semibold">{analysis?.confidence_score ?? lead.confidence_score ?? "—"}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Flags</p>
                    <p className="font-semibold">{flags.length || lead.flag_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical</p>
                    <p className="font-semibold text-destructive">{lead.critical_flag_count ?? 0}</p>
                  </div>
                </div>

                {flags.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Flag className="h-3 w-3" /> Top flags
                    </p>
                    <ul className="space-y-1.5">
                      {flags.slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <Badge
                            className={`text-[10px] px-1.5 py-0 shrink-0 uppercase font-bold ${
                              f.severity === "Critical" || f.severity === "High"
                                ? "bg-destructive/15 text-destructive border border-destructive/30"
                                : f.severity === "Medium"
                                ? "bg-amber-500/15 text-amber-700 border border-amber-500/30"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {f.severity}
                          </Badge>
                          <span className="text-foreground/90">{f.flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {lead.latest_analysis_id ? (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <Link
                      to={`/admin/leads/${leadId}/report`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Open Truth Report
                    </Link>
                    {isValidScanSessionId(lead.latest_scan_session_id) ? (
                      <Link
                        to={`/report/classic/${lead.latest_scan_session_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Homeowner view
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-[11px] italic text-muted-foreground">
                        No valid homeowner report link
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* Phase 10 — Human Context Layer (motivation, property, timeline,
              handoff consent, fit warnings, deterministic opening script). */}
          <LeadHumanContextPanel
            lead={{
              first_name: lead.first_name,
              last_name: lead.last_name,
              county: lead.county,
              property_type_detail: (lead as any).property_type_detail ?? null,
              hoa_or_condo_complexity: (lead as any).hoa_or_condo_complexity ?? null,
              handoff_consent_status: (lead as any).handoff_consent_status ?? null,
              timeline_bucket: (lead as any).timeline_bucket ?? null,
            }}
            diagnosisIntake={(lead as any).diagnosis_intake ?? null}
            analysis={analysis ?? null}
            latestRoute={(lead as any).latest_route ?? null}
          />

          <LeadTimelinePanel leadId={leadId} />
        </div>

        {/* ── Right column: Status + Notes + Tasks ──────────────────── */}
        <div className="space-y-5">
          <LeadStatusPanel leadId={leadId} currentStage={lead.funnel_stage} />
          <LeadTasksPanel leadId={leadId} />
          <LeadNotesPanel leadId={leadId} />
        </div>
      </div>
    </AdminShell>
  );
}
