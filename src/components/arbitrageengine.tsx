import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  FileText,
  ScanEye,
  Check,
  Handshake,
  AlertTriangle,
  CircleDollarSign,
  ChevronRight,
  PhoneCall,
  ArrowLeft,
  X,
  Crown,
  UserCheck,
  CheckCircle,
  Key,
  Shield,
  Ruler,
  DollarSign,
  FileSearch,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getUtmData } from "@/lib/useUtmCapture";
import { readLateFbCookies } from "@/lib/attribution/fbCookies";
import { toE164 } from "@/utils/formatPhone";

// ── Mock 5-Pillar Analysis Data ──────────────────────────────────────────────
const MOCK_ANALYSIS = {
  grade: "C+",
  gradeScore: 58,
  pillars: [
    { key: "safety", label: "Safety & Code", score: 62, status: "fail" as const, icon: Shield },
    { key: "install", label: "Install Scope", score: 78, status: "pass" as const, icon: Ruler },
    { key: "price", label: "Price Fairness", score: 45, status: "fail" as const, icon: DollarSign },
    { key: "fine_print", label: "Fine Print", score: 71, status: "pass" as const, icon: FileSearch },
    { key: "warranty", label: "Warranty", score: 55, status: "warn" as const, icon: ShieldCheck },
  ],
  redFlags: [
    "No NOA (Notice of Acceptance) referenced for impact products",
    "Missing DP rating specification on 3 of 8 openings",
    "No permit handling or inspection timeline mentioned",
  ],
  amberFlags: [
    'Warranty terms reference "limited lifetime" without defining coverage scope',
    "No line-item breakdown for labor vs. materials",
  ],
};

const statusColor = (s: "pass" | "fail" | "warn") =>
  s === "pass" ? "text-emerald-400" : s === "fail" ? "text-red-400" : "text-amber-400";
const barColor = (s: "pass" | "fail" | "warn") =>
  s === "pass" ? "bg-emerald-400" : s === "fail" ? "bg-red-400" : "bg-amber-400";
const gradeColor = (g: string) => {
  if (g.startsWith("A")) return "text-emerald-400 border-emerald-400/50 bg-emerald-500/10";
  if (g.startsWith("B")) return "text-cyan-400 border-cyan-400/50 bg-cyan-500/10";
  if (g.startsWith("C")) return "text-amber-400 border-amber-400/50 bg-amber-500/10";
  return "text-red-400 border-red-400/50 bg-red-500/10";
};

// ── Pipeline step data ───────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  {
    id: "upload",
    label: "Quote\nUploaded",
    Icon: FileText,
    borderColor: "border-amber-400",
    iconColor: "text-amber-400",
    shadow: "shadow-[0_0_20px_rgba(251,191,36,0.15)_inset,0_0_20px_rgba(251,191,36,0.2)]",
    barColor: "bg-amber-400",
    barShadow: "shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    percentColor: "text-amber-400",
    percent: 92,
    alwaysVisible: true,
    subtitle: null,
  },
  {
    id: "audit",
    label: "AI Risk\nAudit",
    Icon: ScanEye,
    borderColor: "border-yellow-400",
    iconColor: "text-yellow-400",
    shadow: "shadow-[0_0_20px_rgba(250,204,21,0.15)_inset,0_0_20px_rgba(250,204,21,0.2)]",
    barColor: "bg-yellow-400",
    barShadow: "shadow-[0_0_8px_rgba(250,204,21,0.8)]",
    percentColor: "text-yellow-400",
    percent: 92,
    alwaysVisible: true,
    subtitle: "Missing NOA",
  },
  {
    id: "fair_deal",
    label: "Fair Deal\nFound",
    Icon: Check,
    borderColor: "border-red-500",
    iconColor: "text-red-500",
    shadow: "shadow-[0_0_20px_rgba(239,68,68,0.15)_inset,0_0_20px_rgba(239,68,68,0.2)]",
    barColor: "bg-emerald-400",
    barShadow: "shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    percentColor: "text-emerald-400",
    percent: 78,
    alwaysVisible: false,
    subtitle: null,
    inactiveBorder: "border-red-900/40",
  },
  {
    id: "referral",
    label: "Referral Fee Paid\nby Contractor",
    Icon: Handshake,
    borderColor: "border-emerald-400",
    iconColor: "text-emerald-400",
    shadow: "shadow-[0_0_25px_rgba(52,211,153,0.4)_inset,0_0_35px_rgba(52,211,153,0.6)]",
    barColor: "",
    barShadow: "",
    percentColor: "",
    percent: 0,
    alwaysVisible: false,
    subtitle: null,
    inactiveBorder: "border-emerald-900/40",
    hasMoneyIcon: true,
  },
];

// ── Focus trap hook ──────────────────────────────────────────────────────────
function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || !containerRef.current || e.key !== "Tab") return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [isActive],
  );

  useEffect(() => {
    if (!isActive) return;
    document.addEventListener("keydown", handleKeyDown);
    // Focus first focusable element on open
    const timer = setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      el?.focus();
    }, 100);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isActive, handleKeyDown]);

  return containerRef;
}

export type FunnelStep =
  | "scope"
  | "intent_filter"
  | "status"
  | "comp_a"
  | "comp_b"
  | "contact"
  | "identity"
  | "intent"
  | "call"
  | "timeframe"
  | "done"
  | "secret_capture"
  | "secret_success";

export const FUNNEL_STEPS: FunnelStep[] = [
  "scope",
  "intent_filter",
  "status",
  "comp_a",
  "comp_b",
  "contact",
  "identity",
  "intent",
  "call",
  "timeframe",
  "done",
  "secret_capture",
  "secret_success",
];

type LeadCaptureResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  lead_id?: string;
  session_id?: string;
  reused?: boolean;
};

type LeadCaptureErrorPayload = {
  code?: string;
  message?: string;
};

export type ArbitrageEngineProps = {
  autoOpen?: boolean;
  initialStep?: FunnelStep;
  hideBaseShell?: boolean;
  source?: string;
  onDirectEntryClose?: () => void;
};

export default function ArbitrageEngine({
  autoOpen = false,
  initialStep = "scope",
  hideBaseShell = false,
  source = "unknown",
  onDirectEntryClose,
}: ArbitrageEngineProps) {
  const [flowState, setFlowState] = useState("idle");
  const [hasCompletedFunnel, setHasCompletedFunnel] = useState(false);
  const [isExitIntent, setIsExitIntent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [funnelStep, setFunnelStep] = useState<FunnelStep>("scope");
  const [stepHistory, setStepHistory] = useState<FunnelStep[]>([]);
  const [formData, setFormData] = useState({
    scope: "",
    installerPreference: "",
    hasEstimate: "",
    numEstimates: "",
    dealBreaker: "",
    zip: "",
    phone: "",
    name: "",
    email: "",
    callIntent: "",
    timeframe: "",
    hasConsent: false,
  });

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isRevealed = flowState === "revealed" || flowState === "modal_open";

  // Focus trap for modal
  const modalRef = useFocusTrap(flowState === "modal_open");

  useEffect(() => {
    if (flowState === "revealed" && !hasCompletedFunnel) {
      const timer = setTimeout(() => setFlowState("modal_open"), 2000);
      return () => clearTimeout(timer);
    }
  }, [flowState, hasCompletedFunnel]);

  // Direct-entry auto-open
  useEffect(() => {
    if (!autoOpen) return;
    setFlowState("modal_open");
    setHasCompletedFunnel(false);
    setIsExitIntent(false);
    setFunnelStep(initialStep);
    setStepHistory([]);
    console.info("arbitrage_direct_entry_opened", { source, step: initialStep });
  }, [autoOpen, initialStep, source]);

  // Lock body scroll when modal open (scrollbar-width-aware)
  useEffect(() => {
    if (flowState !== "modal_open") return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [flowState]);

  const handleStartSequence = () => {
    if (flowState === "idle") setFlowState("animating");
  };

  const advance = (nextStep: FunnelStep, field: string | null = null, value: string | null = null) => {
    if (field) setFormData((prev) => ({ ...prev, [field]: value }));
    setStepHistory((prev) => [...prev, funnelStep]);
    setFunnelStep(nextStep);
  };

  const handleBack = () => {
    if (stepHistory.length === 0) return;
    setFunnelStep(stepHistory[stepHistory.length - 1]);
    setStepHistory((prev) => prev.slice(0, -1));
  };

  // ── Lead capture (RLS-safe Edge transport) ─────────────────────────────────
  const handleLeadSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const GENERIC_ERROR = "Something went wrong. Please try again.";
    const USER_SAFE_EDGE_ERRORS: Record<string, string> = {
      invalid_first_name: "Please enter your name.",
      invalid_email: "Please enter a valid email address.",
      invalid_session_id: GENERIC_ERROR,
      invalid_json: GENERIC_ERROR,
      invalid_body: GENERIC_ERROR,
      server_misconfigured: GENERIC_ERROR,
    };

    const looksInternalError = (message: string): boolean => {
      const m = message.toLowerCase();
      return (
        m.includes("pgrst") ||
        m.includes("42501") ||
        m.includes("rls") ||
        m.includes("policy") ||
        m.includes("violates") ||
        m.includes("postgres") ||
        m.includes("stack") ||
        (message.includes("{") && message.includes("}"))
      );
    };

    try {
      const trimmedName = formData.name.trim();
      if (trimmedName.length < 2) {
        setSubmitError("Please enter your name.");
        return;
      }
      if (!isEmailValid) {
        setSubmitError("Please enter a valid email address.");
        return;
      }
      if (formData.zip.length < 5) {
        setSubmitError("Please enter your zip code.");
        return;
      }

      const phoneE164 = toE164(formData.phone);
      if (formData.phone.length < 10 || !phoneE164) {
        setSubmitError("Please enter a valid phone number.");
        return;
      }

      const utm = getUtmData();
      const sessionId = crypto.randomUUID();
      const scopeMap: Record<string, number> = { "1-5": 3, "6-10": 8, "11-15": 13, "15+": 20 };
      const windowCount = scopeMap[formData.scope] ?? null;

      const fb = readLateFbCookies(
        { fbp: utm.fbp, fbc: utm.fbc },
        { surface: "arbitrage_engine", sessionId },
      );

      const queryClientSlug =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("client")
          : null;
      const lsClientSlug =
        typeof window !== "undefined"
          ? localStorage.getItem("wm_client_slug")
          : null;
      const effectiveClientSlug =
        queryClientSlug ?? utm.client_slug ?? lsClientSlug ?? null;

      if (effectiveClientSlug && typeof window !== "undefined") {
        try {
          localStorage.setItem("wm_client_slug", effectiveClientSlug);
        } catch {
          // ignore storage failures
        }
      }

      const landingPageUrl =
        utm.landing_page_url ??
        (typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : null);

      const leadCapturePayload = {
        session_id: sessionId,
        first_name: trimmedName,
        email: formData.email.trim().toLowerCase(),
        phone_e164: phoneE164,
        county: null,
        project_type: null,
        window_count: windowCount,
        quote_range: null,
        source: "arbitrage-engine",
        client_slug: effectiveClientSlug,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        utm_term: utm.utm_term,
        utm_content: utm.utm_content,
        fbclid: utm.fbclid,
        gclid: utm.gclid,
        fbc: fb.fbc,
        fbp: fb.fbp,
        landing_page_url: landingPageUrl,
        first_page_path: utm.landing_page,
        initial_referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
      };

      const { data: captureData, error: captureError } =
        await supabase.functions.invoke<LeadCaptureResponse>(
          "capture-truth-gate-lead",
          { body: leadCapturePayload },
        );

      if (captureError || !captureData?.success) {
        const errBody: LeadCaptureErrorPayload = captureData ?? {};
        const code = errBody.code ?? captureError?.name ?? "lead_capture_failed";
        const message = errBody.message ?? captureError?.message ?? "";

        const display =
          USER_SAFE_EDGE_ERRORS[code] ??
          (message && !looksInternalError(message) ? message : null) ??
          GENERIC_ERROR;

        console.error("[ArbitrageEngine] lead capture failed", {
          code,
          message,
          session_id: sessionId,
          has_phone: !!phoneE164,
          has_client_slug: !!effectiveClientSlug,
          payload_keys: Object.keys(leadCapturePayload),
        });

        setSubmitError(display);
        return;
      }

      advance("intent");
    } catch (err: unknown) {
      console.error("[ArbitrageEngine] lead capture failed", {
        error: err instanceof Error ? err.name : "unknown",
      });
      setSubmitError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeToAboutContent = useCallback(() => {
    setFlowState("idle");
    setHasCompletedFunnel(false);
    setIsExitIntent(false);
    setFunnelStep("scope");
    setStepHistory([]);
    onDirectEntryClose?.();
  }, [onDirectEntryClose]);

  const handleClose = () => {
    const preCompletionStep = funnelStep !== "done" && !["secret_capture", "secret_success"].includes(funnelStep);

    // Direct-entry bridge: close before completion reveals normal About page
    if (autoOpen && !hasCompletedFunnel && preCompletionStep && !isExitIntent) {
      setIsExitIntent(true);
      return;
    }

    if (
      !hasCompletedFunnel &&
      !isExitIntent &&
      funnelStep !== "done" &&
      !["secret_capture", "secret_success"].includes(funnelStep) &&
      !isEmailValid
    ) {
      setIsExitIntent(true);
      return;
    }

    const wasCompleted = funnelStep === "done" || hasCompletedFunnel;
    setHasCompletedFunnel(true);
    setFlowState("revealed");

    setTimeout(() => {
      setFunnelStep("scope");
      setStepHistory([]);
      setIsExitIntent(false);

      if (wasCompleted) {
        toast.success("You're matched! Let's scan your quote.");
        setTimeout(() => {
          const safeUrl = new URL("/#truth-gate", window.location.origin);
          window.location.assign(safeUrl.toString());
        }, 1200);
        return;
      }

      if (autoOpen) {
        closeToAboutContent();
      }
    }, 300);
  };

  const getProgress = () => {
    // Phase 1 display-only progress honesty. Durable save-gated completion deferred to Phase 3.
    switch (funnelStep) {
      case "scope":
        return 12;
      case "intent_filter":
        return 25;
      case "status":
        return 37;
      case "comp_a":
        return 50;
      case "comp_b":
        return 62;
      case "contact":
        return 75;
      case "identity":
        return 88;
      case "intent":
        return 92;
      case "call":
        return 96;
      case "timeframe":
        return 96;
      case "secret_capture":
        return 95;
      case "done":
        return 100;
      case "secret_success":
        return 100;
      default:
        return 0;
    }
  };

  // Done-state copy matrix keyed on scope + installerPreference (display only, no new state).
  const getDoneCopy = (): { heading: string; body: string } => {
    const isPremium = formData.installerPreference === "premium";
    switch (formData.scope) {
      case "1-5":
        return {
          heading: "Quick-Response Project Matched!",
          body: "Perfect for our Quick-Response Team. We've matched you with local specialists who can turn small projects around fast.",
        };
      case "15+":
        return isPremium
          ? {
              heading: "Premium Project Detected!",
              body: "We've prioritised your full-home audit for our Premium Installation Team — elite craftsmanship, white-glove service, and maximum pricing leverage.",
            }
          : {
              heading: "Full-Home Pricing Leverage Detected!",
              body: "Your full-home project has been routed to vetted local pros who will compete to give you their cleanest, fairest price.",
            };
      case "6-10":
      case "11-15":
        return isPremium
          ? {
              heading: "Premium Installer Path Matched!",
              body: "Your scope is confirmed. We've matched you with top-rated premium installers known for reputation and white-glove service.",
            }
          : {
              heading: "Fair-Price Local Pro Path Matched!",
              body: "Project scope confirmed. We've connected you with honest local pros competing to offer their most transparent, fair quote.",
            };
      default:
        return {
          heading: "Audit Complete & Matched!",
          body: "Your audit has been routed to our top-rated local installation partners for immediate review.",
        };
    }
  };

  const formatPhoneDisplay = (val: string) => {
    if (!val) return "";
    const cleaned = ("" + val).replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) return !match[2] ? match[1] : `(${match[1]}) ${match[2]}` + (match[3] ? `-${match[3]}` : "");
    return val;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
  };
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, zip: e.target.value.replace(/\D/g, "").slice(0, 5) });
  };

  const slideVariants = {
    initial: { x: 30, opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
    exit: { x: -30, opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } },
  };

  // Shared input class for 48px min touch target
  const inputClass =
    "w-full bg-slate-950/70 border border-white/10 rounded-xl px-4 min-h-[48px] py-3 text-white text-base focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 placeholder:text-gray-500";

  const OptionCard = ({ text, onClick, ariaLabel }: { text: string; onClick: () => void; ariaLabel?: string }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || text}
      className="w-full bg-slate-800/60 border border-white/10 hover:border-cyan-400/80 hover:bg-cyan-900/20 backdrop-blur-md py-4 px-6 rounded-xl shadow-lg transition-all text-gray-200 hover:text-cyan-50 font-semibold text-base sm:text-lg flex items-center justify-between group active:scale-95 shrink-0 min-h-[48px]"
    >
      <span>{text}</span>
      <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[600px] bg-slate-950 text-white font-sans overflow-hidden relative flex flex-col items-center justify-center py-6 selection:bg-cyan-500/30">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.4); }
      `}</style>

      {!hideBaseShell && (
        <>
          {/* Background Effects */}
          <div
            className="absolute inset-0 z-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
            }}
          />
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

          {/* ── Main Content ──────────────────────────────────────────────────── */}
          <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-6 sm:mb-10 drop-shadow-lg text-center">
              The Arbitrage Engine
            </h1>

            {/* Glassmorphic pipeline card */}
            <div
              className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative"
              role="region"
              aria-label="Transparency Flow pipeline"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />

              <div className="text-center mb-6 sm:mb-12 relative z-10">
                <h2 className="text-slate-400 text-base sm:text-xl font-semibold tracking-widest uppercase mb-1 drop-shadow-sm">
                  Transparency Flow:
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">How It Works</p>
              </div>

              {/* ── Desktop horizontal pipeline (md+) ─────────────────────────── */}
              <div className="hidden md:block w-full overflow-x-auto pb-6 hide-scrollbar relative z-10">
                <div className="relative w-[800px] mx-auto pt-2">
                  {/* Horizontal connecting line */}
                  <div className="absolute top-[64px] left-[64px] right-[64px] h-[3px] z-0 flex rounded-full overflow-hidden">
                    <div className="w-[33.33%] bg-gradient-to-r from-amber-400 to-yellow-400" />
                    <div className="w-[66.66%] flex relative">
                      <div className="absolute inset-0 flex opacity-20">
                        <div className="w-1/2 bg-gradient-to-r from-yellow-400 to-red-500" />
                        <div className="w-1/2 bg-gradient-to-r from-red-500 to-emerald-500" />
                      </div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isRevealed ? 1 : 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 flex"
                      >
                        <div className="w-1/2 bg-gradient-to-r from-yellow-400 to-red-500 shadow-[0_0_8px_red]" />
                        <div className="w-1/2 bg-gradient-to-r from-red-500 to-emerald-500 shadow-[0_0_8px_#10b981]" />
                      </motion.div>
                    </div>
                  </div>

                  {flowState === "animating" && (
                    <svg
                      className="absolute top-0 left-0 w-[800px] h-[128px] pointer-events-none z-30 overflow-visible"
                      aria-hidden="true"
                    >
                      <motion.path
                        d="M 352 64 L 448 64 L 448 12 A 12 12 0 0 1 460 0 L 564 0 A 12 12 0 0 1 576 12 L 576 116 A 12 12 0 0 1 564 128 L 460 128 A 12 12 0 0 1 448 116 L 448 64 L 576 64 L 672 64"
                        fill="transparent"
                        stroke="#06b6d4"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2.5, ease: "easeInOut" }}
                        onAnimationComplete={() => setFlowState("revealed")}
                        style={{ filter: "drop-shadow(0 0 8px #06b6d4)" }}
                      />
                    </svg>
                  )}

                  <div className="relative z-10 flex justify-between items-start w-[800px]">
                    {PIPELINE_STEPS.map((step, idx) => {
                      const active = step.alwaysVisible || isRevealed;
                      const border = active ? step.borderColor : step.inactiveBorder || step.borderColor;
                      const shadow = active ? step.shadow : "shadow-none";
                      return (
                        <div
                          key={step.id}
                          className="flex flex-col items-center w-32"
                          role="listitem"
                          aria-label={`Step ${idx + 1}: ${step.label.replace("\n", " ")}`}
                        >
                          <div
                            className={`w-32 h-32 rounded-xl border-2 ${border} bg-slate-800 ${shadow} flex flex-col items-center justify-center p-4 transition-all duration-500 z-20 relative`}
                          >
                            {step.alwaysVisible ? (
                              <>
                                <step.Icon className={`w-10 h-10 ${step.iconColor} mb-3`} strokeWidth={1.5} />
                                <span className="text-[13px] font-medium leading-tight text-gray-200 text-center whitespace-pre-line">
                                  {step.label}
                                </span>
                              </>
                            ) : (
                              <motion.div
                                className="flex flex-col items-center"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 10 }}
                                transition={{ delay: idx * 0.1, duration: 0.5 }}
                              >
                                {step.hasMoneyIcon ? (
                                  <div className="relative mb-2 mt-1">
                                    <step.Icon className={`w-11 h-11 ${step.iconColor}`} strokeWidth={1.5} />
                                    <div className="absolute -top-3 -right-2 bg-slate-800 rounded-full p-[1px]">
                                      <CircleDollarSign className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                                    </div>
                                  </div>
                                ) : (
                                  <step.Icon className={`w-12 h-12 ${step.iconColor} mb-2`} strokeWidth={2} />
                                )}
                                <span className="text-[13px] font-medium leading-tight text-gray-200 text-center whitespace-pre-line">
                                  {step.label}
                                </span>
                              </motion.div>
                            )}
                          </div>
                          {/* Progress bar below node */}
                          {step.percent > 0 && (
                            <motion.div
                              className="w-full mt-4 flex flex-col gap-1.5 px-1"
                              initial={{ opacity: step.alwaysVisible ? 1 : 0 }}
                              animate={{ opacity: step.alwaysVisible || isRevealed ? 1 : 0 }}
                            >
                              <div className="flex justify-end w-full">
                                <span className={`text-[11px] font-bold ${step.percentColor}`}>{step.percent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${step.barColor} ${step.barShadow}`}
                                  style={{ width: `${step.percent}%` }}
                                />
                              </div>
                              {step.subtitle && (
                                <div className="flex items-center justify-center gap-1 mt-0.5 text-[9px] font-semibold text-red-500/90 whitespace-nowrap uppercase tracking-wider">
                                  <AlertTriangle size={10} strokeWidth={2.5} />
                                  <span>{step.subtitle}</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Mobile vertical pipeline (< md) ───────────────────────────── */}
              <div
                className="md:hidden relative z-10 flex flex-col items-center gap-2"
                role="list"
                aria-label="Transparency Flow steps"
              >
                {/* Vertical connecting line */}
                <div className="absolute left-1/2 -translate-x-[1.5px] top-0 bottom-0 w-[3px] z-0">
                  <div className="h-[25%] bg-gradient-to-b from-amber-400 to-yellow-400" />
                  <div className="h-[75%] relative">
                    <div className="absolute inset-0 opacity-20">
                      <div className="h-1/2 bg-gradient-to-b from-yellow-400 to-red-500" />
                      <div className="h-1/2 bg-gradient-to-b from-red-500 to-emerald-500" />
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isRevealed ? 1 : 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0"
                    >
                      <div className="h-1/2 bg-gradient-to-b from-yellow-400 to-red-500 shadow-[0_0_8px_red]" />
                      <div className="h-1/2 bg-gradient-to-b from-red-500 to-emerald-500 shadow-[0_0_8px_#10b981]" />
                    </motion.div>
                  </div>
                </div>

                {/* Mobile animation on reveal */}
                {flowState === "animating" && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-[1.5px] top-0 w-[3px] bg-cyan-400 z-30 rounded-full"
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                    onAnimationComplete={() => setFlowState("revealed")}
                    style={{ filter: "drop-shadow(0 0 8px #06b6d4)" }}
                  />
                )}

                {PIPELINE_STEPS.map((step, idx) => {
                  const active = step.alwaysVisible || isRevealed;
                  const border = active ? step.borderColor : step.inactiveBorder || step.borderColor;
                  const shadow = active ? step.shadow : "shadow-none";
                  return (
                    <div
                      key={step.id}
                      className="relative z-10 flex flex-col items-center py-3"
                      role="listitem"
                      aria-label={`Step ${idx + 1}: ${step.label.replace("\n", " ")}`}
                    >
                      <div
                        className={`w-24 h-24 rounded-xl border-2 ${border} bg-slate-800 ${shadow} flex flex-col items-center justify-center p-3 transition-all duration-500`}
                      >
                        {step.alwaysVisible ? (
                          <>
                            <step.Icon className={`w-8 h-8 ${step.iconColor} mb-2`} strokeWidth={1.5} />
                            <span className="text-[11px] font-medium leading-tight text-gray-200 text-center whitespace-pre-line">
                              {step.label}
                            </span>
                          </>
                        ) : (
                          <motion.div
                            className="flex flex-col items-center"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 8 }}
                            transition={{ delay: idx * 0.1, duration: 0.5 }}
                          >
                            {step.hasMoneyIcon ? (
                              <div className="relative mb-1">
                                <step.Icon className={`w-8 h-8 ${step.iconColor}`} strokeWidth={1.5} />
                                <div className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-[1px]">
                                  <CircleDollarSign className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                                </div>
                              </div>
                            ) : (
                              <step.Icon className={`w-9 h-9 ${step.iconColor} mb-1`} strokeWidth={2} />
                            )}
                            <span className="text-[11px] font-medium leading-tight text-gray-200 text-center whitespace-pre-line">
                              {step.label}
                            </span>
                          </motion.div>
                        )}
                      </div>
                      {/* Mobile progress bar */}
                      {step.percent > 0 && (
                        <motion.div
                          className="w-24 mt-2 flex flex-col gap-1 px-1"
                          initial={{ opacity: step.alwaysVisible ? 1 : 0 }}
                          animate={{ opacity: step.alwaysVisible || isRevealed ? 1 : 0 }}
                        >
                          <div className="flex justify-end w-full">
                            <span className={`text-[10px] font-bold ${step.percentColor}`}>{step.percent}%</span>
                          </div>
                          <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${step.barColor} ${step.barShadow}`}
                              style={{ width: `${step.percent}%` }}
                            />
                          </div>
                          {step.subtitle && (
                            <div className="flex items-center justify-center gap-1 mt-0.5 text-[8px] font-semibold text-red-500/90 whitespace-nowrap uppercase tracking-wider">
                              <AlertTriangle size={8} strokeWidth={2.5} />
                              <span>{step.subtitle}</span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA + Market Maker + Analysis Reveal */}
            <div
              id="audit-results"
              className="mt-10 sm:mt-16 text-center max-w-3xl px-2 sm:px-4 flex flex-col items-center relative z-20 pb-10 sm:pb-16"
            >
              <button
                onClick={handleStartSequence}
                disabled={flowState !== "idle"}
                aria-label={flowState === "idle" ? "Start the estimate analysis" : "Analysis in progress"}
                className={`mb-8 sm:mb-10 px-6 sm:px-8 py-4 rounded-full font-bold text-base sm:text-lg transition-all duration-300 transform active:scale-95 min-h-[48px]
              ${
                flowState === "idle"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] cursor-pointer hover:-translate-y-1"
                  : "bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed opacity-50 shadow-none"
              }`}
              >
                {flowState === "animating"
                  ? "Analyzing Flow..."
                  : flowState === "idle"
                    ? "Click For a Better Estimate"
                    : "Estimate Unlocked"}
              </button>

              <h2 className="text-xl sm:text-2xl md:text-[28px] font-semibold text-white mb-4 tracking-wide drop-shadow-md">
                The Market Maker Model
              </h2>
              <p className="text-slate-400 text-base sm:text-lg leading-relaxed font-semibold font-body">
                The First Contractor Paid For The Discovery, Measurements, and Price Anchoring. WindowMan Captures The
                Deal Downstream. Our Partners Walk Into The Home Knowing Exactly What to Overcome.
              </p>

              {/* ── Mock 5-Pillar Analysis Reveal ──────────────────────────────── */}
              {hasCompletedFunnel && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full mt-8 sm:mt-12"
                  role="region"
                  aria-label="Sample Truth Report Results"
                >
                  <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative text-left">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />

                    {/* Grade Badge */}
                    <div className="relative z-10 flex flex-col items-center mb-6 sm:mb-8">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                        Simplified Sample Truth Report™
                      </span>
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 flex items-center justify-center text-2xl sm:text-3xl font-black ${gradeColor(MOCK_ANALYSIS.grade)}`}
                        aria-label={`Grade: ${MOCK_ANALYSIS.grade}`}
                      >
                        {MOCK_ANALYSIS.grade}
                      </div>
                      <span className="text-slate-400 text-sm mt-2">Overall Score: {MOCK_ANALYSIS.gradeScore}/100</span>
                    </div>

                    {/* 5 Pillar Bars */}
                    <div className="relative z-10 space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                      {MOCK_ANALYSIS.pillars.map((p) => (
                        <div
                          key={p.key}
                          role="meter"
                          aria-label={`${p.label}: ${p.score} out of 100`}
                          aria-valuenow={p.score}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          {/* Mobile: stacked layout */}
                          <div className="flex items-center justify-between mb-1 sm:hidden">
                            <div className="flex items-center gap-2">
                              <p.icon className={`w-4 h-4 shrink-0 ${statusColor(p.status)}`} strokeWidth={1.5} />
                              <span className="text-xs text-gray-300 text-left">{p.label}</span>
                            </div>
                            <span className={`text-xs font-bold ${statusColor(p.status)}`}>{p.score}</span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden sm:hidden">
                            <div
                              className={`h-full rounded-full ${barColor(p.status)}`}
                              style={{ width: `${p.score}%` }}
                            />
                          </div>
                          {/* sm+: inline row */}
                          <div className="hidden sm:flex items-center gap-3">
                            <p.icon className={`w-5 h-5 shrink-0 ${statusColor(p.status)}`} strokeWidth={1.5} />
                            <span className="text-sm text-gray-300 w-28 shrink-0 text-left">{p.label}</span>
                            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor(p.status)}`}
                                style={{ width: `${p.score}%` }}
                              />
                            </div>
                            <span className={`text-sm font-bold w-10 text-right ${statusColor(p.status)}`}>
                              {p.score}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Red Flags */}
                    <div className="relative z-10 mb-5 sm:mb-6">
                      <h3 className="text-xs sm:text-sm font-bold text-red-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2 text-left">
                        <AlertTriangle className="w-4 h-4" /> Red Flags ({MOCK_ANALYSIS.redFlags.length})
                      </h3>
                      <ul className="space-y-2" role="list">
                        {MOCK_ANALYSIS.redFlags.map((f, i) => (
                          <li
                            key={i}
                            className="text-xs sm:text-sm text-gray-300 pl-5 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-red-500/80 text-left"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Amber Flags */}
                    <div className="relative z-10 mb-6 sm:mb-8">
                      <h3 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-2 text-left">
                        <AlertTriangle className="w-4 h-4" /> Warnings ({MOCK_ANALYSIS.amberFlags.length})
                      </h3>
                      <ul className="space-y-2" role="list">
                        {MOCK_ANALYSIS.amberFlags.map((f, i) => (
                          <li
                            key={i}
                            className="text-xs sm:text-sm text-gray-300 pl-5 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:rounded-full before:bg-amber-500/80 text-left"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    <div className="relative z-10">
                      <button
                        onClick={() => {
                          const safeUrl = new URL("/#truth-gate", window.location.origin);
                          window.location.assign(safeUrl.toString());
                        }}
                        aria-label="Upload your real quote for a full audit"
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[48px]"
                      >
                        <Upload className="w-5 h-5" />
                        Upload Your Real Quote
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Breadcrumb Lead Funnel Modal ───────────────────────────────────── */}
      {flowState === "modal_open" && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quote audit qualification"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-slate-900/95 border border-white/10 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden flex flex-col min-h-[380px] sm:min-h-[420px] max-h-[90vh] sm:max-h-[85vh]"
          >
            {/* Back button */}
            {!isExitIntent &&
              stepHistory.length > 0 &&
              !["done", "secret_capture", "secret_success"].includes(funnelStep) && (
                <button
                  onClick={handleBack}
                  aria-label="Go back to previous step"
                  className="absolute top-4 left-4 z-[110] p-2 text-gray-400 hover:text-white hover:scale-110 transition-all cursor-pointer bg-black/20 hover:bg-black/40 rounded-full active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 drop-shadow-md" />
                </button>
              )}
            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Close qualification modal"
              className="absolute top-4 right-4 z-[110] p-2 text-gray-400 hover:text-white hover:scale-110 transition-all cursor-pointer bg-black/20 hover:bg-black/40 rounded-full active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5 drop-shadow-md" />
            </button>

            {/* Progress Bar */}
            {!isExitIntent && !["secret_capture", "secret_success"].includes(funnelStep) && (
              <div
                className="w-full h-1.5 bg-gray-800 absolute top-0 left-0 right-0 z-10 shrink-0"
                role="progressbar"
                aria-valuenow={getProgress()}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Funnel progress"
              >
                <div
                  className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] transition-all duration-500 ease-out"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            )}

            {/* Dynamic Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden mt-1.5">
              <AnimatePresence mode="wait">
                {/* EXIT INTENT */}
                {isExitIntent && (
                  <motion.div
                    key="exit_intent"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar justify-center"
                  >
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-center text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.3)] shrink-0">
                      Before You Go...
                    </h2>
                    <p className="text-lg sm:text-xl text-white font-medium text-center mb-6 sm:mb-8 leading-relaxed shrink-0 px-2">
                      Can I Let You In On a Little <span className="text-amber-300 italic">Secret</span> on How We Get
                      You The Absolute Lowest Priced Install?
                    </p>
                    <div className="flex flex-col gap-4 pb-4">
                      <button
                        onClick={() => {
                          setIsExitIntent(false);
                          if (isEmailValid) {
                            advance("secret_success");
                          } else {
                            advance("secret_capture");
                          }
                        }}
                        aria-label="Yes, tell me the secret pricing strategy"
                        className="w-full bg-slate-800/60 border border-amber-500/50 hover:border-amber-400/80 hover:bg-amber-900/20 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-[0_0_15px_rgba(251,191,36,0.15)] transition-all text-left flex items-center gap-4 group active:scale-95 shrink-0 min-h-[48px]"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:bg-amber-500/30 transition-all">
                          <Key className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                        </div>
                        <span className="text-amber-100 group-hover:text-amber-50 font-bold text-base sm:text-lg flex-1">
                          Yes, Tell Me The Secret.
                        </span>
                        <ChevronRight className="w-5 h-5 text-amber-500/50 group-hover:text-amber-400 transition-colors shrink-0 ml-1" />
                      </button>
                      <button
                        onClick={() => {
                          if (autoOpen) {
                            closeToAboutContent();
                            return;
                          }
                          setFlowState("revealed");
                          setHasCompletedFunnel(true);
                          setTimeout(() => {
                            setFunnelStep("scope");
                            setStepHistory([]);
                            setIsExitIntent(false);
                          }, 300);
                        }}
                        aria-label="No thanks, close modal"
                        className="w-full bg-transparent border border-white/5 hover:bg-white/5 backdrop-blur-md p-4 rounded-xl transition-all text-center group active:scale-95 shrink-0 min-h-[48px]"
                      >
                        <span className="text-gray-500 group-hover:text-gray-400 font-medium text-sm">
                          No thanks, I'll pay retail.
                        </span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* SECRET EMAIL CAPTURE */}
                {!isExitIntent && funnelStep === "secret_capture" && (
                  <motion.div
                    key="secret_capture"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar justify-center"
                  >
                    <h2 className="text-2xl sm:text-[28px] font-extrabold mb-4 text-center bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent shrink-0 leading-tight">
                      The 'Market For Lemons' Tactic
                    </h2>
                    <p className="text-gray-300 text-sm sm:text-[15px] leading-relaxed mb-6 text-center shrink-0">
                      Enter Your Email Below and I'll Show You Our Tactic to Force Contractors To Start With Their Very
                      Best Offers.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        advance("secret_success");
                      }}
                      className="flex flex-col gap-4 w-full"
                    >
                      <div className="flex flex-col gap-1">
                        <input
                          required
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="Where should we send our secret strategy?"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          aria-label="Email address"
                          aria-invalid={formData.email && !isEmailValid ? "true" : undefined}
                          className={`${inputClass} ${formData.email && !isEmailValid ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50" : "focus:border-amber-500/50 focus:ring-amber-500/50"}`}
                        />
                        {formData.email && !isEmailValid && (
                          <span className="text-red-400 text-xs ml-1 font-medium" role="alert">
                            Please enter a valid email address.
                          </span>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!isEmailValid}
                        className="w-full mt-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                      >
                        Send Me Our Strategy
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* SECRET SUCCESS */}
                {!isExitIntent && funnelStep === "secret_success" && (
                  <motion.div
                    key="secret_success"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col items-center justify-center h-full w-full absolute inset-0 p-6 sm:p-8 text-center overflow-y-auto custom-scrollbar"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center mb-6 shrink-0 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                      <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    </div>
                    <h2 className="text-xl sm:text-[26px] font-extrabold mb-4 shrink-0 drop-shadow-sm leading-tight">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
                        The Law of{" "}
                      </span>
                      🍋
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
                        s En Route!
                      </span>
                    </h2>
                    <p className="text-gray-300 text-sm sm:text-[15px] leading-relaxed mb-6 sm:mb-8 shrink-0 px-2">
                      Click Below For a Quick Peek at Your Audit Findings and Be Sure To Bookmark This Page For Later.
                    </p>
                    <button
                      onClick={() => {
                        setHasCompletedFunnel(true);
                        setFlowState("revealed");
                        setTimeout(() => {
                          document
                            .getElementById("audit-results")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          setFunnelStep("scope");
                          setStepHistory([]);
                        }, 300);
                      }}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95 shrink-0 min-h-[48px]"
                    >
                      ✨ Click for a Quick Peek
                    </button>
                  </motion.div>
                )}

                {/* Step 1: Scope */}
                {!isExitIntent && funnelStep === "scope" && (
                  <motion.div
                    key="scope"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      How Many Windows or Doors are we Considering?
                    </h2>
                    <div className="flex flex-col gap-3 pb-4">
                      {["1-5", "6-10", "11-15", "15+"].map((opt) => (
                        <OptionCard
                          key={opt}
                          text={opt}
                          onClick={() => advance("intent_filter", "scope", opt)}
                          ariaLabel={`${opt} windows or doors`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Intent Filter */}
                {!isExitIntent && funnelStep === "intent_filter" && (
                  <motion.div
                    key="intent_filter"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      Whats Your Primary Goal?
                    </h2>
                    <div className="flex flex-col gap-4 pb-4">
                      <button
                        type="button"
                        onClick={() => advance("status", "installerPreference", "premium")}
                        aria-label="I want a premium, high-end installer"
                        className="w-full bg-slate-800/60 border border-white/10 hover:border-cyan-400/80 hover:bg-cyan-900/20 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-lg transition-all text-left flex items-center gap-3 sm:gap-4 group active:scale-95 shrink-0 min-h-[48px]"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-950/50 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-cyan-500/50 transition-all">
                          <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-200 group-hover:text-cyan-50 font-bold text-[15px] sm:text-[17px] leading-tight">
                            Premium, High-End Installer
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400 group-hover:text-cyan-100/70 mt-1 leading-snug">
                            Brand Reputation and White-Glove Service.
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => advance("status", "installerPreference", "value")}
                        aria-label="I want a quality, honest local pro"
                        className="w-full bg-slate-800/60 border border-white/10 hover:border-cyan-400/80 hover:bg-cyan-900/20 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-lg transition-all text-left flex items-center gap-3 sm:gap-4 group active:scale-95 shrink-0 min-h-[48px]"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-950/50 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-cyan-500/50 transition-all">
                          <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-200 group-hover:text-cyan-50 font-bold text-[15px] sm:text-[17px] leading-tight">
                            Quality, Honest Local Pro
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400 group-hover:text-cyan-100/70 mt-1 leading-snug">
                            Reliability and Best Fair Price.
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Status */}
                {!isExitIntent && funnelStep === "status" && (
                  <motion.div
                    key="status"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      Have You Received a Professional Estimate Yet?
                    </h2>
                    <div className="flex flex-col gap-3 mt-4 pb-4">
                      <OptionCard
                        text="Yes, I Have a Quote"
                        onClick={() => advance("comp_a", "hasEstimate", "Yes")}
                      />
                      <OptionCard
                        text="No, I'm Just Starting"
                        onClick={() => advance("contact", "hasEstimate", "No")}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Step 3A */}
                {!isExitIntent && funnelStep === "comp_a" && (
                  <motion.div
                    key="comp_a"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      How Many Estimates Have You Seen?
                    </h2>
                    <div className="flex flex-col gap-3 mt-4 pb-4">
                      <OptionCard text="Just 1" onClick={() => advance("comp_b", "numEstimates", "1")} />
                      <OptionCard text="2 or more" onClick={() => advance("comp_b", "numEstimates", "2+")} />
                    </div>
                  </motion.div>
                )}

                {/* Step 3B */}
                {!isExitIntent && funnelStep === "comp_b" && (
                  <motion.div
                    key="comp_b"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      What Was The Biggest Deal-Breaker?
                    </h2>
                    <div className="flex flex-col gap-2.5 pb-4">
                      {["Price", "Company Reputation", "Timing", "Financing", "Other"].map((opt) => (
                        <OptionCard key={opt} text={opt} onClick={() => advance("contact", "dealBreaker", opt)} />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Contact Gate */}
                {!isExitIntent && funnelStep === "contact" && (
                  <motion.div
                    key="contact"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center text-white shrink-0">
                      Almost There!
                    </h2>
                    <p className="text-cyan-400 text-sm font-semibold text-center mb-6 shrink-0">
                      We Found 3 Potential Savings In Your Area.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        advance("identity");
                      }}
                      className="flex flex-col gap-4 pb-4"
                    >
                      <input
                        required
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        placeholder="Zip Code"
                        value={formData.zip}
                        onChange={handleZipChange}
                        aria-label="Zip code"
                        autoComplete="postal-code"
                        className={inputClass}
                      />
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        maxLength={14}
                        placeholder="(555) 555-5555"
                        value={formatPhoneDisplay(formData.phone)}
                        onChange={handlePhoneChange}
                        aria-label="Phone number"
                        autoComplete="tel"
                        className={inputClass}
                      />

                      <div className="flex items-start gap-3 mt-1 px-1">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={formData.hasConsent}
                          aria-label="Consent to receive automated texts and calls"
                          onClick={() => setFormData({ ...formData, hasConsent: !formData.hasConsent })}
                          className={`mt-0.5 w-5 h-5 sm:w-4 sm:h-4 rounded flex items-center justify-center border transition-all shrink-0 active:scale-90 ${formData.hasConsent ? "bg-cyan-500 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-slate-950/70 border-white/20"}`}
                        >
                          {formData.hasConsent && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>
                        <label
                          onClick={() => setFormData({ ...formData, hasConsent: !formData.hasConsent })}
                          className="text-xs text-gray-400 leading-tight cursor-pointer select-none"
                        >
                          I agree to receive automated texts/calls for my quote audit. Consent is not a condition of
                          purchase.
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={!formData.hasConsent || formData.zip.length < 5 || formData.phone.length < 10}
                        className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                      >
                        Continue to Save My Audit
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Step 5: Identity (Supabase insert) */}
                {!isExitIntent && funnelStep === "identity" && (
                  <motion.div
                    key="identity"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-center bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-sm shrink-0">
                      You Got it
                    </h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await handleLeadSubmit();
                      }}
                      className="flex flex-col gap-4 pb-4"
                    >
                      <input
                        required
                        type="text"
                        placeholder="What's your name?"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        aria-label="Your name"
                        autoComplete="given-name"
                        className={inputClass}
                      />
                      <div className="flex flex-col gap-1">
                        <input
                          required
                          type="email"
                          inputMode="email"
                          placeholder="What's your best email?"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          aria-label="Email address"
                          autoComplete="email"
                          aria-invalid={formData.email && !isEmailValid ? "true" : undefined}
                          aria-describedby={formData.email && !isEmailValid ? "email-error" : undefined}
                          className={`${inputClass} ${formData.email && !isEmailValid ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50" : "focus:border-cyan-500/50 focus:ring-cyan-500/50"}`}
                        />
                        {formData.email && !isEmailValid && (
                          <span id="email-error" className="text-red-400 text-xs ml-1 font-medium" role="alert">
                            Please enter a valid email address.
                          </span>
                        )}
                      </div>
                      {/* Error announcement for screen readers */}
                      <div aria-live="polite" aria-atomic="true">
                        {submitError && (
                          <p className="text-red-400 text-sm text-center font-medium" role="alert">
                            {submitError}
                          </p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!formData.name || !isEmailValid || isSubmitting}
                        className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                      >
                        {isSubmitting ? "Saving…" : "Save My Audit Access"}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* Step 6: Call Intent */}
                {!isExitIntent && funnelStep === "intent" && (
                  <motion.div
                    key="intent"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white leading-snug shrink-0">
                      Would You Like a Quick Call to Review These Results?
                    </h2>
                    <div className="flex flex-col gap-3 mt-2 pb-4">
                      <OptionCard
                        text="Yes, I Want Expert Advice"
                        onClick={() => advance("call", "callIntent", "Yes")}
                      />
                      <OptionCard
                        text="No, just email me for now"
                        onClick={() => advance("timeframe", "callIntent", "No")}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Path A: Call */}
                {!isExitIntent && funnelStep === "call" && (
                  <motion.div
                    key="call"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col items-center justify-center h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 shrink-0">
                      <PhoneCall className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-pulse" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold mb-8 text-center text-white shrink-0">
                      Your Specialist Is Ready!
                    </h2>
                    <a
                      href="tel:18005550199"
                      aria-label="Tap to call a specialist now"
                      className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-xl sm:text-2xl py-5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shrink-0 min-h-[48px]"
                    >
                      Tap to Call Now
                    </a>
                  </motion.div>
                )}

                {/* Path B: Timeframe */}
                {!isExitIntent && funnelStep === "timeframe" && (
                  <motion.div
                    key="timeframe"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col h-full w-full absolute inset-0 p-6 sm:p-8 overflow-y-auto custom-scrollbar"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center text-white shrink-0">
                      What's Your Timeframe For This Project?
                    </h2>
                    <div className="flex flex-col gap-3 pb-4">
                      {["1 Month", "2-3 Months", "Just Researching"].map((opt) => (
                        <OptionCard
                          key={opt}
                          text={opt}
                          onClick={() => {
                            advance("done", "timeframe", opt);
                            setHasCompletedFunnel(true);
                            setTimeout(handleClose, 3500);
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Done */}
                {!isExitIntent && funnelStep === "done" && (
                  <motion.div
                    key="done"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col items-center justify-center h-full w-full absolute inset-0 p-6 sm:p-8 text-center overflow-y-auto custom-scrollbar"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center mb-6 shrink-0 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-green-500 mb-4 shrink-0 drop-shadow-sm">
                      {getDoneCopy().heading}
                    </h2>
                    <p className="text-gray-300 text-sm sm:text-base leading-relaxed shrink-0 px-2">
                      {getDoneCopy().body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
