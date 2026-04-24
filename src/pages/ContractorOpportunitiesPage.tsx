import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CreditCard,
  Search,
  Lock,
  Unlock,
  FileText,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Target,
  Filter,
  LayoutGrid,
  Check,
  Clock,
  Phone,
  Eye,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePartnerPortal } from "@/components/partner/PartnerPortalContext";
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
  getCreditCost,
  getCreditCostLine,
  getUnlockIncludes,
  getCompetitionSignal,
  type HandoffTone,
  type CompetitionTone,
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
const NOW = Date.now();
const MOCK_OPPORTUNITIES: Opportunity[] = [
  // 1. Hot single-family lead — should rise to top under Best Unlock
  {
    opportunity_id: "mock-1", route_id: "r1", analysis_id: "a1", lead_id: "l1",
    county: "Broward", city: "Fort Lauderdale", project_type: "Full Home Replacement",
    window_count: 12, quote_range: "$18,000–$24,000", grade: "D",
    flag_count: 4, red_flag_count: 2, amber_flag_count: 2, priority_score: 85,
    status: "intro_requested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 12 * 60_000).toISOString(),
    buyer_seriousness_score: 92, buyer_seriousness_band: "A",
    property_type_detail: "single_family", timeline_bucket: "this_month",
    motivation_reason: "price_shock", handoff_consent_status: "accepted_today",
    phone_verified_at: new Date(NOW - 30 * 60_000).toISOString(),
    report_viewed_at: new Date(NOW - 20 * 60_000).toISOString(),
    last_activity_at: new Date(NOW - 10 * 60_000).toISOString(),
    exclusive_status: "first_look", contractor_view_count: 0,
    unlocked_by_other_count: 0, credit_cost: 1,
  },
  {
    opportunity_id: "mock-2", route_id: "r2", analysis_id: "a2", lead_id: "l2",
    county: "Miami-Dade", city: "Miami", project_type: "Partial Replacement",
    window_count: 6, quote_range: "$8,500–$12,000", grade: "C",
    flag_count: 2, red_flag_count: 1, amber_flag_count: 1, priority_score: 72,
    status: "contractor_interested", release_status: "pending",
    already_unlocked: true, can_unlock: true, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 86_400_000).toISOString(),
  },
  // 2. Complex condo/high-rise — caution tone, HOA constraints
  {
    opportunity_id: "mock-3", route_id: "r3", analysis_id: "a3", lead_id: "l3",
    county: "Palm Beach", city: "Boca Raton", project_type: "Impact Door + Windows",
    window_count: 18, quote_range: "$32,000–$45,000", grade: "F",
    flag_count: 7, red_flag_count: 4, amber_flag_count: 3, priority_score: 78,
    status: "intro_requested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: false,
    created_at: new Date(NOW - 172_800_000).toISOString(),
    buyer_seriousness_score: 78, buyer_seriousness_band: "B",
    property_type_detail: "high_rise",
    hoa_or_condo_complexity: "high_rise_engineering",
    timeline_bucket: "one_to_three_months",
    motivation_reason: "insurance_or_inspection_pressure",
    handoff_consent_status: "text_or_email_first",
    credit_cost: 1,
  },
  {
    opportunity_id: "mock-4", route_id: "r4", analysis_id: "a4", lead_id: "l4",
    county: "Hillsborough", city: "Tampa", project_type: "Full Home Replacement",
    window_count: 22, quote_range: "$28,000–$38,000", grade: "B",
    flag_count: 1, red_flag_count: 0, amber_flag_count: 1, priority_score: 60,
    status: "homeowner_contact_released", release_status: "released",
    already_unlocked: true, can_unlock: true, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 259_200_000).toISOString(),
  },
  // 3. Report-only nurture — must look muted, NOT a hot-call lead
  {
    opportunity_id: "mock-5", route_id: "r5", analysis_id: "a5", lead_id: "l5",
    county: "Duval", city: "Jacksonville", project_type: "Storefront Impact Glazing",
    window_count: 8, quote_range: "$14,000–$19,500", grade: "C",
    flag_count: 3, red_flag_count: 1, amber_flag_count: 2, priority_score: 55,
    status: "intro_requested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 345_600_000).toISOString(),
    buyer_seriousness_score: 55, buyer_seriousness_band: "C",
    property_type_detail: "single_family", timeline_bucket: "researching",
    motivation_reason: "comparing_before_signing",
    handoff_consent_status: "report_only",
    credit_cost: 1,
  },
  // 4. High project value urgent
  {
    opportunity_id: "mock-6", route_id: "r6", analysis_id: "a6", lead_id: "l6",
    county: "Lee", city: "Cape Coral", project_type: "Hurricane Retrofit",
    window_count: 15, quote_range: "$22,000–$30,000", grade: "D",
    flag_count: 5, red_flag_count: 3, amber_flag_count: 2, priority_score: 88,
    status: "contractor_interested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: false,
    created_at: new Date(NOW - 3 * 60 * 60_000).toISOString(),
    buyer_seriousness_score: 88, buyer_seriousness_band: "B",
    property_type_detail: "single_family", timeline_bucket: "asap",
    motivation_reason: "scope_mismatch",
    handoff_consent_status: "accepted_today",
    credit_cost: 1,
  },
  {
    opportunity_id: "mock-7", route_id: "r7", analysis_id: "a7", lead_id: "l7",
    county: "Orange", city: "Orlando", project_type: "Sliding Glass Door + Windows",
    window_count: 10, quote_range: "$16,000–$21,000", grade: "A",
    flag_count: 0, red_flag_count: 0, amber_flag_count: 0, priority_score: 45,
    status: "closed_won", release_status: "released",
    already_unlocked: true, can_unlock: true, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 518_400_000).toISOString(),
  },
  // 5. Weak/unknown lead — should sink under Best Unlock
  {
    opportunity_id: "mock-8", route_id: "r8", analysis_id: "a8", lead_id: "l8",
    county: "Pinellas", city: "St. Petersburg", project_type: "Full Home Replacement",
    window_count: 20, quote_range: "$26,000–$35,000", grade: "F",
    flag_count: 8, red_flag_count: 5, amber_flag_count: 3, priority_score: 42,
    status: "intro_requested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 5,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 604_800_000).toISOString(),
    buyer_seriousness_score: 42, buyer_seriousness_band: "D",
    property_type_detail: null, timeline_bucket: null,
    motivation_reason: null, handoff_consent_status: null,
    credit_cost: 1,
  },
  // 6. Insufficient-credits demo: locked, can_unlock false, credit_balance 0
  {
    opportunity_id: "mock-9", route_id: "r9", analysis_id: "a9", lead_id: "l9",
    county: "Broward", city: "Pembroke Pines", project_type: "Full Home Replacement",
    window_count: 14, quote_range: "$20,000–$27,000", grade: "C",
    flag_count: 3, red_flag_count: 1, amber_flag_count: 2, priority_score: 70,
    status: "intro_requested", release_status: "pending",
    already_unlocked: false, can_unlock: false, credit_balance: 0,
    dossier_href: "/partner/dossier", has_document: true,
    created_at: new Date(NOW - 6 * 60 * 60_000).toISOString(),
    buyer_seriousness_score: 70, buyer_seriousness_band: "C",
    property_type_detail: "single_family", timeline_bucket: "one_to_three_months",
    motivation_reason: "wants_better_price",
    handoff_consent_status: "accepted_tomorrow",
    credit_cost: 1,
  },
];
const MOCK_META: Meta = { credit_balance: 5, contractor_status: "preview", total: 9 };

export default function ContractorOpportunitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCreditBalance, setIsPreview: publishPreview } = usePartnerPortal();
  const [opportunities, setOpportunities] = useState<Opportunity[]>(FORCE_PREVIEW_MODE ? MOCK_OPPORTUNITIES : []);
  const [meta, setMeta] = useState<Meta | null>(FORCE_PREVIEW_MODE ? MOCK_META : null);
  const [isPreview, setIsPreview] = useState(FORCE_PREVIEW_MODE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [countyFilter, setCountyFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("best_unlock");
  const paymentHandled = useRef(false);

  /* ── Publish credit balance + preview state up to the layout chrome ── */
  useEffect(() => {
    setCreditBalance(meta?.credit_balance ?? null);
  }, [meta?.credit_balance, setCreditBalance]);

  useEffect(() => {
    publishPreview(isPreview);
  }, [isPreview, publishPreview]);


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

  // Add Credits CTA + checkout invocation now lives in PartnerLayout chrome.

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

  /* ── Sorted view (sorting happens AFTER filtering; original array not mutated) ── */
  const sortedOpportunities = useMemo(() => {
    const arr = filteredOpportunities.slice();
    switch (sortMode) {
      case "best_unlock":
        return arr.sort((a, b) => getBestUnlockScore(b) - getBestUnlockScore(a));
      case "highest_bss": {
        const score = (o: Opportunity) =>
          o.buyer_seriousness_score ?? o.priority_score ?? -Infinity;
        return arr.sort((a, b) => score(b) - score(a));
      }
      case "newest":
        return arr.sort(
          (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""),
        );
      case "largest_project":
        return arr.sort((a, b) => {
          const av = parseQuoteMidpoint(a.quote_range) || (a.window_count ?? 0);
          const bv = parseQuoteMidpoint(b.quote_range) || (b.window_count ?? 0);
          return bv - av;
        });
      case "most_red_flags":
        return arr.sort((a, b) => {
          const dr = (b.red_flag_count ?? 0) - (a.red_flag_count ?? 0);
          if (dr !== 0) return dr;
          return (b.amber_flag_count ?? 0) - (a.amber_flag_count ?? 0);
        });
      case "ready_this_month": {
        const rank = (o: Opportunity) =>
          o.timeline_bucket && TIMELINE_RANK[o.timeline_bucket] != null
            ? TIMELINE_RANK[o.timeline_bucket]
            : 99;
        return arr.sort((a, b) => rank(a) - rank(b));
      }
      default:
        return arr;
    }
  }, [filteredOpportunities, sortMode]);

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
    <>

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 space-y-6">
        {/* ─── Stats Row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
          <StatCard icon={<LayoutGrid className="h-4 w-4 text-sky-600" />} label="Total" value={totalCount} />
          <StatCard icon={<Unlock className="h-4 w-4 text-emerald-600" />} label="Unlocked" value={unlockedCount} />
          <StatCard icon={<Target className="h-4 w-4 text-amber-600" />} label="New Leads" value={newCount} />
          <StatCard icon={<CreditCard className="h-4 w-4 text-violet-600" />} label="Credits" value={meta?.credit_balance ?? 0} />
        </div>

        {/* ─── Tactical buying-logic explainer (compact, dashboard-native) ── */}
        <div
          className="rounded-lg border bg-muted/40 px-4 py-3"
          aria-label="How to use Best Unlock"
        >
          <p className="text-xs sm:text-sm text-foreground">
            <span className="font-semibold">Use Best Unlock</span> to prioritize verified, urgent,
            warm-handoff leads — not just bad competitor quotes.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Best Unlock ranks opportunities by buyer seriousness, urgency, handoff warmth, and
            project value.
            {isPreview && (
              <span className="ml-1 italic">
                Preview data uses sample credit signals for demonstration.
              </span>
            )}
          </p>
        </div>

        {/* ─── Filters & Sort ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1 bg-muted rounded-lg border p-1 overflow-x-auto max-w-full"
            role="tablist"
            aria-label="Opportunity filter"
          >
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeFilter === tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
              <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <label className="sr-only" htmlFor="county-filter">Filter by county</label>
              <select
                id="county-filter"
                value={countyFilter}
                onChange={(e) => setCountyFilter(e.target.value)}
                className="bg-background border rounded-md text-xs px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Filter by county"
              >
                <option value="">All Counties</option>
                {uniqueCounties.sort().map((c) => (
                  <option key={c} value={c!}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label
              htmlFor="sort-mode"
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Sort
            </label>
            <select
              id="sort-mode"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-background border rounded-md text-xs px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort opportunities"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
            Showing {sortedOpportunities.length} of {totalCount}
          </span>
        </div>

        {/* ─── Opportunity List ─────────────────────────────────── */}
        {sortedOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
            <Search className="h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden />
            <h3 className="text-base sm:text-lg font-semibold text-muted-foreground mb-1">
              {totalCount === 0 ? "No opportunities yet" : "No matches for current filters"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {totalCount === 0
                ? "When homeowners in your territory scan quotes and match your service profile, opportunities will appear here."
                : "Clear filters or switch back to Best Unlock to see more leads."}
            </p>
            {totalCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all");
                  setCountyFilter("");
                  setSortMode("best_unlock");
                }}
                className="mt-4 px-4 py-2 rounded-md bg-muted border text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
            {sortedOpportunities.map((opp) => (
              <OpportunityCard
                key={opp.opportunity_id}
                opp={opp}
                meta={meta}
                isPreview={isPreview}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </main>
    </>

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

/* ── Credit Decision Card (5 zones) ──────────────────────────────── */

type UnlockState = "released" | "unlocked" | "insufficient" | "unlockable";

function resolveUnlockState(opp: Opportunity, meta: Meta | null): UnlockState {
  if (opp.release_status === "released" || opp.status === "homeowner_contact_released") {
    return "released";
  }
  if (opp.already_unlocked) return "unlocked";

  const cost = getCreditCost(opp);
  const balance =
    typeof opp.credit_balance === "number"
      ? opp.credit_balance
      : typeof meta?.credit_balance === "number"
        ? meta.credit_balance
        : 0;

  if (!opp.can_unlock && balance < cost) return "insufficient";
  return "unlockable";
}

function OpportunityCard({
  opp,
  meta,
  isPreview,
  navigate,
}: {
  opp: Opportunity;
  meta: Meta | null;
  isPreview: boolean;
  navigate: (path: string) => void;
}) {
  const bss = getBuyerSeriousness(opp);
  const propertyBadge = getPropertyBadge(opp);
  const timelineBadge = getTimelineBadge(opp);
  const motivationBadge = getMotivationBadge(opp);
  const handoff = getHandoffSignal(opp);
  const angle = getBestSalesAngle(opp);
  const action = getRecommendedAction(opp);
  const freshness = formatRelativeTime(opp.created_at);
  const unlockIncludes = getUnlockIncludes();
  const creditCostLine = getCreditCostLine(opp, meta);
  // Competition/exclusivity — only when explicit fields exist (anti-fake-scarcity)
  const competition = getCompetitionSignal(opp, isPreview);

  const unlockState = resolveUnlockState(opp, meta);
  const isReportOnly = opp.handoff_consent_status === "report_only";
  const locationLabel = [opp.city, opp.county].filter(Boolean).join(", ") || "Florida";

  const COMPETITION_TONE: Record<CompetitionTone, string> = {
    exclusive: "bg-violet-50 text-violet-700 border-violet-200",
    warm: "bg-emerald-50 text-emerald-700 border-emerald-200",
    competitive: "bg-amber-50 text-amber-800 border-amber-200",
    muted: "bg-muted text-muted-foreground border-border",
  };

  // CTA copy + tone per state (no transactional language unless safely backed)
  const ctaConfig: { label: string; tone: "primary" | "success" | "muted" | "warning" } =
    unlockState === "released"
      ? { label: "View Contact + Call Script", tone: "success" }
      : unlockState === "unlocked"
        ? { label: "Open Sales Brief", tone: "success" }
        : unlockState === "insufficient"
          ? { label: "Add Credits to Unlock", tone: "warning" }
          : { label: "View Unlock Details", tone: "primary" };

  const ctaToneClasses: Record<typeof ctaConfig.tone, string> = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600",
    muted: "bg-muted text-foreground hover:bg-accent border-border",
    warning:
      "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300",
  };

  return (
    <article
      className="bg-card border rounded-xl overflow-hidden flex flex-col hover:border-primary/30 hover:shadow-md transition-all"
      aria-label={`${opp.project_type ?? "Window Project"} in ${locationLabel}`}
    >
      {/* ─── Zone 1: Decision Header ─────────────────────────────── */}
      <header className="p-4 sm:p-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex items-start gap-3">
          <div
            className={`h-11 w-11 shrink-0 rounded-lg border flex items-center justify-center ${gradeBg(opp.grade)}`}
            aria-label={`Quote grade ${opp.grade ?? "unknown"}`}
          >
            <span className={`text-lg font-black ${gradeColor(opp.grade)}`}>
              {opp.grade ?? "—"}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground truncate min-w-0">
                {opp.project_type ?? "Window Project"}
              </h3>
              {statusPill(opp.status)}
            </div>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {bss.label ? (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                  aria-label={`Buyer Seriousness Score ${bss.score}, band ${bss.band}`}
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {bss.label}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border">
                  BSS —
                </span>
              )}
              {unlockState === "released" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Phone className="h-3 w-3" aria-hidden /> Contact Released
                </span>
              ) : unlockState === "unlocked" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Unlock className="h-3 w-3" aria-hidden /> Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted border text-muted-foreground">
                  <Lock className="h-3 w-3" aria-hidden /> Locked
                </span>
              )}
              {competition && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${COMPETITION_TONE[competition.tone]}`}
                  aria-label={`Competition signal: ${competition.label}`}
                >
                  {competition.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Zone 2: Market Facts ────────────────────────────────── */}
      <section
        className="px-4 sm:px-5 py-3 space-y-1.5"
        aria-label="Market facts"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate text-foreground font-medium">{locationLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {opp.window_count != null && (
            <span>
              <span className="text-foreground font-semibold">{opp.window_count}</span> openings
            </span>
          )}
          {opp.quote_range && (
            <span className="text-foreground font-semibold">{opp.quote_range}</span>
          )}
          {opp.flag_count > 0 && (
            <span>
              <span className="text-red-600 font-semibold">{opp.red_flag_count}</span> red ·{" "}
              <span className="text-amber-600 font-semibold">{opp.amber_flag_count}</span> amber
            </span>
          )}
          {opp.has_document && (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <FileText className="h-3 w-3" aria-hidden /> Quote Uploaded
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {freshness && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden /> {freshness}
            </span>
          )}
          {opp.phone_verified_at && (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check className="h-3 w-3" aria-hidden /> Phone Verified
            </span>
          )}
          {opp.report_viewed_at && (
            <span className="inline-flex items-center gap-1 text-sky-700">
              <Eye className="h-3 w-3" aria-hidden /> Report Viewed
            </span>
          )}
        </div>
      </section>

      {/* ─── Zone 3: Human Context ──────────────────────────────── */}
      <section
        className="px-4 sm:px-5 py-3 border-t border-border/60 space-y-2"
        aria-label="Human context"
      >
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Human Context
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border">
            {propertyBadge}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border">
            {timelineBadge}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border">
            {motivationBadge}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${HANDOFF_TONE_CLASSES[handoff.tone]}`}
            aria-label={`Handoff status: ${handoff.label}`}
          >
            {handoff.label}
          </span>
        </div>
        {isReportOnly && (
          <p
            role="note"
            className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5"
          >
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
            <span>Nurture lead — no warm call yet.</span>
          </p>
        )}
      </section>

      {/* ─── Zone 4: Sales Angle ────────────────────────────────── */}
      <section
        className="px-4 sm:px-5 py-3 border-t border-border/60 bg-muted/20"
        aria-label="Sales angle"
      >
        <div className="rounded-md border border-border/80 bg-card p-3 space-y-1.5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Best Sales Angle
            </p>
            <p className="text-xs font-semibold text-foreground mt-0.5">{angle}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Recommended Action
            </p>
            <p
              className={`text-xs mt-0.5 ${
                handoff.isCallReady && !isReportOnly
                  ? "text-foreground font-medium"
                  : "text-muted-foreground italic"
              }`}
            >
              {action}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Zone 5: Unlock Economics ───────────────────────────── */}
      <section
        className="px-4 sm:px-5 py-4 border-t border-border/60 mt-auto space-y-3"
        aria-label="Unlock economics"
      >
        {unlockState === "unlockable" || unlockState === "insufficient" ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
              Unlock Includes
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
              {unlockIncludes.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 text-[11px] text-foreground"
                >
                  <Check className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {unlockState === "unlockable" && (
          <p className="text-[11px] text-muted-foreground">{creditCostLine}</p>
        )}

        {unlockState === "insufficient" && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            <p className="font-semibold">Insufficient credits</p>
            <p className="text-amber-700">Add credits before this Sales Brief can be unlocked.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate(opp.dossier_href)}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${ctaToneClasses[ctaConfig.tone]}`}
          aria-label={`${ctaConfig.label} for ${opp.project_type ?? "this opportunity"} in ${locationLabel}`}
        >
          <span>{ctaConfig.label}</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    </article>
  );
}
