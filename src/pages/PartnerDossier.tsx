import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Lock,
  Unlock,
  ShieldAlert,
  FileText,
  Target,
  ArrowLeft,
  Crosshair,
  Copy,
  Check,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  ClipboardList,
  Building2,
  Hash,
  MapPin,
  DollarSign,
  Layers,
  ShieldCheck,
  Eye,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PreviewModeBadge } from "@/components/PreviewModeBadge";
import { usePartnerPortal } from "@/components/partner/PartnerPortalContext";
import { PartnerActionCenter, type PartnerOutcome } from "@/components/partner/PartnerActionCenter";
import ForensicFindingsPanel from "@/components/dossier/ForensicFindingsPanel";

/* ── tiny helpers ─────────────────────────────────────────────── */
const fmt = (v: number | null | undefined) =>
  v != null ? `$${v.toLocaleString()}` : "N/A";

const PILLAR_LABELS: Record<string, string> = {
  safety: "Safety & Code",
  install: "Install & Scope",
  price: "Price Fairness",
  fine_print: "Fine Print",
  warranty: "Warranty Value",
};

const pillarColor = (score: number) => {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
};

const gradeColor = (g: string | null | undefined) => {
  if (!g) return "text-slate-700";
  if (g === "A") return "text-emerald-600";
  if (g === "B") return "text-emerald-500";
  if (g === "C") return "text-amber-600";
  if (g === "D") return "text-orange-600";
  return "text-red-600";
};

/* ══════════════════════════════════════════════════════════════════
   Canonical dossier display state — single source of truth
   ══════════════════════════════════════════════════════════════════ */
type DossierDisplayState = "locked" | "unlocked" | "preview_locked" | "preview_unlocked";

function deriveDisplayState(isPreview: boolean, masked: boolean): DossierDisplayState {
  if (isPreview) return masked ? "preview_locked" : "preview_unlocked";
  return masked ? "locked" : "unlocked";
}

function isUnlockedState(s: DossierDisplayState): boolean {
  return s === "unlocked" || s === "preview_unlocked";
}

/* ── Rich mock data for no-id / demo fallback ─────────────────── */
const MOCK_DOSSIER = {
  dossier: {
    lead: {
      id: "mock-lead-id",
      first_name: "Sarah",
      last_name: "M.",
      email: "s••••@gmail.com",
      phone_e164: "•••••••4567",
      city: "Fort Lauderdale",
      state: "FL",
      county: "Broward",
      project_type: "Full Home Replacement",
      quote_range: "$18,000–$24,000",
      window_count: 12,
      estimated_savings_low: 2400,
      estimated_savings_high: 5800,
      intent: "comparing_quotes",
    },
    analysis: {
      id: "mock-analysis-id",
      grade: "D",
      confidence_score: 87,
      document_type: "Contractor Proposal",
      rubric_version: "v3.2",
      created_at: new Date().toISOString(),
      flag_count: 4,
      red_flag_count: 2,
      amber_flag_count: 2,
    },
    extraction: {
      total_quoted_price: 22500,
      total_opening_count: 12,
      project_type: "Full Home Replacement",
      company_name: "••••••••",
      page_count: 3,
      line_item_count: 12,
      // Forensic signals — preview-mode showcase
      hvhz_zone: true,
      items_without_dp_rating: 12,
      items_without_noa: 12,
      code_compliance_install_statement_present: false,
      manufacturer_install_compliance_stated: false,
      opening_level_glass_specs_present: false,
      blanket_glass_language_present: true,
      mixed_glass_package_visibility: false,
      items_with_incomplete_glass: 8,
      opening_schedule_present: true,
      opening_schedule_room_labels_present: false,
      opening_schedule_dimensions_complete: true,
      opening_schedule_product_assignments_present: false,
      bulk_scope_blob_present: true,
      anchor_spacing_specified: false,
      fastener_type_specified: false,
      sealant_specified: true,
      disposal_included: true,
      engineering_mentioned: false,
      engineering_fees_included: false,
      warranty_labor_years: 1,
      warranty_manufacturer_years: 10,
      warranty_transferable: false,
      warranty_execution_details_present: false,
      warranty_service_provider_type: "contractor",
      leak_callback_sla_days: null,
      post_install_stucco_excluded: true,
      post_install_paint_excluded: true,
      water_intrusion_damage_excluded: false,
      permits_included: false,
      permits_responsible_party: "homeowner",
      permit_fees_itemized: false,
      stucco_repair_included: false,
      drywall_repair_included: false,
      paint_touchup_included: false,
      debris_removal_included: true,
      deposit_percent: 0.5,
      deposit_amount: 11250,
      final_payment_before_inspection: true,
      subject_to_remeasure_present: true,
      remeasure_price_adjustment_cap_present: false,
      written_change_order_required: false,
      homeowner_approval_required_for_change_orders: false,
      unilateral_price_adjustment_allowed: true,
      insurance_proof_mentioned: false,
      licensing_proof_mentioned: true,
      lead_paint_disclosure_present: false,
      terms_conditions_present: true,
      generic_product_description_present: true,
    },
    pillar_scores: { safety: 45, install: 38, price: 52, fine_print: 28, warranty: 20 },
    flags: [
      { label: "No Impact Rating Specified", detail: "Quote does not list DP ratings for any windows.", severity: "Critical", pillar: "safety", tip: null },
      { label: "Missing Permit Language", detail: "No mention of building permits or NOA compliance.", severity: "High", pillar: "install", tip: null },
      { label: "Above-Market Pricing", detail: "Price per opening is 34% above Broward County median.", severity: "Medium", pillar: "price", tip: null },
      { label: "No Written Warranty Terms", detail: "Quote mentions 'lifetime warranty' without defining coverage.", severity: "Medium", pillar: "warranty", tip: null },
    ],
    proof_of_read: { pages_scanned: 3, document_hash: "abc123" },
  },
  meta: {
    analysis_id: "mock-analysis-id",
    lead_id: "mock-lead-id",
    contractor_id: null,
    opportunity_id: "mock-opportunity-id",
    credit_balance: 5,
    already_unlocked: false,
    can_unlock: false,
    contractor_status: "demo",
    masked: true,
  },
  outcome: {
    id: "mock-outcome-id",
    opportunity_id: "mock-opportunity-id",
    lead_id: "mock-lead-id",
    contractor_id: "mock-contractor-id",
    disposition_state: "new" as const,
    disposition_reason_code: null,
    projected_value_cents: null,
    final_value_cents: null,
    signed_contract_url: null,
    last_partner_action_at: null,
  },
};

/* ── Types ─────────────────────────────────────────────────────── */
interface DossierMeta {
  analysis_id: string;
  lead_id: string | null;
  contractor_id: string | null;
  opportunity_id?: string | null;
  credit_balance: number;
  already_unlocked: boolean;
  can_unlock: boolean;
  contractor_status: string;
  masked: boolean;
}

interface DossierData {
  lead: Record<string, any> | null;
  analysis: Record<string, any>;
  extraction: Record<string, any>;
  pillar_scores: Record<string, number>;
  flags: Array<Record<string, any>>;
  proof_of_read: any;
}

interface DossierErrorDetails {
  message: string;
  errorCode?: string | null;
  stage?: string | null;
}

/* ══════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════ */
export default function PartnerDossier() {
  const { id } = useParams<{ id: string }>();
  const { setCreditBalance, setIsPreview: publishPreview } = usePartnerPortal();

  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [meta, setMeta] = useState<DossierMeta | null>(null);
  const [outcome, setOutcome] = useState<PartnerOutcome | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<DossierErrorDetails | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  /* ── Publish credit balance + preview state up to the layout chrome ── */
  useEffect(() => {
    setCreditBalance(meta?.credit_balance ?? null);
  }, [meta?.credit_balance, setCreditBalance]);

  useEffect(() => {
    publishPreview(isPreview);
  }, [isPreview, publishPreview]);


  /* ── Fallback helper ── */
  const fallbackToMock = useCallback(() => {
    setDossier(MOCK_DOSSIER.dossier as any);
    setMeta(MOCK_DOSSIER.meta as any);
    setOutcome(MOCK_DOSSIER.outcome as PartnerOutcome);
    setIsPreview(true);
  }, []);

  /* ── Initialize immediately with mock if no id ── */
  useEffect(() => {
    if (!id) fallbackToMock();
  }, [id, fallbackToMock]);

  /* ── Fetch dossier via edge function ── */
  const fetchDossier = useCallback(async () => {
    if (!id) return;
    let data: any = null;
    try {
      const res = await supabase.functions.invoke("get-contractor-dossier", { body: { id } });
      data = res.data;
      if (res.error) {
        setError("Unable to load this dossier right now.");
        setErrorDetails({
          message: data?.message ?? "The dossier service returned an error.",
          errorCode: data?.error_code ?? res.error.name ?? null,
          stage: data?.stage ?? null,
        });
        return;
      }
      data = res.data;
    } catch {
      setError("Unable to load this dossier right now.");
      setErrorDetails({ message: "Network error while loading dossier.", errorCode: "network_error" });
      return;
    }
    if (!data) {
      setError("Unable to load this dossier right now.");
      setErrorDetails({ message: "Empty dossier response.", errorCode: "empty_response" });
      return;
    }
    if (data.error === "unauthenticated" || data.error === "internal_error") {
      setError("Unable to load this dossier right now.");
      setErrorDetails({
        message: data.message ?? "Internal server error.",
        errorCode: data.error_code ?? data.error ?? null,
        stage: data.stage ?? null,
      });
      return;
    }
    if (data.error === "not_found") {
      setError("Dossier not found for the given ID.");
      setErrorDetails({ message: data.message ?? "Dossier not found.", errorCode: "not_found" });
      return;
    }
    if (data.dossier && data.meta) {
      setError(null);
      setErrorDetails(null);
      setDossier(data.dossier);
      setMeta(data.meta);
      setOutcome((data.outcome as PartnerOutcome | null) ?? null);
      setIsPreview(false);
    } else {
      setError("Unable to load this dossier right now.");
      setErrorDetails({ message: "Malformed dossier response.", errorCode: "malformed_response" });
    }
  }, [id]);

  useEffect(() => {
    if (id) { fallbackToMock(); fetchDossier(); }
  }, [id, fallbackToMock, fetchDossier]);

  /* ── Unlock handler ── */
  const handleUnlock = async () => {
    if (isPreview) {
      setMeta((prev) => prev ? { ...prev, masked: false, already_unlocked: true } : prev);
      setDossier((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lead: { ...prev.lead, first_name: "Sarah", last_name: "Martinez", email: "sarah.martinez@gmail.com", phone_e164: "+19545551234" },
        };
      });
      toast.success("Lead unlocked! (Preview mode)");
      return;
    }
    if (!meta?.lead_id) return;
    setUnlocking(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("unlock-lead", { body: { lead_id: meta.lead_id } });
      if (fnErr) { toast.error("Unlock failed. Please try again."); setUnlocking(false); return; }
      if (data?.success) {
        toast.success(data.already_unlocked ? "Lead already unlocked." : "Lead unlocked! 1 credit deducted.");
        await fetchDossier();
      } else {
        const code = data?.error_code;
        if (code === "insufficient_credits" || code === "no_credit_account") toast.error("Insufficient credits.");
        else if (code === "contractor_inactive") toast.error("Account suspended.");
        else toast.error(data?.message ?? "Unlock failed.");
      }
    } catch { toast.error("Network error."); } finally { setUnlocking(false); }
  };

  /* ── Copy helper ── */
  const copyText = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  /* ── Error / loading guards ── */
  if (error && !dossier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-slate-300 bg-card p-6 text-center shadow-sm space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-950">Dossier unavailable</h1>
            <p className="text-sm font-semibold text-slate-700">{error}</p>
          </div>
          {errorDetails && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-left font-mono text-xs font-semibold text-slate-700 space-y-1">
              {errorDetails.errorCode && <p>code: {errorDetails.errorCode}</p>}
              {errorDetails.stage && <p>stage: {errorDetails.stage}</p>}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => { setError(null); setErrorDetails(null); void fetchDossier(); }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-blue-800"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <Link
              to="/partner/opportunities"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Opportunities
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!dossier || !meta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Derived state — ALL downstream sections read from these
     ══════════════════════════════════════════════════════════════ */
  const lead = dossier.lead;
  const analysis = dossier.analysis;
  const ext = dossier.extraction;
  const pillarScores = dossier.pillar_scores ?? {};
  const flags = dossier.flags ?? [];

  const displayState = deriveDisplayState(isPreview, meta.masked);
  const unlocked = isUnlockedState(displayState);

  const totalPrice: number | null = ext?.total_quoted_price ?? null;
  const openingCount: number | null = ext?.total_opening_count ?? lead?.window_count ?? null;
  const pricePerOpening =
    totalPrice != null && openingCount && openingCount > 0
      ? Math.round(totalPrice / openingCount)
      : null;

  /* Document vault: detect whether a document exists */
  const hasDocument = !!(dossier.proof_of_read || ext?.company_name);

  /* Intake intelligence cards */
  const intakeCards = [
    { label: "Project Type", value: lead?.project_type ?? ext?.project_type, icon: Building2 },
    { label: "Window Count", value: lead?.window_count != null ? String(lead.window_count) : (openingCount != null ? String(openingCount) : null), icon: Hash },
    { label: "County", value: lead?.county, icon: MapPin },
    { label: "Quote Range", value: lead?.quote_range, icon: DollarSign },
    { label: "Quote Stage", value: lead?.intent?.replace(/_/g, " ") ?? (lead?.quote_range ? "Has Quote" : null), icon: Layers },
  ].filter((c) => c.value != null && c.value !== "");

  /* ══════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════ */
  return (
    <>
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* ─── Page header (breadcrumb + title + primary action) ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              to="/partner/opportunities"
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Opportunity Market
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <Crosshair className="h-5 w-5 text-primary" />
              <h1 className="font-display text-3xl sm:text-4xl font-black leading-tight tracking-tight text-slate-950">
                Intelligence Dossier
              </h1>
              {isPreview && <PreviewModeBadge />}
            </div>
            <p className="text-sm font-semibold text-slate-700 font-mono mt-1">
              ID&nbsp;{(meta.analysis_id ?? id ?? "demo").slice(0, 8)}…
            </p>
          </div>

          {/* Page-local primary action (NOT global chrome) */}
          <button
            onClick={handleUnlock}
            disabled={unlocked || unlocking || (!isPreview && !meta.can_unlock)}
            className={`flex items-center justify-center gap-2 min-h-10 px-5 py-2.5 rounded-lg text-sm font-extrabold transition-all shrink-0 border shadow-sm
              ${unlocked
                ? "bg-emerald-100 text-emerald-950 border border-emerald-300 cursor-default"
                : unlocking
                  ? "bg-primary/10 text-primary cursor-wait"
                  : (isPreview || meta.can_unlock)
                    ? "bg-blue-900 text-white hover:bg-blue-800 shadow-md active:scale-[0.98]"
                    : "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-300"
              }`}
          >
            {unlocked ? (
              <><ShieldCheck className="h-4 w-4" /> Lead Unlocked</>
            ) : unlocking ? (
              <><div className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-transparent animate-spin" /> Unlocking…</>
            ) : (
              <><Lock className="h-4 w-4" /> Unlock Lead · 1 Credit</>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════
            § 0 — PARTNER ACTION CENTER (Sprint 1D)
            ═══════════════════════════════════════════════════════ */}
        <PartnerActionCenter
          outcome={outcome}
          opportunityId={(meta as any)?.opportunity_id ?? outcome?.opportunity_id ?? null}
          isPreview={isPreview}
          isLocked={!isUnlockedState(deriveDisplayState(isPreview, meta.masked))}
          onUpdated={() => { void fetchDossier(); }}
        />

        {/* ═══════════════════════════════════════════════════════
            § 1 — LEAD PROVENANCE
            ═══════════════════════════════════════════════════════ */}
        <section className={`rounded-xl p-6 transition-colors duration-500 ${
          unlocked
            ? "border-2 border-emerald-300 bg-emerald-50/40"
            : "border border-slate-300 bg-card shadow-sm"
        }`}>
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-extrabold tracking-tight text-primary">
              Lead Provenance
            </h2>
            {unlocked && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
                <Unlock className="h-3 w-3" /> Contact Revealed
              </span>
            )}
            {!unlocked && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 bg-white border border-slate-300 px-3 py-1 rounded-full shadow-sm">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
            <InfoRow label="Location" value={`${lead?.city ?? "—"}, ${lead?.state ?? "FL"}`} />
            <InfoRow label="County" value={lead?.county ?? "N/A"} />
            <InfoRow
              label="Lead Name"
              value={`${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim() || "N/A"}
              blur={!unlocked}
            />
            <PiiRow
              label="Phone"
              value={lead?.phone_e164 ?? "N/A"}
              blur={!unlocked}
              onCopy={unlocked && lead?.phone_e164 ? () => copyText("Phone", lead.phone_e164) : undefined}
              copied={copied === "Phone"}
            />
            <PiiRow
              label="Email"
              value={lead?.email ?? "N/A"}
              blur={!unlocked}
              onCopy={unlocked && lead?.email ? () => copyText("Email", lead.email) : undefined}
              copied={copied === "Email"}
            />
            <InfoRow label="Project Type" value={lead?.project_type ?? ext?.project_type ?? "N/A"} />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            § 2 — LEAD INTAKE INTELLIGENCE
            ═══════════════════════════════════════════════════════ */}
        {intakeCards.length > 0 && (
          <section className="rounded-xl border border-slate-300 bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <ClipboardList className="h-5 w-5 text-violet-600" />
              <h2 className="text-xl font-extrabold tracking-tight text-violet-700">
                Lead Intake Intelligence
              </h2>
              <span className="ml-auto text-sm font-medium text-slate-700">
                {intakeCards.length} signal{intakeCards.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className={`grid gap-4 ${
              intakeCards.length >= 5 ? "grid-cols-2 sm:grid-cols-5" :
              intakeCards.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
              "grid-cols-1 sm:grid-cols-3"
            }`}>
              {intakeCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="relative bg-white rounded-xl p-4 border border-slate-300 shadow-sm overflow-hidden"
                  >
                    {/* Accent stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-violet-400" />
                    <div className="pl-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="h-3.5 w-3.5 text-violet-500/70" />
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-700 font-extrabold">
                          {card.label}
                        </p>
                      </div>
                      <p className="text-base font-black leading-tight capitalize text-slate-950">
                        {card.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════
            § 3 — COMPETITIVE INTELLIGENCE
            ═══════════════════════════════════════════════════════ */}
        <section className="rounded-xl border border-slate-300 bg-card shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-extrabold tracking-tight text-amber-700">
              Competitive Intelligence
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 text-center border border-slate-300 shadow-sm">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-widest mb-2">
                Competitor Grade
              </p>
              <p className={`text-5xl font-black leading-none ${gradeColor(analysis?.grade)}`}>
                {analysis?.grade ?? "—"}
              </p>
              {analysis?.confidence_score != null && (
                <p className="text-xs font-semibold text-slate-700 mt-2 font-mono">
                  {analysis.confidence_score}% confidence
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 text-center border border-slate-300 shadow-sm">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-widest mb-2">
                Total Quoted
              </p>
              <p className="text-3xl font-black text-slate-950">{fmt(totalPrice)}</p>
              <p className="text-sm font-medium text-slate-700 mt-1">
                {openingCount ?? "?"} openings
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 text-center border border-slate-300 shadow-sm">
              <p className="text-xs font-extrabold text-slate-700 uppercase tracking-widest mb-2">
                Price / Opening
              </p>
              <p className="text-3xl font-black text-slate-950">
                {pricePerOpening != null ? `$${pricePerOpening.toLocaleString()}` : "N/A"}
              </p>
              {pricePerOpening != null && <MarketIndicator price={pricePerOpening} />}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            § 3b — FORENSIC BREAKDOWN (Pillar Scores)
            ═══════════════════════════════════════════════════════ */}
        {Object.keys(pillarScores).length > 0 && (
          <section className="rounded-xl border border-slate-300 bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Crosshair className="h-5 w-5 text-violet-600" />
              <h2 className="text-xl font-extrabold tracking-tight text-violet-700">
                Forensic Breakdown
              </h2>
            </div>
            <div className="space-y-3.5">
              {Object.entries(PILLAR_LABELS).map(([key, label]) => {
                const score = pillarScores[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-28 shrink-0 text-right font-mono">
                      {label}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pillarColor(score)}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 font-mono w-8 text-right font-bold tabular-nums">
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════
            § 3c — FORENSIC FINDINGS (37+ extracted signals)
            ═══════════════════════════════════════════════════════ */}
        <ForensicFindingsPanel extraction={ext} locked={!unlocked} />

        {/* ═══════════════════════════════════════════════════════
            § 4 — ATTACK SURFACE & VULNERABILITIES
            ═══════════════════════════════════════════════════════ */}
        <section className="rounded-xl border border-red-300 bg-red-50 p-6">
          <div className="flex items-center gap-2 mb-5">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h2 className="text-xl font-extrabold tracking-tight text-destructive">
              Attack Surface &amp; Vulnerabilities
            </h2>
            {flags.length > 0 && (
              <span className="ml-auto text-[11px] font-bold text-destructive bg-destructive/10 border border-red-300 px-2 py-0.5 rounded-full">
                {flags.length} issue{flags.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {flags.length === 0 ? (
            <div className="flex items-center gap-2 py-4">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-medium text-slate-700">No critical vulnerabilities detected.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {flags.map((flag: any, i: number) => (
                <li
                  key={i}
                  className="flex items-start gap-3 bg-card rounded-xl p-4 border shadow-sm"
                >
                  <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug">
                      {flag?.label ?? `Flag ${i + 1}`}
                    </p>
                    <p className="text-sm font-medium text-slate-700 mt-1 leading-relaxed">
                      {flag?.detail ?? "—"}
                    </p>
                  </div>
                  {flag?.severity && (
                    <span
                      className={`shrink-0 text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        flag.severity === "Critical"
                          ? "bg-red-100 text-red-950 border border-red-300"
                          : flag.severity === "High"
                            ? "bg-red-100 text-red-950 border border-red-300"
                            : "bg-amber-100 text-amber-950 border border-amber-300"
                      }`}
                    >
                      {flag.severity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════
            § 5 — DOCUMENT VAULT
            ═══════════════════════════════════════════════════════ */}
        <DocumentVault
          hasDocument={hasDocument}
          isUnlocked={unlocked}
          analysisId={meta.analysis_id}
          createdAt={analysis?.created_at}
          isPreview={isPreview}
        />

        {/* ─── Provenance Footer ── */}
        <footer className="text-center text-sm font-medium text-slate-700 font-mono py-8 space-y-1 border-t mt-4 pt-8">
          <p>
            Scanned {new Date(analysis?.created_at).toLocaleString()} · Rubric {analysis?.rubric_version ?? "—"} · Confidence {analysis?.confidence_score ?? "—"}%
          </p>
          <p className="text-slate-700">WindowMan Intelligence — Contractor Eyes Only</p>
        </footer>
      </main>
    </>

  );
}

/* ══════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════ */

function InfoRow({ label, value, blur }: { label: string; value: string; blur?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-700 font-extrabold mb-1">
        {label}
      </p>
      <p className={`text-base font-bold leading-snug text-slate-950 ${blur ? "blur-[5px] select-none" : ""} transition-[filter] duration-500`}>
        {value}
      </p>
    </div>
  );
}

function PiiRow({ label, value, blur, onCopy, copied }: {
  label: string; value: string; blur: boolean; onCopy?: () => void; copied: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-700 font-extrabold mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p className={`text-base font-bold leading-snug text-slate-950 ${blur ? "blur-[5px] select-none" : ""} transition-[filter] duration-500`}>
          {value}
        </p>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded-md text-slate-700 hover:text-primary hover:bg-primary/5 transition-colors"
            title={`Copy ${label}`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function MarketIndicator({ price }: { price: number }) {
  const avg = 2100;
  const diff = ((price - avg) / avg) * 100;
  const abs = Math.abs(Math.round(diff));

  if (abs < 5)
    return (
      <span className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700 mt-1.5">
        <Minus className="h-3 w-3" /> At market
      </span>
    );

  return diff > 0 ? (
    <span className="flex items-center justify-center gap-1 text-[10px] text-red-600 mt-1.5 font-medium">
      <TrendingUp className="h-3 w-3" /> {abs}% above market
    </span>
  ) : (
    <span className="flex items-center justify-center gap-1 text-[10px] text-emerald-600 mt-1.5 font-medium">
      <TrendingDown className="h-3 w-3" /> {abs}% below market
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Document Vault — 3 distinct visual states
   ══════════════════════════════════════════════════════════════════ */
function DocumentVault({ hasDocument, isUnlocked, analysisId, createdAt, isPreview }: {
  hasDocument: boolean; isUnlocked: boolean; analysisId: string; createdAt: string | undefined; isPreview: boolean;
}) {
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const handleViewDocument = async () => {
    if (isPreview) { toast.info("Document viewing not available in preview mode."); return; }
    setDocLoading(true);
    setDocError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("get-contractor-document-url", { body: { analysis_id: analysisId } });
      if (fnErr || !data?.success) {
        const msg = data?.message ?? fnErr?.message ?? "Failed to retrieve document.";
        setDocError(msg); toast.error(msg); return;
      }
      window.open(data.signed_url, "_blank", "noopener,noreferrer");
    } catch { setDocError("Network error."); toast.error("Network error."); } finally { setDocLoading(false); }
  };

  const scannedDate = createdAt ? new Date(createdAt).toLocaleDateString() : "—";

  /* ── State 1: No document ── */
  if (!hasDocument) {
    return (
      <section className="rounded-xl border border-dashed bg-muted/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-slate-700" />
          <h2 className="text-xl font-extrabold tracking-tight text-slate-700">
            Document Vault
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
            <FileText className="h-7 w-7 text-slate-700" />
          </div>
          <p className="text-sm font-medium text-slate-700">No document on file</p>
          <p className="text-xs text-slate-700 mt-1 max-w-xs">
            The original quote document was not uploaded for this lead.
          </p>
        </div>
      </section>
    );
  }

  /* ── State 2: Document exists, locked ── */
  if (!isUnlocked) {
    return (
      <section className="rounded-xl border border-slate-300 bg-card shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-extrabold tracking-tight text-primary">
            Document Vault
          </h2>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-muted px-2 py-0.5 rounded-full">
            <Lock className="h-3 w-3" /> Locked
          </span>
        </div>
        <div className="relative bg-muted/30 rounded-xl p-6 border overflow-hidden">
          {/* Locked overlay */}
          <div className="absolute inset-0 backdrop-blur-sm bg-background/30 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted border flex items-center justify-center">
                <Lock className="h-5 w-5 text-slate-700" />
              </div>
              <p className="text-xs font-semibold text-slate-700">Unlock to view document</p>
            </div>
          </div>
          {/* Blurred content behind */}
          <div className="flex items-center gap-4 select-none pointer-events-none opacity-100">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <p className="text-sm font-medium">Original_Quote.pdf</p>
              <p className="text-xs text-slate-700">Scanned {scannedDate}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── State 3: Document exists, unlocked ── */
  return (
    <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50/40 p-6 transition-colors duration-500">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-emerald-600" />
        <h2 className="text-xl font-extrabold tracking-tight text-emerald-700">
          Document Vault
        </h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full">
          <Eye className="h-3 w-3" /> Viewable
        </span>
      </div>
      <div className="bg-card rounded-xl p-5 border border-emerald-200 flex items-center gap-4 shadow-sm">
        <div className="h-12 w-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Original_Quote.pdf</p>
          <p className="text-xs text-slate-700 mt-0.5">Scanned {scannedDate}</p>
          {docError && <p className="text-xs text-destructive mt-1">{docError}</p>}
        </div>
        <button
          onClick={handleViewDocument}
          disabled={docLoading}
          className="min-h-10 px-4 py-2.5 rounded-lg border border-blue-900 bg-blue-900 text-white text-sm font-extrabold hover:bg-blue-800 transition-colors disabled:opacity-100 disabled:cursor-wait shadow-sm"
        >
          {docLoading ? "Loading…" : "View Original Quote"}
        </button>
      </div>
    </section>
  );
}
