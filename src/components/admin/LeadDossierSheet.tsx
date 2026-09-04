/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD DOSSIER SHEET — Full lead intelligence side panel
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, Mail, MapPin, Hash, DollarSign, Clock,
  AlertTriangle, CheckCircle, ExternalLink, Globe,
  ChevronDown, ChevronUp, Flag, Info,
  PhoneCall, Calendar, CalendarCheck, RotateCcw, AlertCircle,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import type { CRMLead, AnalysisFlag, LeadAnalysisData } from "./types";
import {
  operatorExtractionFromProjection,
  pillarScoresRecordFromProjection,
} from "./adminAnalysisEvidence";
import { fetchLeadAnalysis, fetchLeadVoiceFollowups, invokeAdminData, routeLeadToContractor, fetchContractors } from "@/services/adminDataService";
import type { VoiceFollowup } from "@/services/adminDataService";
import { OpportunityRouteTimeline } from "./OpportunityRouteTimeline";
import ForensicFindingsPanel from "@/components/dossier/ForensicFindingsPanel";
import { LeadLifecycleTimeline } from "./LeadLifecycleTimeline";
import { LeadIdentity } from "./LeadIdentity";
import { useQuery } from "@tanstack/react-query";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-emerald-900 text-white";
    case "B": return "bg-emerald-100 text-emerald-950 border border-emerald-300";
    case "C": return "bg-amber-100 text-amber-950 border border-amber-300";
    case "D": return "bg-orange-100 text-orange-950 border border-orange-300";
    case "F": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-slate-700";
  }
}

function scoreToGrade(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function InfoRow({ label, value, icon: Icon }: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="wm-verdict-dossier__info flex items-start gap-2 py-1.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0">
        <p className="wm-verdict-dossier__label text-xs uppercase">{label}</p>
        <div className="wm-verdict-dossier__value break-all text-sm font-semibold">{value || <span className="wm-verdict-dossier__empty">—</span>}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="wm-verdict-dossier__section-title mb-3 text-xs font-bold uppercase">
      {children}
    </h3>
  );
}

function TimelineEntry({ label, timestamp }: { label: string; timestamp: string | null }) {
  if (!timestamp) return null;
  return (
    <div className="flex items-center gap-2 py-1">
      <Clock className="h-3.5 w-3.5 text-slate-700" />
      <span className="text-xs text-slate-700">{label}</span>
      <span className="text-xs font-mono ml-auto">
        {format(new Date(timestamp), "MMM d, yyyy h:mm a")}
      </span>
    </div>
  );
}

/* ── Pillar Types ─────────────────────────────────────────────────────── */

const PILLAR_CONFIG = [
  { key: "safety", label: "Safety & Code" },
  { key: "install", label: "Install & Scope" },
  { key: "price", label: "Price Fairness" },
  { key: "finePrint", label: "Fine Print" },
  { key: "warranty", label: "Warranty Value" },
] as const;

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3,
};

/* ── Props ────────────────────────────────────────────────────────────── */

interface LeadDossierSheetProps {
  lead: CRMLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function LeadDossierSheet({ lead, open, onOpenChange }: LeadDossierSheetProps) {
  const [analysis, setAnalysis] = useState<LeadAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [auditOpen, setAuditOpen] = useState(true);
  const [showAllFlags, setShowAllFlags] = useState(false);

  // ── Call History state ──
  const [callHistory, setCallHistory] = useState<VoiceFollowup[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [callHistoryError, setCallHistoryError] = useState<string | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !lead?.latest_analysis_id) {
      setAnalysis(null);
      setAnalysisError(false);
      return;
    }

    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError(false);
    fetchLeadAnalysis(lead.latest_analysis_id)
      .then((data) => {
        if (!cancelled && data) {
          setAnalysis({
            grade: data.grade ?? null,
            dollar_delta: data.dollar_delta ?? null,
            confidence_score: data.confidence_score ?? null,
            flags: Array.isArray(data.flags) ? data.flags : [],
            evidence_projection: data.evidence_projection ?? null,
          });
        }
      })
      .catch((err) => {
        console.error("[Dossier] Failed to fetch analysis:", err);
        if (!cancelled) setAnalysisError(true);
      })
      .finally(() => { if (!cancelled) setAnalysisLoading(false); });

    return () => { cancelled = true; };
  }, [open, lead?.latest_analysis_id]);

  // ── Fetch call history on lead change ──
  const refetchCallHistory = useCallback(() => {
    if (!lead?.id) return;
    setCallHistoryLoading(true);
    setCallHistoryError(null);
    fetchLeadVoiceFollowups(lead.id)
      .then(setCallHistory)
      .catch((err) => setCallHistoryError(err?.message ?? "Unknown error"))
      .finally(() => setCallHistoryLoading(false));
  }, [lead?.id]);

  useEffect(() => {
    if (!open || !lead?.id) {
      setCallHistory([]);
      setCallHistoryError(null);
      return;
    }
    setExpandedTranscripts(new Set());
    refetchCallHistory();
  }, [open, lead?.id, refetchCallHistory]);

  // ── Retry call handler ──
  const handleRetryCall = useCallback(async (entry: VoiceFollowup) => {
    if (!lead) return;
    const scanSessionId = lead.latest_scan_session_id ?? entry.scan_session_id;
    if (!scanSessionId) {
      console.error("[Dossier] Cannot retry — no scan_session_id");
      toast.error("Cannot retry — missing scan session data");
      return;
    }
    try {
      await invokeAdminData("trigger_voice_followup", {
        scan_session_id: scanSessionId,
        phone_e164: lead.phone_e164 ?? entry.phone_e164,
      });
      refetchCallHistory();
    } catch (err) {
      console.error("[Dossier] Retry call failed:", err);
      toast.error("Retry call failed");
    }
  }, [lead, refetchCallHistory]);

  // ── Handoff state ──
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffSending, setHandoffSending] = useState(false);
  const [localSentToContractor, setLocalSentToContractor] = useState(false);

  // Reset local sent state on lead change
  useEffect(() => {
    setLocalSentToContractor(false);
    setHandoffModalOpen(false);
  }, [lead?.id]);

  // Load contractors so we can pick the canonical one for the unified routing helper.
  const { data: contractorsList } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    enabled: open && !!lead,
    staleTime: 60_000,
  });

  if (!lead) return null;

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const alreadySent = !!lead.latest_opportunity_id || localSentToContractor;

  // ── Pillar data from safe admin evidence projection ──
  const evidenceProjection = analysis?.evidence_projection ?? null;
  const pillarScores = pillarScoresRecordFromProjection(evidenceProjection);
  const extraction = operatorExtractionFromProjection(evidenceProjection);
  const pillarDetailUnavailable = analysis != null &&
    !evidenceProjection?.pillar_detail_available;

  // ── Sorted flags ──
  const sortedFlags = [...(analysis?.flags ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );
  const visibleFlags = showAllFlags ? sortedFlags : sortedFlags.slice(0, 5);
  const severityCounts = sortedFlags.reduce(
    (counts, flag) => {
      if (flag.severity === "Critical" || flag.severity === "High") counts.high += 1;
      else if (flag.severity === "Medium") counts.medium += 1;
      else counts.other += 1;
      return counts;
    },
    { high: 0, medium: 0, other: 0 },
  );
  const flagCount = sortedFlags.length;
  const confidence = analysis?.confidence_score ?? null;
  const confidenceWidth = confidence == null
    ? 0
    : Math.max(0, Math.min(100, confidence));
  const dollarDelta = analysis?.dollar_delta;
  const dollarDeltaLabel = dollarDelta == null
    ? "—"
    : `${dollarDelta > 0 ? "+" : ""}$${Math.abs(dollarDelta).toLocaleString()}`;
  const evidenceNotice = !lead.latest_analysis_id
    ? { tone: "intel", label: "Analysis pending — evidence file not yet assembled" }
    : analysisLoading
    ? { tone: "intel", label: "Assembling evidence projection" }
    : analysisError
    ? { tone: "high", label: "Evidence unavailable — review required" }
    : pillarDetailUnavailable
    ? { tone: "medium", label: "Limited evidence — detailed review unavailable" }
    : null;

  // ── Top HIGH flags for handoff preview ──
  const topHighFlags = sortedFlags
    .filter((f) => f.severity === "High" || f.severity === "Critical")
    .slice(0, 3);

  const activeContractors = (contractorsList ?? []).filter((c: any) => c.status === "active");
  const canonicalContractorId = activeContractors.length >= 1 ? activeContractors[0].id : null;

  // ── Handoff confirm handler — uses canonical unified routing helper ──
  const handleHandoffConfirm = async () => {
    if (!canonicalContractorId) {
      toast.error("No active contractor configured");
      return;
    }
    setHandoffSending(true);
    try {
      const result = await routeLeadToContractor(
        lead.id,
        canonicalContractorId,
        lead.latest_scan_session_id ?? undefined,
      );
      if (result.success) {
        if (result.warning) toast.warning(result.warning);
        else toast.success("Routed to contractor");
        setLocalSentToContractor(true);
        setHandoffModalOpen(false);
      } else {
        toast.error(result.warning ?? "Handoff failed");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Handoff failed");
    } finally {
      setHandoffSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="wm-verdict-dossier wm-slim-scrollbar w-full overflow-y-auto border-[#26303D] bg-[#0A0E14] p-0 text-[#E6EDF3] sm:max-w-[min(760px,58vw)]"
      >
        <SheetHeader className="wm-verdict-dossier__cover sticky top-0 z-20 space-y-0 px-5 pb-4 pt-5 pr-14 text-left sm:px-6 sm:pr-14">
          <p className="wm-verdict-dossier__classification">Confidential · Lead verdict file</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SheetTitle className="font-mono text-2xl font-black tracking-tight text-[#E6EDF3] sm:text-3xl">
              {name}
            </SheetTitle>
            {lead.grade ? (
              <Badge className={`${gradeColor(lead.grade)} border text-xs px-2`}>
                Grade {lead.grade}
              </Badge>
            ) : null}
          </div>
          <SheetDescription className="mt-1 font-mono text-xs text-[#9AA7B8]">
            Created {format(new Date(lead.created_at), "MMM d, yyyy")} · operator projection
          </SheetDescription>
          <LeadIdentity
            leadId={lead.id}
            variant="verdict"
            className="mt-2 text-xs font-semibold text-[#9AA7B8]"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-11 gap-1.5 border-[#35506a] bg-[#18212E] text-xs text-[#E6EDF3] hover:border-[#7DE3FF] hover:bg-[#203047] hover:text-white"
            >
              <Link to={`/admin/leads/${lead.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open Lead Workspace
              </Link>
            </Button>
            {alreadySent ? (
              <Button variant="outline" size="sm" disabled className="h-11 cursor-not-allowed gap-1.5 border-[#2F6B43] bg-[#12251A] text-xs text-[#8BDBA4] opacity-100">
                <CheckCircle className="w-3.5 h-3.5 text-[#3FB950]" />
                Sent to Contractor
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-1.5 border-[#8A641C] bg-[#201B12] text-xs text-[#F5C66A] hover:border-[#F5A623] hover:bg-[#2A2112] hover:text-[#FFD88A]"
                onClick={() => setHandoffModalOpen(true)}
              >
                <Send className="w-3.5 h-3.5" />
                Send to Contractor
              </Button>
            )}
            {alreadySent && (
              <Badge className="border border-[#2F6B43] bg-[#12251A] text-sm text-[#8BDBA4]">
                Sent {localSentToContractor ? "just now" : ""}
              </Badge>
            )}
          </div>

          <div className="wm-verdict-dossier__hero mt-4" aria-label="Verdict summary">
            <div className="wm-verdict-dossier__metric wm-verdict-dossier__metric--primary">
              <p>Dollar delta</p>
              <strong>{dollarDeltaLabel}</strong>
              <span>Quoted-price variance</span>
            </div>
            <div className="wm-verdict-dossier__metric">
              <p>Flag count</p>
              <strong>{flagCount}</strong>
              <div
                className="wm-verdict-dossier__severity-meter"
                aria-label={`${severityCounts.high} high and ${severityCounts.medium} medium flags`}
              >
                {flagCount > 0 ? (
                  <>
                    <span className="is-high" style={{ width: `${(severityCounts.high / flagCount) * 100}%` }} />
                    <span className="is-medium" style={{ width: `${(severityCounts.medium / flagCount) * 100}%` }} />
                    <span className="is-other" style={{ width: `${(severityCounts.other / flagCount) * 100}%` }} />
                  </>
                ) : <span className="is-empty" />}
              </div>
            </div>
            <div className="wm-verdict-dossier__metric">
              <p>Confidence</p>
              <strong>{confidence == null ? "—" : `${confidence}%`}</strong>
              <div
                className="wm-verdict-dossier__confidence-track"
                role="progressbar"
                aria-label="Analysis confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={confidence ?? undefined}
              >
                <span style={{ width: `${confidenceWidth}%` }} />
              </div>
            </div>
          </div>

          {evidenceNotice ? (
            <div className={`wm-verdict-dossier__notice is-${evidenceNotice.tone}`} role="status">
              <AlertTriangle className="h-4 w-4" />
              <span>{evidenceNotice.label}</span>
            </div>
          ) : null}
        </SheetHeader>

        <div className="wm-verdict-dossier__body px-5 pb-8 pt-5 sm:px-6">

        {/* ── 1. Contact + project cover brief ─────────────────────── */}
        <section className="wm-verdict-section">
        <SectionTitle>Contact Information</SectionTitle>
        <div className="grid gap-x-5 gap-y-0.5 sm:grid-cols-2">
          <InfoRow label="Name" value={name} />
          <InfoRow
            label="Email"
            icon={Mail}
            value={lead.email ? (
              <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
            ) : null}
          />
          <InfoRow
            label="Phone"
            icon={Phone}
            value={lead.phone_e164 ? (
              <a href={`tel:${lead.phone_e164}`} className="text-primary hover:underline font-mono">
                {lead.phone_e164}
              </a>
            ) : null}
          />
          <InfoRow label="Location" icon={MapPin} value={[lead.county, lead.state, lead.zip].filter(Boolean).join(", ")} />
          <InfoRow
            label="Phone Verified"
            icon={CheckCircle}
            value={lead.phone_verified ? (
              <Badge variant="default" className="bg-emerald-900 text-white text-sm">Verified</Badge>
            ) : (
              <Badge variant="secondary" className="text-sm">Not Verified</Badge>
            )}
          />
        </div>

        <Separator className="my-4" />

        {/* ── 2. Project Specs ─────────────────────────────────────── */}
        <SectionTitle>Project Specs</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <InfoRow label="Window Count" icon={Hash} value={lead.window_count} />
          <InfoRow label="Project Type" value={lead.project_type} />
          <InfoRow label="Quote Range" value={lead.quote_range} />
          <InfoRow label="Quote Amount" icon={DollarSign} value={lead.quote_amount ? `$${Number(lead.quote_amount).toLocaleString()}` : null} />
        </div>
        </section>

        {/* ── Contractor Delivery (Phase 6) ─────────────────────────── */}
        <section className="wm-verdict-section">
        <SectionTitle>Contractor Delivery</SectionTitle>
        <OpportunityRouteTimeline opportunityId={lead.latest_opportunity_id} />
        </section>

        {/* ── 3. Truth Engine Audit ────────────────────────────────── */}
        <Collapsible className="wm-verdict-section wm-verdict-dossier__audit" open={auditOpen} onOpenChange={setAuditOpen}>
          <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between py-1 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
                Truth Engine Audit
              </h3>
              {lead.grade && (
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${gradeColor(lead.grade)}`}>
                  {lead.grade}
                </span>
              )}
            </div>
            {auditOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-700" />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 space-y-4">
            {!lead.latest_analysis_id ? (
              <p className="text-xs text-slate-700">No Truth Engine analysis available yet.</p>
            ) : analysisLoading ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 flex-1 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-4 w-48" />
              </div>
            ) : analysisError ? (
              <p className="text-xs text-destructive">Unable to load Truth Engine audit.</p>
            ) : (
              <>
                {/* ── Pillar Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {PILLAR_CONFIG.map(({ key, label }) => {
                    const score = pillarScores?.[key] ?? null;
                    const letterGrade = scoreToGrade(score);
                    return (
                      <div
                        key={key}
                        className="wm-verdict-dossier__pillar min-w-0 rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm uppercase tracking-wide text-slate-700 leading-tight">
                            {label}
                          </p>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${gradeColor(letterGrade === "—" ? null : letterGrade)}`}>
                            {letterGrade}
                          </span>
                        </div>
                        {score != null ? (
                          <div className="mt-1.5">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  score >= 80 ? "bg-green-500" :
                                  score >= 65 ? "bg-emerald-500" :
                                  score >= 50 ? "bg-amber-500" :
                                  score >= 35 ? "bg-orange-500" :
                                  "bg-destructive"
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-700 mt-0.5 font-mono">{score}/100</p>
                          </div>
                        ) : (
                          <p className="wm-verdict-dossier__redacted mt-2 text-sm">Not analyzed</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Flagged Issues ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Flag className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold">Flagged Issues</span>
                    {sortedFlags.length > 0 && (
                      <Badge variant="destructive" className="text-sm px-1.5 py-0">
                        {sortedFlags.length}
                      </Badge>
                    )}
                  </div>
                  {sortedFlags.length === 0 ? (
                    <div className="flex items-center gap-2 py-1">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-xs text-green-600">No critical flags detected</span>
                    </div>
                  ) : (
                    <ul className="wm-verdict-dossier__flag-list space-y-1.5">
                      {visibleFlags.map((f, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2 rounded-r-md py-1 pl-2 pr-1 text-xs ${
                            f.severity === "Critical" || f.severity === "High"
                              ? "is-high"
                              : f.severity === "Medium"
                              ? "is-medium"
                              : "is-other"
                          }`}
                        >
                          <Badge
                            className={`text-sm px-1.5 py-0 shrink-0 uppercase font-bold ${
                              f.severity === "Critical" || f.severity === "High"
                                ? "bg-destructive/20 text-destructive border border-destructive/30"
                                : f.severity === "Medium"
                                ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                                : "bg-muted text-slate-700 border border-border"
                            }`}
                          >
                            {f.severity}
                          </Badge>
                          <span className="text-foreground/80">
                            {f.flag}
                            {f.detail && <span className="text-slate-700 ml-1">— {f.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {sortedFlags.length > 5 && (
                    <button
                      onClick={() => setShowAllFlags(!showAllFlags)}
                      className="text-sm text-primary hover:underline mt-1"
                    >
                      {showAllFlags ? "Show less" : `Show all ${sortedFlags.length} flags`}
                    </button>
                  )}
                </div>

                {/* ── Operator Metadata ── */}
                {(extraction || evidenceProjection?.rubric_version) && (
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Info className="h-3 w-3 text-slate-700" />
                      <span className="text-sm uppercase tracking-wide text-slate-700 font-semibold">
                        Extraction Details
                      </span>
                    </div>
                    {extraction?.contractor_name && (
                      <p className="text-xs"><span className="text-slate-700">Contractor:</span> {String(extraction.contractor_name)}</p>
                    )}
                    {extraction?.total_quoted_price != null && (
                      <p className="text-xs"><span className="text-slate-700">Total Quoted:</span> ${Number(extraction.total_quoted_price).toLocaleString()}</p>
                    )}
                    {extraction?.opening_count != null && (
                      <p className="text-xs"><span className="text-slate-700">Openings:</span> {String(extraction.opening_count)}</p>
                    )}
                    {extraction?.document_type && (
                      <p className="text-xs"><span className="text-slate-700">Doc Type:</span> {String(extraction.document_type)}</p>
                    )}
                    {evidenceProjection?.rubric_version && (
                      <p className="text-xs"><span className="text-slate-700">Rubric:</span> v{evidenceProjection.rubric_version}</p>
                    )}
                  </div>
                )}

                {/* ── Forensic Findings (37+ extracted signals) ── */}
                <div className="mt-3">
                  <ForensicFindingsPanel
                    extraction={extraction as Record<string, unknown> | null}
                    locked={false}
                    defaultCollapsed
                  />
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ── 3b. Call History ──────────────────────────────────────── */}
        <section className="wm-verdict-section">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Call History
              </h3>
            </div>
            <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {callHistory.length}
            </span>
          </div>

          {callHistoryLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-muted rounded-lg h-14 w-full" />
              ))}
            </div>
          ) : callHistoryError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Failed to load call history</span>
              <button onClick={refetchCallHistory} className="text-xs underline ml-2">
                Retry
              </button>
            </div>
          ) : callHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-slate-700">
              <Phone className="w-5 h-5" />
              <span className="text-sm">No calls logged yet.</span>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {callHistory.map((entry) => {
                const isExpanded = expandedTranscripts.has(entry.id);
                const showRetry = entry.call_outcome === "voicemail" || entry.call_outcome === "no_answer" || entry.status === "failed";

                return (
                  <div key={entry.id} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    {/* Row 1: Meta strip */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {/* Type badge */}
                        {entry.call_intent === "operator_outbound" || entry.call_intent === "manual_dial" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-blue-100 text-blue-950 border-blue-200">
                            Manual
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-violet-100 text-violet-950 border-violet-200">
                            AI Call
                          </span>
                        )}

                        {/* Outcome badge */}
                        {entry.call_outcome === "answered" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-emerald-100 text-emerald-950 border-emerald-200">Answered</span>
                        ) : entry.call_outcome === "voicemail" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-amber-100 text-amber-950 border-amber-200">Voicemail</span>
                        ) : entry.call_outcome === "no_answer" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-orange-100 text-orange-700 border-orange-200">No Answer</span>
                        ) : entry.status === "failed" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-destructive/20 text-destructive border-destructive/30">Failed</span>
                        ) : entry.status === "in_progress" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-blue-100 text-blue-950 border-blue-200 animate-pulse">In Progress</span>
                        ) : entry.status === "queued" ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase border bg-muted text-slate-700 border-border">Queued</span>
                        ) : null}

                        {/* Duration */}
                        {entry.duration_seconds != null && (
                          <span className="text-xs text-slate-700">
                            {Math.floor(entry.duration_seconds / 60)}m {entry.duration_seconds % 60}s
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.booking_intent_detected && (
                          <span title="Booking intent detected"><Calendar className="w-3 h-3 text-emerald-600" /></span>
                        )}
                        {entry.appointment_booked && (
                          <span title="Appointment booked"><CalendarCheck className="w-3 h-3 text-green-500" /></span>
                        )}
                        <span className="text-xs text-slate-700">
                          {format(new Date(entry.created_at), "MMM d 'at' h:mm a")}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Transcript / Audio / Retry */}
                    <div className="mt-2">
                      {entry.transcript_text ? (
                        <>
                          <button
                            onClick={() => {
                              setExpandedTranscripts((prev) => {
                                const next = new Set(prev);
                                if (next.has(entry.id)) next.delete(entry.id);
                                else next.add(entry.id);
                                return next;
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                          >
                            {isExpanded ? "Hide Transcript" : "View Transcript"}
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 p-2 rounded bg-muted text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                              {entry.transcript_text}
                            </div>
                          )}
                        </>
                      ) : entry.transcript_url ? (
                        <a
                          href={entry.transcript_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Transcript
                        </a>
                      ) : (
                        <span className="text-xs text-slate-700 italic">No transcript available.</span>
                      )}

                      {entry.summary && !isExpanded && (
                        <p className="text-xs text-slate-700 mt-1 italic line-clamp-2">{entry.summary}</p>
                      )}

                      {entry.recording_url && (
                        <audio controls src={entry.recording_url} className="w-full h-8 mt-2" preload="none" />
                      )}

                      {showRetry && (
                        <button
                          onClick={() => handleRetryCall(entry)}
                          className="inline-flex items-center gap-1 text-xs text-amber-950 hover:text-amber-600 mt-2"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry Call
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Follow-up Status (Phase 6) ────────────────────────────── */}
        <section className="wm-verdict-section">
        <SectionTitle>Follow-up Status</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <InfoRow label="Last Call Intent" value={lead.last_call_intent} />
          <InfoRow label="Last Call Status" value={(lead as any).last_call_status} />
          <InfoRow label="Last Call Outcome" value={(lead as any).last_call_outcome} />
          <InfoRow
            label="Last Call Completed"
            value={(lead as any).last_call_completed_at ? format(new Date((lead as any).last_call_completed_at), "MMM d, h:mm a") : null}
          />
          <InfoRow
            label="Appointment Booked"
            value={(lead as any).appointment_booked_at ? format(new Date((lead as any).appointment_booked_at), "MMM d, h:mm a") : null}
          />
          <InfoRow
            label="Replacement Quote Submitted"
            value={(lead as any).replacement_quote_submitted_at ? format(new Date((lead as any).replacement_quote_submitted_at), "MMM d") : null}
          />
          <InfoRow label="Deal Status" value={lead.deal_status} />
        </div>
        </section>

        <section className="wm-verdict-section wm-verdict-dossier__dogtag">
        <SectionTitle>Attribution & Source</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <InfoRow label="UTM Source" icon={Globe} value={lead.utm_source} />
          <InfoRow label="UTM Medium" value={lead.utm_medium} />
          <InfoRow label="UTM Campaign" value={lead.utm_campaign} />
          <InfoRow label="GCLID" value={lead.gclid ? `${lead.gclid.slice(0, 16)}…` : null} />
          <InfoRow label="FBCLID" value={lead.fbclid ? `${lead.fbclid.slice(0, 16)}…` : null} />
          <InfoRow label="Referrer" value={lead.initial_referrer} />
        </div>
        {lead.landing_page_url && (
          <div className="mt-1">
            <InfoRow
              label="Landing Page"
              icon={ExternalLink}
              value={
                <span className="text-xs font-mono break-all">{lead.landing_page_url}</span>
              }
            />
          </div>
        )}
        </section>

        {/* ── 5. Activity Timeline (Phase 7: real lifecycle) ───────── */}
        <section className="wm-verdict-section wm-verdict-dossier__custody">
        <SectionTitle>Activity Timeline</SectionTitle>
        <LeadLifecycleTimeline lead={lead} />
        </section>

        <div className="h-8" />
        </div>
      </SheetContent>

      {/* ── Handoff Confirmation Dialog ── */}
      <Dialog open={handoffModalOpen} onOpenChange={setHandoffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Lead Handoff</DialogTitle>
            <DialogDescription>
              Review the lead details below before sending to contractor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Homeowner */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{name}</p>
                <p className="text-xs text-slate-700">
                  {[lead.city, lead.zip].filter(Boolean).join(", ") || "Florida"}
                </p>
              </div>
              {lead.grade && (
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${gradeColor(lead.grade)}`}>
                  {lead.grade}
                </span>
              )}
            </div>

            {/* Issues */}
            <div className="text-sm text-slate-700">
              {lead.flag_count ?? 0} flagged issue{(lead.flag_count ?? 0) !== 1 ? "s" : ""}
            </div>

            {/* Top flags */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5">
              {topHighFlags.length > 0 ? (
                topHighFlags.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span>🚩</span>
                    <span>{f.flag || f.detail || "Issue detected"}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-500">
                  <CheckCircle className="w-3 h-3" />
                  No critical flags detected
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setHandoffModalOpen(false)}
              disabled={handoffSending}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleHandoffConfirm}
              disabled={handoffSending}
            >
              <Send className="w-3.5 h-3.5" />
              {handoffSending ? "Sending…" : "Send Dossier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
