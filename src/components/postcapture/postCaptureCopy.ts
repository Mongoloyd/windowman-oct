/**
 * Sprint 2F-C post-capture intent router copy.
 *
 * Calm, national, consumer-advocate tone. This is acquisition guidance after a
 * trusted contact-owned lead/session already exists — never a permission wall.
 * No "locked" / "access denied" / "security" language by design.
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
    confirmation:
      "Saved. When your quote is ready, come back and upload it here — no need to start over.",
    pivotCta: "I found my quote — scan it now",
  },
  noQuote: {
    placeholder:
      "No quote yet? You're still in the right place. We'll help you understand what a clean window quote should include before you sign anything.",
    pivotCta: "I got a quote — scan it now",
  },
  backToOptions: "Back to options",
} as const;
