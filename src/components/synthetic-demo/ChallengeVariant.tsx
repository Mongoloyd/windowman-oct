import { ArrowRight, Check, Lightbulb, Target } from "lucide-react";
import { BackButton, Progress, QuoteEscape, SampleLabel } from "./VariantParts";
import type { VariantViewModel } from "./types";

export default function ChallengeVariant(view: VariantViewModel) {
  const choice = view.signal.answers.find((answer) => answer.id === view.answer);
  return <>
    <img className="sd-advisor-photo" src="/images/synthetic-demo/advisor-hero.webp" alt="An advisor and homeowner reviewing a fictional sample estimate together" width={1000} height={584} />
    <section className="sd-challenge-panel">
      <Progress step={view.step} variant="challenge" completed={view.revealedCount} />
      <SampleLabel>Sample scenario — fictional details</SampleLabel>
      <fieldset className="sd-question" key={view.signal.id}>
        <legend tabIndex={-1} data-step-focus>{view.signal.challenge}</legend>
        <p className="sd-question-help" id={`sd-help-${view.signal.id}`}>Choose one next step. You can change your answer.</p>
        <div className="sd-answers">
          {view.signal.answers.map((answer) => <label key={answer.id} className={`sd-answer ${answer.id === view.answer ? "is-selected" : ""}`}>
            <input type="radio" name={`sd-answer-${view.signal.id}`} value={answer.id} checked={view.answer === answer.id}
              aria-describedby={`sd-help-${view.signal.id}`} onChange={() => view.onAnswer(answer.id)} />
            <span><strong>{answer.label}</strong><small>{answer.detail}</small></span>
            {answer.id === view.answer ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
          </label>)}
        </div>
      </fieldset>
      <div className="sd-coaching" role="status">
        <Lightbulb aria-hidden="true" size={26} /><div><small>YOUR STRONGEST MOVE</small><strong>{choice?.coaching ?? "A clear question is a strong first move."}</strong><p>{choice ? "Use this question when you review a written estimate." : "Choose an answer to see the coaching."}</p></div>
        <span className="sd-catches"><Target aria-hidden="true" size={20} />{view.revealedCount} useful {view.revealedCount === 1 ? "question" : "questions"}</span>
      </div>
      <button type="button" className="sd-primary" disabled={!view.answer} onClick={view.step === 2 ? view.onPayoff : view.onNext}>
        {view.step === 2 ? "Build my 3-question checklist" : "Try the next question"}<ArrowRight aria-hidden="true" size={20} />
      </button>
      <QuoteEscape onClick={view.onHasQuote} label="I already have a quote" />
      <BackButton {...view} />
    </section>
  </>;
}
