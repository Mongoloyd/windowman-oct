import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isValidEmail, isValidName } from "@/utils/formatPhone";
import { Check, Shield } from "lucide-react";
import { useTickerStats } from "@/hooks/useTickerStats";
import { supabase } from "@/integrations/supabase/client";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { captureUtmFromUrl } from "@/lib/useUtmCapture";
import { readLateFbCookies } from "@/lib/attribution/fbCookies";

// ═══════════════════════════════════════════════════════════════════════════
// STEP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const stepConfig = [
  {
    question: "How many windows are in your project?",
    sub: "To Calibrate The Market Comparison.",
    key: "windowCount",
    options: ["1–5 windows", "6–10 windows", "11–20 windows", "20+ windows"],
  },
  {
    question: "What type of project is this?",
    sub: "This helps the AI focus on the right benchmarks for your scope.",
    key: "projectType",
    options: ["Full Home Replacement", "Partial Replacement", "New Construction", "Single Room "],
  },
  {
    question: "Which Florida county is the project in?",
    sub: "We have pricing benchmarks for every major Florida county.",
    key: "county",
    options: ["Miami-Dade", "Broward", "Palm Beach", "Other Florida county"],
  },
  {
    question: "What's your approximate quote total?",
    sub: "This is how we calculate your dollar overage against fair market.",
    key: "quoteRange",
    options: ["Under $10,000", "$10,000–$20,000", "$20,000–$35,000", "$35,000+"],
  },
];

const eyebrowLabels = [
  "STEP 1 OF 4 · CONFIGURE YOUR SCAN",
  "STEP 2 OF 4 · CONFIGURE YOUR SCAN",
  "STEP 3 OF 4 · CONFIGURE YOUR SCAN",
  "STEP 4 OF 4 · CONFIGURE YOUR SCAN",
  "STEP 4 OF 4 · SCAN CONFIGURED",
];

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Answers = {
  windowCount: string;
  projectType: string;
  county: string;
  quoteRange: string;
  firstName: string;
  email: string;
  phone: string;
};

type TransitionState = "idle" | "loading" | "estimate" | "done";
type SubmitState = "idle" | "submitting" | "success" | "error";
type FieldStatus = "untouched" | "valid" | "invalid";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

const parseWindowCount = (val: string): number | null => {
  if (val.includes("1–5")) return 5;
  if (val.includes("6–10")) return 10;
  if (val.includes("11–20")) return 20;
  if (val.includes("20+")) return 25;
  return null;
};

/**
 * Validate a US phone number entered by the user.
 * Returns true if empty (field is optional) or if the input looks like a real 10-digit US number.
 * Blocks junk like all-repeating digits, sequential fakes, and invalid area codes.
 */
const isValidPhone = (val: string): boolean => {
  if (!val || val.trim() === "") return true; // empty is fine — field is optional
  const digits = val.replace(/\D/g, "");

  // Strip leading country code if user typed +1 or 1
  const normalized = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;

  // Must be exactly 10 digits
  if (normalized.length !== 10) return false;

  // US area codes cannot start with 0 or 1
  if (normalized[0] === "0" || normalized[0] === "1") return false;

  // Reject all-repeating digits (2222222222, 5555555555, etc.)
  if (/^(\d)\1{9}$/.test(normalized)) return false;

  // Reject common fake sequential numbers
  if (normalized === "1234567890" || normalized === "0987654321") return false;

  return true;
};

/**
 * Normalize a user-entered phone string to E.164 format (+1XXXXXXXXXX).
 * Returns null if the input is empty or invalid.
 * Mirrors the server-side normalizePhone.ts logic in the edge functions.
 */
const normalizePhoneToE164 = (val: string): string | null => {
  if (!val || val.trim() === "") return null;
  const digits = val.replace(/\D/g, "");

  // 10-digit US number → +1XXXXXXXXXX
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;

  // 11-digit starting with 1 → +1XXXXXXXXXX
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;

  // Anything else is invalid
  return null;
};

/**
 * Format a phone string for display as (XXX) XXX-XXXX while the user types.
 * Only formats when we have enough digits; otherwise returns the raw input.
 */
const formatPhoneDisplay = (val: string): string => {
  const digits = val.replace(/\D/g, "");
  // Strip leading 1 for display
  const local = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;

  if (local.length === 0) return "";
  if (local.length <= 3) return `(${local}`;
  if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/** Split a label like "1–5 windows" into { number: "1–5", unit: "windows" } */
const splitLabel = (label: string): { number: string; unit: string } | null => {
  const match = label.match(/^([0-9+–\-]+)\s+(.+)$/);
  if (!match) return null;
  return { number: match[1], unit: match[2] };
};

const OptionButton = ({
  label,
  selected,
  onClick,
  tile,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tile?: boolean;
}) => {
  const parts = tile ? splitLabel(label) : null;

  return (
    <button
      onClick={onClick}
      className={`flex border transition-all group hover:-translate-y-px ${
        tile
          ? "flex-col items-center justify-center text-center p-5 min-h-[88px]"
          : "items-center justify-between p-4 text-left"
      } ${
        selected
          ? "border-primary bg-primary/10 text-primary scale-[1.02]"
          : "border-border bg-card hover:border-primary/50 text-foreground"
      }`}
      style={{
        borderRadius: "var(--radius-btn)",
        boxShadow: selected ? "var(--shadow-pressed)" : "var(--shadow-resting)",
      }}
    >
      {parts ? (
        <>
          <span className="font-heading text-2xl font-bold leading-none">{parts.number}</span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">{parts.unit}</span>
        </>
      ) : (
        <>
          <span className="font-body text-wm-body-soft font-semibold text-[1.05rem]">{label}</span>
          <span
            className={`text-base transition-colors ${selected ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}
          >
            →
          </span>
        </>
      )}
    </button>
  );
};

const Spinner = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" className="animate-spin" style={{ color: "#2563EB" }}>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
    <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const ValidationIcon = ({ valid }: { valid: boolean }) => (
  <span
    className={`absolute right-3 top-1/2 -translate-y-1/2 text-base leading-none ${valid ? "text-primary" : "text-orange-500"}`}
  >
    {valid ? "✓" : "✗"}
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TruthGateFlow = ({
  onLeadCaptured,
  onStepChange,
  highlight,
  onHighlightDone,
}: {
  onLeadCaptured?: (sessionId: string) => void;
  onStepChange?: (step: number, county: string) => void;
  highlight?: boolean;
  onHighlightDone?: () => void;
}) => {
  const [glowing, setGlowing] = useState(false);
  const { total, today: tickerToday } = useTickerStats();

  // Ref to track whether the component is still mounted (for timeout safety)
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (highlight) {
      setGlowing(true);
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setGlowing(false);
          onHighlightDone?.();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlight, onHighlightDone]);

  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({
    windowCount: "",
    projectType: "",
    county: "",
    quoteRange: "",
    firstName: "",
    email: "",
    phone: "",
  });
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [transitionState, setTransitionState] = useState<TransitionState>("idle");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<{ code?: string; message?: string } | null>(null);
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({
    firstName: "untouched",
    email: "untouched",
    phone: "untouched",
  });
  const funnel = useScanFunnelSafe();

  const selectedCounty = answers.county || "your county";
  const selectedRange = answers.quoteRange || "your";

  // ── Option selection (quiz steps 1-4) ───────────────────────────────
  const handleOptionClick = useCallback(
    (key: string, value: string) => {
      setSelectedOption(value);
      const newAnswers = { ...answers, [key]: value };
      setAnswers((prev) => ({ ...prev, [key]: value }));

      if (currentStep < 4) {
        setTimeout(() => {
          if (!mountedRef.current) return;
          setSelectedOption("");
          setCurrentStep((s) => {
            const next = s + 1;
            onStepChange?.(next - 1, newAnswers.county || "your county");
            return next;
          });
        }, 300);
      } else {
        setTimeout(() => {
          if (!mountedRef.current) return;
          setTransitionState("loading");
          setTimeout(() => {
            if (!mountedRef.current) return;
            setTransitionState("estimate");
            setTimeout(() => {
              if (!mountedRef.current) return;
              setTransitionState("done");
              setCurrentStep(5);
            }, 1500);
          }, 500);
        }, 400);
      }
    },
    [currentStep, answers, onStepChange],
  );

  // ── Field validation ────────────────────────────────────────────────
  const validateField = useCallback((field: string, value: string): FieldStatus => {
    switch (field) {
      case "firstName":
        return isValidName(value) ? "valid" : "invalid";
      case "email":
        return isValidEmail(value) ? "valid" : "invalid";
      case "phone":
        if (!value || value.trim() === "") return "untouched";
        return isValidPhone(value) ? "valid" : "invalid";
      default:
        return "untouched";
    }
  }, []);

  const handleFieldBlur = useCallback(
    (field: string, value: string) => {
      if (value.trim().length > 0) {
        setFieldStatus((prev) => ({ ...prev, [field]: validateField(field, value) }));
      }
    },
    [validateField],
  );

  // ── Phone input handler with auto-formatting ────────────────────────
  const handlePhoneChange = useCallback((rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d\s()\-+]/g, "");
    const formatted = formatPhoneDisplay(cleaned);
    setAnswers((prev) => ({ ...prev, phone: formatted }));

    setFieldStatus((prev) => {
      if (prev.phone === "invalid") return { ...prev, phone: "untouched" };
      return prev;
    });
  }, []);

  // ── Form submission ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameValid = isValidName(answers.firstName);
    const emailValid = isValidEmail(answers.email);
    const phoneValid = isValidPhone(answers.phone);

    setFieldStatus({
      firstName: nameValid ? "valid" : "invalid",
      email: emailValid ? "valid" : "invalid",
      phone: answers.phone.trim() === "" ? "untouched" : phoneValid ? "valid" : "invalid",
    });

    if (!nameValid || !emailValid || !phoneValid) return;

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const sessionId = crypto.randomUUID();

      // Normalize phone to E.164 before DB insert
      const phoneE164 = normalizePhoneToE164(answers.phone);

      // Capture attribution fresh from current URL
      const utm = captureUtmFromUrl();

      // Late re-read of `_fbp` / `_fbc` cookies right before insert.
      // The Pixel may have seeded them AFTER `captureUtmFromUrl()` ran
      // (script loaded late, consent granted mid-funnel). Only validated
      // values are written — malformed cookies log one diagnostic and
      // resolve to null, never garbage. Never blocks submission.
      const fb = readLateFbCookies(
        { fbp: utm.fbp, fbc: utm.fbc },
        { surface: "truth_gate_flow", sessionId },
      );

      // Slug resolution priority (highest → lowest):
      //   1. funnel.clientSlug — set by /lp/:slug route via ScanFunnelProvider (canonical white-label entry)
      //   2. ?client= query param — explicit override on any page
      //   3. utm.client_slug — captured earlier this session from URL
      //   4. localStorage('wm_client_slug') — durability across refresh / tab switch
      //   5. null — true direct/organic traffic
      const queryClientSlug =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("client")
          : null;

      const lsClientSlug =
        typeof window !== "undefined"
          ? localStorage.getItem("wm_client_slug")
          : null;

      const effectiveClientSlug =
        funnel?.clientSlug ??
        queryClientSlug ??
        utm.client_slug ??
        lsClientSlug ??
        null;

      // Persist for future sessions / refresh durability (Fix 2 from diagnosis)
      if (effectiveClientSlug && typeof window !== "undefined") {
        try { localStorage.setItem("wm_client_slug", effectiveClientSlug); } catch {}
      }

      const landingPageUrl =
        utm.landing_page_url ??
        (typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : null);

      // Build the full intake payload as a named object for clean diagnostics.
      const leadInsertPayload = {
        session_id: sessionId,
        first_name: answers.firstName,
        email: answers.email,
        phone_e164: phoneE164,
        county: answers.county,
        project_type: answers.projectType,
        window_count: parseWindowCount(answers.windowCount),
        quote_range: answers.quoteRange,
        source: "truth-gate",

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
        initial_referrer: typeof document !== "undefined" ? document.referrer || null : null,
      };

      // Route through the dedicated edge function. This avoids the
      // anon-vs-authenticated RLS mismatch on `public.leads` (browser sessions
      // can carry an admin/operator JWT, which previously caused a 42501).
      const { data: captureData, error: captureError } = await supabase.functions.invoke(
        "capture-truth-gate-lead",
        { body: leadInsertPayload },
      );

      if (captureError || !captureData?.success) {
        const errBody = (captureData ?? {}) as {
          code?: string;
          message?: string;
          details?: unknown;
          hint?: string;
        };
        const code = errBody.code || captureError?.name || "lead_capture_failed";
        const message =
          errBody.message ||
          captureError?.message ||
          "Lead capture failed.";

        // Structured non-PII diagnostic
        console.error("[TruthGateFlow] leads capture failed", {
          code,
          message,
          details: errBody.details ?? null,
          hint: errBody.hint ?? null,
          payload_keys: Object.keys(leadInsertPayload),
          has_phone: !!phoneE164,
          has_client_slug: !!effectiveClientSlug,
          session_id: sessionId,
        });

        setSubmitError({ code, message });
        throw new Error(message);
      }

      if (funnel) {
        funnel.setSessionId(sessionId);
        if (phoneE164) {
          funnel.setPhone(phoneE164, "screened_valid");
        } else {
          funnel.setPhone("", "none");
        }
      }

      // Note: success telemetry is written server-side by the edge function.
      // No browser-side event_logs insert here — it would race with the
      // anon-only RLS policy when an admin/operator session is present.

      setSubmitState("success");
      onLeadCaptured?.(sessionId);

      supabase.functions
        .invoke("enrich-lead", {
          body: {
            session_id: sessionId,
            county: answers.county,
            window_count: parseWindowCount(answers.windowCount),
          },
        })
        .then(({ error: enrichErr }) => {
          if (enrichErr) console.warn("[TruthGateFlow] enrichment failed:", enrichErr);
        })
        .catch((invokeErr) => {
          console.warn("[TruthGateFlow] enrichment invoke rejected:", invokeErr);
        });
    } catch (err) {
      console.error("Lead capture error:", err);

      supabase
        .from("event_logs")
        .insert({
          event_name: "lead_capture_failed",
          session_id: funnel?.sessionId || null,
          metadata: {
            error_message: err instanceof Error ? err.message : String(err),
            stage: "lead_capture",
            timestamp: new Date().toISOString(),
          },
        })
        .then(({ error: evtErr }) => {
          if (evtErr) console.warn("event_log insert failed:", evtErr);
        });

      setSubmitState("error");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  const progressWidth = currentStep <= 4 ? `${currentStep * 25}%` : "100%";

  const renderStepContent = () => {
    if (transitionState === "loading") {
      return (
        <motion.div
          key="loading"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
          className="flex flex-col items-center justify-center py-12 gap-4"
        >
          <Spinner />
          <p className="font-mono text-wm-body-soft text-primary">Configuring Your Analysis...</p>
        </motion.div>
      );
    }

    if (transitionState === "estimate") {
      return (
        <motion.div
          key="estimate"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
        >
          <div className="bg-primary/5 border border-primary/20 p-5" style={{ borderRadius: 0 }}>
            <p className="font-mono text-wm-body-soft text-primary uppercase tracking-widest mb-2">
              BASED ON YOUR ANSWERS
            </p>
            <p className="font-body text-wm-label text-foreground mb-1">
              Quotes in {selectedCounty} in the {selectedRange} range...
            </p>
            <p className="font-body text-wm-body-soft text-muted-foreground">
              ...Score Between C and D on Average. 67% Contain at Least One Red Flag.
            </p>
            <p className="font-body text-wm-body-soft text-muted-foreground italic mt-3">
              Your Actual Grade Requires Your Quote. But You're in a High-Risk Range.
            </p>
          </div>
        </motion.div>
      );
    }

    if (currentStep >= 1 && currentStep <= 4) {
      const cfg = stepConfig[currentStep - 1];
      return (
        <motion.div
          key={`step-${currentStep}`}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
        >
          <h2
            className="font-display font-black uppercase leading-tight text-foreground"
            style={{
              fontSize: "clamp(22px, 4vw, 30px)",
              letterSpacing: "0.02em",
              marginBottom: 8,
            }}
          >
            {cfg.question}
          </h2>
          <p className="font-body text-wm-body-soft text-muted-foreground mb-7 text-center">{cfg.sub}</p>
          <div className="grid grid-cols-2 gap-3">
            {cfg.options.map((opt) => (
              <OptionButton
                key={opt}
                label={opt}
                selected={selectedOption === opt}
                onClick={() => handleOptionClick(cfg.key, opt)}
                tile={cfg.key === "windowCount"}
              />
            ))}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key="lead-gate"
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.15 }}
      >
        <div
          className="inline-flex items-center mb-5 px-3 py-1 bg-primary/10 border border-primary"
          style={{ borderRadius: 0 }}
        >
          <span className="wm-eyebrow text-primary">✓ Your scan is configured</span>
        </div>

        <h2
          className="font-display font-black uppercase leading-tight text-foreground"
          style={{
            fontSize: "clamp(24px, 4vw, 32px)",
            letterSpacing: "0.02em",
            marginBottom: 8,
          }}
        >
          What's Hiding In Your Quote.
        </h2>
        <p className="font-body text-wm-body-soft text-muted-foreground mb-6">Enter Your Details to Run The Scan.</p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <label className="wm-eyebrow mb-1.5 text-muted-foreground block">
              FIRST NAME <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Your first name"
                autoComplete="given-name"
                maxLength={100}
                required
                aria-invalid={fieldStatus.firstName === "invalid"}
                value={answers.firstName}
                onChange={(e) => setAnswers((p) => ({ ...p, firstName: e.target.value }))}
                className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
                  fieldStatus.firstName !== "untouched" ? "pr-10" : ""
                } ${
                  fieldStatus.firstName === "invalid"
                    ? "border-orange-500"
                    : fieldStatus.firstName === "valid"
                      ? "border-primary"
                      : ""
                }`}
                onBlur={() => handleFieldBlur("firstName", answers.firstName)}
              />
              {fieldStatus.firstName === "valid" && <ValidationIcon valid />}
              {fieldStatus.firstName === "invalid" && <ValidationIcon valid={false} />}
            </div>
            {fieldStatus.firstName === "invalid" && (
              <p className="font-body text-xs text-orange-500 mt-1">Please enter your first name (2+ characters)</p>
            )}
          </div>

          <div>
            <label className="wm-eyebrow mb-1.5 text-muted-foreground block">
              EMAIL ADDRESS <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                maxLength={255}
                required
                aria-invalid={fieldStatus.email === "invalid"}
                value={answers.email}
                onChange={(e) => setAnswers((p) => ({ ...p, email: e.target.value }))}
                className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
                  fieldStatus.email !== "untouched" ? "pr-10" : ""
                } ${
                  fieldStatus.email === "invalid"
                    ? "border-orange-500"
                    : fieldStatus.email === "valid"
                      ? "border-primary"
                      : ""
                }`}
                onBlur={() => handleFieldBlur("email", answers.email)}
              />
              {fieldStatus.email === "valid" && <ValidationIcon valid />}
              {fieldStatus.email === "invalid" && <ValidationIcon valid={false} />}
            </div>
            {fieldStatus.email === "invalid" && (
              <p className="font-body text-xs text-orange-500 mt-1">Please enter a valid email address</p>
            )}
          </div>

          <div>
            <label className="wm-eyebrow mb-1.5 text-muted-foreground block">MOBILE NUMBER</label>
            <div className="relative">
              <input
                type="tel"
                placeholder="(555) 555-5555"
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                aria-invalid={fieldStatus.phone === "invalid"}
                value={answers.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
                  fieldStatus.phone !== "untouched" ? "pr-10" : ""
                } ${
                  fieldStatus.phone === "invalid"
                    ? "border-orange-500"
                    : fieldStatus.phone === "valid"
                      ? "border-primary"
                      : ""
                }`}
                onBlur={() => handleFieldBlur("phone", answers.phone)}
              />
              {fieldStatus.phone === "valid" && <ValidationIcon valid />}
              {fieldStatus.phone === "invalid" && <ValidationIcon valid={false} />}
            </div>
            {fieldStatus.phone === "invalid" && (
              <p className="font-body text-xs text-orange-500 mt-1">Please enter a valid 10-digit US phone number</p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={submitState === "submitting" || submitState === "success"}
            className="btn-depth-primary w-full"
            style={{
              height: 54,
              fontSize: 18,
              background: submitState === "error" ? "linear-gradient(135deg,#F97316 0%,#EA580C 100%)" : undefined,
              boxShadow:
                submitState === "error"
                  ? "0 10px 25px rgba(249,115,22,0.35), 0 0 0 1px rgba(234,88,12,0.9)"
                  : undefined,
              marginTop: 4,
            }}
          >
            {submitState === "idle" && "Upload My Quote →"}
            {submitState === "submitting" && (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Saving...
              </span>
            )}
            {submitState === "success" && (
              <span className="inline-flex items-center gap-2">
                <Check size={18} /> Ready — Upload Below
              </span>
            )}
            {submitState === "error" && "Something went wrong — Try Again"}
          </motion.button>
        </form>

        <p className="font-body text-wm-body-soft text-muted-foreground leading-relaxed text-center mt-4">
          Your Free Report is Yours
          <br />
          We Just Help You Understand It Better
        </p>
      </motion.div>
    );
  };

  return (
    <section
      id="truth-gate"
      className="bg-background h-full min-h-screen md:min-h-[85vh] flex-col py-12 flex items-center justify-center"
    >
      <div
        className={`mx-auto w-full max-w-2xl px-4 md:px-8 py-10 md:py-16 transition-all duration-500 ${glowing ? "ring-2 ring-cobalt shadow-lg shadow-cobalt/20" : ""}`}
      >
        <p className="text-center mb-2 wm-eyebrow text-muted-foreground">THE SCANNER</p>
        <p className="text-center mb-3 wm-eyebrow text-primary" style={{ fontSize: 11 }}>
          {eyebrowLabels[Math.min(currentStep - 1, 4)]}
        </p>
        <div className="w-full h-1.5 input-well mb-8">
          <motion.div
            className="h-1.5 rounded-full"
            style={{ background: "linear-gradient(90deg, #4DA3FF, #2563EB)", boxShadow: "0 0 8px rgba(37,99,235,0.3)" }}
            animate={{ width: progressWidth }}
            transition={{ duration: 0.15 }}
          />
        </div>

        <div
          className="card-dominant p-7 md:p-8 shadow-2xl"
          style={{
            minHeight: 280,
            overflow: "hidden",
          }}
        >
          <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>
        </div>

        <div className="flex justify-center -mt-3 md:-mt-4 relative z-10 pointer-events-none select-none">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/60 bg-white/80 backdrop-blur-sm px-4 py-1.5 shadow-sm">
            <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold tabular-nums font-mono text-foreground">
              {total.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              Quotes Scanned
            </span>
            <div className="w-px h-3.5 bg-border" />
            <span className="text-xs font-bold tabular-nums font-mono text-primary whitespace-nowrap">
              +{tickerToday} Today
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TruthGateFlow;
