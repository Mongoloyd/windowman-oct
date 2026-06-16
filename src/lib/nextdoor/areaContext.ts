import { isValidZip } from "@/lib/nextdoor/attributionHelpers";

export type AreaConfidence = "zip_confirmed" | "campaign_hint" | "fallback";

export type AreaContext = {
  areaLabel: string;
  confidence: AreaConfidence;
  source: "zip" | "utm" | "fallback";
};

const DEFAULT_AREA_LABEL = "South Florida";

type DeriveAreaContextInput = {
  zip?: string;
  /** Ignored for county display — campaign hints never override to a specific county. */
  utmCampaign?: string | null;
  utmSource?: string | null;
};

/**
 * Frontend-only area labels for CRO copy. Not used for routing, persistence, or eligibility.
 * Campaign/UTM county hints are deliberately collapsed to broad South Florida labels.
 */
export function deriveAreaContext(input: DeriveAreaContextInput = {}): AreaContext {
  const zip = input.zip?.trim() ?? "";

  if (!zip || !isValidZip(zip)) {
    return {
      areaLabel: DEFAULT_AREA_LABEL,
      confidence: "fallback",
      source: "fallback",
    };
  }

  // Valid ZIP without a maintained county map — stay broad, never guess Broward/Miami-Dade/etc.
  return {
    areaLabel: "your local area",
    confidence: "zip_confirmed",
    source: "zip",
  };
}

export function heroEyebrowLabel(context: AreaContext): string {
  const region =
    context.areaLabel === "your local area" ? "Your area" : context.areaLabel;
  return `${region} · Local quote check`;
}

export function mockCardAreaSubtitle(context: AreaContext): string {
  const region =
    context.areaLabel === "your local area" ? "Your area" : context.areaLabel;
  return `${region} · Impact window estimate`;
}

export function zipFieldHelperText(context: AreaContext): string {
  if (context.confidence === "zip_confirmed") {
    return "Used for local quote context in your area";
  }
  return "Used for local quote context";
}

export function prepPanelAreaPhrase(context: AreaContext): string {
  if (context.areaLabel === "your local area") {
    return "your local area";
  }
  return context.areaLabel;
}

export function checksGridIntro(context: AreaContext): string {
  const region =
    context.areaLabel === "your local area"
      ? "your area"
      : context.areaLabel.toLowerCase();
  return `Each review area answers one question: what should you clarify before you sign? Built for ${region} homeowners — no real quote is analyzed until you upload.`;
}

export const TRUST_PILL_LABELS = {
  freePreviewFirst: "Free preview first",
  privateQuoteCheck: "Private quote check",
  southFloridaReady: "South Florida-ready",
  noContractorPressure: "No contractor pressure",
} as const;

export const PAGE_TITLE = "Local Quote Check | WindowMan";

export const PAGE_META_DESCRIPTION =
  "South Florida homeowners: check your impact-window quote before you sign. Private review — not a contractor.";

export const HERO_HEADLINE =
  "Turn every quote into leverage before you sign.";

export const HERO_SUBHEAD =
  "Upload your impact-window estimate. See what is vague, missing, or worth questioning — then use every bid to make the next conversation clearer.";
