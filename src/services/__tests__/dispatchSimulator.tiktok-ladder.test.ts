import { describe, expect, it } from "vitest";
import type { PlatformConfigRow } from "@/services/clientPlatformConfigs";
import type { RevenueReadinessRow } from "@/services/revenueDispatchReadiness";
import {
  previewTikTokLadderDryRun,
  resolveTikTokEventName,
  TIKTOK_DRY_RUN_MAPPER_VERSION,
} from "@/services/dispatchSimulator";

const LADDER_CASES = [
  { source: "truth_gate_captured", tiktok: "SubmitForm" },
  { source: "lead_captured", tiktok: "SubmitForm" },
  { source: "quote_uploaded", tiktok: "UploadQuote" },
  { source: "report_revealed", tiktok: "UnlockReport" },
  { source: "report_unlocked", tiktok: "UnlockReport" },
  { source: "contractor_match_requested", tiktok: "Contact" },
  { source: "contractor_intro_requested", tiktok: "Contact" },
  { source: "appointment_booked", tiktok: "Schedule" },
  { source: "appointment_scheduled", tiktok: "Schedule" },
  { source: "sold", tiktok: "CompletePayment" },
  { source: "won", tiktok: "CompletePayment" },
] as const;

function baseReadinessRow(
  eventName: string,
  overrides: Partial<RevenueReadinessRow> = {},
): RevenueReadinessRow {
  return {
    id: "event-row-1",
    eventId: "wmc_sold_lead-abc",
    revenueSignalKey: null,
    eventName,
    timestamp: "2026-04-14T10:00:00.000Z",
    createdAt: "2026-04-14T10:00:00.000Z",
    leadId: "lead-123",
    scanSessionId: null,
    analysisId: null,
    clientSlug: "tenant-alpha",
    status: "ready",
    reasons: [],
    valueUsd: 5000,
    finalValueCents: null,
    finalValueUsd: null,
    optimizationValueUsd: 5000,
    attributionStrength: "medium",
    attributionPresence: {
      ttclid: true,
      ttp: true,
      utm_source: true,
    },
    payloadIntegrity: {
      payloadIsObject: true,
      revenueTruthSource: null,
      revenueRollupTarget: null,
      sourceSystem: null,
      dispositionState: "sold_closed",
      optimizationValueBasis: "gross_sale_value",
      trueMarginAvailable: false,
      marginModelVersion: null,
    },
    context: {
      contractorOutcomeId: null,
      opportunityId: null,
      contractorId: null,
    },
    config: {
      tenantResolved: true,
      activePlatformConfigCount: 1,
      activeDestinationConfigsTotal: 1,
      platformConfigs: [],
    },
    ...overrides,
  };
}

function tiktokConfig(): PlatformConfigRow {
  return {
    id: "config-tiktok-1",
    client_id: "client-1",
    platform_name: "tiktok",
    pixel_id: "pixel-123",
    dataset_id: null,
    conversion_id: null,
    conversion_label: null,
    endpoint_url: null,
    token_secret_id: "secret-1",
    is_active: true,
    created_at: "2026-04-14T10:00:00.000Z",
    updated_at: "2026-04-14T10:00:00.000Z",
    clients: { slug: "tenant-alpha" },
  };
}

describe("resolveTikTokEventName", () => {
  it.each(LADDER_CASES)("maps $source to $tiktok", ({ source, tiktok }) => {
    expect(resolveTikTokEventName(source)).toBe(tiktok);
  });

  it("returns null for unknown events", () => {
    expect(resolveTikTokEventName("unknown_event")).toBeNull();
    expect(resolveTikTokEventName("phone_verified")).toBeNull();
    expect(resolveTikTokEventName(null)).toBeNull();
  });
});

describe("previewTikTokLadderDryRun", () => {
  it.each(LADDER_CASES)(
    "builds dry-run payload with mapped TikTok event for $source",
    async ({ source, tiktok }) => {
      const preview = await previewTikTokLadderDryRun(
        baseReadinessRow(source),
        tiktokConfig(),
      );

      expect(preview.tiktokEventName).toBe(tiktok);
      expect(preview.reasons).not.toContain("tiktok_unmapped_event");

      const payload = preview.payload as {
        data?: Array<{ event?: string | null }>;
        windowman_debug?: { mapper_version?: string; source_event?: string };
      };
      expect(payload.data?.[0]?.event).toBe(tiktok);
      expect(payload.windowman_debug?.mapper_version).toBe(TIKTOK_DRY_RUN_MAPPER_VERSION);
      expect(payload.windowman_debug?.source_event).toBe(source);
    },
  );

  it("marks unknown events as unmapped and blocked", async () => {
    const preview = await previewTikTokLadderDryRun(
      baseReadinessRow("unknown_event"),
      tiktokConfig(),
    );

    expect(preview.tiktokEventName).toBeNull();
    expect(preview.reasons).toContain("tiktok_unmapped_event");
    expect(preview.simulatedStatus).toBe("dry_run_blocked");

    const payload = preview.payload as {
      data?: Array<{ event?: string | null }>;
    };
    expect(payload.data?.[0]?.event).toBeNull();
  });

  it("requires value only for revenue-tier mapped events", async () => {
    const revenuePreview = await previewTikTokLadderDryRun(
      baseReadinessRow("sold", { valueUsd: null }),
      tiktokConfig(),
    );
    expect(revenuePreview.reasons).toContain("tiktok_value_missing");

    const leadPreview = await previewTikTokLadderDryRun(
      baseReadinessRow("lead_captured", { valueUsd: null }),
      tiktokConfig(),
    );
    expect(leadPreview.reasons).not.toContain("tiktok_value_missing");
  });
});
