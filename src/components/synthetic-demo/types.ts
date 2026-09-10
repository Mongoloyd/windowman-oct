import type { MouseEventHandler, ReactNode, RefObject } from "react";

export type SyntheticDemoVariant = "xray" | "lens" | "challenge";
export interface SyntheticDemoAttribution {
  sourcePath: string;
  entryPoint: string;
}
export interface SyntheticDemoContact {
  firstName: string;
  email: string;
}
export interface SyntheticDemoHandoffContext {
  variant: SyntheticDemoVariant;
  attribution: SyntheticDemoAttribution;
  contact?: SyntheticDemoContact;
  demoLeadId?: string;
  demoSessionId?: string;
}
export interface SyntheticDemoCreateInput {
  contact: SyntheticDemoContact;
  variant: SyntheticDemoVariant;
  attribution: SyntheticDemoAttribution;
  fixtureId: string;
}
export interface SyntheticDemoIntake {
  status?: "Just researching options" | "Ready to get estimates soon" | "Already have a quote to check" | "Emergency replacement needed";
  property?: "Single-Family Home" | "Condo / Apartment" | "Townhouse" | "Commercial / Business";
  scope?: "1 to 5 Openings" | "6 to 10 Openings" | "11 to 15 Openings" | "16+ Openings";
  logistics?: "1st Floor Only — No HOA" | "Multi-Story Installation" | "HOA Approval Required" | "Multi-Story + HOA Required";
  timeline?: "Hurricane Protection / Immediate" | "Lower Insurance / 1-3 Months" | "Replacing Old Windows / Planning Ahead" | "New Construction / Just Researching";
}
/** One session per opening. Its identity belongs only to synthetic lead capture. */
export interface SyntheticDemoCaptureSession {
  readonly sessionId: string;
  create: (input: SyntheticDemoCreateInput) => Promise<unknown>;
  updateZip: (leadId: string, zip: string) => Promise<unknown>;
  updatePhone: (leadId: string, phone: string) => Promise<unknown>;
  updateIntake: (leadId: string, intake: SyntheticDemoIntake) => Promise<unknown>;
}
export interface SyntheticDemoCaptureClient {
  startSession: () => SyntheticDemoCaptureSession;
}
export interface SyntheticDemoProps {
  open: boolean;
  variant: SyntheticDemoVariant;
  attribution: SyntheticDemoAttribution;
  onOpenChange: (open: boolean) => void;
  onHasQuote: (context: SyntheticDemoHandoffContext) => void;
  onNoQuote: (context: SyntheticDemoHandoffContext) => void;
  captureClient?: SyntheticDemoCaptureClient;
  /** Optional when controlled directly; launchers supply their exact trigger. */
  openerRef?: RefObject<HTMLElement>;
  previewLabel?: string;
}
export type SyntheticDemoLauncherProps = Omit<SyntheticDemoProps, "open" | "onOpenChange" | "openerRef"> & {
  renderTrigger: (props: {
    onClick: MouseEventHandler<HTMLElement>;
    "aria-haspopup": "dialog";
    "aria-expanded": boolean;
  }) => ReactNode;
};
export type SignalId = "scope" | "warranty" | "fees";
export type AnswerId = "clarify" | "assume" | "later";
export interface DemoSignal {
  id: SignalId;
  label: string;
  quote: string;
  finding: string;
  explanation: string;
  question: string;
  challenge: string;
  answers: readonly { id: AnswerId; label: string; detail: string; coaching: string }[];
}
export interface VariantViewModel {
  step: number;
  signal: DemoSignal;
  revealed: boolean;
  revealedCount: number;
  answer?: AnswerId;
  reducedMotion: boolean;
  onReveal: () => void;
  onAnswer: (answer: AnswerId) => void;
  onNext: () => void;
  onPrevious: () => void;
  onPayoff: () => void;
  onHasQuote: () => void;
  /** Only supplied for static X-Ray; the engine owns close-first delivery. */
  onNoQuote?: () => void;
}
