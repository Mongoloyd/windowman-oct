import type {
  IntakeBucket,
  IntakeStep,
  ProjectSize,
  ThreatConcern,
  Timeline,
} from "./intakeTypes";

export const STEP_LABELS: Record<IntakeStep, string> = {
  intent: "Quote status",
  threat: "Concerns",
  projectSize: "Scope",
  interstitial: "Preparing",
  contact: "Contact",
  identity: "Identity",
  callIntent: "Walkthrough",
  timeline: "Timeline",
  handoff: "Next step",
};

export const INTENT_OPTIONS: Array<{
  label: string;
  bucket: IntakeBucket;
}> = [
  { label: "I already have a quote", bucket: "quote_ready" },
  { label: "I have one, but not with me", bucket: "quote_not_handy" },
  { label: "I'm getting quotes", bucket: "no_quote_yet" },
  { label: "I'm just researching", bucket: "researching" },
];

export const THREAT_OPTIONS: Array<{
  label: string;
  value: ThreatConcern;
}> = [
  { label: "Overpaying", value: "overpaying" },
  { label: "Choosing the wrong contractor", value: "wrong_contractor" },
  { label: "Missing scope or permit details", value: "missing_scope_or_permits" },
  { label: "Financing or payment terms", value: "financing_or_payment" },
  { label: "I'm not sure yet", value: "not_sure" },
];

export const PROJECT_SIZE_OPTIONS: Array<{
  label: string;
  value: ProjectSize;
}> = [
  { label: "1–5 openings", value: "1-5" },
  { label: "6–10 openings", value: "6-10" },
  { label: "11–20 openings", value: "11-20" },
  { label: "Whole house / not sure", value: "whole_house_or_not_sure" },
];

export const TIMELINE_OPTIONS: Array<{
  label: string;
  value: Timeline;
}> = [
  { label: "This week", value: "this_week" },
  { label: "This month", value: "this_month" },
  { label: "2–3 months", value: "2-3_months" },
  { label: "Just researching", value: "just_researching" },
];

export const INTERSTITIAL_LINES = [
  "Organizing your quote-check path…",
  "Preparing your buyer-protection file…",
  "Checking which route fits your situation…",
  "Mapping your next best step…",
] as const;

export const STEP_HEADLINES: Record<
  Exclude<IntakeStep, "interstitial" | "handoff">,
  string
> = {
  intent: "Where are you in the window quote process?",
  threat: "What worries you most before you sign anything?",
  projectSize: "How much window work are we looking at?",
  contact: "Where should WindowMan save your quote check?",
  identity: "Where should we send your reminder and findings?",
  callIntent: "Want a quick walkthrough?",
  timeline: "When are you trying to make a decision?",
};

export const CALL_INTENT_SUBCOPY =
  "Optional — you can finish by text or email instead.";

export const HANDOFF_VARIANTS: Record<
  IntakeBucket,
  { headline: string; body: string; primaryCta: string }
> = {
  quote_ready: {
    headline: "Your protection file is ready for your quote",
    body: "Upload your quote when you're ready. WindowMan will check scope, pricing signals, and fine print before you sign.",
    primaryCta: "Upload your quote now",
  },
  quote_not_handy: {
    headline: "We'll keep your file ready",
    body: "When your quote is handy, WindowMan can run the same checks before you commit.",
    primaryCta: "We'll remind you before you sign",
  },
  no_quote_yet: {
    headline: "Let's get you quote-ready",
    body: "We'll help you know what to ask for and what to watch for before contractors send numbers.",
    primaryCta: "Build my quote-ready plan",
  },
  researching: {
    headline: "See what WindowMan checks",
    body: "Even without a quote yet, you'll know the risk areas Florida homeowners miss most often.",
    primaryCta: "Show me what WindowMan checks",
  },
};

export const WANTS_CALL_HANDOFF = {
  headline: "A specialist walkthrough is noted",
  body: "We'll reach out with your next step. No live queue — you'll hear from us on your preferred channel.",
  primaryCta: "A quote specialist can walk you through it",
};

export const CONSENT_LABEL =
  "I agree WindowMan may contact me about my quote check by phone or text.";

export const FILE_HEADER_TITLE = "Buyer Protection File";
export const FILE_HEADER_SUBTITLE = "Guided quote-check setup";

export const TRUST_BADGES = [
  "Private setup",
  "No contractor obligation",
  "~90 seconds",
  "Quote-first guidance",
] as const;

export const INTENT_STEP_HELPER =
  "Start with where you are. WindowMan will route you to the right next step.";

export const PREVIEW_LAB_BANNER = "VISUAL LAB · MOCK INTAKE · NOT PRODUCTION FLOW";

/* ─── WindowMan Concierge identity ──────────────────────────────────────── */

export const CONCIERGE_NAME = "WindowMan Concierge";
export const CONCIERGE_TAGLINE = "Private quote-protection setup";

/** Compact status pills shown next to the Concierge identity. */
export const CONCIERGE_STATUS_BADGES = ["Guided", "Private", "~90 seconds"] as const;

/**
 * Optional warm lead-in line spoken by WindowMan before each question.
 * Kept short — the question itself stays in STEP_HEADLINES.
 */
export const CONCIERGE_LEADS: Partial<Record<IntakeStep, string>> = {
  intent: "Hi — I'm WindowMan. Let's set up a quick, private quote check.",
  threat: "Good to know. Now, the part that matters most:",
  projectSize: "Almost there on scope —",
  contact: "I'll keep this private and only use it for your quote check.",
  identity: "So your reminder and findings reach you —",
  callIntent: "One quick preference:",
  timeline: "Last question:",
};

/**
 * Per-bucket acknowledgement shown after intent is chosen.
 * Makes the Concierge feel responsive without changing flow order.
 */
export const BUCKET_ACK: Record<IntakeBucket, string> = {
  quote_ready: "Great — you already have a quote in hand.",
  quote_not_handy:
    "No problem. I can save your setup and remind you before you sign.",
  no_quote_yet: "Smart to check before the numbers land.",
  researching: "Good instinct to learn the risks early.",
};

/* ─── Quote-holder Fast-Pass (local-only presentation) ──────────────────── */

export const FAST_PASS = {
  eyebrow: "Quote in hand",
  headline: "You already have a quote — want WindowMan to check it now?",
  body: "I can take you straight to the quote check, or finish your protection setup first. Either works.",
  primaryCta: "Check my quote now",
  secondaryCta: "Finish setup first",
  helperCta: "Ask how this works",
  /** Shown under the buttons so the lab is honest about no navigation yet. */
  note: "Visual lab only — the quote check handoff is wired in a later sprint.",
} as const;

/* ─── Returning visitor (local, non-PII) ────────────────────────────────── */

export const RETURNING = {
  eyebrow: "Welcome back",
  body: "Want to pick up your quote-protection setup where you left off?",
  resumeCta: "Resume setup",
  freshCta: "Start fresh",
} as const;

/* ─── Helper / info-sheet trigger ───────────────────────────────────────── */

export const HELPER_TRIGGER_LABEL = "How does this work?";

export function getIntentLabel(bucket: IntakeBucket): string {
  return INTENT_OPTIONS.find((o) => o.bucket === bucket)?.label ?? "—";
}

export function getThreatLabel(value: ThreatConcern): string {
  return THREAT_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

export function getProjectSizeLabel(value: ProjectSize): string {
  return PROJECT_SIZE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}

export function getTimelineLabel(value: Timeline): string {
  return TIMELINE_OPTIONS.find((o) => o.value === value)?.label ?? "—";
}
