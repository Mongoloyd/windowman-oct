import type { QuoteReadiness } from "@/components/nextdoor/types";

export type NextdoorNextRoute =
  | "upload_quote_now"
  | "comparison_checklist"
  | "sales_visit_prep"
  | "quote_anatomy";

export const READINESS_TO_NEXT_ROUTE: Record<QuoteReadiness, NextdoorNextRoute> = {
  has_estimate: "upload_quote_now",
  getting_quotes_now: "comparison_checklist",
  need_quote_soon: "sales_visit_prep",
  researching: "quote_anatomy",
};

export type PathSummaryCopy = {
  pathLabel: string;
  nextHint: string;
};

export type NextStepPanelCopy = {
  headline: string;
  body: string;
  saveCta: string;
  badge: string;
};

const PATH_SUMMARY: Record<QuoteReadiness, PathSummaryCopy> = {
  has_estimate: {
    pathLabel: "Quote-ready",
    nextHint: "upload your quote when ready",
  },
  getting_quotes_now: {
    pathLabel: "Comparing quotes",
    nextHint: "use the same checklist on every bid",
  },
  need_quote_soon: {
    pathLabel: "Pre-appointment prep",
    nextHint: "build your sales-visit question list",
  },
  researching: {
    pathLabel: "Researching",
    nextHint: "learn what a complete quote should include",
  },
};

const NEXT_STEP_COPY: Record<QuoteReadiness, NextStepPanelCopy> = {
  has_estimate: {
    badge: "Quote ready",
    headline: "You have the paperwork. Now make it work for you.",
    body: "Save your details, then upload your quote for a private WindowMan check.",
    saveCta: "Save my details",
  },
  getting_quotes_now: {
    badge: "Comparison mode",
    headline: "Compare every bid on the same checklist.",
    body: "Use the same pressure points for scope, permits, warranty, payment timing, and product proof so every quote is easier to compare.",
    saveCta: "Save my comparison checklist",
  },
  need_quote_soon: {
    badge: "Pre-visit prep",
    headline: "Walk into the sales visit with better questions.",
    body: "Prep the questions that make the quote easier to compare later: what is included, who handles permits, what product is being used, and what triggers payment.",
    saveCta: "Save my quote-prep checklist",
  },
  researching: {
    badge: "Quote anatomy",
    headline: "Learn what a complete quote should include.",
    body: "Start with the anatomy of a clean impact-window quote so you know what to look for before collecting bids.",
    saveCta: "Save the quote anatomy checklist",
  },
};

export function resolveNextRoute(readiness: QuoteReadiness): NextdoorNextRoute {
  return READINESS_TO_NEXT_ROUTE[readiness];
}

export function pathSummaryCopy(readiness: QuoteReadiness): PathSummaryCopy {
  return PATH_SUMMARY[readiness];
}

export function nextStepPanelCopy(readiness: QuoteReadiness): NextStepPanelCopy {
  return NEXT_STEP_COPY[readiness];
}

export function saveCtaLabel(readiness: QuoteReadiness | null): string {
  if (!readiness) return "Start my free preview";
  return NEXT_STEP_COPY[readiness].saveCta;
}

const LEAD_SUCCESS_MESSAGE: Record<QuoteReadiness, string> = {
  has_estimate:
    "Your details are saved. Upload your quote below — it stays private.",
  getting_quotes_now:
    "Your comparison checklist is saved. Use it on every bid you collect.",
  need_quote_soon:
    "Your quote-prep checklist is saved. Use it before the sales visit.",
  researching:
    "Your quote anatomy checklist is saved. Use it before you start collecting bids.",
};

export function leadSuccessMessage(readiness: QuoteReadiness): string {
  return LEAD_SUCCESS_MESSAGE[readiness];
}
