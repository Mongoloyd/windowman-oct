import type { IntakeBucket, IntakeStep, Timeline } from "./intakeTypes";

/* ─── Helper / info-sheet topics (read-only, never mutate intake state) ──── */

export type HelperTopic = {
  id: string;
  question: string;
  answer: string;
};

export const HELPER_TOPICS: HelperTopic[] = [
  {
    id: "how-it-works",
    question: "How does this work?",
    answer:
      "I guide you through a few quick questions, then assemble a private quote-protection setup. It's a guided setup — not a contractor form, and not a chatbot. Takes about 90 seconds.",
  },
  {
    id: "why-zip",
    question: "Why do you need my ZIP?",
    answer:
      "Your ZIP helps me line up the right local code and permit context for your area. It stays private and is only used for your quote check.",
  },
  {
    id: "why-phone",
    question: "Why my phone?",
    answer:
      "Your phone lets me save your quote check and send your next step. You're always in control — I only reach out about your quote check, with your consent.",
  },
  {
    id: "need-quote",
    question: "Do I need a quote right now?",
    answer:
      "Not at all. Whether you have a quote, will have one soon, or are just researching, I'll route you to the right next step.",
  },
  {
    id: "are-you-contractor",
    question: "Are you a contractor?",
    answer:
      "No. WindowMan is on your side as the buyer. I'm not a contractor and not a contractor directory — I help you protect yourself before you sign.",
  },
  {
    id: "after-submit",
    question: "What happens after I submit?",
    answer:
      "Your protection file is assembled and you choose the next step — upload your quote, get a reminder, or a quick walkthrough. There's no automatic contractor match.",
  },
];

/* ─── Returning-visitor local hints (NON-PII ONLY) ───────────────────────── */

export const SEEN_KEY = "wm_intake_seen_v1";
export const PROGRESS_KEY = "wm_intake_progress_v1";

/**
 * Local resume hint. Intentionally excludes ZIP / phone / first name / email.
 * No authorization, lead, or report state is ever implied or stored here.
 */
export type IntakeProgressHint = {
  step: IntakeStep;
  bucket: IntakeBucket | null;
  threat: string | null;
  projectSize: string | null;
  callIntent: "yes" | "no" | null;
  wantsCall: boolean;
  timeline: Timeline | null;
  ts: number;
};

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function markIntakeSeen(): void {
  safeStorage()?.setItem(SEEN_KEY, "1");
}

export function readIntakeProgress(): IntakeProgressHint | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IntakeProgressHint>;
    if (!parsed || typeof parsed.step !== "string") return null;
    // Only resume mid-flow — never from the very start or terminal screens.
    if (parsed.step === "intent" || parsed.step === "handoff") return null;
    return {
      step: parsed.step,
      bucket: parsed.bucket ?? null,
      threat: parsed.threat ?? null,
      projectSize: parsed.projectSize ?? null,
      callIntent: parsed.callIntent ?? null,
      wantsCall: Boolean(parsed.wantsCall),
      timeline: parsed.timeline ?? null,
      ts: typeof parsed.ts === "number" ? parsed.ts : Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeIntakeProgress(hint: IntakeProgressHint): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(hint));
  } catch {
    /* storage full / unavailable — non-fatal for a local hint */
  }
}

export function clearIntakeProgress(): void {
  safeStorage()?.removeItem(PROGRESS_KEY);
}
