import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Shield,
  CreditCard,
  Search,
  Lock,
  Unlock,
  FileText,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Target,
  TrendingUp,
  Filter,
  LayoutGrid,
  Plus,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PreviewModeBadge } from "@/components/PreviewModeBadge";
import { toast } from "sonner";
import {
  formatRelativeTime,
  getBuyerSeriousness,
  getPropertyBadge,
  getTimelineBadge,
  getMotivationBadge,
  getHandoffSignal,
  getBestSalesAngle,
  getRecommendedAction,
  getBestUnlockScore,
  type HandoffTone,
} from "@/lib/contractorOpportunitySignals";

/* ── Types ──────────────────────────────────────────────────────── */
interface Opportunity {
  opportunity_id: string;
  route_id: string;
  analysis_id: string;
  lead_id: string;
  county: string | null;
  city: string | null;
  project_type: string | null;
  window_count: number | null;
  quote_range: string | null;
  grade: string | null;
  flag_count: number;
  red_flag_count: number;
  amber_flag_count: number;
  priority_score: number;
  status: string;
  release_status: string;
  already_unlocked: boolean;
  can_unlock: boolean;
  credit_balance: number;
  dossier_href: string;
  has_document: boolean;
  created_at: string;

  /* ── Sprint 1: optional frontend-only signal fields (nullable-safe) ── */
  buyer_seriousness_score?: number | null;
  buyer_seriousness_band?: "A" | "B" | "C" | "D" | null;
  property_type_detail?: string | null;
  hoa_or_condo_complexity?: string | null;
  timeline_bucket?: string | null;
  motivation_reason?: string | null;
  handoff_consent_status?: string | null;
  last_activity_at?: string | null;
  phone_verified_at?: string | null;
  report_viewed_at?: string | null;
  best_sales_angle?: string | null;
  recommended_action?: string | null;
  exclusive_status?: string | null;
  contractor_view_count?: number | null;
  unlocked_by_other_count?: number | null;
  credit_cost?: number | null;
}

interface Meta {
  credit_balance: number;
  contractor_status: string;
  total: number;
}

type FilterTab = "all" | "unlocked" | "pending" | "released";

type SortMode =
  | "best_unlock"
  | "highest_bss"
  | "newest"
  | "largest_project"
  | "most_red_flags"
  | "ready_this_month";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "best_unlock", label: "Best Unlock" },
  { value: "highest_bss", label: "Highest BSS" },
  { value: "newest", label: "Newest" },
  { value: "largest_project", label: "Largest Project" },
  { value: "most_red_flags", label: "Most Red Flags" },
  { value: "ready_this_month", label: "Ready Soonest" },
];

const TIMELINE_RANK: Record<string, number> = {
  asap: 0,
  this_month: 1,
  one_to_three_months: 2,
  three_to_six_months: 3,
  researching: 4,
};

function parseQuoteMidpoint(range: string | null | undefined): number {
  if (!range) return 0;
  const nums = range.replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return 0;
  const vals = nums.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (vals.length === 0) return 0;
  if (vals.length === 1) return vals[0];
  return (vals[0] + vals[vals.length - 1]) / 2;
}

const HANDOFF_TONE_CLASSES: Record<HandoffTone, string> = {
  hot: "bg-red-50 border-red-200 text-red-700",
  warm: "bg-amber-50 border-amber-200 text-amber-700",
  caution: "bg-sky-50 border-sky-200 text-sky-700",
  muted: "bg-muted border-border text-muted-foreground",
};

/* ── Helpers ────────────────────────────────────────────────────── */
const gradeColor = (g: string | null) => {
  if (!g) return "text-muted-foreground";
  if (g === "A") return "text-emerald-600";
  if (g === "B") return "text-emerald-500";
  if (g === "C") return "text-amber-600";
  if (g === "D") return "text-orange-600";
  return "text-red-600";
};

const gradeBg = (g: string | null) => {
  if (!g) return "bg-muted";
  if (g === "A") return "bg-emerald-50 border-emerald-200";
  if (g === "B") return "bg-emerald-50 border-emerald-200";
  if (g === "C") return "bg-amber-50 border-amber-200";
  if (g === "D") return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
};

const statusPill = (status: string) => {
  const map: Record<string, { label: string; classes: string }> = {
    intro_requested: { label: "New", classes: "bg-sky-100 text-sky-700" },
    contractor_interested: { label: "Interested", classes: "bg-violet-100 text-violet-700" },
    homeowner_contact_released: { label: "Released", classes: "bg-emerald-100 text-emerald-700" },
    closed_won: { label: "Won", classes: "bg-emerald-100 text-emerald-800" },
    closed_lost: { label: "Lost", classes: "bg-muted text-muted-foreground" },
  };
  const info = map[status] ?? { label: status.replace(/_/g, " "), classes: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${info.classes}`}>
      {info.label}
    </span>
  );
};

/* ── Hard-disable live fetch ────────────────────────────────────── */
const FORCE_PREVIEW_MODE = true;

/* ── Mock data for preview mode ────────────────────────────────── */
const MOCK_OPPORTUNITIES: Opportunity[] = [
  { opportunity_id: "mock-1", route_id: "r1", analysis_id: "a1", lead_id: "l1", county: "Broward", city: "Fort Lauderdale", project_type: "Full Home Replacement", window_count: 12, quote_range: "$18,000–$24,000", grade: "D", flag_count: 4, red_flag_count: 2, amber_flag_count: 2, priority_score: 85, status: "intro_requested", release_status: "pending", already_unlocked: false, can_unlock: false, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date().toISOString() },
  { opportunity_id: "mock-2", route_id: "r2", analysis_id: "a2", lead_id: "l2", county: "Miami-Dade", city: "Miami", project_type: "Partial Replacement", window_count: 6, quote_range: "$8,500–$12,000", grade: "C", flag_count: 2, red_flag_count: 1, amber_flag_count: 1, priority_score: 72, status: "contractor_interested", release_status: "pending", already_unlocked: true, can_unlock: true, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  { opportunity_id: "mock-3", route_id: "r3", analysis_id: "a3", lead_id: "l3", county: "Palm Beach", city: "Boca Raton", project_type: "Impact Door + Windows", window_count: 18, quote_range: "$32,000–$45,000", grade: "F", flag_count: 7, red_flag_count: 4, amber_flag_count: 3, priority_score: 94, status: "intro_requested", release_status: "pending", already_unlocked: false, can_unlock: false, credit_balance: 5, dossier_href: "/partner/dossier", has_document: false, created_at: new Date(Date.now() - 172800000).toISOString() },
  { opportunity_id: "mock-4", route_id: "r4", analysis_id: "a4", lead_id: "l4", county: "Hillsborough", city: "Tampa", project_type: "Full Home Replacement", window_count: 22, quote_range: "$28,000–$38,000", grade: "B", flag_count: 1, red_flag_count: 0, amber_flag_count: 1, priority_score: 60, status: "homeowner_contact_released", release_status: "released", already_unlocked: true, can_unlock: true, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date(Date.now() - 259200000).toISOString() },
  { opportunity_id: "mock-5", route_id: "r5", analysis_id: "a5", lead_id: "l5", county: "Duval", city: "Jacksonville", project_type: "Storefront Impact Glazing", window_count: 8, quote_range: "$14,000–$19,500", grade: "C", flag_count: 3, red_flag_count: 1, amber_flag_count: 2, priority_score: 68, status: "intro_requested", release_status: "pending", already_unlocked: false, can_unlock: false, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date(Date.now() - 345600000).toISOString() },
  { opportunity_id: "mock-6", route_id: "r6", analysis_id: "a6", lead_id: "l6", county: "Lee", city: "Cape Coral", project_type: "Hurricane Retrofit", window_count: 15, quote_range: "$22,000–$30,000", grade: "D", flag_count: 5, red_flag_count: 3, amber_flag_count: 2, priority_score: 81, status: "contractor_interested", release_status: "pending", already_unlocked: false, can_unlock: false, credit_balance: 5, dossier_href: "/partner/dossier", has_document: false, created_at: new Date(Date.now() - 432000000).toISOString() },
  { opportunity_id: "mock-7", route_id: "r7", analysis_id: "a7", lead_id: "l7", county: "Orange", city: "Orlando", project_type: "Sliding Glass Door + Windows", window_count: 10, quote_range: "$16,000–$21,000", grade: "A", flag_count: 0, red_flag_count: 0, amber_flag_count: 0, priority_score: 45, status: "closed_won", release_status: "released", already_unlocked: true, can_unlock: true, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date(Date.now() - 518400000).toISOString() },
  { opportunity_id: "mock-8", route_id: "r8", analysis_id: "a8", lead_id: "l8", county: "Pinellas", city: "St. Petersburg", project_type: "Full Home Replacement", window_count: 20, quote_range: "$26,000–$35,000", grade: "F", flag_count: 8, red_flag_count: 5, amber_flag_count: 3, priority_score: 97, status: "intro_requested", release_status: "pending", already_unlocked: false, can_unlock: false, credit_balance: 5, dossier_href: "/partner/dossier", has_document: true, created_at: new Date(Date.now() - 604800000).toISOString() },
];
const MOCK_META: Meta = { credit_balance: 5, contractor_status: "preview", total: 8 };

export default function ContractorOpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [opportunities, setOpportunities] = useState<Opportunity[]>(FORCE_PREVIEW_MODE ? MOCK_OPPORTUNITIES : []);
  const [meta, setMeta] = useState<Meta | null>(FORCE_PREVIEW_MODE ? MOCK_META : null);
  const [isPreview, setIsPreview] = useState(FORCE_PREVIEW_MODE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [countyFilter, setCountyFilter] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const paymentHandled = useRef(false);

  const fallbackToMock = useCallback(() => {
    setOpportunities(MOCK_OPPORTUNITIES);
    setMeta(MOCK_META);
    setIsPreview(true);
  }, []);

  const fetchOpportunities = useCallback(async () => {
    if (FORCE_PREVIEW_MODE) return;

    setErrorMsg(null);
    try {
      const res = await supabase.functions.invoke("list-contractor-opportunities", { body: {} });
      if (res.error) { fallbackToMock(); return; }
      const data = res.data as any;
      if (!data || data.error) { fallbackToMock(); return; }
      setOpportunities(data.opportunities ?? []);
      setMeta(data.meta ?? null);
      setIsPreview(false);
    } catch {
      fallbackToMock();
    }
  }, [fallbackToMock]);

  useEffect(() => { fetchOpportunities(); }, [fetchOpportunities]);

  /* ── Payment return handling ── */
  useEffect(() => {
    if (paymentHandled.current) return;
    const payment = searchParams.get("payment");
    if (!payment) return;

    paymentHandled.current = true;

    if (payment === "success") {
      toast.success("Payment received. Refreshing credits…");
      // Give webhook a moment to fulfill, then refresh
      const timer = setTimeout(() => {
        fetchOpportunities();
      }, 2500);
      // Clean URL
      setSearchParams((prev) => {
        prev.delete("payment");
        prev.delete("session_id");
        return prev;
      }, { replace: true });
      return () => clearTimeout(timer);
    }

    if (payment === "cancel") {
      toast("Checkout cancelled — no charges were made.", { duration: 4000 });
      setSearchParams((prev) => {
        prev.delete("payment");
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchOpportunities]);

  /* ── Add Credits handler ── */
  const handleAddCredits = async () => {
    setCheckoutLoading(true);
    try {
      const origin = window.location.origin;
      const res = await supabase.functions.invoke("create-checkout-session", {
        body: { pack_code: "pack_10_credits", origin },
      });

      if (res.error) {
        console.error("[AddCredits] invoke error:", res.error);
        toast.error("Failed to start checkout. Please try again.");
        setCheckoutLoading(false);
        return;
      }

      const data = res.data as { url?: string; error?: string; message?: string };
      if (!data?.url) {
        toast.error(data?.message ?? "Failed to create checkout session.");
        setCheckoutLoading(false);
        return;
      }

      // Redirect to Stripe
      window.location.href = data.url;
    } catch (err) {
      console.error("[AddCredits] unhandled error:", err);
      toast.error("Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  };

  /* ── Canonical derived filtered list ── */
  const filteredOpportunities = useMemo(() => {
    let result = opportunities;

    if (activeFilter === "unlocked") result = result.filter((o) => o.already_unlocked);
    else if (activeFilter === "pending") result = result.filter((o) => o.release_status === "pending");
    else if (activeFilter === "released") result = result.filter((o) => o.release_status === "released");

    if (countyFilter) {
      result = result.filter((o) => o.county?.toLowerCase() === countyFilter.toLowerCase());
    }

    return result;
  }, [opportunities, activeFilter, countyFilter]);

  /* ── Derived stats from full dataset (not affected by county filter) ── */
  const totalCount = opportunities.length;
  const unlockedCount = opportunities.filter((o) => o.already_unlocked).length;
  const pendingCount = opportunities.filter((o) => o.release_status === "pending").length;
  const releasedCount = opportunities.filter((o) => o.release_status === "released").length;
  const newCount = opportunities.filter((o) => o.status === "intro_requested").length;
  const uniqueCounties = [...new Set(opportunities.map((o) => o.county).filter(Boolean))];

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${totalCount})` },
    { key: "unlocked", label: `Unlocked (${unlockedCount})` },
    { key: "pending", label: `Pending (${pendingCount})` },
    { key: "released", label: `Released (${releasedCount})` },
  ];

  /* ── Error ──────────────────────────────────────────────────── */
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={fetchOpportunities}
            className="px-4 py-2 rounded-lg bg-muted text-sm text-foreground hover:bg-accent transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight leading-none">
                  Opportunity Command Center
                </h1>
                {isPreview && <PreviewModeBadge />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">WindowMan Partner Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted border">
              <CreditCard className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-xs font-mono text-foreground">
                {meta?.credit_balance ?? 0} credit{(meta?.credit_balance ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={handleAddCredits}
              disabled={checkoutLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</>
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Add Credits</>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
        {/* ─── Stats Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
          <StatCard icon={<LayoutGrid className="h-4 w-4 text-sky-600" />} label="Total" value={totalCount} />
          <StatCard icon={<Unlock className="h-4 w-4 text-emerald-600" />} label="Unlocked" value={unlockedCount} />
          <StatCard icon={<Target className="h-4 w-4 text-amber-600" />} label="New Leads" value={newCount} />
          <StatCard icon={<CreditCard className="h-4 w-4 text-violet-600" />} label="Credits" value={meta?.credit_balance ?? 0} />
        </div>

        {/* ─── Filters ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg border p-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeFilter === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {uniqueCounties.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                className="bg-background border rounded-md text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Counties</option>
                {uniqueCounties.sort().map((c) => (
                  <option key={c} value={c!}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filteredOpportunities.length} of {totalCount}
          </span>
        </div>

        {/* ─── Opportunity List ─────────────────────────────────── */}
        {filteredOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-1">
              {totalCount === 0 ? "No opportunities yet" : "No matches for current filter"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {totalCount === 0
                ? "When homeowners scan their quotes and match your service area, opportunities will appear here."
                : "Try adjusting your filters to see more opportunities."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
            {filteredOpportunities.map((opp) => (
              <OpportunityCard key={opp.opportunity_id} opp={opp} navigate={navigate} />
            ))}
          </div>
        )}
      </main>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="text-center text-[11px] text-muted-foreground py-8">
        WindowMan Partner Portal — Contractor Eyes Only
      </footer>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function OpportunityCard({ opp, navigate }: { opp: Opportunity; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(opp.dossier_href)}
      className="w-full text-left bg-card border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Top row: grade + location + status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`h-10 w-10 rounded-lg border flex items-center justify-center ${gradeBg(opp.grade)}`}>
              <span className={`text-lg font-black ${gradeColor(opp.grade)}`}>
                {opp.grade ?? "—"}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">
                  {opp.project_type ?? "Window Project"}
                </span>
                {statusPill(opp.status)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {[opp.city, opp.county].filter(Boolean).join(", ") || "Florida"}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 flex-wrap">
            {opp.window_count != null && (
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{opp.window_count}</span> openings
              </span>
            )}
            {opp.quote_range && (
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{opp.quote_range}</span>
              </span>
            )}
            {opp.flag_count > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="text-red-600 font-medium">{opp.red_flag_count}</span> red ·{" "}
                <span className="text-amber-600 font-medium">{opp.amber_flag_count}</span> amber
              </span>
            )}
            {opp.has_document && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" /> Doc
              </span>
            )}
          </div>
        </div>

        {/* Right: unlock state + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {opp.already_unlocked ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
              <Unlock className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Unlocked</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted border">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Locked</span>
            </div>
          )}

          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}
