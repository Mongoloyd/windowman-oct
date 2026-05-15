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
} from "lucide-react";

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
    <div className="min-h-screen bg-[#020617] text-slate-100 antialiased">
      {/* Ambient atmospheric layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-[600px] w-[600px] rounded-full bg-blue-500/[0.06] blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.05] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* SR-only live region */}
      <div role="status" aria-live="polite" className="sr-only">
        {liveMsg}
      </div>

      <div className="relative mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        {/* Header bar */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]">
              <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight text-white">
                WindowMan
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
                Forensic Audit System
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Secure intake · TLS
          </div>
        </div>

        {/* Title block + Case ID */}
        <div className="mb-8 max-w-2xl">
          <button
            type="button"
            onClick={handleCopyCaseId}
            aria-label={`Copy case ID ${caseId}`}
            className="group mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-blue-300 transition-all hover:border-blue-400/40 hover:bg-blue-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Lock className="h-3 w-3" />
            <span>Case · {caseId}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            )}
          </button>
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[36px]">
            Open your private case file.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            Tell us where you are in your window project. We'll prep a
            forensic-grade audit profile before you upload anything.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-slate-950/40 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.18em]">
              <span
                className={
                  step === 1 ? "text-blue-300" : "text-slate-500"
                }
              >
                01 · Intake
              </span>
              <span className="text-slate-700">›</span>
              <span
                className={
                  step === 2 ? "text-blue-300" : "text-slate-500"
                }
              >
                02 · Chain of Custody
              </span>
            </div>
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded px-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              )}
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                Step {step} of 2
              </span>
            </div>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 motion-safe:transition-all motion-safe:duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.5)]"
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
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
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
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIdx = Math.max(
    0,
    PATHS.findIndex((p) => p === selected)
  );

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = PATHS.findIndex((p) => p === selected);
    const idx = current < 0 ? 0 : current;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (idx + 1) % PATHS.length;
      onSelect(PATHS[next]);
      refs.current[next]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx - 1 + PATHS.length) % PATHS.length;
      onSelect(PATHS[next]);
      refs.current[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(PATHS[0]);
      refs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = PATHS.length - 1;
      onSelect(PATHS[last]);
      refs.current[last]?.focus();
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
            btnRef={(el) => (refs.current[i] = el)}
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIdx = Math.max(
    0,
    HOME_TYPES.findIndex((h) => h === selected)
  );

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = HOME_TYPES.findIndex((h) => h === selected);
    const idx = current < 0 ? 0 : current;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % HOME_TYPES.length;
      onSelect(HOME_TYPES[next]);
      refs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (idx - 1 + HOME_TYPES.length) % HOME_TYPES.length;
      onSelect(HOME_TYPES[next]);
      refs.current[next]?.focus();
    }
  };

  const icons: Record<Exclude<HomeType, null>, React.ReactNode> = {
    single_family: <Home className="h-3.5 w-3.5" />,
    townhome: <Building2 className="h-3.5 w-3.5" />,
    condo: <Building className="h-3.5 w-3.5" />,
  };

  return (
    <div
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
            ref={(el) => (refs.current[i] = el)}
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

const PathCard = ({
  ref,
  icon,
  title,
  subtitle,
  tag,
  selected,
  tabIndex,
  onClick,
}: {
  btnRef: (el: HTMLButtonElement | null) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag?: string;
  selected: boolean;
  tabIndex: number;
  onClick: () => void;
}) => {
  return (
    <button
      ref={btnRef}
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
};

const PillChoice = ({
  ref,
  icon,
  label,
  selected,
  tabIndex,
  onClick,
}: {
  btnRef: (el: HTMLButtonElement | null) => void;
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  tabIndex: number;
  onClick: () => void;
}) => {
  return (
    <button
      ref={btnRef}
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
};

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

export default PreUploadIntake;
