import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDiagnosticIntake } from "./diagnosis/hooks/useDiagnosticIntake";
import { ProgressIndicator } from "./diagnosis/components/ProgressIndicator";
import { StepIntake } from "./diagnosis/components/StepIntake";
import { StepDiagnosis } from "./diagnosis/components/StepDiagnosis";
import { StepPrescription } from "./diagnosis/components/StepPrescription";
import { SuccessScreen } from "./diagnosis/components/SuccessScreen";
import { MarketingSections } from "./diagnosis/components/MarketingSections";

const PAGE_BG = "linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)";

const Diagnosis = () => {
  const navigate = useNavigate();
  const intake = useDiagnosticIntake();

  // ── Hydration: pending ─────────────────────────────────────────────────────
  if (intake.hydrationStatus === "pending") {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-sans text-foreground"
        style={{ background: PAGE_BG }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Loading Your Diagnosis…</p>
        </div>
      </div>
    );
  }

  // ── Hydration: failed → safe empty state, route user back to start ─────────
  if (intake.hydrationStatus === "failed") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 font-sans text-foreground"
        style={{ background: PAGE_BG }}
      >
        <div className="max-w-md text-center bg-white/70 backdrop-blur-md rounded-2xl border border-border/60 p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold mb-3">Start from your report</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your Diagnosis Needs The Context From Your Unlocked Truth Report. Head Back To The Report and Tap The
            Primary CTA to Continue From There.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (intake.step === "success") {
    return (
      <SuccessScreen
        context={intake.context}
        activeConfig={intake.activeConfig}
        onReturn={intake.handleReturnToReport}
      />
    );
  }

  // ── Main render (hydrationStatus === 'ready') ─────────────────────────────
  return (
    <div
      ref={intake.pageTopRef}
      className="min-h-screen font-sans text-foreground selection:bg-cobalt/20 relative overflow-hidden"
      style={{ background: PAGE_BG }}
    >
      {/* Nav */}
      <nav className="border-b border-border/60 px-6 py-4 flex items-center justify-between sticky top-0 bg-white/70 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-xl"
            style={{
              background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)",
            }}
          >
            W
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight text-foreground">WindowMan</span>
        </div>
        <button
          onClick={intake.handleReturnToReport}
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Report
        </button>
      </nav>

      <ProgressIndicator stepNumber={intake.stepNumber} />

      {intake.step === "intake" && (
        <StepIntake context={intake.context} onSelectPrimary={intake.selectPrimaryDiagnosis} />
      )}

      {intake.step === "diagnosis" && intake.activeConfig && intake.primaryDiagnosis && (
        <StepDiagnosis
          activeConfig={intake.activeConfig}
          primaryDiagnosis={intake.primaryDiagnosis}
          secondaryClarifiers={intake.secondaryClarifiers}
          otherFreeText={intake.otherFreeText}
          windowStyles={intake.windowStyles}
          windowConcerns={intake.windowConcerns}
          frameMaterial={intake.frameMaterial}
          canAdvanceFromDiagnosis={intake.canAdvanceFromDiagnosis}
          onBack={intake.handleBack}
          onAdvance={intake.advanceToPrescription}
          setOtherFreeText={intake.setOtherFreeText}
          setFrameMaterial={intake.setFrameMaterial}
          toggleInArray={intake.toggleInArray}
          setSecondaryClarifiers={intake.setSecondaryClarifiers}
          setWindowStyles={intake.setWindowStyles}
          setWindowConcerns={intake.setWindowConcerns}
        />
      )}

      {intake.step === "prescription" && intake.activeConfig && intake.primaryDiagnosis && (
        <StepPrescription
          activeConfig={intake.activeConfig}
          primaryDiagnosis={intake.primaryDiagnosis}
          context={intake.context}
          secondaryClarifiers={intake.secondaryClarifiers}
          otherFreeText={intake.otherFreeText}
          windowStyles={intake.windowStyles}
          windowConcerns={intake.windowConcerns}
          frameMaterial={intake.frameMaterial}
          counterOfferTerms={intake.counterOfferTerms}
          counterOfferFreeText={intake.counterOfferFreeText}
          hasCounterOffer={intake.hasCounterOffer}
          isSubmitting={intake.isSubmitting}
          onBack={intake.handleBack}
          onContactEdit={intake.handleContactEdit}
          onSubmit={intake.handleSubmit}
          setCounterOfferFreeText={intake.setCounterOfferFreeText}
          setCounterOfferTerms={intake.setCounterOfferTerms}
          toggleInArray={intake.toggleInArray}
        />
      )}

      {intake.step === "intake" && <MarketingSections />}

      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border/50 relative z-10">
        <p>&copy; {new Date().getFullYear()} WindowMan. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Diagnosis;
