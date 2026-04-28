import type { WMEventName, WMOptimizationPayload } from "./types.ts";

const VALUE_LADDER: Record<string, number> = {
  lead_identified: 10,
  lead_qualified: 100,
  quote_uploaded: 250,
  quote_upload_completed: 250,
  quote_validation_passed: 500,
  appointment_booked: 1000,
};

export interface WMValueModelInput {
  eventName: WMEventName;
  marginUsd?: number;
  approvedForIndex?: boolean;
  approvedForAds?: boolean;
  manualReviewRequired?: boolean;
}

export function getOptimizationValueUsd(input: WMValueModelInput): number {
  if (input.eventName === "sale_confirmed" || input.eventName === "sold") {
    return typeof input.marginUsd === "number" &&
        Number.isFinite(input.marginUsd) && input.marginUsd > 0
      ? Math.round(input.marginUsd * 100) / 100
      : 1500;
  }

  return VALUE_LADDER[input.eventName] ?? 0;
}

function derivePriority(valueUsd: number): number {
  if (valueUsd >= 1000) return 90;
  if (valueUsd >= 500) return 70;
  if (valueUsd >= 250) return 55;
  if (valueUsd >= 100) return 40;
  if (valueUsd > 0) return 20;
  return 0;
}

export function buildOptimizationPayload(
  input: WMValueModelInput,
): WMOptimizationPayload {
  const valueUsd = getOptimizationValueUsd(input);
  const approvedForIndex = input.approvedForIndex ?? false;
  const approvedForAds = input.approvedForAds ?? false;
  const manualReviewRequired = input.manualReviewRequired ?? false;

  return {
    approvedForIndex,
    approvedForAds,
    manualReviewRequired,
    valueUsd,
    priority: derivePriority(valueUsd),
  };
}
