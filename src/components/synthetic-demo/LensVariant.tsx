import { motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, FileCheck2 } from "lucide-react";
import type { CSSProperties } from "react";
import { SAMPLE_QUOTE } from "./fixture";
import { NextButton, Progress, QuoteEscape, SampleLabel } from "./VariantParts";
import type { VariantViewModel } from "./types";

const ESTIMATE_SIZE = { width: 1122, height: 1402 } as const;
// Clause centers measured in the approved, uncropped estimate image.
const CLAUSE_CENTERS = {
  scope: { x: 500, y: 563 },
  warranty: { x: 500, y: 864 },
  fees: { x: 500, y: 953 },
} satisfies Record<VariantViewModel["signal"]["id"], { x: number; y: number }>;

export default function LensVariant(view: VariantViewModel) {
  const center = CLAUSE_CENTERS[view.signal.id];
  const lensPosition = {
    "--sd-lens-x": `${center.x / ESTIMATE_SIZE.width * 100}%`,
    "--sd-lens-y": `${center.y / ESTIMATE_SIZE.height * 100}%`,
  } as CSSProperties;

  return <>
    <div className="sd-lens-progress sd-body-pad"><Progress step={view.step} variant="lens" completed={view.revealedCount} /><SampleLabel>Synthetic example</SampleLabel><p className="sd-micro">NOT A REAL CONTRACTOR QUOTE</p></div>
    <div className="sd-lens-scene" style={lensPosition}>
      <img className="sd-lens-document" src="/images/synthetic-demo/lens/estimate-bg.webp" alt="Fictional itemized estimate for six windows, with installation, manufacturer warranty, permit clauses, and a $12,930 sample total" width={ESTIMATE_SIZE.width} height={ESTIMATE_SIZE.height} />
      <motion.button type="button" className={`sd-lens-control ${view.revealed ? "is-inspected" : ""}`}
        data-step-focus
        onClick={view.onReveal} aria-label={`Inspect ${view.signal.label.toLowerCase()}`} aria-expanded={view.revealed}
        initial={view.reducedMotion ? false : { opacity: 0.85 }}
        animate={{ opacity: 1 }} key={view.signal.id}
        transition={{ duration: 0.3 }}>
        <span className="sd-lens-caption">DESCRIPTION / SCOPE</span>
        <span className="sd-lens-sheet" aria-hidden="true">
          {SAMPLE_QUOTE.signals.map((signal, index) => <span key={signal.id} className={`sd-lens-row ${index === view.step ? "is-active" : ""}`}>
            <span><strong>{index + 1}. {signal.label}</strong><span>“{signal.quote}”</span></span>
            <span className="sd-lens-note">{index === view.step ? <><AlertTriangle size={18} /><strong>{view.revealed ? signal.finding : "Look closer"}</strong><span>{view.revealed ? signal.explanation : "Tap this lens to inspect the clause."}</span></> : <span>Another detail<br />to make clear</span>}</span>
          </span>)}
        </span>
        <span className="sd-lens-reading" aria-live="polite">{view.revealed ? view.signal.finding : "Tap the lens to reveal this detail"}</span>
        <span className="sd-lens-dots" aria-hidden="true">{SAMPLE_QUOTE.signals.map((signal) => <i key={signal.id} className={signal.id === view.signal.id ? "is-active" : ""} />)}</span>
      </motion.button>
    </div>
    <section className="sd-body-pad sd-lens-actions">
      <div className="sd-direction-controls">
        <button type="button" disabled={view.step === 0} onClick={view.onPrevious}><ChevronLeft size={20} aria-hidden="true" />Previous signal</button>
        <button type="button" disabled={!view.revealed || view.step === 2} onClick={view.onNext}>Next signal<ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <div className="sd-takeaway"><FileCheck2 size={42} aria-hidden="true" /><div><small>HOMEOWNER TAKEAWAY</small><h2>3 questions to ask<br />before you sign</h2><p aria-live="polite">{view.revealed ? view.signal.question : "Turn unclear clauses into useful questions."}</p></div></div>
      <NextButton step={2} revealed={view.revealedCount === 3 && view.step === 2} onNext={view.onNext} onPayoff={view.onPayoff} />
      <QuoteEscape onClick={view.onHasQuote} label="Check my real quote instead" />
    </section>
  </>;
}
