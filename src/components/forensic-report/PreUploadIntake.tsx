import { useState, useEffect } from "react";
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
  CheckCircle2,
} from "lucide-react";

/**
 * PreUploadIntake — Phase 4L.9 visual harness.
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

export function PreUploadIntake() {
  const [selectedPath, setSelectedPath] = useState<VisitorPath>(null);
  const [homeType, setHomeType] = useState<HomeType>(null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Improvement #1 — sync quoteStatus from the visitor path so users don't
  // re-answer the same question.
  useEffect(() => {
    if (selectedPath) setQuoteStatus(PATH_TO_QUOTE_STATUS[selectedPath]);
  }, [selectedPath]);

  const canContinue =
    selectedPath !== null &&
    homeType !== null &&
    name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(email) &&
    /^\d{5}$/.test(zip);

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

        {/* Title block */}
        <div className="mb-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/[0.08] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-blue-300">
            <Lock className="h-3 w-3" /> Step 1 of 2 · Identity
          </div>
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[36px]">
            Open your private case file.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
            Tell us where you are in your window project. We'll prep a
            forensic-grade audit profile before you upload anything.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr]">
          {/* ──────────────── ZONE A — Visitor segmentation ──────────────── */}
          <section
            aria-labelledby="zone-a-heading"
            className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-7"
          >
            <header className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                <span className="h-px w-6 bg-slate-600" /> Visitor type
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

            <div
              role="radiogroup"
              aria-label="Visitor type"
              className="grid grid-cols-1 gap-3"
            >
              <PathCard
                icon={<FileText className="h-5 w-5" />}
                title="I have a quote"
                subtitle="Upload it and get a forensic audit"
                tag="Most common"
                selected={selectedPath === "has_quote"}
                onClick={() => setSelectedPath("has_quote")}
              />
              <PathCard
                icon={<Calculator className="h-5 w-5" />}
                title="I'm getting quotes"
                subtitle="Compare contractor pricing & terms"
                selected={selectedPath === "getting_quotes"}
                onClick={() => setSelectedPath("getting_quotes")}
              />
              <PathCard
                icon={<Search className="h-5 w-5" />}
                title="I'm just researching"
                subtitle="Learn what a fair quote looks like"
                selected={selectedPath === "researching"}
                onClick={() => setSelectedPath("researching")}
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
            className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-7"
          >
            <header className="mb-5">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                <span className="h-px w-6 bg-slate-600" /> Identity
              </div>
              <h2
                id="zone-b-heading"
                className="text-[20px] font-semibold tracking-tight text-white"
              >
                Set up your case file
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                Your case file will be encrypted and used to benchmark your
                quote against current South Florida market indices.
              </p>
            </header>

            <div className="space-y-4">
              {/* Name */}
              <FieldShell label="Full name">
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maria Gonzalez"
                  className="w-full rounded-lg bg-slate-950/80 px-3.5 py-2.5 text-[14px] text-white placeholder:text-slate-600 outline-none ring-0 border border-white/[0.06] transition-colors focus:border-blue-400/40"
                />
              </FieldShell>

              {/* Email */}
              <FieldShell label="Email">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-lg bg-slate-950/80 px-3.5 py-2.5 text-[14px] text-white placeholder:text-slate-600 outline-none ring-0 border border-white/[0.06] transition-colors focus:border-blue-400/40"
                />
              </FieldShell>

              {/* Zip */}
              <FieldShell label="Project Zip (for Local Building Codes/NOA verification)">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zip}
                  onChange={(e) =>
                    setZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  placeholder="33073"
                  className="w-full rounded-lg bg-slate-950/80 px-3.5 py-2.5 text-[14px] tracking-wider text-white placeholder:text-slate-600 outline-none ring-0 border border-white/[0.06] transition-colors focus:border-blue-400/40"
                />
              </FieldShell>

              {/* Home type — segmented pills */}
              <div>
                <div className="mb-1.5 text-[12px] font-medium text-slate-300">
                  Home type
                </div>
                <div
                  role="radiogroup"
                  aria-label="Home type"
                  className="grid grid-cols-3 gap-2"
                >
                  <PillChoice
                    icon={<Home className="h-3.5 w-3.5" />}
                    label="Single family"
                    selected={homeType === "single_family"}
                    onClick={() => setHomeType("single_family")}
                  />
                  <PillChoice
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Townhome"
                    selected={homeType === "townhome"}
                    onClick={() => setHomeType("townhome")}
                  />
                  <PillChoice
                    icon={<Building className="h-3.5 w-3.5" />}
                    label="Condo"
                    selected={homeType === "condo"}
                    onClick={() => setHomeType("condo")}
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-6">
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setSubmitted(true)}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(59,130,246,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 hover:from-blue-400 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {submitted ? (
                    <>
                      <CheckCircle2 className="h-4.5 w-4.5" /> Case file opened
                    </>
                  ) : (
                    <>
                      Continue to upload
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

function PathCard({
  icon,
  title,
  subtitle,
  tag,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "group relative w-full text-left rounded-xl border px-4 py-4 transition-all duration-200 ease-out",
        "flex items-center gap-4",
        selected
          ? "border-blue-400/40 bg-gradient-to-b from-blue-500/[0.12] to-blue-500/[0.04] translate-y-[2px] shadow-inner shadow-black/40"
          : "border-white/[0.07] bg-slate-950/40 hover:border-white/15 hover:bg-slate-900/60",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
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
          "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-medium transition-all duration-200 ease-out",
        selected
          ? "border-blue-400/40 bg-blue-500/[0.12] text-white translate-y-[1px] shadow-inner shadow-black/40"
          : "border-white/[0.07] bg-slate-950/40 text-slate-400 hover:border-white/15 hover:text-slate-200",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="group relative block">
      <div className="mb-1.5 text-[12px] font-medium text-slate-300">
        {label}
      </div>
      <div className="relative rounded-lg focus-within:ring-1 focus-within:ring-blue-400/50 transition-shadow">
        {/* faint blue radial glow behind active input */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 50%, rgba(59,130,246,0.12), transparent 70%)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </label>
  );
}

export default PreUploadIntake;
