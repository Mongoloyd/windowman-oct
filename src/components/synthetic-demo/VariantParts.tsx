import { ArrowRight, ChevronLeft, Check, AlertTriangle } from "lucide-react";
import type { VariantViewModel } from "./types";

export function Progress({ step, variant, completed }: { step: number; variant: "xray" | "lens" | "challenge"; completed: number }) {
  const label = variant === "xray" ? "Sample audit" : variant === "lens" ? "Sample risk sweep" : "Contract challenge";
  return <div className="sd-progress">
    <div className={`sd-progress-track ${variant === "challenge" ? "sd-progress-steps" : ""}`} aria-hidden="true">
      {[0, 1, 2].map((index) => <span key={index} className={index <= step ? "is-active" : ""}>
        {variant === "challenge" ? (index < completed && index < step ? <Check size={12} /> : index + 1) : null}
      </span>)}
    </div>
    <p aria-live="polite">{label} · {step + 1} of 3</p>
  </div>;
}
export function SampleLabel({ children = "Sample — not your quote" }: { children?: string }) {
  return <p className="sd-sample-label">{children}</p>;
}
export function Finding({ signal, revealed }: Pick<VariantViewModel, "signal" | "revealed">) {
  return <div className={`sd-finding ${revealed ? "is-revealed" : ""}`} aria-live="polite">
    <AlertTriangle aria-hidden="true" />
    <div><strong>{revealed ? signal.finding : "What is missing from this line?"}</strong>
      <p>{revealed ? `Ask: ${signal.question}` : "Tap the sample to look beneath the surface."}</p>
    </div>
  </div>;
}
export function NextButton({ step, revealed, onNext, onPayoff, lastLabel = "Reveal my question list" }: Pick<VariantViewModel, "step" | "revealed" | "onNext" | "onPayoff"> & { lastLabel?: string }) {
  return <button type="button" className="sd-primary" disabled={!revealed} onClick={step === 2 ? onPayoff : onNext}>
    {step === 2 ? lastLabel : "Check the next line"}<ArrowRight aria-hidden="true" size={22} />
  </button>;
}
export function QuoteEscape({ onClick, label = "I have a quote to upload" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="sd-escape" onClick={onClick}>{label}</button>;
}
export function BackButton({ step, onPrevious }: Pick<VariantViewModel, "step" | "onPrevious">) {
  return <button type="button" className="sd-back" onClick={onPrevious} disabled={step === 0}><ChevronLeft aria-hidden="true" size={20} />Back</button>;
}
