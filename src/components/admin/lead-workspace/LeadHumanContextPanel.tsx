/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LeadHumanContextPanel — Phase 10
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The "money card" for contractor-readiness. Renders inside the operator
 * dossier (AdminLeadDossierPage). 100% derived from canonical, repo-real
 * data passed down from `fetch_lead_detail`. Zero AI calls. Zero mutations
 * here — this is a read surface; capture happens in the homeowner flow.
 */

import { useMemo, useState } from "react";
import { Copy, Check, AlertTriangle, Info, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildOpeningScript,
  deriveLeadFitWarnings,
  handoffConsentLabel,
  hoaComplexityLabel,
  motivationLabelFromDiagnosis,
  propertyTypeLabel,
  timelineLabel,
  type LeadFitWarning,
} from "@/lib/humanContext";

// ── Loose shape — matches the joined payload returned by the extended
// fetch_lead_detail action. We intentionally keep this loose to avoid
// coupling to the auto-generated supabase types file.
interface LeadShape {
  first_name: string | null;
  last_name: string | null;
  county: string | null;
  property_type_detail: string | null;
  hoa_or_condo_complexity: string | null;
  handoff_consent_status: string | null;
  timeline_bucket: string | null;
}

interface DiagnosisIntakeShape {
  primary_diagnosis: string | null;
  secondary_clarifiers: { codes?: string[] } | Record<string, unknown> | null;
  other_text: string | null;
  // JSON column — treated as untrusted; only terms_free_text is read, safely.
  counter_offer?: { terms_free_text?: unknown } | Record<string, unknown> | null;
  created_at: string | null;
}

interface AnalysisShape {
  flags?: Array<{ flag?: string; severity?: string }> | null;
}

interface LatestRouteShape {
  contractor_company_name?: string | null;
}

interface Props {
  lead: LeadShape;
  diagnosisIntake: DiagnosisIntakeShape | null;
  analysis: AnalysisShape | null;
  latestRoute: LatestRouteShape | null;
}

function Field({
  label,
  value,
  fallback,
}: {
  label: string;
  value: React.ReactNode;
  fallback: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">
        {value ?? <span className="text-slate-700 italic">{fallback}</span>}
      </div>
    </div>
  );
}

function WarningRow({ w }: { w: LeadFitWarning }) {
  const Icon =
    w.severity === "block"
      ? ShieldAlert
      : w.severity === "warn"
        ? AlertTriangle
        : Info;
  const tone =
    w.severity === "block"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : w.severity === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-border bg-muted/40 text-foreground/80";
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${tone}`}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{w.message}</span>
    </div>
  );
}

export function LeadHumanContextPanel({
  lead,
  diagnosisIntake,
  analysis,
  latestRoute,
}: Props) {
  const [copied, setCopied] = useState(false);

  const motivation = motivationLabelFromDiagnosis(diagnosisIntake?.primary_diagnosis);
  const propertyLabel = propertyTypeLabel(lead.property_type_detail);
  const hoaLabel = hoaComplexityLabel(lead.hoa_or_condo_complexity);
  const tlLabel = timelineLabel(lead.timeline_bucket);
  const consent = handoffConsentLabel(lead.handoff_consent_status);

  const secondaryClarifierCount = useMemo(() => {
    const codes = (diagnosisIntake?.secondary_clarifiers as { codes?: string[] } | null)?.codes;
    return Array.isArray(codes) ? codes.length : 0;
  }, [diagnosisIntake]);

  // Homeowner's free-text note from the diagnosis counter-offer. The JSON is
  // untrusted, so read defensively and only render a non-empty trimmed string.
  const advisorNote = useMemo(() => {
    const co = diagnosisIntake?.counter_offer;
    if (!co || typeof co !== "object") return "";
    const raw = (co as { terms_free_text?: unknown }).terms_free_text;
    return typeof raw === "string" ? raw.trim() : "";
  }, [diagnosisIntake]);

  const warnings = useMemo(
    () =>
      deriveLeadFitWarnings({
        property_type_detail: lead.property_type_detail,
        hoa_or_condo_complexity: lead.hoa_or_condo_complexity,
        handoff_consent_status: lead.handoff_consent_status,
        timeline_bucket: lead.timeline_bucket,
        primary_diagnosis: diagnosisIntake?.primary_diagnosis,
        secondary_clarifier_count: secondaryClarifierCount,
      }),
    [lead, diagnosisIntake, secondaryClarifierCount],
  );

  const topFlag = useMemo(() => {
    if (!analysis?.flags || analysis.flags.length === 0) return null;
    // Prefer Critical/High first.
    const ordered = [...analysis.flags].sort((a, b) => {
      const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (order[a.severity ?? "Low"] ?? 99) - (order[b.severity ?? "Low"] ?? 99);
    });
    return ordered[0]?.flag ?? null;
  }, [analysis]);

  const opener = useMemo(
    () =>
      buildOpeningScript({
        homeownerFirstName: lead.first_name,
        contractorName: latestRoute?.contractor_company_name ?? null,
        topFlag,
        primary_diagnosis: diagnosisIntake?.primary_diagnosis,
        property_type_detail: lead.property_type_detail,
        hoa_or_condo_complexity: lead.hoa_or_condo_complexity,
        timeline_bucket: lead.timeline_bucket,
        handoff_consent_status: lead.handoff_consent_status,
      }),
    [lead, latestRoute, topFlag, diagnosisIntake],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(opener.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in some contexts; silently degrade.
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
            Sales Context
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
            Human Context
          </h3>
        </div>
        <Sparkles className="h-4 w-4 text-slate-700" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Motivation"
          fallback="Motivation not captured yet"
          value={
            motivation ? (
              <div>
                <p>{motivation.long}</p>
                {diagnosisIntake?.other_text && (
                  <p className="mt-1 text-xs text-slate-700 italic">
                    Notes: {diagnosisIntake.other_text}
                  </p>
                )}
              </div>
            ) : null
          }
        />

        <Field
          label="Property"
          fallback="Property type unknown — ask first"
          value={
            propertyLabel ? (
              <p>
                {propertyLabel}
                {lead.county ? ` · ${lead.county} County` : ""}
                {hoaLabel ? ` · ${hoaLabel}` : ""}
              </p>
            ) : null
          }
        />

        <Field
          label="Timeline"
          fallback="Timeline unknown"
          value={tlLabel ? <p>{tlLabel}</p> : null}
        />

        <Field
          label="Handoff Status"
          fallback="No explicit contractor handoff captured"
          value={
            consent ? (
              <div className="space-y-1">
                <Badge
                  variant="outline"
                  className={
                    lead.handoff_consent_status === "report_only"
                      ? "border-destructive/40 text-destructive bg-destructive/5"
                      : lead.handoff_consent_status === "text_or_email_first"
                        ? "border-amber-400/50 text-amber-800 bg-amber-50"
                        : "border-emerald-500/40 text-emerald-950 bg-emerald-50"
                  }
                >
                  {consent.full}
                </Badge>
                {consent.homeownerToldCopy && (
                  <p className="text-xs text-slate-700 italic mt-1">
                    Homeowner was told: "{consent.homeownerToldCopy}"
                  </p>
                )}
              </div>
            ) : null
          }
        />
      </div>

      {/* Advisor Note — homeowner's own words from the counter-offer free text.
          Rendered only when present; plain interpolation (never raw HTML). */}
      {advisorNote && (
        <div className="mt-4 rounded-lg border border-amber-300/60 bg-amber-50/70 p-3.5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-900">
            Advisor Note
          </p>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {advisorNote}
          </p>
        </div>
      )}

      {/* Lead Fit Warnings */}
      <div className="mt-4 space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
          Lead Fit Warnings
        </p>
        {warnings.length === 0 ? (
          <p className="text-xs text-slate-700 italic">
            None — clean signal.
          </p>
        ) : (
          <div className="space-y-1.5">
            {warnings.map((w) => (
              <WarningRow key={w.code} w={w} />
            ))}
          </div>
        )}
      </div>

      {/* Recommended Opening Script */}
      <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-800">
            Recommended Opening
            {opener.isUrgent && (
              <Badge className="ml-2 bg-orange-100 text-orange-950 border border-orange-300 text-sm px-1.5 py-0">
                URGENT
              </Badge>
            )}
            {opener.isReportOnly && (
              <Badge className="ml-2 bg-destructive text-destructive-foreground text-sm px-1.5 py-0">
                REPORT ONLY
              </Badge>
            )}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 px-2 text-sm"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" /> Copy script
              </>
            )}
          </Button>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 font-serif italic">
          "{opener.script}"
        </p>
      </div>
    </section>
  );
}
