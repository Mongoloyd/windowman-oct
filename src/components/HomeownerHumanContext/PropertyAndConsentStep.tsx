/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PropertyAndConsentStep — Phase 10 (homeowner-side capture)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lightweight, OPTIONAL post-report capture step. Mounted on the diagnosis
 * SuccessScreen so it sits AFTER OTP verification + report unlock. It must
 * never block report access, and it never sends contractor-sensitive data
 * back to the client.
 *
 * Persistence path:
 *   client → supabase.functions.invoke('update-homeowner-context', { lead_id, scan_session_id, ...})
 *   The edge function rebinds lead_id ↔ scan_session_id server-side and
 *   only writes to the 3 Phase 10 columns on `leads`.
 */

import { useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  HANDOFF_CONSENT_VALUES,
  HOA_COMPLEXITY_VALUES,
  PROPERTY_TYPE_VALUES,
  type HandoffConsentStatus,
  type HoaComplexity,
  type PropertyTypeDetail,
} from "@/lib/humanContext";
import { buildContractorSharingConsentRequest } from "@/lib/consent/buildConsentRequest";
import { ContractorSharingConsentCheckbox } from "@/components/consent/ContractorSharingConsentCheckbox";
import { createUuid } from "@/lib/createUuid";

interface Props {
  leadId: string;
  scanSessionId: string;
  onSubmitted?: () => void;
  onSkipped?: () => void;
}

const PROPERTY_OPTIONS: Array<{ value: PropertyTypeDetail; label: string }> = [
  { value: "single_family", label: "Single-family home" },
  { value: "condo", label: "Condo" },
  { value: "townhouse_villa", label: "Townhouse / villa" },
  { value: "high_rise", label: "High-rise unit" },
  { value: "multifamily_investment", label: "Multi-family / investment" },
];

const HOA_OPTIONS: Array<{ value: HoaComplexity; label: string }> = [
  { value: "none", label: "No HOA" },
  { value: "hoa_simple", label: "HOA — simple" },
  { value: "hoa_complex", label: "HOA — complex / strict" },
  { value: "high_rise_engineering", label: "High-rise / engineering review" },
  { value: "unknown", label: "Not sure" },
];

const CONSENT_OPTIONS: Array<{ value: HandoffConsentStatus; label: string }> = [
  { value: "accepted_today", label: "Yes — have someone call me today" },
  { value: "accepted_tomorrow", label: "Yes — tomorrow is better" },
  { value: "text_or_email_first", label: "Text or email me first" },
  { value: "report_only", label: "Not yet — I only want the report" },
];

function handoffRequestsContractor(status: HandoffConsentStatus | null): boolean {
  return (
    status === "accepted_today" ||
    status === "accepted_tomorrow" ||
    status === "text_or_email_first"
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              selected
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:border-primary/40"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PropertyAndConsentStep({
  leadId,
  scanSessionId,
  onSubmitted,
  onSkipped,
}: Props) {
  const [propertyType, setPropertyType] = useState<PropertyTypeDetail | null>(null);
  const [hoa, setHoa] = useState<HoaComplexity | null>(null);
  const [consent, setConsent] = useState<HandoffConsentStatus | null>(null);
  const [contractorSharingConsent, setContractorSharingConsent] = useState(false);

  // One consent-decision transaction per submission. Kept for identical
  // retries after a failure; rotated whenever the contractor-sharing decision
  // inputs change and after a completed persist, so a changed decision is
  // always a new append-only consent event, never a conflicting reuse.
  const submissionIdRef = useRef(createUuid());

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestsContractor = handoffRequestsContractor(consent);

  const canSubmit =
    !!propertyType &&
    !!consent &&
    (!requestsContractor || contractorSharingConsent) &&
    !submitting;

  const persistContractorConsent = async (granted: boolean) => {
    const consentEnvelope = buildContractorSharingConsentRequest({
      submissionId: submissionIdRef.current,
      granted,
    });
    await supabase.functions.invoke("update-homeowner-context", {
      body: {
        lead_id: leadId,
        scan_session_id: scanSessionId,
        consent: consentEnvelope,
      },
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "update-homeowner-context",
        {
          body: {
            lead_id: leadId,
            scan_session_id: scanSessionId,
            property_type_detail: propertyType,
            hoa_or_condo_complexity: hoa ?? "unknown",
            handoff_consent_status: consent,
            consent: buildContractorSharingConsentRequest({
              submissionId: submissionIdRef.current,
              granted: requestsContractor && contractorSharingConsent,
            }),
          },
        },
      );

      if (invokeError) throw invokeError;

      // Completed persist closes this consent transaction.
      submissionIdRef.current = createUuid();
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save right now — your report is still available.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await persistContractorConsent(false);
      // Completed persist closes this consent transaction.
      submissionIdRef.current = createUuid();
    } catch {
      // Non-blocking — homeowner may still skip the step.
    }
    onSkipped?.();
  };

  if (submitted) {
    return (
      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3"
        role="status"
        aria-live="polite"
      >
        <Check className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Got it — thank you.</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            Your contractor will see exactly what to focus on before reaching out.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Optional · 30 seconds
        </p>
        <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
          Help your contractor prep
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Three quick questions so any contractor we route to you can show up ready.
        </p>
      </header>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          What type of property is this for?
        </p>
        <ChipGroup
          options={PROPERTY_OPTIONS}
          value={propertyType}
          onChange={(v) => {
            setPropertyType(v);
            // Smart default: condos/high-rises probably have complex HOA; let
            // user override but pre-fill so we get usable signal even if they
            // skip the HOA question.
            if (!hoa) {
              if (v === "high_rise") setHoa("high_rise_engineering");
              else if (v === "condo") setHoa("hoa_complex");
              else if (v === "single_family") setHoa("none");
            }
          }}
          ariaLabel="Property type"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Any HOA or building approval to worry about?
        </p>
        <ChipGroup options={HOA_OPTIONS} value={hoa} onChange={(v) => setHoa(v)} ariaLabel="HOA complexity" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Want a vetted contractor to call with a same-scope option?
        </p>
        <ChipGroup
          options={CONSENT_OPTIONS}
          value={consent}
          onChange={(v) => {
            setConsent(v);
            // Changed decision input → new consent submission transaction.
            submissionIdRef.current = createUuid();
            if (v === "report_only") {
              setContractorSharingConsent(false);
            }
          }}
          ariaLabel="Handoff consent"
        />
      </div>

      {requestsContractor ? (
        <ContractorSharingConsentCheckbox
          checked={contractorSharingConsent}
          onChange={(checked) => {
            setContractorSharingConsent(checked);
            // Changed decision input → new consent submission transaction.
            submissionIdRef.current = createUuid();
          }}
        />
      ) : null}

      {requestsContractor && !contractorSharingConsent && (
        <p className="text-xs text-muted-foreground" role="status">
          Check the contractor authorization box to continue with a contractor
          introduction.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save and continue
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
