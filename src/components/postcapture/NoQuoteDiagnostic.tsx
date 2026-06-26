import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Upload } from "lucide-react";
import { NO_QUOTE_DIAGNOSTIC } from "@/components/postcapture/postCaptureCopy";
import type { PostCapturePath } from "@/components/PostCaptureRouter";

/**
 * Sprint 2F-D no-quote quote-prep diagnostic.
 *
 * Frontend-only: a 3-question helper that ends on a "You're quote-ready" screen.
 * Answers live in local state only — never written to Supabase, never tracked,
 * never used as authorization. It never mounts UploadZone, never calls
 * start-upload-scan-session / scan-quote / capture-truth-gate-lead. The primary
 * CTA pivots back to the quote-ready upload path via onUploadNow, reusing the
 * existing contact-owned leadId/sessionId held by Index.tsx.
 */
export interface NoQuoteDiagnosticProps {
  onUploadNow: () => void;
  onSelectPath: (path: PostCapturePath) => void;
}

const C = NO_QUOTE_DIAGNOSTIC;

const optionClass =
  "group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/80 px-5 py-4 text-left font-body text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-md";
const primaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-body text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const linkBtnClass =
  "font-body text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

export default function NoQuoteDiagnostic({
  onUploadNow,
  onSelectPath,
}: NoQuoteDiagnosticProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showChecklist, setShowChecklist] = useState(false);

  const totalQuestions = C.questions.length;
  const isFinal = stepIndex >= totalQuestions;

  const handleAnswer = (questionId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      onSelectPath("router");
      return;
    }
    setStepIndex((prev) => prev - 1);
  };

  if (isFinal) {
    return (
      <div
        data-testid="post-capture-no-quote"
        className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-center shadow-sm"
        role="status"
      >
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h2
          data-testid="no-quote-quote-ready"
          className="mt-4 font-display text-2xl font-extrabold tracking-[0.01em] text-foreground sm:text-3xl"
        >
          {C.final.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
          {C.final.supporting}
        </p>
        <p className="mx-auto mt-2 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
          {C.final.secondarySupporting}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button type="button" onClick={onUploadNow} className={primaryCtaClass}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {C.final.primaryCta}
          </button>
          <button
            type="button"
            onClick={() => setShowChecklist((v) => !v)}
            className={linkBtnClass}
          >
            {C.final.secondaryCta}
          </button>
        </div>

        {showChecklist ? (
          <div className="mx-auto mt-5 max-w-xl rounded-xl border border-border/60 bg-background/60 p-5 text-left">
            <p className="font-display text-sm font-bold text-foreground">
              {C.final.checklistTitle}
            </p>
            <ul className="mt-3 space-y-2">
              {C.final.checklist.map((item) => (
                <li
                  key={item}
                  className="relative pl-5 font-body text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const question = C.questions[stepIndex];

  return (
    <div
      data-testid="post-capture-no-quote"
      className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border/60 bg-card/80 px-6 py-7 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">
          {C.intro.eyebrow}
        </p>
        <p className="font-mono text-[11px] font-medium text-muted-foreground">
          {stepIndex + 1} / {totalQuestions}
        </p>
      </div>

      <h2 className="mt-3 font-display text-xl font-extrabold leading-snug tracking-[0.01em] text-foreground sm:text-2xl">
        {question.prompt}
      </h2>

      <div className="mt-5 grid gap-3">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleAnswer(question.id, option)}
            className={optionClass}
            aria-label={option}
          >
            <span>{option}</span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleBack}
        className="mt-5 inline-flex items-center gap-1.5 font-body text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {stepIndex === 0 ? "Back to options" : "Back"}
      </button>
    </div>
  );
}
