/**
 * Sprint 2F-C post-capture intent router copy.
 *
 * Calm, national, consumer-advocate tone. This is acquisition guidance after a
 * trusted contact-owned lead/session already exists — never a permission wall.
 * Intentionally free of mechanical funnel or gate-style wording.
 */
export const POST_CAPTURE_ROUTER_COPY = {
  headline: "You're in. What are you working with?",
  supporting:
    "Pick the option that fits today. We'll keep your quote check and results together.",
  cards: {
    upload: {
      title: "I have my quote",
      subcopy: "Upload it now for a private WindowMan scan.",
      cta: "Upload my quote",
    },
    upload_later: {
      title: "I have a quote, but not here",
      subcopy:
        "Save your spot and come back when the estimate is on this device.",
      cta: "Save my spot",
    },
    no_quote: {
      title: "I don't have a quote yet",
      subcopy:
        "Get quote-ready before a contractor puts numbers in front of you.",
      cta: "Show me what to check",
    },
  },
  uploadLater: {
    headline: "Your quote check is started.",
    supporting:
      "When the estimate is on this device, come back and scan it here before you sign.",
    secondarySupporting:
      "WindowMan keeps the next step simple: upload the quote, scan the details, then see what deserves a closer look.",
    // Only true because the homepage rehydrates the same contact-owned
    // lead/session from local funnel state on return (no cross-device promise).
    helpText: "No need to start over in this browser.",
    pivotCta: "I found my quote — scan it now",
  },
  backToOptions: "Back to options",
} as const;

/**
 * Sprint 2F-D no-quote quote-prep diagnostic copy.
 *
 * A short (3 question) helper that gets a homeowner quote-ready before a
 * contractor prices the job. Answers are held in local component state only —
 * never written to Supabase, never tracked, never used as authorization.
 */
export const NO_QUOTE_DIAGNOSTIC = {
  intro: {
    eyebrow: "Quote prep",
    headline: "Let's get you quote-ready.",
    supporting:
      "A few quick questions so you know what to look for before a contractor prices the job.",
  },
  questions: [
    {
      id: "scope",
      prompt: "How many windows or doors are you thinking about?",
      options: ["1–3", "4–7", "8–12", "Whole home / not sure"],
    },
    {
      id: "timeline",
      prompt: "How soon are you trying to get this done?",
      options: ["ASAP", "This month", "1–3 months", "Just researching"],
    },
    {
      id: "priority",
      prompt: "What matters most right now?",
      options: [
        "Avoiding a bad deal",
        "Hurricane protection",
        "Price / financing",
        "Insurance / permits",
        "Energy / noise",
        "Not sure yet",
      ],
    },
  ],
  final: {
    headline: "You're quote-ready.",
    supporting:
      "When a contractor sends the estimate, come back and scan it here before you sign.",
    secondarySupporting:
      "WindowMan will help you check what's included, what's missing, and what deserves a closer look.",
    primaryCta: "I got my quote — scan it now",
    secondaryCta: "Review what to ask before I sign",
    checklistTitle: "Ask every contractor:",
    checklist: [
      "Is the product approval (NOA) and DP rating listed for each opening?",
      "Who pulls the permit, and is inspection included?",
      "What exactly is the warranty — and what voids it?",
      "Is the price broken down by labor vs. materials?",
      "What triggers each payment?",
    ],
  },
} as const;
