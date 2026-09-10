import { useEffect, useReducer, useRef, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileCheck2 } from "lucide-react";
import SyntheticDemoDialog from "./SyntheticDemoDialog";
import { SAMPLE_QUOTE } from "./fixture";
import { demoReducer, initialDemoState, validContact } from "./reducer";
import { VARIANT_RENDERERS } from "./variantRenderers";
import { QuoteEscape, SampleLabel } from "./VariantParts";
import type { SyntheticDemoCaptureSession, SyntheticDemoHandoffContext, SyntheticDemoProps } from "./types";
import "./synthetic-demo.css";

export default function SyntheticDemo({ open, variant, attribution, onOpenChange, onHasQuote, onNoQuote, captureClient, openerRef, previewLabel }: SyntheticDemoProps) {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialDemoState);
  const sessionRef = useRef<SyntheticDemoCaptureSession | null>(null);
  const submittingRef = useRef(false);
  const deliveredRef = useRef(false);
  const payoffRef = useRef<HTMLHeadingElement>(null);
  const formHeadingRef = useRef<HTMLHeadingElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef(0);
  const reducedMotion = useReducedMotion() === true;

  useEffect(() => {
    let active = true;
    deliveredRef.current = false;
    submittingRef.current = false;
    if (!open) { dispatch({ type: "CLOSE" }); return; }
    // The QA client takes this branch without even loading production transport.
    const client = captureClient ? Promise.resolve(captureClient)
      : import("./productionCaptureClient").then((module) => module.productionCaptureClient);
    void client.then((resolved) => {
      if (!active) return;
      sessionRef.current = resolved.startSession();
      dispatch({ type: "OPEN", sessionId: sessionRef.current.sessionId, variant });
    }).catch(() => { if (active) dispatch({ type: "OPEN_FAILED" }); });
    return () => { active = false; sessionRef.current = null; submittingRef.current = false; };
  }, [open, captureClient, variant]);

  useEffect(() => {
    if (state.phase === "value_revealed") payoffRef.current?.focus();
    if (state.phase === "capturing") formHeadingRef.current?.focus();
  }, [state.phase]);

  useEffect(() => {
    if (state.captureStatus === "saved") savedRef.current?.focus();
  }, [state.captureStatus]);

  useEffect(() => {
    if (state.phase === "interacting" && previousStepRef.current !== state.step) {
      interactionRef.current?.querySelector<HTMLElement>("[data-step-focus]")?.focus({ preventScroll: true });
    }
    previousStepRef.current = state.step;
  }, [state.step, state.phase]);

  const close = () => { dispatch({ type: "CLOSE" }); onOpenChange(false); };
  const afterClose = () => {
    if (state.phase !== "handoff" || !state.handoff || deliveredRef.current) return;
    deliveredRef.current = true;
    const context: SyntheticDemoHandoffContext = {
      variant, attribution: { sourcePath: attribution.sourcePath, entryPoint: attribution.entryPoint },
      ...(state.lead ? { contact: { ...state.contact }, demoLeadId: state.lead.leadId, demoSessionId: state.lead.sessionId } : {}),
    };
    onOpenChange(false);
    if (state.handoff === "no_quote" || state.handoff === "xray_no_quote_escape") onNoQuote(context); else onHasQuote(context);
  };
  const capture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.phase !== "capturing" || state.lead || submittingRef.current || !sessionRef.current) return;
    dispatch({ type: "SUBMIT_CAPTURE" });
    if (!validContact(state.contact)) return;
    submittingRef.current = true;
    const session = sessionRef.current;
    try {
      const result = await session.create({ contact: { ...state.contact }, variant,
        attribution: { sourcePath: attribution.sourcePath, entryPoint: attribution.entryPoint }, fixtureId: SAMPLE_QUOTE.id });
      if (sessionRef.current === session) dispatch({ type: "CAPTURE_RESULT", result, sessionId: session.sessionId });
    } catch {
      if (sessionRef.current === session) dispatch({ type: "CAPTURE_FAILED", sessionId: session.sessionId });
    } finally { if (sessionRef.current === session) submittingRef.current = false; }
  };
  const Renderer = VARIANT_RENDERERS[variant];
  const signal = SAMPLE_QUOTE.signals[state.step];
  const showPayoff = state.phase === "value_revealed" || state.phase === "capturing";
  return <SyntheticDemoDialog open={open && state.phase !== "handoff"} variant={variant} onOpenChange={(next) => { if (!next) close(); }}
    openerRef={openerRef} onAfterClose={afterClose} previewLabel={previewLabel}>
    {state.phase === "idle" ? <div className="sd-body-pad sd-loading" role={state.captureError ? "alert" : "status"}>
      {state.captureError ?? "Opening your sample…"}
    </div> : null}
    {state.phase === "interacting" ? <div ref={interactionRef}><Renderer
      step={state.step} signal={signal} revealed={state.revealed.includes(signal.id)} revealedCount={state.revealed.length}
      answer={state.answers[signal.id]} reducedMotion={reducedMotion}
      onReveal={() => dispatch({ type: "REVEAL" })} onAnswer={(answer) => dispatch({ type: "ANSWER", answer })}
      onNext={() => dispatch({ type: "NEXT" })} onPrevious={() => dispatch({ type: "PREVIOUS" })}
      onPayoff={() => dispatch({ type: "REVEAL_VALUE" })} onHasQuote={() => dispatch({ type: "HANDOFF", target: "has_quote_escape" })}
      onNoQuote={variant === "xray" ? () => dispatch({ type: "XRAY_NO_QUOTE_HANDOFF" }) : undefined}
    /></div> : null}
    {showPayoff ? <motion.section className="sd-payoff sd-body-pad" initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
      <SampleLabel>Sample takeaways — yours to use</SampleLabel>
      <FileCheck2 className="sd-payoff-icon" aria-hidden="true" size={38} />
      <h2 ref={payoffRef} tabIndex={-1}>Three better questions.<br />One stronger estimate.</h2>
      <p>You have seen the gaps in this fictional example. Here is your checklist for a real conversation.</p>
      <ol className="sd-checklist">{SAMPLE_QUOTE.signals.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.question}</span></li>)}</ol>
      {state.phase === "value_revealed" ? <>
        <button className="sd-primary" type="button" onClick={() => dispatch({ type: "BEGIN_CAPTURE" })}>Save my next step<ArrowRight aria-hidden="true" size={20} /></button>
        <p className="sd-optional">Optional. The questions above are already yours to use.</p>
      </> : null}
      {state.phase === "capturing" && state.captureStatus !== "saved" ? <form className="sd-contact" onSubmit={capture} noValidate>
        <h3 ref={formHeadingRef} tabIndex={-1}>Where should we start?</h3>
        <p>Save your details with WindowMan, then choose help with an estimate or a quote you already have.</p>
        <label htmlFor="sd-first-name">First name</label>
        <input id="sd-first-name" name="given-name" autoComplete="given-name" maxLength={100} value={state.contact.firstName} disabled={state.captureStatus === "saving"}
          onChange={(event) => dispatch({ type: "EDIT_CONTACT", field: "firstName", value: event.target.value })} />
        <label htmlFor="sd-email">Email address</label>
        <input id="sd-email" name="email" type="email" autoComplete="email" maxLength={255} value={state.contact.email} disabled={state.captureStatus === "saving"}
          aria-describedby={state.captureError ? "sd-capture-error" : undefined}
          onChange={(event) => dispatch({ type: "EDIT_CONTACT", field: "email", value: event.target.value })} />
        {state.captureError ? <p id="sd-capture-error" className="sd-error" role="alert">{state.captureError}</p> : null}
        <button className="sd-primary" type="submit" disabled={state.captureStatus === "saving"}>{state.captureStatus === "saving" ? "Saving…" : "Save my details"}<ArrowRight aria-hidden="true" size={20} /></button>
      </form> : null}
      {state.captureStatus === "saved" ? <div ref={savedRef} tabIndex={-1} className="sd-saved" role="status"><CheckCircle2 aria-hidden="true" /><div><strong>Your details are saved.</strong><p>Choose what you would like to do next.</p></div></div> : null}
      {state.captureStatus !== "saving" && state.captureStatus !== "error" ? <div className="sd-handoff-actions">
        <button className="sd-secondary" type="button" onClick={() => dispatch({ type: "HANDOFF", target: "has_quote" })}>Check my written estimate<ArrowRight aria-hidden="true" size={19} /></button>
        <button className="sd-secondary" type="button" onClick={() => dispatch({ type: "HANDOFF", target: "no_quote" })}>Help me request an estimate<ArrowRight aria-hidden="true" size={19} /></button>
      </div> : null}
      <QuoteEscape onClick={() => dispatch({ type: "HANDOFF", target: "has_quote_escape" })} label="I already have a quote — continue now" />
      <button className="sd-back" type="button" onClick={close}>Keep exploring on my own</button>
    </motion.section> : null}
  </SyntheticDemoDialog>;
}
