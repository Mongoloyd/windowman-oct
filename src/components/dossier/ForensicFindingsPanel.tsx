/**
 * ForensicFindingsPanel — Structured display of the 37+ forensic signals
 * extracted from each Truth Report.
 *
 * Reads from `dossier.extraction` (returned by get-contractor-dossier and
 * shaped equivalently for admin views). Each signal renders as a chip-style
 * field with a neutral / good / warn / bad status so partners can scan
 * the report's strongest negotiation hooks at a glance.
 *
 * This is the "sales ammunition" surface — every chip is a real talking
 * point a partner can lead a homeowner conversation with.
 */

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ClipboardList,
  DollarSign,
  Hammer,
  Layers,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";

type Tone = "good" | "warn" | "bad" | "info" | "unknown";

interface Signal {
  label: string;
  /** Short value to render (e.g., "Yes", "12 yrs", "$2,400"). */
  value: string;
  /** Optional one-line context (renders below value). */
  hint?: string;
  tone: Tone;
}

interface SignalGroup {
  key: string;
  title: string;
  icon: React.ElementType;
  accent: string;
  signals: Signal[];
}

const toneStyles: Record<Tone, { dot: string; pill: string; value: string }> = {
  good: {
    dot: "bg-emerald-500",
    pill: "border-emerald-200 bg-emerald-50",
    value: "text-emerald-800",
  },
  warn: {
    dot: "bg-amber-500",
    pill: "border-amber-200 bg-amber-50",
    value: "text-amber-800",
  },
  bad: {
    dot: "bg-rose-500",
    pill: "border-rose-200 bg-rose-50",
    value: "text-rose-800",
  },
  info: {
    dot: "bg-sky-500",
    pill: "border-sky-200 bg-sky-50",
    value: "text-sky-800",
  },
  unknown: {
    dot: "bg-muted-foreground/40",
    pill: "border-border bg-muted/30",
    value: "text-muted-foreground",
  },
};

// ── Helpers to convert raw extraction values into Signal entries ─────────

/** boolean where TRUE is good, FALSE is bad. null/undefined → unknown. */
function boolPositive(label: string, val: unknown, hint?: { good?: string; bad?: string }): Signal {
  if (val === true) return { label, value: "Yes", tone: "good", hint: hint?.good };
  if (val === false) return { label, value: "No", tone: "bad", hint: hint?.bad };
  return { label, value: "Not stated", tone: "unknown" };
}

/** boolean where TRUE is bad (red flag), FALSE is good. */
function boolNegative(label: string, val: unknown, hint?: { good?: string; bad?: string }): Signal {
  if (val === true) return { label, value: "Yes", tone: "bad", hint: hint?.bad };
  if (val === false) return { label, value: "No", tone: "good", hint: hint?.good };
  return { label, value: "Not stated", tone: "unknown" };
}

function countSignal(label: string, count: number | null | undefined, threshold = 0): Signal {
  if (count == null) return { label, value: "—", tone: "unknown" };
  if (count === 0) return { label, value: "0", tone: "good" };
  if (count <= threshold) return { label, value: String(count), tone: "warn" };
  return { label, value: String(count), tone: "bad", hint: "Negotiation hook" };
}

function yearsSignal(label: string, years: number | null | undefined, opts: {
  goodMin: number;
  warnMin: number;
}): Signal {
  if (years == null) return { label, value: "Not stated", tone: "unknown" };
  const value = `${years} yr${years === 1 ? "" : "s"}`;
  if (years >= opts.goodMin) return { label, value, tone: "good" };
  if (years >= opts.warnMin) return { label, value, tone: "warn" };
  return { label, value, tone: "bad", hint: "Below market" };
}

function moneySignal(label: string, cents: number | null | undefined): Signal {
  if (cents == null) return { label, value: "—", tone: "unknown" };
  return {
    label,
    value: `$${Math.round(cents).toLocaleString()}`,
    tone: "info",
  };
}

function pctSignal(label: string, val: number | null | undefined, opts: {
  warnAbove: number;
  badAbove: number;
}): Signal {
  if (val == null) return { label, value: "Not stated", tone: "unknown" };
  const pct = val <= 1 ? Math.round(val * 100) : Math.round(val);
  const value = `${pct}%`;
  if (pct >= opts.badAbove) return { label, value, tone: "bad", hint: "Above safe limit" };
  if (pct >= opts.warnAbove) return { label, value, tone: "warn" };
  return { label, value, tone: "good" };
}

function textSignal(label: string, raw: unknown, fallback = "Not stated"): Signal {
  if (raw == null || raw === "") return { label, value: fallback, tone: "unknown" };
  const str = String(raw);
  return { label, value: str.length > 36 ? str.slice(0, 33) + "…" : str, tone: "info" };
}

// ── Group builders ───────────────────────────────────────────────────────

function buildGroups(ext: Record<string, unknown>): SignalGroup[] {
  const get = (k: string) => ext[k];

  return [
    {
      key: "compliance",
      title: "Code & Compliance",
      icon: Shield,
      accent: "text-rose-700",
      signals: [
        boolPositive("HVHZ Zone Acknowledged", get("hvhz_zone"), {
          good: "Confirmed wind-borne debris zone",
          bad: "HVHZ status missing",
        }),
        countSignal("Items Missing DP Rating", get("items_without_dp_rating") as number | null),
        countSignal("Items Missing NOA Number", get("items_without_noa") as number | null),
        boolPositive(
          "Code Compliance Stated",
          get("code_compliance_install_statement_present"),
        ),
        boolPositive(
          "Manufacturer Install Compliance",
          get("manufacturer_install_compliance_stated"),
        ),
      ],
    },
    {
      key: "glass",
      title: "Glass Package",
      icon: Layers,
      accent: "text-cyan-700",
      signals: [
        boolPositive("Per-Opening Glass Specs", get("opening_level_glass_specs_present"), {
          bad: "Uses blanket language instead",
        }),
        boolNegative("Blanket Glass Language", get("blanket_glass_language_present"), {
          bad: "One spec applied to all openings",
        }),
        boolNegative("Mixed Glass Packages Visible", get("mixed_glass_package_visibility")),
        countSignal(
          "Items With Incomplete Glass",
          get("items_with_incomplete_glass") as number | null,
        ),
      ],
    },
    {
      key: "scope",
      title: "Opening Schedule & Scope",
      icon: ClipboardList,
      accent: "text-violet-700",
      signals: [
        boolPositive("Opening Schedule Present", get("opening_schedule_present")),
        boolPositive("Room Labels Listed", get("opening_schedule_room_labels_present")),
        boolPositive("Dimensions Complete", get("opening_schedule_dimensions_complete")),
        boolPositive(
          "Product Assignments Per Opening",
          get("opening_schedule_product_assignments_present"),
        ),
        boolNegative("Bulk Scope Blob Present", get("bulk_scope_blob_present"), {
          bad: "No itemization — vague scope",
        }),
      ],
    },
    {
      key: "install",
      title: "Installation Method",
      icon: Hammer,
      accent: "text-amber-700",
      signals: [
        boolPositive("Anchor Spacing Specified", get("anchor_spacing_specified")),
        boolPositive("Fastener Type Specified", get("fastener_type_specified")),
        boolPositive("Sealant Specified", get("sealant_specified")),
        boolPositive("Disposal Included", get("disposal_included")),
        boolPositive("Engineering Mentioned", get("engineering_mentioned")),
        boolPositive("Engineering Fees Included", get("engineering_fees_included")),
      ],
    },
    {
      key: "warranty",
      title: "Warranty Execution",
      icon: CheckCircle2,
      accent: "text-emerald-700",
      signals: [
        yearsSignal("Labor Warranty", get("warranty_labor_years") as number | null, {
          goodMin: 5,
          warnMin: 2,
        }),
        yearsSignal(
          "Manufacturer Warranty",
          get("warranty_manufacturer_years") as number | null,
          { goodMin: 20, warnMin: 10 },
        ),
        boolPositive("Warranty Transferable", get("warranty_transferable")),
        boolPositive(
          "Execution Details Present",
          get("warranty_execution_details_present"),
        ),
        textSignal(
          "Service Provider Type",
          get("warranty_service_provider_type"),
          "Unspecified",
        ),
        countSignal(
          "Leak Callback SLA (days)",
          get("leak_callback_sla_days") as number | null,
          7,
        ),
        boolNegative("Stucco Damage Excluded", get("post_install_stucco_excluded")),
        boolNegative("Paint Damage Excluded", get("post_install_paint_excluded")),
        boolNegative(
          "Water Intrusion Excluded",
          get("water_intrusion_damage_excluded"),
        ),
      ],
    },
    {
      key: "permits",
      title: "Permits & Repairs",
      icon: Wrench,
      accent: "text-sky-700",
      signals: [
        boolPositive("Permits Included", get("permits_included")),
        boolPositive("Permit Fees Itemized", get("permit_fees_itemized")),
        textSignal(
          "Permits Responsible Party",
          get("permits_responsible_party"),
          "Unspecified",
        ),
        boolPositive("Stucco Repair Included", get("stucco_repair_included")),
        boolPositive("Drywall Repair Included", get("drywall_repair_included")),
        boolPositive("Paint Touch-Up Included", get("paint_touchup_included")),
        boolPositive("Debris Removal Included", get("debris_removal_included")),
      ],
    },
    {
      key: "payment",
      title: "Payment Terms",
      icon: DollarSign,
      accent: "text-rose-700",
      signals: [
        pctSignal("Deposit Required", get("deposit_percent") as number | null, {
          warnAbove: 33,
          badAbove: 50,
        }),
        moneySignal("Deposit Amount", get("deposit_amount") as number | null),
        boolNegative(
          "Final Payment Before Inspection",
          get("final_payment_before_inspection"),
          { bad: "Pay-before-inspection trap" },
        ),
        boolNegative(
          "Subject To Re-Measure Clause",
          get("subject_to_remeasure_present"),
          { bad: "Open-ended price exposure" },
        ),
        boolPositive(
          "Re-Measure Cap Present",
          get("remeasure_price_adjustment_cap_present"),
        ),
      ],
    },
    {
      key: "change_orders",
      title: "Change-Order Protections",
      icon: ClipboardList,
      accent: "text-violet-700",
      signals: [
        boolPositive(
          "Written Change-Orders Required",
          get("written_change_order_required"),
        ),
        boolPositive(
          "Homeowner Approval Required",
          get("homeowner_approval_required_for_change_orders"),
        ),
        boolNegative(
          "Unilateral Price Changes Allowed",
          get("unilateral_price_adjustment_allowed"),
          { bad: "Contractor can re-price unilaterally" },
        ),
      ],
    },
    {
      key: "trust",
      title: "Trust Signals",
      icon: Activity,
      accent: "text-emerald-700",
      signals: [
        boolPositive("Insurance Proof Mentioned", get("insurance_proof_mentioned")),
        boolPositive("Licensing Proof Mentioned", get("licensing_proof_mentioned")),
        boolPositive("Lead Paint Disclosure", get("lead_paint_disclosure_present")),
        boolPositive("Terms & Conditions Present", get("terms_conditions_present")),
        boolNegative(
          "Generic Product Description",
          get("generic_product_description_present"),
          { bad: "No brand/series specified" },
        ),
      ],
    },
  ];
}

function summarize(groups: SignalGroup[]) {
  let bad = 0;
  let warn = 0;
  let good = 0;
  let unknown = 0;
  let total = 0;
  for (const g of groups) {
    for (const s of g.signals) {
      total += 1;
      if (s.tone === "bad") bad += 1;
      else if (s.tone === "warn") warn += 1;
      else if (s.tone === "good") good += 1;
      else if (s.tone === "unknown") unknown += 1;
    }
  }
  return { bad, warn, good, unknown, total };
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  extraction: Record<string, unknown> | null | undefined;
  /** When true, talking points / hints are blurred behind the unlock CTA. */
  locked?: boolean;
  /** Optional default-collapsed groups (e.g., for compact admin embeds). */
  defaultCollapsed?: boolean;
}

export default function ForensicFindingsPanel({
  extraction,
  locked = false,
  defaultCollapsed = false,
}: Props) {
  const groups = useMemo(() => (extraction ? buildGroups(extraction) : []), [extraction]);
  const stats = useMemo(() => summarize(groups), [groups]);

  if (!extraction || stats.total === 0) {
    return (
      <section className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Forensic Findings
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          No extracted signals available yet. Upload a quote to populate this panel.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <Zap className="h-5 w-5 text-amber-600" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-amber-700">
          Forensic Findings
        </h2>
        <span className="text-[11px] text-muted-foreground font-mono">
          {stats.total} signal{stats.total === 1 ? "" : "s"} extracted
        </span>

        <div className="ml-auto flex items-center gap-1.5 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
            <AlertTriangle className="h-3 w-3" /> {stats.bad}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
            <CircleDashed className="h-3 w-3" /> {stats.warn}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> {stats.good}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
            ? {stats.unknown}
          </span>
        </div>
      </header>

      <div className="space-y-5">
        {groups.map((group) => (
          <ForensicGroup key={group.key} group={group} locked={locked} startCollapsed={defaultCollapsed} />
        ))}
      </div>
    </section>
  );
}

function ForensicGroup({
  group,
  locked,
  startCollapsed,
}: {
  group: SignalGroup;
  locked: boolean;
  startCollapsed: boolean;
}) {
  const Icon = group.icon;
  const hasFindings = group.signals.some((s) => s.tone === "bad" || s.tone === "warn");

  return (
    <details
      open={!startCollapsed}
      className="rounded-lg border border-border/60 bg-muted/20 [&[open]>summary>svg.chev-down]:hidden [&:not([open])>summary>svg.chev-up]:hidden"
    >
      <summary className="flex items-center gap-2 cursor-pointer list-none px-4 py-2.5 hover:bg-muted/40 rounded-lg">
        <Icon className={`h-4 w-4 ${group.accent}`} />
        <h3 className={`text-[12px] font-bold uppercase tracking-wider ${group.accent}`}>
          {group.title}
        </h3>
        {hasFindings && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="h-2.5 w-2.5" /> Hooks
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {group.signals.length}
        </span>
        <ChevronDown className="chev-down h-4 w-4 text-muted-foreground" />
        <ChevronUp className="chev-up h-4 w-4 text-muted-foreground" />
      </summary>

      <div className="grid gap-2 px-4 pb-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
        {group.signals.map((s, i) => {
          const styles = toneStyles[s.tone];
          return (
            <div
              key={`${group.key}-${i}`}
              className={`rounded-lg border ${styles.pill} px-3 py-2.5`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`} />
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold leading-tight">
                  {s.label}
                </p>
              </div>
              <p className={`mt-1 text-sm font-bold tabular-nums ${styles.value}`}>{s.value}</p>
              {s.hint && (
                <p
                  className={`mt-0.5 text-[10px] leading-snug ${
                    locked && s.tone !== "unknown" ? "blur-[3px] select-none" : "text-muted-foreground"
                  }`}
                >
                  {s.hint}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
