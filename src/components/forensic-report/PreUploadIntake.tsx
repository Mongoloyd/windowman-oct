import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  FileText,
  Calculator,
  Search,
  Home,
  Building2,
  Building,
  ShieldCheck,
  Lock,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  UploadCloud,
  BarChart3,
  Eye,
  MapPin,
  Sparkles,
} from "lucide-react";
import wmPointing from "@/assets/wm-pointing.png";
import wmReceiptBg from "@/assets/wm-receipt-bg.png";

/**
 * PreUploadIntake — Phase 4L.9.2 visual harness.
 *
 * Premium skeuomorphic pre-upload identity capture screen designed to live
 * behind any single WindowMan CTA (homepage, paid landing, partner pages).
 *
 * VISUAL HARNESS ONLY. No production wiring, no Supabase, no routing,
 * no analytics. Local state for visual interactions only.
 */

type VisitorPath = "has_quote" | "getting_quotes" | "researching" | null;
type HomeType = "single_family" | "townhome" | "condo" | null;
type QuoteStatus = "have_one" | "comparing" | "exploring" | null;

const PATH_TO_QUOTE_STATUS: Record<Exclude<VisitorPath, null>, QuoteStatus> = {
  has_quote: "have_one",
  getting_quotes: "comparing",
  researching: "exploring",
};

const PATH_LABELS: Record<Exclude<VisitorPath, null>, string> = {
  has_quote: "I already have a quote",
  getting_quotes: "I'm getting quotes",
  researching: "I'm just researching",
};

const HOME_LABELS: Record<Exclude<HomeType, null>, string> = {
  single_family: "Single family",
  townhome: "Townhome",
  condo: "Condo",
};

const PATHS: Exclude<VisitorPath, null>[] = [
  "has_quote",
  "getting_quotes",
  "researching",
];
const HOME_TYPES: Exclude<HomeType, null>[] = [
  "single_family",
  "townhome",
  "condo",
];

const DRAFT_KEY = "wm:intake:draft";

const isValidName = (v: string) => v.trim().length >= 2;
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidZip = (v: string) => /^\d{5}$/.test(v);

export function PreUploadIntake() {
  const [selectedPath, setSelectedPath] = useState<VisitorPath>(null);
  const [homeType, setHomeType] = useState<HomeType>(null);
  const [, setQuoteStatus] = useState<QuoteStatus>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, zip: false });
  const [typing, setTyping] = useState({ name: false, email: false, zip: false });
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");

  // Stable case ID for the session
  const caseId = useMemo(() => {
    const n = Math.floor(1000 + Math.random() * 9000);
    return `WM-2026-FL-${n}`;
  }, []);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.selectedPath) setSelectedPath(d.selectedPath);
      if (d.homeType) setHomeType(d.homeType);
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.email === "string") setEmail(d.email);
      if (typeof d.zip === "string") setZip(d.zip);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist draft
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ selectedPath, homeType, name, email, zip })
      );
    } catch {
      /* ignore */
    }
  }, [selectedPath, homeType, name, email, zip]);

  // Sync derived quote status from path
  useEffect(() => {
    if (selectedPath) setQuoteStatus(PATH_TO_QUOTE_STATUS[selectedPath]);
  }, [selectedPath]);

  // Auto-advance step when Zone A is complete
  useEffect(() => {
    if (selectedPath && homeType && step === 1) setStep(2);
  }, [selectedPath, homeType, step]);

  // Typing pulse debouncers
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pingTyping = useCallback((field: "name" | "email" | "zip") => {
    setTyping((t) => ({ ...t, [field]: true }));
    clearTimeout(typingTimers.current[field]);
    typingTimers.current[field] = setTimeout(() => {
      setTyping((t) => ({ ...t, [field]: false }));
    }, 600);
  }, []);

  const fieldValid = {
    name: isValidName(name),
    email: isValidEmail(email),
    zip: isValidZip(zip),
  };

  const canContinue =
    selectedPath !== null &&
    homeType !== null &&
    fieldValid.name &&
    fieldValid.email &&
    fieldValid.zip;

  const handleContinueAttempt = () => {
    if (!canContinue) {
      setTouched({ name: true, email: true, zip: true });
      setShowErrorSummary(true);
      setLiveMsg("Complete required fields to open your case file.");
      return;
    }
    setSubmitted(true);
    setLiveMsg(`Case file ${caseId} opened.`);
  };

  const handleCopyCaseId = async () => {
    try {
      await navigator.clipboard?.writeText(caseId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const stepProgress = step === 1 ? (selectedPath ? (homeType ? 50 : 30) : 10) : 100;

  const hasAnyPreview =
    selectedPath || homeType || name || email || zip;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1A2E] via-[#102A47] to-[#1A2332] text-slate-100 antialiased">
      {/* Ambient atmospheric layer — lighter blue/amber blend */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[680px] w-[680px] rounded-full bg-[#3B82F6]/[0.14] blur-[130px]" />
        <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-[#F4A261]/[0.10] blur-[130px]" />
        <div className="absolute -bottom-40 left-1/2 h-[500px] w-[500px] rounded-full bg-[#E8924A]/[0.07] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Sentinel at the Threshold — WindowMan pointing at Zone B */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-0 top-0 z-[1] hidden h-screen items-center justify-end pr-2 lg:flex xl:pr-6"
      >
        <div className="relative">
          <div className="absolute inset-0 -z-10 translate-x-6 translate-y-10 rounded-full bg-[#F4A261]/20 blur-3xl" />
          <img
            src={wmPointing}
            alt=""
            className="h-[78vh] max-h-[820px] w-auto select-none object-contain opacity-95 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] motion-safe:animate-float-soft"
            style={{ transform: "translateX(8%)" }}
          />
        </div>
      </div>

      {/* SR-only live region */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMsg}
      </div>

      {submitted && selectedPath ? (
        <BranchPanel
          path={selectedPath}
          caseId={caseId}
          name={name}
          zip={zip}
          homeType={homeType}
          onBack={() => {
            setSubmitted(false);
            setLiveMsg("Returned to intake. Your answers are preserved.");
          }}
        />
      ) : (
      <div className="relative z-[2] mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:py-20 lg:pr-[300px] xl:pr-[360px]">
        {/* Header bar */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_6px_16px_-3px_rgba(59,130,246,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight text-white">
                WindowMan
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-300">
                Forensic Audit System
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            Secure intake · TLS
          </div>
        </div>

        {/* Title block + Case ID */}
        <div className="mb-8 max-w-2xl">
          <button
            type="button"
            onClick={handleCopyCaseId}
            aria-label={`Copy case ID ${caseId}`}
            className="group mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/[0.10] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-amber-100 transition-all hover:border-amber-300/50 hover:bg-amber-400/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 shadow-[0_4px_12px_-4px_rgba(244,162,97,0.4),inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            <Lock className="h-3 w-3" />
            <span>Case · {caseId}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-300" />
            ) : (
              <Copy className="h-3 w-3 opacity-70 group-hover:opacity-100" />
            )}
          </button>
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[36px]">
            Open your private case file.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
            Tell us where you are in your window project. We'll prep a
            forensic-grade audit profile before you upload anything.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-md sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.18em]">
              <span className={step === 1 ? "text-white" : "text-slate-300"}>
                01 · Intake
              </span>
              <span className="text-slate-400">›</span>
              <span className={step === 2 ? "text-white" : "text-slate-300"}>
                02 · Chain of Custody
              </span>
            </div>
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded px-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              )}
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300">
                Step {step} of 2
              </span>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-900/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 via-indigo-400 to-amber-300 motion-safe:transition-all motion-safe:duration-500 ease-out shadow-[0_0_14px_rgba(244,162,97,0.6)]"
              style={{ width: `${stepProgress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr]">
          {/* ──────────────── ZONE A — Visitor segmentation ──────────────── */}
          <section
            aria-labelledby="zone-a-heading"
            className={[
              "relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-7",
              "motion-safe:transition-opacity motion-safe:duration-300",
              step === 2 ? "opacity-60" : "opacity-100",
            ].join(" ")}
          >
            <header className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                <span className="h-px w-6 bg-slate-600" /> § 01 — INTAKE
              </div>
              <h2
                id="zone-a-heading"
                className="text-[20px] font-semibold tracking-tight text-white"
              >
                Where are you in the process?
              </h2>
              <p className="mt-1 text-[13px] text-slate-400">
                Pick the closest match — it changes how we triage your audit.
              </p>
            </header>

            <PathRadioGroup
              selected={selectedPath}
              onSelect={(p) => {
                setSelectedPath(p);
                setLiveMsg(`Selected: ${PATH_LABELS[p]}`);
              }}
            />

            {/* Home type */}
            <div className="mt-6">
              <div className="mb-1.5 text-[12px] font-medium text-slate-300">
                Home type
              </div>
              <PillRadioGroup
                selected={homeType}
                onSelect={(h) => {
                  setHomeType(h);
                  setLiveMsg(`Home type: ${HOME_LABELS[h]}`);
                }}
              />
            </div>

            {/* Footer support card */}
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-[12.5px] leading-relaxed text-slate-400">
                <span className="font-semibold text-slate-200">
                  What happens next.
                </span>{" "}
                After this step you'll upload your quote (PDF, photo, or scan).
                We extract the contract, score 5 audit pillars, and unlock your
                report after SMS verification.
              </div>
            </div>
          </section>

          {/* ──────────────── ZONE B — Identity capture ──────────────── */}
          <section
            aria-labelledby="zone-b-heading"
            onFocus={() => {
              if (step === 1 && selectedPath && homeType) setStep(2);
            }}
            className={[
              "relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-7",
              "motion-safe:transition-opacity motion-safe:duration-300",
              step === 1 ? "opacity-70" : "opacity-100",
            ].join(" ")}
          >
            <header className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                <span className="h-px w-6 bg-slate-600" /> § 02 — CHAIN OF CUSTODY
              </div>
              <h2
                id="zone-b-heading"
                className="text-[20px] font-semibold tracking-tight text-white"
              >
                Set up your case file
              </h2>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                Benchmarked against 2,847 South FL quotes
              </div>
            </header>

            <div className="space-y-4">
              <SecureField
                label="Full name"
                type="text"
                autoComplete="name"
                value={name}
                placeholder="Maria Gonzalez"
                onChange={(v) => {
                  setName(v);
                  pingTyping("name");
                }}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                touched={touched.name}
                valid={fieldValid.name}
                typing={typing.name}
                error="Enter at least 2 characters."
              />
              <SecureField
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder="you@domain.com"
                onChange={(v) => {
                  setEmail(v);
                  pingTyping("email");
                }}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                touched={touched.email}
                valid={fieldValid.email}
                typing={typing.email}
                error="Enter a valid email address."
              />
              <SecureField
                label="Project Zip (for Local Building Codes/NOA verification)"
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                placeholder="33073"
                onChange={(v) => {
                  setZip(v.replace(/\D/g, "").slice(0, 5));
                  pingTyping("zip");
                }}
                onBlur={() => setTouched((t) => ({ ...t, zip: true }))}
                touched={touched.zip}
                valid={fieldValid.zip}
                typing={typing.zip}
                error="Enter a 5-digit ZIP."
                tracking
              />
            </div>

            {/* Case File Preview / Receipt */}
            {hasAnyPreview && (
              <div className="mt-6 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-3 font-mono">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  <span>§ Case File Preview</span>
                  <span className="text-slate-600">{caseId}</span>
                </div>
                <div className="space-y-1 text-[11.5px] text-slate-300">
                  {selectedPath && (
                    <ReceiptLine
                      label="PATH"
                      value={PATH_LABELS[selectedPath]}
                    />
                  )}
                  {homeType && (
                    <ReceiptLine label="HOME" value={HOME_LABELS[homeType]} />
                  )}
                  {(name || email) && (
                    <ReceiptLine
                      label="ASSIGNED"
                      value={
                        [name.trim(), email.trim()]
                          .filter(Boolean)
                          .join(" · ") || "—"
                      }
                    />
                  )}
                  {zip && <ReceiptLine label="JURISDICTION" value={zip} />}
                </div>
              </div>
            )}

            {/* Error summary */}
            {showErrorSummary && !canContinue && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-[12px] text-red-300"
              >
                Complete required fields to open your case file.
              </div>
            )}

            {/* CTA */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleContinueAttempt}
                aria-disabled={!canContinue}
                className={[
                  "group relative w-full overflow-hidden rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white motion-safe:transition-all motion-safe:duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  canContinue
                    ? "bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_10px_28px_-10px_rgba(59,130,246,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-blue-400 hover:to-blue-600"
                    : "bg-slate-800/60 cursor-not-allowed opacity-60 shadow-none",
                ].join(" ")}
              >
                <span className="relative flex items-center justify-center gap-2">
                  {submitted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Case file opened
                    </>
                  ) : (
                    <>
                      Continue to upload
                      <ArrowRight className="h-4 w-4 motion-safe:transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </span>
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" /> Encrypted in transit · No spam ·
                You control the unlock
              </div>
            </div>
          </section>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" /> SMS-gated
            reveal
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-blue-400/70" /> Private storage
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-indigo-400/70" /> Deterministic
            scoring
          </span>
        </div>
      </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Sub-components ────────────────────────────── */

function PathRadioGroup({
  selected,
  onSelect,
}: {
  selected: VisitorPath;
  onSelect: (p: Exclude<VisitorPath, null>) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const focusedIdx = Math.max(
    0,
    PATHS.findIndex((p) => p === selected)
  );

  const focusAt = (i: number) =>
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]
      ?.focus();

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = PATHS.findIndex((p) => p === selected);
    const idx = current < 0 ? 0 : current;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % PATHS.length;
      onSelect(PATHS[next]);
      focusAt(next);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx - 1 + PATHS.length) % PATHS.length;
      onSelect(PATHS[next]);
      focusAt(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(PATHS[0]);
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = PATHS.length - 1;
      onSelect(PATHS[last]);
      focusAt(last);
    }
  };

  const meta: Record<
    Exclude<VisitorPath, null>,
    { icon: React.ReactNode; subtitle: string; tag?: string }
  > = {
    has_quote: {
      icon: <FileText className="h-5 w-5" />,
      subtitle: "Upload it and get a forensic audit",
      tag: "Most common",
    },
    getting_quotes: {
      icon: <Calculator className="h-5 w-5" />,
      subtitle: "Compare contractor pricing & terms",
    },
    researching: {
      icon: <Search className="h-5 w-5" />,
      subtitle: "Learn what a fair quote looks like",
    },
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Visitor type"
      onKeyDown={onKey}
      className="grid grid-cols-1 gap-3"
    >
      {PATHS.map((p, i) => {
        const isSelected = selected === p;
        const isFocusable = isSelected || (selected === null && i === focusedIdx);
        return (
          <PathCard
            key={p}
            icon={meta[p].icon}
            title={PATH_LABELS[p]}
            subtitle={meta[p].subtitle}
            tag={meta[p].tag}
            selected={isSelected}
            tabIndex={isFocusable ? 0 : -1}
            onClick={() => onSelect(p)}
          />
        );
      })}
    </div>
  );
}

function PillRadioGroup({
  selected,
  onSelect,
}: {
  selected: HomeType;
  onSelect: (h: Exclude<HomeType, null>) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const focusedIdx = Math.max(
    0,
    HOME_TYPES.findIndex((h) => h === selected)
  );

  const focusAt = (i: number) =>
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]
      ?.focus();

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = HOME_TYPES.findIndex((h) => h === selected);
    const idx = current < 0 ? 0 : current;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % HOME_TYPES.length;
      onSelect(HOME_TYPES[next]);
      focusAt(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (idx - 1 + HOME_TYPES.length) % HOME_TYPES.length;
      onSelect(HOME_TYPES[next]);
      focusAt(next);
    }
  };

  const icons: Record<Exclude<HomeType, null>, React.ReactNode> = {
    single_family: <Home className="h-3.5 w-3.5" />,
    townhome: <Building2 className="h-3.5 w-3.5" />,
    condo: <Building className="h-3.5 w-3.5" />,
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Home type"
      onKeyDown={onKey}
      className="grid grid-cols-3 gap-2"
    >
      {HOME_TYPES.map((h, i) => {
        const isSelected = selected === h;
        const isFocusable = isSelected || (selected === null && i === focusedIdx);
        return (
          <PillChoice
            key={h}
            icon={icons[h]}
            label={HOME_LABELS[h]}
            selected={isSelected}
            tabIndex={isFocusable ? 0 : -1}
            onClick={() => onSelect(h)}
          />
        );
      })}
    </div>
  );
}

function PathCard({
  icon,
  title,
  subtitle,
  tag,
  selected,
  tabIndex,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag?: string;
  selected: boolean;
  tabIndex: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onClick}
      className={[
        "group relative w-full text-left rounded-xl border px-4 py-4 motion-safe:transition-all motion-safe:duration-200 ease-out",
        "flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        selected
          ? "border-blue-400/40 bg-gradient-to-b from-blue-500/[0.12] to-blue-500/[0.04] motion-safe:translate-y-[2px] shadow-inner shadow-black/40"
          : "border-white/[0.07] bg-slate-950/40 hover:border-white/15 hover:bg-slate-900/60",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg motion-safe:transition-colors",
          selected
            ? "bg-blue-500/20 text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            : "bg-white/[0.04] text-slate-400 group-hover:text-slate-200",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-semibold text-white">{title}</span>
          {tag && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-300">
              {tag}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12.5px] text-slate-400">{subtitle}</div>
      </div>
      <div
        aria-hidden
        className={[
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border motion-safe:transition-colors",
          selected
            ? "border-blue-400 bg-blue-500"
            : "border-white/15 bg-transparent",
        ].join(" ")}
      >
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

function PillChoice({
  icon,
  label,
  selected,
  tabIndex,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  tabIndex: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-medium motion-safe:transition-all motion-safe:duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        selected
          ? "border-blue-400/40 bg-blue-500/[0.12] text-white motion-safe:translate-y-[1px] shadow-inner shadow-black/40"
          : "border-white/[0.07] bg-slate-950/40 text-slate-400 hover:border-white/15 hover:text-slate-200",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SecureField({
  label,
  type,
  value,
  placeholder,
  onChange,
  onBlur,
  touched,
  valid,
  typing,
  error,
  autoComplete,
  inputMode,
  maxLength,
  tracking,
}: {
  label: string;
  type: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  touched: boolean;
  valid: boolean;
  typing: boolean;
  error: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email";
  maxLength?: number;
  tracking?: boolean;
}) {
  const showError = touched && !valid;
  const lockColor = !value
    ? "text-slate-600"
    : typing
      ? "text-amber-400 motion-safe:animate-pulse"
      : valid
        ? "text-emerald-400"
        : "text-slate-600";

  return (
    <label className="group relative block">
      <div className="mb-1.5 text-[12px] font-medium text-slate-300">
        {label}
      </div>
      <div className="relative rounded-lg motion-safe:transition-shadow focus-within:ring-1 focus-within:ring-blue-400/50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 motion-safe:transition-opacity motion-safe:duration-300 group-focus-within:opacity-100"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 50%, rgba(59,130,246,0.12), transparent 70%)",
          }}
        />
        <div className="relative">
          <input
            type={type}
            autoComplete={autoComplete}
            inputMode={inputMode}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            aria-invalid={showError}
            className={[
              "w-full rounded-lg bg-slate-950/80 px-3.5 py-2.5 pr-9 text-[14px] text-white placeholder:text-slate-600 outline-none ring-0 border motion-safe:transition-colors focus:border-blue-400/40",
              tracking ? "tracking-wider" : "",
              showError
                ? "border-red-400/40"
                : "border-white/[0.06]",
            ].join(" ")}
          />
          <Lock
            className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 motion-safe:transition-colors ${lockColor}`}
          />
        </div>
      </div>
      {showError && (
        <div className="mt-1 text-[11px] text-red-400/80">{error}</div>
      )}
    </label>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="flex-1 truncate border-b border-dotted border-slate-800/80 text-slate-700">
        {"·".repeat(40)}
      </span>
      <span className="text-slate-200 truncate max-w-[60%] text-right">
        {value}
      </span>
    </div>
  );
}

/* ────────────────────────────── Branch Panels ────────────────────────────── */

function BranchPanel({
  path,
  caseId,
  name,
  zip,
  homeType,
  onBack,
}: {
  path: Exclude<VisitorPath, null>;
  caseId: string;
  name: string;
  zip: string;
  homeType: HomeType;
  onBack: () => void;
}) {
  const firstName = name.trim().split(/\s+/)[0] || "";
  const homeLabel = homeType ? HOME_LABELS[homeType] : "";

  return (
    <div className="relative mx-auto max-w-[920px] px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
      {/* Top utility bar */}
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 motion-safe:transition-colors hover:border-white/20 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <ArrowLeft className="h-3 w-3 motion-safe:transition-transform group-hover:-translate-x-0.5" />
          Edit my answers
        </button>
        <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.18em] text-slate-500">
          <Lock className="h-3 w-3 text-blue-400/70" />
          Case · {caseId}
        </div>
      </div>

      {path === "has_quote" && (
        <UploadIntentPanel firstName={firstName} />
      )}
      {path === "getting_quotes" && (
        <BaselinePanel firstName={firstName} zip={zip} homeLabel={homeLabel} />
      )}
      {path === "researching" && (
        <SampleReportPanel firstName={firstName} />
      )}

      <PreviewOnlyNote />
    </div>
  );
}

function PanelShell({
  eyebrow,
  heading,
  subcopy,
  children,
}: {
  eyebrow: string;
  heading: string;
  subcopy: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-9">
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-blue-300">
          <Sparkles className="h-3 w-3" /> {eyebrow}
        </div>
        <h2 className="text-[24px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[30px]">
          {heading}
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-slate-400">
          {subcopy}
        </p>
      </div>
      {children}
    </section>
  );
}

function PanelCTA({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(59,130,246,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] motion-safe:transition-all motion-safe:duration-200 hover:from-blue-400 hover:to-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <span className="relative flex items-center justify-center gap-2">
        {label}
        {icon}
      </span>
    </button>
  );
}

function PreviewOnlyNote() {
  return (
    <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-600">
      <span className="h-1 w-1 rounded-full bg-amber-400/70" />
      Visual preview only — wiring comes later
    </div>
  );
}

/* ─────── Path 1 — Upload intent ─────── */
function UploadIntentPanel({ firstName }: { firstName: string }) {
  return (
    <PanelShell
      eyebrow={firstName ? `Step 2 · ${firstName}` : "Step 2 · Scan"}
      heading="Ready to scan your quote"
      subcopy="Upload your estimate next and WindowMan will check pricing, missing scope, warranty traps, and code-risk signals."
    >
      {/* Dropzone mock */}
      <div className="relative rounded-xl border-2 border-dashed border-blue-400/25 bg-slate-950/60 px-6 py-10 text-center motion-safe:transition-colors hover:border-blue-400/40">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-blue-500/20 to-blue-600/10 text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <UploadCloud className="h-7 w-7" />
        </div>
        <div className="text-[15px] font-semibold text-white">
          Drop your quote here
        </div>
        <div className="mt-1 text-[12.5px] text-slate-400">
          or tap to browse — we'll do the rest
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {["PDF", "JPG", "PNG"].map((t) => (
            <span
              key={t}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-400"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <PanelCTA
          label="Continue to Quote Upload"
          icon={<ArrowRight className="h-4 w-4 motion-safe:transition-transform group-hover:translate-x-0.5" />}
        />
      </div>
    </PanelShell>
  );
}

/* ─────── Path 2 — Baseline ─────── */
function BaselinePanel({
  firstName,
  zip,
  homeLabel,
}: {
  firstName: string;
  zip: string;
  homeLabel: string;
}) {
  return (
    <PanelShell
      eyebrow={firstName ? `Step 2 · ${firstName}` : "Step 2 · Baseline"}
      heading="Build your fair-price baseline"
      subcopy="Before contractors come out, WindowMan can help you understand the range you should expect in your area."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryTile
          icon={<MapPin className="h-4 w-4" />}
          label="ZIP / County"
          value={zip ? `${zip} · South FL` : "—"}
        />
        <SummaryTile
          icon={<Home className="h-4 w-4" />}
          label="Project type"
          value={homeLabel || "—"}
        />
      </div>

      {/* Baseline preview card */}
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-slate-950/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="mb-3 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.18em] text-slate-500">
          <span>§ Baseline preview</span>
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            Live data
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Expected range
            </div>
            <div className="mt-1 text-[26px] font-semibold tracking-tight text-white">
              $1,180<span className="text-slate-500"> – </span>$1,640
            </div>
            <div className="mt-0.5 text-[12px] text-slate-400">per opening · installed</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Sample size
            </div>
            <div className="mt-1 font-mono text-[18px] text-blue-300">2,847</div>
          </div>
        </div>
        {/* faux distribution bar */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
          <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-mono uppercase tracking-wider text-slate-600">
          <span>Low</span>
          <span>Median</span>
          <span>High</span>
        </div>
      </div>

      <div className="mt-6">
        <PanelCTA
          label="Build My Baseline"
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>
    </PanelShell>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-slate-950/60 p-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="truncate text-[14px] font-semibold text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ─────── Path 3 — Sample Truth Report ─────── */
function SampleReportPanel({ firstName }: { firstName: string }) {
  return (
    <PanelShell
      eyebrow={firstName ? `Step 2 · ${firstName}` : "Step 2 · Demo"}
      heading="See how WindowMan works"
      subcopy="Preview a sample Truth Report so you know what risks WindowMan looks for before you upload your own quote."
    >
      {/* Sample report card */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="mb-4 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.18em] text-slate-500">
          <span>Sample · Truth Report</span>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-300">
            Demo
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Grade dial */}
          <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-400/20 to-amber-600/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_-4px_rgba(251,191,36,0.4)]">
            <div className="absolute inset-1 rounded-full border border-amber-400/30" />
            <div className="text-center">
              <div className="text-[28px] font-bold leading-none text-amber-300">C+</div>
              <div className="mt-0.5 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                Grade
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <PillarRow label="Safety & code" tone="amber" />
            <PillarRow label="Install scope" tone="emerald" />
            <PillarRow label="Price fairness" tone="red" />
            <PillarRow label="Warranty" tone="amber" />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-200/90">
          <span className="font-semibold text-red-300">3 red flags</span> · DP rating
          missing · permit handling unclear · deposit above market
        </div>
      </div>

      <div className="mt-6">
        <PanelCTA
          label="View Sample Truth Report"
          icon={<Eye className="h-4 w-4" />}
        />
      </div>
    </PanelShell>
  );
}

function PillarRow({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "red";
}) {
  const colors = {
    emerald: { bar: "bg-emerald-400", w: "w-[82%]" },
    amber: { bar: "bg-amber-400", w: "w-[55%]" },
    red: { bar: "bg-red-400", w: "w-[28%]" },
  }[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[88px] flex-shrink-0 text-[11px] text-slate-400">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full ${colors.bar} ${colors.w}`} />
      </div>
    </div>
  );
}

export default PreUploadIntake;
