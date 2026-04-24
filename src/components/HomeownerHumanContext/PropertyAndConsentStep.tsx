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

import { useState } from "react";
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

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
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

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!propertyType && !!consent && !submitting;

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
          },
        },
      );

      if (invokeError) throw invokeError;

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
        <ChipGroup options={HOA_OPTIONS} value={hoa} onChange={setHoa} ariaLabel="HOA complexity" />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Want a vetted contractor to call with a same-scope option?
        </p>
        <ChipGroup
          options={CONSENT_OPTIONS}
          value={consent}
          onChange={setConsent}
          ariaLabel="Handoff consent"
        />
      </div>

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
          onClick={onSkipped}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
