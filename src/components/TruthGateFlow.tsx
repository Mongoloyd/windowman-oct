import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield } from "lucide-react";
import { useTickerStats } from "@/hooks/useTickerStats";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { getUtmData } from "@/lib/useUtmCapture";
import {
  hasTrustedContactIdentity,
  isValidLeadSessionUuid,
} from "@/lib/leadSession";
import {
  formatTruthGatePhoneDisplay,
  validateTruthGateContact,
  validateTruthGateContactField,
  type TruthGateFieldStatus,
} from "@/lib/validation/truthGateContact";
import { submitTruthGateLead } from "@/services/truthGateLeadCapture";

const CONTACT_FONT =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type PaidAttributionSignals = {
  utm_source: string | null;
  ndclid: string | null;
  nd_lead_id: string | null;
  ttclid: string | null;
  fbclid: string | null;
};

function resolveNetworkLabel(signals: PaidAttributionSignals): string | null {
  const source = (signals.utm_source ?? "").toLowerCase();

  if (source.includes("nextdoor") || signals.ndclid || signals.nd_lead_id) {
    return "Nextdoor";
  }

  if (source.includes("tiktok") || signals.ttclid) {
    return "TikTok";
  }

  if (
    source.includes("facebook") ||
    source.includes("meta") ||
    signals.fbclid
  ) {
    return "Meta";
  }

  return null;
}

function resolveContactEyebrow(): string {
  const data = getUtmData();
  const networkLabel = resolveNetworkLabel({
    utm_source: data.utm_source,
    ndclid: data.ndclid,
    nd_lead_id: data.nd_lead_id,
    ttclid: data.ttclid,
    fbclid: data.fbclid,
  });

  if (networkLabel) {
    return `FROM ${networkLabel.toUpperCase()}`;
  }

  return "FREE QUOTE CHECK";
}

type ContactFields = {
  firstName: string;
  email: string;
  phone: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";
type FieldStatus = TruthGateFieldStatus;

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
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

const ContactCaptureStep = ({
  firstName,
  email,
  phone,
  fieldStatus,
  submitState,
  submitError,
  onFirstNameChange,
  onEmailChange,
  onPhoneChange,
  onFieldBlur,
  onSubmit,
}: {
  firstName: string;
  email: string;
  phone: string;
  fieldStatus: Record<string, FieldStatus>;
  submitState: SubmitState;
  submitError: { code?: string; message?: string } | null;
  onFirstNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onFieldBlur: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) => (
  <motion.div
    key="contact-capture"
    variants={slideVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ duration: 0.15 }}
    className="flex flex-col gap-5"
    style={{ fontFamily: CONTACT_FONT }}
  >
    <div
      className="rounded-xl border border-primary/20 bg-gradient-to-b from-white to-primary/[0.06] p-6 shadow-[var(--shadow-elevated)]"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground shadow-sm"
        >
          Quote
        </span>
        <span
          className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary shadow-sm"
        >
          Scan
        </span>
      </div>
      <h2 className="font-display text-2xl font-extrabold leading-tight tracking-[0.01em] text-foreground sm:text-[28px]">
        Get the right window quote — then scan it before you sign.
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Have a quote already? Scan it in 60 seconds. Still waiting on one? Start
        here and we&apos;ll keep everything together.
      </p>
      <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Free check. Private by default. No contractor sees your quote unless you
          choose.
        </span>
      </p>
    </div>

    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label className="wm-eyebrow mb-1.5 text-muted-foreground block">FIRST NAME</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Your first name"
            autoComplete="given-name"
            maxLength={100}
            aria-invalid={fieldStatus.firstName === "invalid"}
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onBlur={() => onFieldBlur("firstName", firstName)}
            className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
              fieldStatus.firstName !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.firstName === "invalid"
                ? "border-orange-500"
                : fieldStatus.firstName === "valid"
                  ? "border-primary"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.firstName === "valid" && <ValidationIcon valid />}
          {fieldStatus.firstName === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.firstName === "invalid" && (
          <p className="font-body text-xs text-orange-500 mt-1">
            Please enter your first name (2+ characters)
          </p>
        )}
      </div>

      <div>
        <label className="wm-eyebrow mb-1.5 text-muted-foreground block">EMAIL ADDRESS</label>
        <div className="relative">
          <input
            type="email"
            placeholder="your@email.com"
            autoComplete="email"
            maxLength={255}
            aria-invalid={fieldStatus.email === "invalid"}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => onFieldBlur("email", email)}
            className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
              fieldStatus.email !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.email === "invalid"
                ? "border-orange-500"
                : fieldStatus.email === "valid"
                  ? "border-primary"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.email === "valid" && <ValidationIcon valid />}
          {fieldStatus.email === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.email === "invalid" && (
          <p className="font-body text-xs text-orange-500 mt-1">
            Please enter a valid email address
          </p>
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
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            onBlur={() => onFieldBlur("phone", phone)}
            className={`wm-input-well w-full h-12 px-4 font-body text-[15px] text-foreground outline-none ${
              fieldStatus.phone !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.phone === "invalid"
                ? "border-orange-500"
                : fieldStatus.phone === "valid"
                  ? "border-primary"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.phone === "valid" && <ValidationIcon valid />}
          {fieldStatus.phone === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.phone === "invalid" && (
          <p className="font-body text-xs text-orange-500 mt-1">
            Please enter a valid 10-digit US phone number
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitState === "submitting" || submitState === "success"}
        className="btn-depth-primary w-full rounded-lg border border-primary/20 bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow"
        style={{ fontFamily: CONTACT_FONT }}
      >
        {submitState === "idle" && "Start Free"}
        {submitState === "submitting" && (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner /> Saving...
          </span>
        )}
        {submitState === "success" && (
          <span className="inline-flex items-center justify-center gap-2">
            <Check size={18} /> Ready — Upload Below
          </span>
        )}
        {submitState === "error" && "Something went wrong — Try Again"}
      </button>

      {submitState === "error" && submitError?.message && (
        <p className="font-body text-xs text-orange-500 text-center">{submitError.message}</p>
      )}
    </form>
  </motion.div>
);

const TruthGateFlow = ({
  onLeadCaptured,
  highlight,
  onHighlightDone,
}: {
  onLeadCaptured?: (sessionId: string) => void;
  highlight?: boolean;
  onHighlightDone?: () => void;
}) => {
  const [glowing, setGlowing] = useState(false);
  const { total, today: tickerToday } = useTickerStats();

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

  const [fields, setFields] = useState<ContactFields>({
    firstName: "",
    email: "",
    phone: "",
  });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<{ code?: string; message?: string } | null>(null);
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({
    firstName: "untouched",
    email: "untouched",
    phone: "untouched",
  });
  const funnel = useScanFunnelSafe();
  const [eyebrowText] = useState(() => resolveContactEyebrow());

  const unlockAfterContactCapture = useCallback(
    (sessionId: string) => {
      setSubmitState("success");
      onLeadCaptured?.(sessionId);
    },
    [onLeadCaptured],
  );

  const handleFieldBlur = useCallback((field: string, value: string) => {
    if (value.trim().length > 0) {
      setFieldStatus((prev) => ({
        ...prev,
        [field]: validateTruthGateContactField(field, value),
      }));
    }
  }, []);

  const handlePhoneChange = useCallback((rawValue: string) => {
    const cleaned = rawValue.replace(/[^\d\s()\-+]/g, "");
    const formatted = formatTruthGatePhoneDisplay(cleaned);
    setFields((prev) => ({ ...prev, phone: formatted }));

    setFieldStatus((prev) => {
      if (prev.phone === "invalid") return { ...prev, phone: "untouched" };
      return prev;
    });
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateTruthGateContact(fields);
    setFieldStatus(validation.fieldStatus);

    if (!validation.valid) return;

    if (
      hasTrustedContactIdentity(funnel?.leadId, funnel?.sessionId) &&
      funnel?.sessionId
    ) {
      unlockAfterContactCapture(funnel.sessionId);
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    const sessionId = isValidLeadSessionUuid(funnel?.sessionId)
      ? funnel!.sessionId!
      : crypto.randomUUID();

    if (funnel && !isValidLeadSessionUuid(funnel.sessionId)) {
      funnel.setSessionId(sessionId);
    }

    const result = await submitTruthGateLead({
      sessionId,
      firstName: fields.firstName,
      email: fields.email,
      phone: fields.phone,
      funnelClientSlug: funnel?.clientSlug,
    });

    if (result.ok === false) {
      setSubmitError({ code: result.code, message: result.message });
      setSubmitState("error");
      return;
    }

    if (funnel) {
      funnel.setSessionId(result.sessionId);
      funnel.setLeadId(result.leadId);
      if (result.phoneE164) {
        funnel.setPhone(result.phoneE164, "screened_valid");
      } else {
        funnel.setPhone("", "none");
      }
    }

    unlockAfterContactCapture(result.sessionId);
  };

  return (
    <section
      id="truth-gate"
      className="bg-background h-full min-h-screen md:min-h-[85vh] flex-col py-12 flex items-center justify-center"
    >
      <div
        className={`mx-auto w-full max-w-2xl px-4 md:px-8 py-10 md:py-16 transition-all duration-500 ${glowing ? "ring-2 ring-cobalt shadow-lg shadow-cobalt/20" : ""}`}
      >
        <p className="text-center mb-2 wm-eyebrow text-muted-foreground">WINDOWMAN QUOTE CHECK</p>
        <p className="text-center mb-3 wm-eyebrow text-primary" style={{ fontSize: 11 }}>
          {eyebrowText}
        </p>
        <div className="w-full h-1.5 input-well mb-8">
          <motion.div
            className="h-1.5 rounded-full"
            style={{ background: "linear-gradient(90deg, #4DA3FF, #2563EB)", boxShadow: "0 0 8px rgba(37,99,235,0.3)" }}
            animate={{ width: "100%" }}
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
          <AnimatePresence mode="wait">
            <ContactCaptureStep
              firstName={fields.firstName}
              email={fields.email}
              phone={fields.phone}
              fieldStatus={fieldStatus}
              submitState={submitState}
              submitError={submitError}
              onFirstNameChange={(value) =>
                setFields((prev) => ({ ...prev, firstName: value }))
              }
              onEmailChange={(value) =>
                setFields((prev) => ({ ...prev, email: value }))
              }
              onPhoneChange={handlePhoneChange}
              onFieldBlur={handleFieldBlur}
              onSubmit={handleContactSubmit}
            />
          </AnimatePresence>
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
