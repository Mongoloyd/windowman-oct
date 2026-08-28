import { useState, useCallback, useEffect, useRef } from "react";
import {
  Check,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Search,
  FileText,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { useTickerStats } from "@/hooks/useTickerStats";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { getUtmData } from "@/lib/useUtmCapture";
import { createUuid } from "@/lib/createUuid";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import {
  formatTruthGatePhoneDisplay,
  validateTruthGateContact,
  validateTruthGateContactField,
  type TruthGateFieldStatus,
} from "@/lib/validation/truthGateContact";
import { MarketingConsentCheckbox } from "@/components/consent/MarketingConsentCheckbox";
import { ServiceAuthorizationDisclosure } from "@/components/consent/ServiceAuthorizationDisclosure";

type TruthGateLeadCaptureModule = typeof import("@/services/truthGateLeadCapture");

export function createTruthGateLeadCaptureModuleLoader(
  importer: () => Promise<TruthGateLeadCaptureModule>,
) {
  let modulePromise: Promise<TruthGateLeadCaptureModule> | null = null;

  const load = () => {
    if (modulePromise) return modulePromise;

    modulePromise = importer().catch((error: unknown) => {
      modulePromise = null;
      throw error;
    });
    return modulePromise;
  };

  const prewarm = () => {
    void load().catch(() => undefined);
  };

  return { load, prewarm };
}

const truthGateLeadCaptureLoader = createTruthGateLeadCaptureModuleLoader(
  () => import("@/services/truthGateLeadCapture"),
);

const SAFE_CAPTURE_MESSAGE =
  "We couldn't save your details yet. Check them and try again.";

const CONTACT_FONT =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Material-layer tokens — visual only, L0–L4 hierarchy */
const TG = {
  pillBase:
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
  pillQuote: "border border-slate-400/25 bg-[#0D1F38] text-slate-200",
  pillScan: "border border-cyan-400/30 bg-[#0A2430] text-cyan-100",
  pillRiskCheck: "border border-amber-400/25 bg-[#121A2E] text-amber-100/90",
  privacyStrip:
    "mt-3 flex items-center gap-3 rounded-xl border border-blue-400/25 bg-[#0B1A32] px-4 py-3 shadow-inner",
  privacyChip:
    "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 shadow-[0_0_10px_rgba(96,165,250,0.18)]",
  inputBase:
    "h-12 w-full rounded-xl border border-slate-500/45 bg-[#162A42] pl-10 pr-4 font-body text-[15px] text-slate-100 outline-none placeholder:text-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.28)] transition-colors focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/25 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#162A42] [&:-webkit-autofill]:[-webkit-text-fill-color:#f1f5f9] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_#162A42] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_#162A42]",
  inputIconIdle: "text-slate-500 group-focus-within:text-cyan-300 transition-colors",
  inputIconActive: "text-cyan-300",
  trustRail:
    "mt-5 flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-slate-400/25 bg-[#152A40] px-3 py-2 sm:gap-2",
  miniQuoteVisual:
    "relative hidden h-16 w-14 shrink-0 rounded-lg border border-slate-400/20 bg-[#0D1F38] p-2 shadow-[0_0_18px_rgba(34,211,238,0.22)] sm:block",
} as const;

const RISK_CHIPS = [
  {
    icon: AlertTriangle,
    label: "Price Risk",
    panel: "border border-amber-500/20 bg-[#1A1408]",
    iconClass: "text-amber-400",
    labelClass: "text-amber-100/90",
  },
  {
    icon: Search,
    label: "Scope Gaps",
    panel: "border border-sky-400/20 bg-[#0C1828]",
    iconClass: "text-sky-300",
    labelClass: "text-sky-100/90",
  },
  {
    icon: ShieldCheck,
    label: "Warranty Traps",
    panel: "border border-violet-400/20 bg-[#141028]",
    iconClass: "text-violet-300",
    labelClass: "text-violet-100/90",
  },
] as const;

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

const Spinner = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" className="animate-spin" style={{ color: "#F8FBFF" }}>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
    <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const ValidationIcon = ({ valid }: { valid: boolean }) => (
  <span className="absolute right-3 top-1/2 -translate-y-1/2">
    {valid ? (
      <CheckCircle className="h-4 w-4 text-cyan-300" aria-hidden="true" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
    )}
  </span>
);

const MiniQuoteScanVisual = () => (
  <div
    aria-hidden="true"
    className={TG.miniQuoteVisual}
  >
    <FileText className="absolute right-1 top-1 h-3 w-3 text-cyan-400/70" />
    <div className="mt-1 space-y-1.5">
      <div className="relative h-1 rounded-full bg-slate-600/60">
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400/90" />
      </div>
      <div className="h-1 rounded-full bg-slate-600/50" />
      <div className="h-1 w-3/4 rounded-full bg-slate-600/40" />
    </div>
    <div className="absolute inset-x-1 top-1/2 h-px bg-cyan-400/70 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
  </div>
);

const ContactCaptureStep = ({
  firstName,
  email,
  phone,
  fieldStatus,
  submitState,
  submitError,
  total,
  tickerToday,
  onFirstNameChange,
  onEmailChange,
  onPhoneChange,
  onFieldBlur,
  onIntent,
  onSubmit,
  marketingConsent,
  onMarketingConsentChange,
}: {
  firstName: string;
  email: string;
  phone: string;
  fieldStatus: Record<string, FieldStatus>;
  submitState: SubmitState;
  submitError: { code?: string; message?: string } | null;
  total: number;
  tickerToday: number;
  onFirstNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onFieldBlur: (field: string, value: string) => void;
  onIntent: () => void;
  onSubmit: (e: React.FormEvent) => void;
  marketingConsent: boolean;
  onMarketingConsentChange: (checked: boolean) => void;
}) => (
  <div
    className="flex flex-col gap-5"
    style={{ fontFamily: CONTACT_FONT }}
  >
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className={`${TG.pillBase} ${TG.pillQuote}`}>
            Quote
          </span>
          <span className={`${TG.pillBase} ${TG.pillScan}`}>
            Scan
          </span>
          <span className={`${TG.pillBase} ${TG.pillRiskCheck}`}>
            QUOTE RISK CHECK
          </span>
        </div>
        <MiniQuoteScanVisual />
      </div>

      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#F8FBFF] sm:text-[32px]">
        Get The Best Window Quote Possible
      </h2>
      <p className="mt-3 max-w-md text-base leading-relaxed text-[#CBD5E1]">
        Have A Quote Already? Scan It In 60 Seconds. Still Waiting On One?
        Start Here And We&apos;ll Keep Everything Together.
      </p>

      <div
        aria-hidden="true"
        className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2"
      >
        {RISK_CHIPS.map(({ icon: Icon, label, panel, iconClass, labelClass }) => (
          <div
            key={label}
            className={`flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 sm:gap-1.5 sm:px-2 ${panel}`}
          >
            <Icon className={`h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 ${iconClass}`} />
            <span
              className={`text-[9px] font-semibold uppercase leading-tight tracking-wide sm:text-[10px] ${labelClass}`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className={TG.privacyStrip}>
        <span className={TG.privacyChip}>
          <ShieldCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold leading-snug text-blue-50">
          Private Quote Upload. No Contractor Sees It Unless You Choose.
        </span>
      </div>
    </div>

    <form
      onSubmit={onSubmit}
      onFocusCapture={onIntent}
      onPointerDownCapture={onIntent}
      noValidate
      className="flex flex-col gap-4"
    >
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-300">FIRST NAME</label>
        <div className="relative group">
          <User
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              fieldStatus.firstName === "valid" ? TG.inputIconActive : TG.inputIconIdle
            }`}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Your first name"
            autoComplete="given-name"
            maxLength={100}
            data-wm-form-start="truth_gate_contact"
            data-wm-form-step="1"
            data-wm-field-name="first_name"
            aria-invalid={fieldStatus.firstName === "invalid"}
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
            onBlur={() => onFieldBlur("firstName", firstName)}
            className={`${TG.inputBase} ${
              fieldStatus.firstName !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.firstName === "invalid"
                ? "border-orange-500/80"
                : fieldStatus.firstName === "valid"
                  ? "border-cyan-400/70"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.firstName === "valid" && <ValidationIcon valid />}
          {fieldStatus.firstName === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.firstName === "invalid" && (
          <p className="mt-1.5 font-body text-xs text-amber-300">
            Please enter your first name (2+ characters)
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-300">EMAIL ADDRESS</label>
        <div className="relative group">
          <Mail
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              fieldStatus.email === "valid" ? TG.inputIconActive : TG.inputIconIdle
            }`}
            aria-hidden="true"
          />
          <input
            type="email"
            placeholder="your@email.com"
            autoComplete="email"
            maxLength={255}
            aria-invalid={fieldStatus.email === "invalid"}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => onFieldBlur("email", email)}
            className={`${TG.inputBase} ${
              fieldStatus.email !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.email === "invalid"
                ? "border-orange-500/80"
                : fieldStatus.email === "valid"
                  ? "border-cyan-400/70"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.email === "valid" && <ValidationIcon valid />}
          {fieldStatus.email === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.email === "invalid" && (
          <p className="mt-1.5 font-body text-xs text-amber-300">
            Please enter a valid email address
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-300">MOBILE NUMBER</label>
        <div className="relative group">
          <Phone
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              fieldStatus.phone === "valid" ? TG.inputIconActive : TG.inputIconIdle
            }`}
            aria-hidden="true"
          />
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
            className={`${TG.inputBase} ${
              fieldStatus.phone !== "untouched" ? "pr-10" : ""
            } ${
              fieldStatus.phone === "invalid"
                ? "border-orange-500/80"
                : fieldStatus.phone === "valid"
                  ? "border-cyan-400/70"
                  : ""
            }`}
            style={{ fontFamily: CONTACT_FONT }}
          />
          {fieldStatus.phone === "valid" && <ValidationIcon valid />}
          {fieldStatus.phone === "invalid" && <ValidationIcon valid={false} />}
        </div>
        {fieldStatus.phone === "invalid" && (
          <p className="mt-1.5 font-body text-xs text-amber-300">
            Please enter a valid 10-digit US phone number
          </p>
        )}
      </div>

      <MarketingConsentCheckbox
        id="truth-gate-marketing-consent"
        checked={marketingConsent}
        onChange={onMarketingConsentChange}
        variant="dark"
      />

      <button
        type="submit"
        disabled={submitState === "submitting" || submitState === "success"}
        className="h-14 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-400 text-base font-bold text-white shadow-[0_10px_30px_-8px_rgba(34,211,238,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_42px_-10px_rgba(34,211,238,0.72)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_30px_-8px_rgba(34,211,238,0.55)]"
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

      <ServiceAuthorizationDisclosure buttonLabel="Start Free" />

      {submitState === "error" && submitError?.message && (
        <p className="text-center font-body text-xs text-amber-300">{submitError.message}</p>
      )}

      <p className="text-center text-xs text-[#CBD5E1]/80">
        Your quote stays private until you decide what to do next.
      </p>

      <div className={TG.trustRail} aria-label="Quote scan statistics">
        <Shield className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="text-[10px] font-semibold tabular-nums font-mono text-slate-100 sm:text-xs">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          Quotes Scanned
        </span>
        <div className="hidden h-3 w-px bg-slate-600/40 sm:block" aria-hidden="true" />
        <span className="text-[10px] font-bold tabular-nums font-mono text-cyan-300 whitespace-nowrap sm:text-xs">
          +{tickerToday} Today
        </span>
      </div>
    </form>
  </div>
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
  const [marketingCommunicationsConsent, setMarketingCommunicationsConsent] =
    useState(false);
  // One submissionId identifies one immutable consent-decision transaction.
  // It is reused only for a byte-equivalent retry of the same decision; a
  // changed decision or a completed submission starts a new transaction.
  const submissionIdRef = useRef(createUuid());

  const handleMarketingConsentChange = useCallback((checked: boolean) => {
    setMarketingCommunicationsConsent(checked);
    // Changed consent decision → new consent submission transaction.
    submissionIdRef.current = createUuid();
  }, []);

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

    // Trusted-session note: even when a trusted leadId+sessionId pair already
    // exists, the submit still goes through capture-truth-gate-lead so the
    // current consent envelope is persisted server-side before unlock. The
    // Edge Function reuses the existing lead via session lookup — session
    // reuse, OTP, and Verify-to-Reveal are unchanged.
    setSubmitState("submitting");
    setSubmitError(null);

    let captureModule: TruthGateLeadCaptureModule;
    try {
      captureModule = await truthGateLeadCaptureLoader.load();
    } catch {
      setSubmitError({ code: "lead_capture_failed", message: SAFE_CAPTURE_MESSAGE });
      setSubmitState("error");
      return;
    }

    const sessionId = isValidLeadSessionUuid(funnel?.sessionId)
      ? funnel!.sessionId!
      : createUuid();

    if (funnel && !isValidLeadSessionUuid(funnel.sessionId)) {
      funnel.setSessionId(sessionId);
    }

    const result = await captureModule.submitTruthGateLead({
      sessionId,
      firstName: fields.firstName,
      email: fields.email,
      phone: fields.phone,
      funnelClientSlug: funnel?.clientSlug,
      submissionId: submissionIdRef.current,
      marketingCommunicationsGranted: marketingCommunicationsConsent,
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

    // Completed submission closes this consent transaction; any later
    // user-triggered submission is a new transaction.
    submissionIdRef.current = createUuid();
    unlockAfterContactCapture(result.sessionId);
  };

  return (
    <section
      id="truth-gate"
      className="relative bg-background pt-10 pb-12 md:pt-24 md:pb-20 lg:pt-28 lg:pb-28"
    >
      <div
        className={`mx-auto w-full max-w-lg px-4 md:px-8 transition-all duration-500 ${glowing ? "ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/20 rounded-2xl" : ""}`}
      >
        <p className="mb-6 text-center wm-eyebrow text-cyan-300/90" style={{ fontSize: 11 }}>
          {eyebrowText}
        </p>

        <div className="rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 p-[2px] shadow-[0_25px_70px_-20px_rgba(37,99,235,0.5)]">
          <div className="relative rounded-[calc(1rem-1px)] border border-white/[0.06] bg-[#050B16] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:p-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[calc(1rem-1px)]" aria-hidden="true">
              <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_70%)]" />
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(148,163,184,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.6) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            </div>

            <div className="relative z-10">
              <ContactCaptureStep
                firstName={fields.firstName}
                email={fields.email}
                phone={fields.phone}
                fieldStatus={fieldStatus}
                submitState={submitState}
                submitError={submitError}
                total={total}
                tickerToday={tickerToday}
                onFirstNameChange={(value) =>
                  setFields((prev) => ({ ...prev, firstName: value }))
                }
                onEmailChange={(value) =>
                  setFields((prev) => ({ ...prev, email: value }))
                }
                onPhoneChange={handlePhoneChange}
                onFieldBlur={handleFieldBlur}
                onIntent={truthGateLeadCaptureLoader.prewarm}
                onSubmit={handleContactSubmit}
                marketingConsent={marketingCommunicationsConsent}
                onMarketingConsentChange={handleMarketingConsentChange}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TruthGateFlow;
