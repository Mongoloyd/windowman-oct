import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  type Answers,
  INITIAL_ANSWERS,
  type RoutingTier,
  computeRoutingTier,
  getOutcomeContent,
} from "../../lib/qualificationLogic";
import { PAGE_CONFIG } from "../../config/page.config";
import { createContractorLead } from "../../lib/contractors2/service";
import { supabase } from "@/integrations/supabase/client";
import StepCard from "./StepCard";
import OptionButton from "./OptionButton";
import CalendlyEmbed from "../ui/CalendlyEmbed";
import { useToast } from "@/hooks/use-toast";

interface QualificationFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 6;

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

function slideVariants(dir: number) {
  return {
    enter: { opacity: 0, x: dir > 0 ? 40 : -40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir > 0 ? -40 : 40 },
  };
}

const fadeScale = {
  enter: { opacity: 0, scale: 0.96 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

/** Map UI answers to contractor_leads columns */
function mapAnswersToLeadInput(answers: Answers) {
  return {
    service_area: answers.serviceArea || undefined,
    average_job_size_band: answers.jobSize ?? undefined,
    installs_regularly: answers.installVolume ?? undefined,
    response_speed: answers.responseSpeed ?? undefined,
    follow_up_consistency: answers.followUpBehavior ?? undefined,
    wants_quality_over_volume: answers.expectationAlignment ?? undefined,
  };
}

export default function QualificationFlow({ isOpen, onClose }: QualificationFlowProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [tier, setTier] = useState<RoutingTier | null>(null);
  const [lowTierEmail, setLowTierEmail] = useState("");
  const [lowTierSubmitted, setLowTierSubmitted] = useState(false);
  const [lowTierError, setLowTierError] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const { toast } = useToast();

  const reset = useCallback(() => {
    setStep(1);
    setDirection(1);
    setAnswers(INITIAL_ANSWERS);
    setTier(null);
    setLowTierEmail("");
    setLowTierSubmitted(false);
    setLowTierError("");
    setLeadId(null);
    setPersisting(false);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Step 5 auto-advance — persist lead during this "checking" pause
  useEffect(() => {
    if (step !== 5 || !isOpen || !tier) return;

    let cancelled = false;

    const persistLead = async () => {
      // Only persist for tiers that aren't BLOCK (BLOCK = no lead worth saving)
      if (tier === "BLOCK") {
        setTimeout(() => {
          if (!cancelled) {
            setDirection(1);
            setStep(6);
          }
        }, 1500);
        return;
      }

      setPersisting(true);
      try {
        // Create lead with qualification data (email will be added later for LOW tier)
        const lead = await createContractorLead({
          email: `pending-${Date.now()}@qualification.windowman.app`,
          ...mapAnswersToLeadInput(answers),
          source: "contractors2_page",
        });
        if (!cancelled) {
          setLeadId(lead.id);
        }
      } catch (err) {
        console.error("[QualificationFlow] Failed to persist lead:", err);
        // Non-fatal — still advance to step 6
      } finally {
        if (!cancelled) {
          setPersisting(false);
          setDirection(1);
          setStep(6);
        }
      }
    };

    // Small visual delay before persisting
    const t = setTimeout(persistLead, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, isOpen, tier, answers]);

  const updateAnswer = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const nav = (to: number, dir: 1 | -1) => {
    setDirection(dir);
    setStep(to);
  };

  /** Called when Calendly fires `calendly.event_scheduled` */
  const handleCalendlyScheduled = useCallback(async (eventData: Record<string, unknown>) => {
    if (!leadId) return;

    try {
      const { data, error } = await supabase.functions.invoke("contractor-booking-confirmed", {
        body: {
          lead_id: leadId,
          calendly_event_uri: (eventData.event as Record<string, unknown>)?.uri ?? null,
          calendly_invitee_uri: (eventData.invitee as Record<string, unknown>)?.uri ?? null,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message ?? data?.message ?? "Booking confirmation failed");
      }
      toast({ title: "Booking confirmed!", description: "We'll be in touch shortly." });
    } catch (err) {
      console.error("[QualificationFlow] Booking confirmation failed:", err);
      toast({
        title: "Booking confirmation failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  }, [leadId, toast]);

  if (!isOpen) return null;

  const vars = step === 6 ? fadeScale : slideVariants(direction);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            variants={vars}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
          >
            {step === 1 && <Step1 onNext={() => nav(2, 1)} />}
            {step === 2 && (
              <Step2
                answers={answers}
                updateAnswer={updateAnswer}
                onBack={() => nav(1, -1)}
                onNext={() => nav(3, 1)}
              />
            )}
            {step === 3 && (
              <Step3
                answers={answers}
                updateAnswer={updateAnswer}
                onBack={() => nav(2, -1)}
                onNext={() => nav(4, 1)}
              />
            )}
            {step === 4 && (
              <Step4
                answers={answers}
                onBack={() => nav(3, -1)}
                onSelect={(val) => {
                  const next = { ...answers, expectationAlignment: val };
                  setAnswers(next);
                  setTier(computeRoutingTier(next));
                  setDirection(1);
                  setStep(5);
                }}
              />
            )}
            {step === 5 && <Step5 />}
            {step === 6 && tier && (
              <Step6
                tier={tier}
                leadId={leadId}
                email={lowTierEmail}
                setEmail={setLowTierEmail}
                submitted={lowTierSubmitted}
                setSubmitted={setLowTierSubmitted}
                error={lowTierError}
                setError={setLowTierError}
                onStartOver={reset}
                onCalendlyScheduled={handleCalendlyScheduled}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-steps ────────────────────────────────────────────────────────── */

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <StepCard step={1} totalSteps={TOTAL_STEPS}>
      <h3 className="text-xl font-bold text-white mb-3">
        Let's See If This Is a Fit
      </h3>
      <p className="text-lg text-zinc-400 leading-relaxed mb-6">
        We only work with a limited number of contractors per area. This takes
        about 30 seconds.
      </p>
      <PrimaryBtn onClick={onNext}>Continue</PrimaryBtn>
    </StepCard>
  );
}

function Step2({
  answers,
  updateAnswer,
  onBack,
  onNext,
}: {
  answers: Answers;
  updateAnswer: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue =
    answers.serviceArea.trim().length > 0 && answers.jobSize !== null;

  return (
    <StepCard step={2} totalSteps={TOTAL_STEPS}>
      <h3 className="text-xl font-bold text-white mb-6">Your Market</h3>

      <label className="text-sm text-zinc-400 mb-2 block">
        City or county you serve
      </label>
      <input
        type="text"
        value={answers.serviceArea}
        onChange={(e) => updateAnswer("serviceArea", e.target.value)}
        className="w-full min-h-[48px] bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors text-sm mb-6"
        placeholder="e.g. Miami-Dade"
      />

      <label className="text-sm text-zinc-400 mb-3 block">
        Average job size
      </label>
      <div className="space-y-2 mb-6">
        {([
          ["Under $8k", "under8k"],
          ["$8k – $15k", "8to15k"],
          ["$15k – $25k", "15to25k"],
          ["$25k+", "25plus"],
        ] as const).map(([label, val]) => (
          <OptionButton
            key={val}
            label={label}
            selected={answers.jobSize === val}
            onClick={() => updateAnswer("jobSize", val)}
          />
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} disabled={!canContinue} />
    </StepCard>
  );
}

function Step3({
  answers,
  updateAnswer,
  onBack,
  onNext,
}: {
  answers: Answers;
  updateAnswer: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue =
    answers.responseSpeed !== null && answers.followUpBehavior !== null;

  return (
    <StepCard step={3} totalSteps={TOTAL_STEPS}>
      <h3 className="text-xl font-bold text-white mb-6">
        How You Handle Opportunities
      </h3>

      <p className="text-sm text-zinc-400 mb-3">
        How quickly can you call a new lead?
      </p>
      <div className="space-y-2 mb-6">
        {([
          ["Within 15 minutes", "under15min"],
          ["Within a few hours", "fewhours"],
          ["Same day", "sameday"],
          ["Next day or later", "nextday"],
        ] as const).map(([label, val]) => (
          <OptionButton
            key={val}
            label={label}
            selected={answers.responseSpeed === val}
            onClick={() => updateAnswer("responseSpeed", val)}
          />
        ))}
      </div>

      <p className="text-sm text-zinc-400 mb-3">
        Do you actively follow up?
      </p>
      <div className="space-y-2 mb-6">
        {([
          ["Yes, consistently", "consistent"],
          ["Sometimes", "sometimes"],
          ["Rarely", "rarely"],
        ] as const).map(([label, val]) => (
          <OptionButton
            key={val}
            label={label}
            selected={answers.followUpBehavior === val}
            onClick={() => updateAnswer("followUpBehavior", val)}
          />
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} disabled={!canContinue} />
    </StepCard>
  );
}

function Step4({
  answers,
  onBack,
  onSelect,
}: {
  answers: Answers;
  onBack: () => void;
  onSelect: (val: "quality" | "unsure" | "volume") => void;
}) {
  return (
    <StepCard step={4} totalSteps={TOTAL_STEPS}>
      <h3 className="text-xl font-bold text-white mb-4">
        This Is Different From Normal Lead Gen
      </h3>

      <ul className="space-y-3 mb-6">
        {[
          "You will get fewer opportunities than typical sources",
          "Each buyer already has quotes from competing contractors",
          "They are closer to deciding — not at the top of the funnel",
        ].map((b) => (
          <li key={b} className="flex items-start gap-3 text-zinc-400 text-sm">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <p className="text-sm text-zinc-400 mb-3">
        Does this align with what you're looking for?
      </p>
      <div className="space-y-2 mb-6">
        {([
          ["Yes — I want quality over volume", "quality"],
          ["Not sure yet", "unsure"],
          ["No — I need volume", "volume"],
        ] as const).map(([label, val]) => (
          <OptionButton
            key={val}
            label={label}
            selected={answers.expectationAlignment === val}
            onClick={() => onSelect(val)}
          />
        ))}
      </div>

      <button
        onClick={onBack}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← Back
      </button>
    </StepCard>
  );
}

function Step5() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin mb-4" />
      <p className="text-zinc-400">Checking territory availability...</p>
    </div>
  );
}

function Step6({
  tier,
  leadId,
  email,
  setEmail,
  submitted,
  setSubmitted,
  error,
  setError,
  onStartOver,
  onCalendlyScheduled,
}: {
  tier: RoutingTier;
  leadId: string | null;
  email: string;
  setEmail: (v: string) => void;
  submitted: boolean;
  setSubmitted: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  onStartOver: () => void;
  onCalendlyScheduled: (data: Record<string, unknown>) => void;
}) {
  const content = getOutcomeContent(tier);

  const handleLowSubmit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");

    try {
      if (leadId) {
        // Update existing lead with actual email
        await supabase
          .from("contractor_leads")
          .update({ email })
          .eq("id", leadId);
      } else {
        // Create new lead with just the email
        await createContractorLead({
          email,
          source: "contractors2_page",
        });
      }
    } catch (err) {
      console.error("[QualificationFlow] LOW tier email persist failed:", err);
    }

    setSubmitted(true);
  };

  return (
    <div className="bg-zinc-900/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm w-full max-w-lg mx-auto">
      <h3 className="text-xl font-bold text-white mb-3">{content.headline}</h3>
      <p className="text-lg text-zinc-400 leading-relaxed mb-6">
        {content.subhead}
      </p>

      {(tier === "HIGH" || tier === "MID") && (
        <>
          {tier === "MID" && content.note && (
            <p className="text-sm text-zinc-500 mb-4 italic">{content.note}</p>
          )}
          <CalendlyEmbed
            url={PAGE_CONFIG.calendly.url}
            height={600}
            onEventScheduled={onCalendlyScheduled}
          />
          <div className="mt-4">
            <a
              href={PAGE_CONFIG.phone.href}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Or call {PAGE_CONFIG.phone.display}
            </a>
          </div>
        </>
      )}

      {tier === "LOW" && (
        <>
          {content.bullets && (
            <ul className="space-y-2 mb-6">
              {content.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-zinc-400 text-sm">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          {!submitted ? (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="Your email"
                className="w-full min-h-[48px] bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors text-sm"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <PrimaryBtn onClick={handleLowSubmit}>Submit</PrimaryBtn>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">
              Got it. We'll reach out if this becomes a fit.
            </p>
          )}
        </>
      )}

      {tier === "BLOCK" && null}

      <button
        onClick={onStartOver}
        className="mt-6 text-xs text-zinc-600 hover:text-zinc-400 transition-colors block mx-auto"
      >
        Start Over
      </button>
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────────────────────── */

function PrimaryBtn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`inline-flex items-center justify-center bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-colors w-full ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
    >
      {children}
    </motion.button>
  );
}

function NavRow({
  onBack,
  onNext,
  disabled,
}: {
  onBack: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onBack}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        ← Back
      </button>
      <PrimaryBtn onClick={onNext} disabled={disabled}>
        Continue
      </PrimaryBtn>
    </div>
  );
}
