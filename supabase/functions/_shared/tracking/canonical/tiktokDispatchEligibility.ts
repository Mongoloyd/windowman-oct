import { mapToTikTok } from "./mapToTikTok.ts";

export interface TikTokDispatchEligibilityInput {
  eventName: string;
  env?: Record<string, string | undefined>;
}

export type TikTokDispatchEligibilityResult =
  | {
    shouldEnqueue: true;
    platformName: "tiktok";
    mappedEventName: string;
  }
  | {
    shouldEnqueue: false;
    reason: "tiktok_disabled" | "no_tiktok_mapping" | "missing_event_name";
    mappedEventName?: string | null;
  };

export function isTikTokCapiEnabled(envValue: string | undefined): boolean {
  return envValue === "true";
}

export function evaluateTikTokDispatchEligibility(
  input: TikTokDispatchEligibilityInput,
): TikTokDispatchEligibilityResult {
  const eventName = typeof input.eventName === "string" ? input.eventName.trim() : "";
  if (!eventName) {
    return { shouldEnqueue: false, reason: "missing_event_name", mappedEventName: null };
  }

  if (!isTikTokCapiEnabled(input.env?.TIKTOK_CAPI_ENABLED)) {
    return { shouldEnqueue: false, reason: "tiktok_disabled", mappedEventName: null };
  }

  const mapped = mapToTikTok(eventName);
  if (!mapped) {
    return { shouldEnqueue: false, reason: "no_tiktok_mapping", mappedEventName: null };
  }

  return {
    shouldEnqueue: true,
    platformName: "tiktok",
    mappedEventName: mapped.tiktokEventName,
  };
}

export function isDenoTikTokCapiEnabled(
  envValue?: string | null,
): boolean {
  if (arguments.length === 0) {
    return isTikTokCapiEnabled(Deno.env.get("TIKTOK_CAPI_ENABLED") ?? undefined);
  }

  return isTikTokCapiEnabled(envValue ?? undefined);
}
