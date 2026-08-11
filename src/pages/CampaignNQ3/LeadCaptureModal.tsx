import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  formatTruthGatePhoneDisplay,
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
} from "@/lib/validation/truthGateContact";
import { isValidEmail, isValidName } from "@/utils/formatPhone";
import {
  isFloridaZip,
  NQ3_OPENING_RANGES,
  NQ3_PROJECT_TYPES,
  type LeadCaptureStep,
  type Nq3OpeningRange,
  type Nq3ProjectType,
  type OnSubmitLead,
} from "./types";

interface LeadCaptureModalProps {
  initialStep: 1 | 2;
  initialZip: string;
  onClose: () => void;
  onSubmitLead: OnSubmitLead;
}

export default function LeadCaptureModal({ initialStep, initialZip, onClose, onSubmitLead }: LeadCaptureModalProps) {
  const [step, setStep] = useState<LeadCaptureStep>(initialStep);
  const [zip, setZip] = useState(initialZip);
  const [projectType, setProjectType] = useState<Nq3ProjectType | "">("");
  const [openings, setOpenings] = useState<Nq3OpeningRange | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const focusTarget = step === 1 ? zipRef.current : step === 3 ? nameRef.current : modalRef.current?.querySelector<HTMLElement>("button");
    focusTarget?.focus();
  }, [step]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const continueFromZip = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFloridaZip(zip)) {
      setFieldError("Enter a valid 5-digit Florida ZIP code.");
      zipRef.current?.focus();
      return;
    }
    setFieldError("");
    setStep(2);
  };

  const continueFromProject = () => {
    if (!projectType || !openings) {
      setFieldError("Choose a project type and approximate number of openings.");
      return;
    }
    setFieldError("");
    setStep(3);
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");

    if (!projectType || !openings) {
      setFieldError("Choose a project type and approximate number of openings.");
      setStep(2);
      return;
    }
    if (!isValidName(name)) {
      setFieldError("Enter your first name.");
      nameRef.current?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!phone.trim() || !isValidTruthGatePhone(phone)) {
      setFieldError("Enter a valid 10-digit mobile number.");
      return;
    }

    const normalizedPhone = normalizeTruthGatePhoneToE164(phone);
    if (!normalizedPhone) {
      setFieldError("Enter a valid 10-digit mobile number.");
      return;
    }

    setFieldError("");
    setIsSubmitting(true);
    try {
      const result = await onSubmitLead({
        zip: zip.trim(),
        projectType,
        openings,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizedPhone,
      });
      if (result.ok) {
        setStep("done");
      } else {
        setSubmitError(result.message);
      }
    } catch {
      setSubmitError("We couldn't submit your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressStep = step === "done" ? 3 : Math.min(Math.max(step, 1), 3);

  return (
    <div
      className="overlay on"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nq3-modal-title"
        aria-describedby="nq3-modal-description"
        ref={modalRef}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modal-top">
          <div className="prog" aria-label={`Step ${progressStep} of 3`}>
            {[1, 2, 3].map((position) => <i className={position <= progressStep ? "on" : ""} key={position} />)}
          </div>
        </div>
        <div className="modal-body">
          {step === 1 && (
            <form onSubmit={continueFromZip} noValidate>
              <h3 id="nq3-modal-title">Where's the project?</h3>
              <p className="m-sub" id="nq3-modal-description">We serve homeowners across Florida. Your ZIP gives us the location context for your project.</p>
              <div className="field">
                <label htmlFor="nq3-modal-zip">Florida ZIP code</label>
                <input
                  id="nq3-modal-zip"
                  ref={zipRef}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 33139"
                  autoComplete="postal-code"
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? "nq3-modal-error" : undefined}
                  value={zip}
                  onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
                />
              </div>
              {fieldError && <p className="m-legal" id="nq3-modal-error" role="alert" style={{ color: "var(--bad)" }}>{fieldError}</p>}
              <button className="btn btn-primary" type="submit">Continue</button>
            </form>
          )}

          {step === 2 && (
            <div>
              <h3 id="nq3-modal-title">What are you replacing?</h3>
              <p className="m-sub" id="nq3-modal-description">This gives WindowMan the basic scope of your project.</p>
              <div className="field">
                <span id="nq3-project-type-label" style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--txt-2)", marginBottom: "7px", letterSpacing: ".02em" }}>Project type</span>
                <div className="opts" role="radiogroup" aria-labelledby="nq3-project-type-label" aria-describedby={fieldError ? "nq3-modal-error" : undefined}>
                  {NQ3_PROJECT_TYPES.map((option) => (
                    <button
                      className={`opt${projectType === option ? " sel" : ""}`}
                      type="button"
                      role="radio"
                      aria-checked={projectType === option}
                      key={option}
                      onClick={() => {
                        setProjectType(option);
                        setFieldError("");
                      }}
                      style={{ fontFamily: "inherit", color: projectType === option ? undefined : "inherit" }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field" style={{ marginTop: "16px" }}>
                <span id="nq3-openings-label" style={{ display: "block", fontSize: "12px", fontWeight: 650, color: "var(--txt-2)", marginBottom: "7px", letterSpacing: ".02em" }}>Roughly how many openings?</span>
                <div className="opts" role="radiogroup" aria-labelledby="nq3-openings-label" aria-describedby={fieldError ? "nq3-modal-error" : undefined}>
                  {NQ3_OPENING_RANGES.map((option) => (
                    <button
                      className={`opt${openings === option ? " sel" : ""}`}
                      type="button"
                      role="radio"
                      aria-checked={openings === option}
                      key={option}
                      onClick={() => {
                        setOpenings(option);
                        setFieldError("");
                      }}
                      style={{ fontFamily: "inherit", color: openings === option ? undefined : "inherit" }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              {fieldError && <p className="m-legal" id="nq3-modal-error" role="alert" style={{ color: "var(--bad)" }}>{fieldError}</p>}
              <button className="btn btn-primary" type="button" onClick={continueFromProject}>Continue</button>
              <button className="m-back" type="button" onClick={() => { setFieldError(""); setStep(1); }}>← Back</button>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={submitLead} noValidate>
              <h3 id="nq3-modal-title">Where should we send it?</h3>
              <p className="m-sub" id="nq3-modal-description">We'll text you the next step for your project in {zip || "your area"}.</p>
              <div className="field">
                <label htmlFor="nq3-first-name">First name</label>
                <input
                  id="nq3-first-name"
                  ref={nameRef}
                  placeholder="Your first name"
                  autoComplete="given-name"
                  aria-invalid={fieldError === "Enter your first name."}
                  aria-describedby={fieldError === "Enter your first name." ? "nq3-modal-error" : undefined}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="nq3-email">Email address</label>
                <input
                  id="nq3-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={fieldError === "Enter a valid email address."}
                  aria-describedby={fieldError === "Enter a valid email address." ? "nq3-modal-error" : undefined}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="nq3-phone">Mobile number</label>
                <input
                  id="nq3-phone"
                  inputMode="tel"
                  placeholder="(305) 555-0142"
                  autoComplete="tel"
                  aria-invalid={fieldError === "Enter a valid 10-digit mobile number."}
                  aria-describedby={fieldError === "Enter a valid 10-digit mobile number." ? "nq3-modal-error" : undefined}
                  value={phone}
                  onChange={(event) => setPhone(formatTruthGatePhoneDisplay(event.target.value))}
                />
              </div>
              {fieldError && <p className="m-legal" id="nq3-modal-error" role="alert" style={{ color: "var(--bad)" }}>{fieldError}</p>}
              {submitError && <p className="m-legal" role="alert" style={{ color: "var(--bad)" }}>{submitError}</p>}
              <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Get My Comparison"}
              </button>
              <button className="m-back" type="button" onClick={() => { setFieldError(""); setSubmitError(""); setStep(2); }}>← Back</button>
              <p className="m-legal">By continuing, you request help with your project and authorize WindowMan to contact you by call, text message, or email about that request and related support. This authorization does not include marketing. Message and data rates may apply. Reply STOP to opt out of texts. WindowMan is independent software — not an installing contractor.</p>
            </form>
          )}

          {step === "done" && (
            <div>
              <div className="done-ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3 id="nq3-modal-title" style={{ textAlign: "center" }}>You're in.</h3>
              <p className="m-sub" id="nq3-modal-description" style={{ textAlign: "center" }}>
                Your request for ZIP {zip} was saved. A WindowMan team member will text you shortly
                about the next step toward your estimate.
              </p>
              <button className="btn btn-ghost" type="button" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
