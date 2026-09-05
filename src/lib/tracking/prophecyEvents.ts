import { pushDataLayerEvent } from "@/lib/tracking/dataLayer";

const PROPHECY_EVENT_NAMES = [
  "path_selected",
  "form_start",
  "form_error",
  "upload_start",
  "upload_error",
  "video_play",
] as const;

const PROPHECY_INTENTS = new Set(["has_quote", "no_quote"]);
const PROPHECY_CTA_LOCATIONS = new Set([
  "hero_primary",
  "footer_primary",
]);
const PROPHECY_STEP_NAMES = new Set([
  "intent",
  "submission",
  "upload",
  "explainer",
]);
const PROPHECY_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);
const PROPHECY_FLOW_VARIANTS = new Set([
  "prophecy",
  "unsaid",
  "four_checks",
  "opening_offer",
]);
const PROPHECY_EVENT_NAME_SET = new Set<string>(PROPHECY_EVENT_NAMES);

export type ProphecyLowIntentEventName =
  (typeof PROPHECY_EVENT_NAMES)[number];
export type ProphecyIntent = "has_quote" | "no_quote";
export type ProphecyCtaLocation = "hero_primary" | "footer_primary";
export type ProphecyStepName =
  | "intent"
  | "submission"
  | "upload"
  | "explainer";
export type ProphecyFileType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic";

/**
 * Deliberately narrow browser-measurement contract for Prophecy interactions.
 * The source tool is owned by this module rather than accepted from callers.
 */
export interface ProphecyLowIntentParameters {
  flow_variant?: string | null;
  wm_intent?: ProphecyIntent | null;
  cta_location?: ProphecyCtaLocation | null;
  step_name?: ProphecyStepName | null;
  file_type?: string | null;
}

function sanitizeProphecyParameters(
  parameters: ProphecyLowIntentParameters,
): Record<string, string> {
  const safe: Record<string, string> = { source_tool: "prophecy" };

  if (
    typeof parameters.flow_variant === "string" &&
    PROPHECY_FLOW_VARIANTS.has(parameters.flow_variant)
  ) {
    safe.flow_variant = parameters.flow_variant;
  }

  if (
    typeof parameters.wm_intent === "string" &&
    PROPHECY_INTENTS.has(parameters.wm_intent)
  ) {
    safe.wm_intent = parameters.wm_intent;
  }

  if (
    typeof parameters.cta_location === "string" &&
    PROPHECY_CTA_LOCATIONS.has(parameters.cta_location)
  ) {
    safe.cta_location = parameters.cta_location;
  }

  if (
    typeof parameters.step_name === "string" &&
    PROPHECY_STEP_NAMES.has(parameters.step_name)
  ) {
    safe.step_name = parameters.step_name;
  }

  if (
    typeof parameters.file_type === "string" &&
    PROPHECY_FILE_TYPES.has(parameters.file_type)
  ) {
    safe.file_type = parameters.file_type;
  }

  return safe;
}

/**
 * Emits a PII-free, vendor-agnostic Prophecy interaction. Runtime projection
 * creates a new object from the allowlist, so extra or nested caller data can
 * never ride along to the data layer. Measurement must never block the funnel.
 */
export function pushProphecyLowIntentEvent(
  eventName: ProphecyLowIntentEventName,
  parameters: ProphecyLowIntentParameters = {},
): void {
  if (!PROPHECY_EVENT_NAME_SET.has(eventName)) return;

  try {
    pushDataLayerEvent(
      eventName,
      sanitizeProphecyParameters(parameters),
    );
  } catch {
    // Observational measurement must never interrupt an intake or upload.
  }
}
