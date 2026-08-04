/**
 * ScanLandingExperience — Sprint 2 local conversion prototype for `/scan`.
 *
 * Owns the local prototype state machine only. No file-content reading,
 * Supabase, Gemini, persistence, OTP, contractor network, or tracking.
 */

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import ScanHero from "./ScanHero";
import ScanUploadSurface, { SCAN_UPLOAD_SECTION_ID } from "./ScanUploadSurface";
import BlindReverseAuctionSection from "./BlindReverseAuctionSection";
import LeadCaptureModal from "./LeadCaptureModal";
import AnalysisSummaryModal from "./AnalysisSummaryModal";
import {
  ANALYSIS_DURATION_MS,
  ANALYSIS_STEPS,
  MULTI_FILE_NOTICE,
  validateEstimateSelection,
  type ScanPrototypeState,
  type SelectedEstimateMeta,
} from "./scanPrototypeModel";

const AUTHORITY_SIGNALS = ["QUOTE CLARITY", "REPEATABLE PROCESS", "NO OBLIGATION"] as const;

function AuthorityRibbon() {
  return (
    <section
      aria-labelledby="scan-authority-heading"
      className="border-b border-[#0B2545] bg-[#0B2545] px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <h2
          id="scan-authority-heading"
          className="text-center text-lg font-black uppercase leading-tight tracking-tight text-white sm:text-xl lg:text-left"
        >
          FREE TO HOMEOWNERS.{" "}
          <span className="text-[#49A5FF]">BUILT TO CREATE COMPETITION.</span>
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-0 gap-y-2">
          {AUTHORITY_SIGNALS.map((signal, index) => (
            <li key={signal} className="flex items-center">
              {index > 0 ? (
                <span
                  className="mx-3 hidden h-5 w-px bg-white/25 sm:block"
                  aria-hidden="true"
                />
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white/90">
                <Check className="h-3.5 w-3.5 text-[#49A5FF]" aria-hidden="true" />
                {signal}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AnalyzingOverlay({ stepIndex }: { stepIndex: number }) {
  const activeStep = ANALYSIS_STEPS[Math.min(stepIndex, ANALYSIS_STEPS.length - 1)];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#0B2545]/72 px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <h2 className="text-xl font-black uppercase tracking-tight text-[#0B2545] sm:text-2xl">
          BUILDING YOUR LEVERAGE MAP
        </h2>
        <ol className="mt-5 space-y-2.5">
          {ANALYSIS_STEPS.map((step, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li
                key={step}
                className={`flex items-center gap-2.5 text-sm ${
                  current
                    ? "font-semibold text-[#1878F0]"
                    : done
                      ? "text-slate-500"
                      : "text-slate-400"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    current
                      ? "bg-[#1878F0] text-white"
                      : done
                        ? "bg-slate-200 text-slate-600"
                        : "border border-slate-200 text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {step}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm font-medium text-[#0B2545]" aria-live="polite">
          {activeStep}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Local prototype: no document has been uploaded and example findings are used.
        </p>
      </div>
    </div>
  );
}

export default function ScanLandingExperience() {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const analysisTimersRef = useRef<number[]>([]);
  const analyzingLockRef = useRef(false);

  const [state, setState] = useState<ScanPrototypeState>("idle");
  const [selected, setSelected] = useState<SelectedEstimateMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [multiFileNotice, setMultiFileNotice] = useState<string | null>(null);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);

  function clearAnalysisTimers() {
    for (const id of analysisTimersRef.current) {
      window.clearTimeout(id);
    }
    analysisTimersRef.current = [];
    analyzingLockRef.current = false;
  }

  useEffect(() => {
    return () => {
      clearAnalysisTimers();
    };
  }, []);

  function resetToIdle() {
    clearAnalysisTimers();
    setState("idle");
    setSelected(null);
    setError(null);
    setMultiFileNotice(null);
    setAnalysisStepIndex(0);
  }

  function handleGetReview() {
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    document.getElementById(SCAN_UPLOAD_SECTION_ID)?.scrollIntoView?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    uploadInputRef.current?.focus({ preventScroll: true });
  }

  function handleFilesChosen(files: File[] | FileList | null) {
    if (state === "analyzing") return;

    const result = validateEstimateSelection(files);
    setMultiFileNotice(result.multiFile ? MULTI_FILE_NOTICE : null);

    if (result.ok === false) {
      setSelected(null);
      setError(result.error);
      setState("idle");
      return;
    }

    // Metadata only — File object is not retained after this handler returns.
    setSelected(result.meta);
    setError(null);
    setState("selected");
  }

  function handleRemove() {
    if (state === "analyzing") return;
    setSelected(null);
    setError(null);
    setMultiFileNotice(null);
    setState("idle");
  }

  function handleReview() {
    if (state !== "selected" || !selected || analyzingLockRef.current) return;

    analyzingLockRef.current = true;
    clearAnalysisTimers();
    setAnalysisStepIndex(0);
    setState("analyzing");

    const stepCount = ANALYSIS_STEPS.length;
    const stepMs = ANALYSIS_DURATION_MS / stepCount;

    for (let i = 1; i < stepCount; i += 1) {
      const id = window.setTimeout(() => {
        setAnalysisStepIndex(i);
      }, Math.round(stepMs * i));
      analysisTimersRef.current.push(id);
    }

    const completeId = window.setTimeout(() => {
      analyzingLockRef.current = false;
      analysisTimersRef.current = [];
      setState("lead_capture");
    }, ANALYSIS_DURATION_MS);
    analysisTimersRef.current.push(completeId);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <ScanHero
        onGetReview={handleGetReview}
        competitionStage={
          <ScanUploadSurface
            ref={uploadInputRef}
            selected={selected}
            error={error}
            multiFileNotice={multiFileNotice}
            reviewDisabled={state === "analyzing"}
            onFilesChosen={handleFilesChosen}
            onRemove={handleRemove}
            onReview={handleReview}
          />
        }
      />

      <AuthorityRibbon />

      <BlindReverseAuctionSection />

      <footer className="bg-muted px-4 py-8 sm:px-6">
        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
          WindowMan is an independent quote-review service. We are not the contractor or installer.
          Identifying homeowner and original-contractor details are removed before network sharing.
          Participating contractors decide whether they can beat the measured job.
        </p>
      </footer>

      {state === "analyzing" ? <AnalyzingOverlay stepIndex={analysisStepIndex} /> : null}

      <LeadCaptureModal
        open={state === "lead_capture"}
        onClose={() => {
          if (state === "lead_capture") setState("selected");
        }}
        onSubmitValid={() => {
          setState("summary");
        }}
      />

      <AnalysisSummaryModal
        open={state === "summary"}
        onClose={() => {
          if (state === "summary") setState("selected");
        }}
        onRunAnother={resetToIdle}
      />
    </main>
  );
}
