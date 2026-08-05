/**
 * ScanLandingExperience — `/scan` conversion surface with real upload + scanner bridge.
 *
 * Lead contact remains local until Sprint 3B. No OTP, full report, or tracking.
 */

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import ScanHero from "./ScanHero";
import ScanUploadSurface, { SCAN_UPLOAD_SECTION_ID } from "./ScanUploadSurface";
import BlindReverseAuctionSection from "./BlindReverseAuctionSection";
import LeadCaptureModal from "./LeadCaptureModal";
import AnalysisSummaryModal from "./AnalysisSummaryModal";
import {
  MULTI_FILE_NOTICE,
  validateEstimateSelection,
  type SelectedEstimateMeta,
} from "./scanPrototypeModel";
import { useRealScanBridge } from "./useRealScanBridge";

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

function ScanProgressOverlay({ label }: { label: string }) {
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
        <p className="mt-4 text-sm font-medium text-[#1878F0]" aria-live="polite">
          {label}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          WindowMan is securing and scanning your estimate through the live scanner pipeline.
        </p>
      </div>
    </div>
  );
}

export default function ScanLandingExperience() {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const scanStartRef = useRef(false);
  const bridge = useRealScanBridge();

  const [selected, setSelected] = useState<SelectedEstimateMeta | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [multiFileNotice, setMultiFileNotice] = useState<string | null>(null);

  const displayError = validationError ?? bridge.error;
  const showProgressOverlay =
    bridge.phase === "uploading" ||
    bridge.phase === "bootstrapping" ||
    bridge.phase === "processing" ||
    bridge.phase === "preview_loading";

  function resetToIdle() {
    bridge.resetAll();
    setSelected(null);
    setValidationError(null);
    setMultiFileNotice(null);
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
    if (bridge.busy) return;

    const result = validateEstimateSelection(files);
    setMultiFileNotice(result.multiFile ? MULTI_FILE_NOTICE : null);

    if (result.ok === false) {
      bridge.releaseSelectedFile();
      setSelected(null);
      setValidationError(result.error);
      return;
    }

    const file = Array.isArray(files) ? files[0] : files?.[0];
    if (!file) return;

    bridge.holdSelectedFile(file);
    setSelected(result.meta);
    setValidationError(null);
  }

  function handleRemove() {
    if (bridge.busy) return;
    bridge.releaseSelectedFile();
    setSelected(null);
    setValidationError(null);
    setMultiFileNotice(null);
    bridge.resetAll();
  }

  function handleReview() {
    if (!selected || bridge.busy || scanStartRef.current) return;
    scanStartRef.current = true;
    void bridge.beginScan().finally(() => {
      scanStartRef.current = false;
    });
  }

  const selectedFootnote =
    bridge.phase === "uploading" ||
    bridge.phase === "bootstrapping" ||
    bridge.phase === "processing" ||
    bridge.phase === "preview_loading"
      ? "Scan in progress on this device."
      : "Selected on this device.";

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <ScanHero
        onGetReview={handleGetReview}
        competitionStage={
          <ScanUploadSurface
            ref={uploadInputRef}
            selected={selected}
            error={displayError}
            multiFileNotice={multiFileNotice}
            reviewDisabled={!selected || bridge.busy}
            selectedFootnote={selectedFootnote}
            onFilesChosen={handleFilesChosen}
            onRemove={handleRemove}
            onReview={handleReview}
            onRetryScan={
              bridge.canRetryScan ? () => void bridge.retryScan() : undefined
            }
            onStartOver={bridge.canChooseAnother ? resetToIdle : undefined}
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

      {showProgressOverlay && bridge.progressLabel ? (
        <ScanProgressOverlay label={bridge.progressLabel} />
      ) : null}

      <LeadCaptureModal
        open={bridge.phase === "lead_capture"}
        onClose={bridge.closeLeadModal}
        onSubmitValid={() => {
          bridge.openSummaryFromLead();
        }}
      />

      {bridge.livePreview ? (
        <AnalysisSummaryModal
          open={bridge.phase === "summary"}
          preview={bridge.livePreview}
          onClose={bridge.closeSummaryModal}
          onRunAnother={resetToIdle}
        />
      ) : null}
    </main>
  );
}
