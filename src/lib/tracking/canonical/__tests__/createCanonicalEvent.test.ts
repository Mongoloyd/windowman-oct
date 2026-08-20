import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanonicalEvent } from "../createCanonicalEvent";
import type { CreateCanonicalEventInput } from "../types";

class MockDB {
  public inserts: Record<string, unknown[]> = {};
  public upserts: Record<string, unknown[]> = {};
  public upsertOptions: Record<
    string,
    Array<{ onConflict?: string; ignoreDuplicates?: boolean } | undefined>
  > = {};
  public slugLookups: Record<string, Record<string, string | null>> = {
    leads: {},
    scan_sessions: {},
    analyses: {},
  };
  public attributionLookups: Record<
    string,
    Record<string, Record<string, unknown>>
  > = {
    leads: {},
    scan_sessions: {},
  };
  public queryParamsLookups: Record<
    string,
    Record<string, Record<string, string | string[]>>
  > = {
    leads: {},
    scan_sessions: {},
  };

  from(table: string) {
    return {
      insert: async (
        payload: Record<string, unknown> | Record<string, unknown>[],
      ) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.inserts[table] = [...(this.inserts[table] ?? []), ...rows];
        return { data: rows, error: null };
      },
      upsert: async (
        payload: Record<string, unknown> | Record<string, unknown>[],
        options?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.upserts[table] = [...(this.upserts[table] ?? []), ...rows];
        this.upsertOptions[table] = [
          ...(this.upsertOptions[table] ?? []),
          options,
        ];
        return { data: rows, error: null };
      },
      select: (_columns: string) => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => {
            if (table === "wm_event_log") {
              return { data: { id: "event-log-1" }, error: null };
            }

            if (
              table === "leads" || table === "scan_sessions" ||
              table === "analyses"
            ) {
              const data: Record<string, unknown> = {};
              const slug = this.slugLookups[table]?.[value];
              if (slug != null) {
                data.client_slug = slug;
              }
              const attribution = this.attributionLookups[table]?.[value];
              if (attribution != null) {
                data.attribution = attribution;
              }
              const queryParams = this.queryParamsLookups[table]?.[value];
              if (queryParams != null) {
                data.query_params = queryParams;
              }
              return {
                data: Object.keys(data).length > 0 ? data : null,
                error: null,
              };
            }

            return { data: { id: "event-log-1" }, error: null };
          },
        }),
      }),
    };
  }
}

function baseInput(
  overrides: Partial<CreateCanonicalEventInput> = {},
): CreateCanonicalEventInput {
  return {
    eventName: "quote_validation_passed",
    leadId: crypto.randomUUID(),
    analysisId: crypto.randomUUID(),
    scanSessionId: crypto.randomUUID(),
    quoteFileId: crypto.randomUUID(),
    payload: {
      identity: {
        email: "user@example.com",
        phone: "5614685571",
        gclid: "gclid-123",
      },
      journey: {
        route: "/vault/upload",
        flow: "vault",
      },
      quote: {
        isQuoteDocument: true,
        analysisId: crypto.randomUUID(),
        quoteAmount: 12000,
        pricePerOpening: 1400,
        depositPercent: 20,
      },
      analytics: {
        ocrConfidence: 0.92,
        completeness: 0.9,
        mathConsistency: 0.9,
        cohortFit: 0.85,
        scopeConsistency: 0.88,
        documentValidity: 0.9,
        identityStrength: 0.75,
        anomalyScore: 0,
        trustScore: 0,
        anomalyStatus: "review",
        reasons: [],
      },
    },
    ...overrides,
  };
}

function nextdoorEligibleInput(
  overrides: Partial<CreateCanonicalEventInput> = {},
): CreateCanonicalEventInput {
  const leadId = crypto.randomUUID();
  return baseInput({
    eventName: "lead_identified",
    leadId,
    payload: {
      identity: {
        email: "user@example.com",
        phone: "5614685571",
        leadId,
        clickId: "nd-click-1",
      },
      journey: { route: "/city/pompano-beach", flow: "public" },
      metadata: {
        utm_source: "nextdoor",
        ndclid: "nd-click-1",
      },
    },
    ...overrides,
  });
}

describe("createCanonicalEvent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("generates event_id when omitted and reuses when provided", async () => {
    const db = new MockDB();

    const generated = await createCanonicalEvent(
      baseInput({ eventId: undefined }),
      {
        db,
        createId: () => "wmc_fixed",
        now: () => new Date("2026-04-14T10:00:00.000Z"),
      },
    );

    const reused = await createCanonicalEvent(
      baseInput({ eventId: "wmc_reused" }),
      {
        db,
        now: () => new Date("2026-04-14T10:00:00.000Z"),
      },
    );

    expect(generated.canonicalEvent.eventId).toBe("wmc_fixed");
    expect(reused.canonicalEvent.eventId).toBe("wmc_reused");
  });

  it("persists wm_event_log and wm_quote_facts with dispatch eligibility", async () => {
    const db = new MockDB();

    const result = await createCanonicalEvent(baseInput(), {
      db,
      createId: () => "wmc_persist",
      now: () => new Date("2026-04-14T10:00:00.000Z"),
    });

    expect(db.inserts.wm_event_log?.length).toBe(1);
    expect(db.upserts.wm_quote_facts?.length).toBe(1);
    expect(db.upserts.wm_platform_dispatch_log?.length).toBeGreaterThan(0);
    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).toContain("meta");
    expect(result.dispatchPlatforms).toContain("google_ads");
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("suppresses dispatch enqueue for unsafe quote states", async () => {
    const db = new MockDB();

    await createCanonicalEvent(
      baseInput({
        payload: {
          ...baseInput().payload,
          quote: {
            ...baseInput().payload.quote!,
            impossibleValuesDetected: true,
          },
        },
      }),
      {
        db,
        createId: () => "wmc_unsafe",
      },
    );

    expect(db.upserts.wm_platform_dispatch_log ?? []).toHaveLength(0);
  });

  it("writes client_slug from leads.client_slug when leadId resolves", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    db.slugLookups.leads[leadId] = "Tenant-Alpha";

    await createCanonicalEvent(
      baseInput({
        leadId,
        clientSlug: undefined,
        scanSessionId: undefined,
        analysisId: undefined,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => "wmc_lead_slug",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.client_slug).toBe("tenant-alpha");
  });

  it("falls back to scan_sessions.client_slug when lead slug is unavailable", async () => {
    const db = new MockDB();
    const scanSessionId = crypto.randomUUID();
    db.slugLookups.scan_sessions[scanSessionId] = "Tenant-Beta";

    await createCanonicalEvent(
      baseInput({
        leadId: undefined,
        scanSessionId,
        analysisId: undefined,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
          journey: {
            route: "/vault/upload",
            flow: "vault",
            scanSessionId,
          },
        },
      }),
      {
        db,
        createId: () => "wmc_scan_slug",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.client_slug).toBe("tenant-beta");
  });

  it("falls back to analyses.client_slug when lead and session slugs are unavailable", async () => {
    const db = new MockDB();
    const analysisId = crypto.randomUUID();
    db.slugLookups.analyses[analysisId] = "Tenant-Gamma";

    await createCanonicalEvent(
      baseInput({
        leadId: undefined,
        scanSessionId: undefined,
        analysisId,
        payload: {
          ...baseInput().payload,
          quote: {
            isQuoteDocument: true,
            analysisId,
          },
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => "wmc_analysis_slug",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.client_slug).toBe("tenant-gamma");
  });

  it("keeps client_slug null when no trusted ownership exists", async () => {
    const db = new MockDB();

    await createCanonicalEvent(
      baseInput({
        leadId: undefined,
        scanSessionId: undefined,
        analysisId: undefined,
        payload: {
          identity: { email: "user@example.com" },
          journey: { route: "/", flow: "public" },
        },
      }),
      {
        db,
        createId: () => "wmc_no_slug",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.client_slug).toBeNull();
  });

  it("prefers trusted input.clientSlug over database lookups", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    db.slugLookups.leads[leadId] = "from-lead";

    await createCanonicalEvent(
      baseInput({
        leadId,
        clientSlug: "Trusted-Edge-Slug",
        payload: {
          identity: { email: "user@example.com" },
          journey: { route: "/", flow: "public" },
        },
      }),
      {
        db,
        createId: () => "wmc_trusted_slug",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.client_slug).toBe("trusted-edge-slug");
  });

  it("recovers duplicate event_id inserts without changing client_slug behavior", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    db.slugLookups.leads[leadId] = "tenant-dup";

    const duplicateDb = {
      from(table: string) {
        const base = db.from(table);
        if (table !== "wm_event_log") {
          return base;
        }

        let insertCount = 0;
        return {
          ...base,
          insert: async (
            payload: Record<string, unknown> | Record<string, unknown>[],
          ) => {
            insertCount += 1;
            if (insertCount === 1) {
              return {
                data: null,
                error: {
                  message:
                    "duplicate key value violates unique constraint wm_event_log_event_id",
                },
              };
            }
            return base.insert(payload);
          },
        };
      },
    };

    const result = await createCanonicalEvent(
      baseInput({
        eventId: "wmc_duplicate_slug",
        leadId,
        payload: {
          identity: { email: "user@example.com" },
          journey: { route: "/", flow: "public" },
        },
      }),
      { db: duplicateDb },
    );

    expect(result.eventLogId).toBe("event-log-1");
    expect(db.inserts.wm_event_log?.[0]).toBeUndefined();
  });

  it("keeps shouldSendNextdoor false for Nextdoor-attributed metadata when env gate is off", async () => {
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput(),
      { db, createId: () => "wmc_nextdoor_attr" },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("does not queue nextdoor for virtual_page_view events even when env gate is on", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        eventName: "virtual_page_view",
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
            clickId: "pv-1",
          },
          journey: { route: "/about", flow: "public" },
          metadata: { utm_source: "nextdoor", ndclid: "pv-1" },
        },
      }),
      {
        db,
        createId: () => "wmc_nextdoor_pv",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms ?? []).not.toContain("nextdoor");
  });
});

describe("createCanonicalEvent Nextdoor env-gated activation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env gate missing/false prevents queueing for Nextdoor-attributed events", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "false");
    const db = new MockDB();

    const result = await createCanonicalEvent(nextdoorEligibleInput(), {
      db,
      createId: () => "wmc_gate_off",
    });

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("env gate true + attribution + medium/high identity + safe event queues nextdoor", async () => {
    const db = new MockDB();

    const result = await createCanonicalEvent(nextdoorEligibleInput(), {
      db,
      createId: () => "wmc_gate_on",
      readNextdoorCapiEnabled: () => true,
    });

    expect(result.canonicalEvent.identityQuality).not.toBe("unknown");
    expect(result.canonicalEvent.identityQuality).not.toBe("low");
    expect(result.canonicalEvent.payload.metadata?.utm_source).toBe("nextdoor");
    expect(result.canonicalEvent.shouldSendNextdoor).toBe(true);
    expect(result.dispatchPlatforms).toContain("nextdoor");
  });

  it("env gate true but no Nextdoor attribution does not queue nextdoor", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
          },
          journey: { route: "/", flow: "public" },
        },
      }),
      {
        db,
        createId: () => "wmc_no_attr",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("env gate true but low identity does not queue nextdoor", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: { gclid: "only-click-id" },
          journey: { route: "/city/foo", flow: "public" },
          metadata: { utm_source: "nextdoor", ndclid: "nd-1" },
        },
      }),
      {
        db,
        createId: () => "wmc_low_identity",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("env gate true but unsafe quote state does not queue nextdoor", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        eventName: "quote_validation_passed",
        payload: {
          ...nextdoorEligibleInput().payload,
          quote: {
            isQuoteDocument: true,
            analysisId: crypto.randomUUID(),
            impossibleValuesDetected: true,
          },
          analytics: baseInput().payload.analytics,
        },
      }),
      {
        db,
        createId: () => "wmc_unsafe_quote",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("attribution via metadata ndclid works without utm_source", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
            clickId: "only-ndclid",
          },
          journey: { route: "/city/foo", flow: "public" },
          metadata: { ndclid: "only-ndclid" },
        },
      }),
      {
        db,
        createId: () => "wmc_ndclid_only",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(true);
    expect(result.dispatchPlatforms).toContain("nextdoor");
  });

  it("attribution via metadata nd_lead_id works without utm_source", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
            clickId: "lead-only",
          },
          journey: { route: "/city/foo", flow: "public" },
          metadata: { nd_lead_id: "lead-only" },
        },
      }),
      {
        db,
        createId: () => "wmc_nd_lead_only",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(true);
    expect(result.dispatchPlatforms).toContain("nextdoor");
  });

  it("path /nextdoor alone without attribution does not enable Nextdoor", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
            clickId: "nd-1",
          },
          journey: { route: "/nextdoor", flow: "public" },
        },
      }),
      {
        db,
        createId: () => "wmc_path_only",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(false);
    expect(result.dispatchPlatforms).not.toContain("nextdoor");
  });

  it("attribution via source.utmSource queues nextdoor when env gate is on", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(
      nextdoorEligibleInput({
        payload: {
          identity: {
            email: "user@example.com",
            phone: "5614685571",
            leadId: crypto.randomUUID(),
            clickId: "source-utm",
          },
          journey: { route: "/about", flow: "public" },
          source: { utmSource: "nextdoor" },
        },
      }),
      {
        db,
        createId: () => "wmc_source_utm",
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendNextdoor).toBe(true);
    expect(result.dispatchPlatforms).toContain("nextdoor");
  });

  it("Meta/Google dispatch behavior remains unchanged when Nextdoor env gate is on", async () => {
    vi.stubEnv("VITE_NEXTDOOR_CAPI_ENABLED", "true");
    const db = new MockDB();

    const result = await createCanonicalEvent(baseInput(), {
      db,
      createId: () => "wmc_meta_google",
      readNextdoorCapiEnabled: () => true,
    });

    expect(result.dispatchPlatforms).toContain("meta");
    expect(result.dispatchPlatforms).toContain("google_ads");
    expect(result.canonicalEvent.shouldSendMeta).toBe(true);
    expect(result.canonicalEvent.shouldSendGoogle).toBe(true);
  });

  it("copies attribution and query_params from lead row into wm_event_log", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    db.attributionLookups.leads[leadId] = {
      ttclid: "ttclid-lead",
      ttp: "ttp-cookie",
      utm_source: "tiktok",
    };
    db.queryParamsLookups.leads[leadId] = {
      ttclid: "ttclid-lead",
    };

    const inputPayload = baseInput({
      leadId,
      scanSessionId: undefined,
      analysisId: undefined,
      payload: {
        ...baseInput().payload,
        quote: undefined,
        analytics: undefined,
      },
    });

    await createCanonicalEvent(inputPayload, {
      db,
      createId: () => "wmc_lead_attribution",
    });

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.attribution).toEqual({
      ttclid: "ttclid-lead",
      ttp: "ttp-cookie",
      utm_source: "tiktok",
    });
    expect(row.query_params).toEqual({ ttclid: "ttclid-lead" });
    expect(inputPayload.payload).toEqual({
      ...baseInput().payload,
      quote: undefined,
      analytics: undefined,
    });
  });

  it("falls back to scan_session attribution and query_params when lead has none", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    const scanSessionId = crypto.randomUUID();
    db.attributionLookups.scan_sessions[scanSessionId] = {
      ttclid: "ttclid-session",
      utm_campaign: "spring",
    };
    db.queryParamsLookups.scan_sessions[scanSessionId] = {
      utm_campaign: "spring",
    };

    await createCanonicalEvent(
      baseInput({
        leadId,
        scanSessionId,
        analysisId: undefined,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
          journey: {
            route: "/vault/upload",
            flow: "vault",
            scanSessionId,
          },
        },
      }),
      {
        db,
        createId: () => "wmc_session_attribution",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.attribution).toEqual({
      ttclid: "ttclid-session",
      utm_campaign: "spring",
    });
    expect(row.query_params).toEqual({ utm_campaign: "spring" });
  });

  it("merges lead attribution over scan_session gaps without overwriting lead keys", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    const scanSessionId = crypto.randomUUID();
    db.attributionLookups.leads[leadId] = {
      ttclid: "ttclid-lead",
      utm_source: "tiktok",
    };
    db.attributionLookups.scan_sessions[scanSessionId] = {
      ttclid: "ttclid-session",
      ttp: "ttp-session",
    };

    await createCanonicalEvent(
      baseInput({
        leadId,
        scanSessionId,
        analysisId: undefined,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
          journey: {
            route: "/vault/upload",
            flow: "vault",
            scanSessionId,
          },
        },
      }),
      {
        db,
        createId: () => "wmc_merged_attribution",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.attribution).toEqual({
      ttclid: "ttclid-lead",
      utm_source: "tiktok",
      ttp: "ttp-session",
    });
  });

  it("writes empty attribution and query_params when parent rows are missing", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    const scanSessionId = crypto.randomUUID();

    await createCanonicalEvent(
      baseInput({
        leadId,
        scanSessionId,
        analysisId: undefined,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
          journey: {
            route: "/vault/upload",
            flow: "vault",
            scanSessionId,
          },
        },
      }),
      {
        db,
        createId: () => "wmc_empty_attribution",
      },
    );

    const row = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(row.attribution).toEqual({});
    expect(row.query_params).toEqual({});
  });

  it("does not enqueue TikTok dispatch when attribution snapshot is written", async () => {
    const db = new MockDB();
    const leadId = crypto.randomUUID();
    db.attributionLookups.leads[leadId] = { ttclid: "ttclid-lead" };

    const result = await createCanonicalEvent(
      baseInput({
        leadId,
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => "wmc_no_tiktok_dispatch",
      },
    );

    expect(result.dispatchPlatforms).not.toContain("tiktok");
    expect(
      (db.upserts.wm_platform_dispatch_log ?? []).some(
        (row) => (row as Record<string, unknown>).platform_name === "tiktok",
      ),
    ).toBe(false);
  });

  it("does not enqueue TikTok dispatch when TIKTOK_CAPI_ENABLED is false", async () => {
    const db = new MockDB();

    const result = await createCanonicalEvent(
      baseInput({
        eventName: "quote_uploaded",
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => "wmc_tiktok_gate_false",
        readTikTokCapiEnabled: () => false,
      },
    );

    expect(result.dispatchPlatforms).not.toContain("tiktok");
    expect(
      (db.upserts.wm_platform_dispatch_log ?? []).some(
        (row) => (row as Record<string, unknown>).platform_name === "tiktok",
      ),
    ).toBe(false);
  });

  it("enqueues one TikTok dispatch row when gate is true and event is mapped", async () => {
    const db = new MockDB();
    const eventId = "wmc_tiktok_enabled";

    const result = await createCanonicalEvent(
      baseInput({
        eventName: "quote_uploaded",
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => eventId,
        readTikTokCapiEnabled: () => true,
      },
    );

    expect(result.dispatchPlatforms).toContain("tiktok");
    const tiktokRows = (db.upserts.wm_platform_dispatch_log ?? []).filter(
      (row) => (row as Record<string, unknown>).platform_name === "tiktok",
    );

    expect(tiktokRows).toHaveLength(1);
    expect(tiktokRows[0]).toMatchObject({
      event_log_id: "event-log-1",
      platform_name: "tiktok",
      dispatch_status: "pending",
    });

    const eventLogRow = db.inserts.wm_event_log?.[0] as Record<string, unknown>;
    expect(eventLogRow.event_id).toBe(eventId);
  });

  it("does not enqueue TikTok dispatch for unknown events when gate is true", async () => {
    const db = new MockDB();

    const result = await createCanonicalEvent(
      baseInput({
        eventName: "lead_identified",
        payload: {
          ...baseInput().payload,
          quote: undefined,
          analytics: undefined,
        },
      }),
      {
        db,
        createId: () => "wmc_tiktok_unknown_event",
        readTikTokCapiEnabled: () => true,
      },
    );

    expect(result.dispatchPlatforms).not.toContain("tiktok");
    expect(
      (db.upserts.wm_platform_dispatch_log ?? []).some(
        (row) => (row as Record<string, unknown>).platform_name === "tiktok",
      ),
    ).toBe(false);
  });

  it("callback_requested with allowedPlatforms meta and granted consent enqueues only pending Meta", async () => {
    const db = new MockDB();
    const result = await createCanonicalEvent(
      baseInput({
        eventName: "callback_requested",
        eventId: "wmc_callback_requested_lead-a_scan-b",
        payload: {
          identity: {
            leadId: crypto.randomUUID(),
            phoneHash: "b".repeat(64),
            phoneVerifiedAt: "2026-08-12T00:00:00.000Z",
          },
          journey: { route: "/diagnosis", flow: "public" },
        },
        dispatchPolicy: {
          allowedPlatforms: ["meta"],
          metaConsent: "granted",
        },
      }),
      {
        db,
        readTikTokCapiEnabled: () => true,
        readNextdoorCapiEnabled: () => true,
      },
    );

    expect(result.canonicalEvent.shouldSendMeta).toBe(true);
    expect(result.canonicalEvent.shouldSendGoogle).toBe(false);
    expect(result.canonicalEvent.payload.identity.identityQuality).toBe(
      result.canonicalEvent.identityQuality,
    );
    expect(result.canonicalEvent.payload.shouldSendMeta).toBe(true);
    expect(result.canonicalEvent.payload.shouldSendGoogle).toBe(false);
    expect(result.dispatchPlatforms).toEqual(["meta"]);
    expect(result.canonicalEvent.dispatchStatus).toBe("pending");
    const rows = db.upserts.wm_platform_dispatch_log ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      platform_name: "meta",
      dispatch_status: "pending",
    });
    expect(db.upsertOptions.wm_platform_dispatch_log).toEqual([{
      onConflict: "event_log_id,platform_name",
      ignoreDuplicates: true,
    }]);
  });

  it("callback_requested denied consent writes suppressed Meta and no other platforms", async () => {
    const db = new MockDB();
    const result = await createCanonicalEvent(
      baseInput({
        eventName: "callback_requested",
        eventId: "wmc_cb_denied",
        payload: {
          identity: {
            leadId: crypto.randomUUID(),
            phoneHash: "b".repeat(64),
            phoneVerifiedAt: "2026-08-12T00:00:00.000Z",
          },
          journey: { route: "/diagnosis", flow: "public" },
        },
        dispatchPolicy: {
          allowedPlatforms: ["meta"],
          metaConsent: "denied",
          metaSuppressionReason: "consent_declined",
        },
      }),
      { db, readTikTokCapiEnabled: () => true },
    );

    expect(result.canonicalEvent.shouldSendMeta).toBe(false);
    expect(result.canonicalEvent.dispatchStatus).toBe("suppressed");
    expect(result.dispatchPlatforms).toEqual(["meta"]);
    expect(db.upserts.wm_platform_dispatch_log?.[0]).toMatchObject({
      platform_name: "meta",
      dispatch_status: "suppressed",
      error_message: "consent_declined",
    });
  });

  it.each(
    [
      ["denied", "advertising_measurement_declined"],
      ["unknown", "advertising_measurement_missing"],
    ] as const,
  )(
    "WMChat lead_captured with %s consent creates a suppressed row and zero sendable Meta dispatch",
    async (metaConsent, reason) => {
      const db = new MockDB();
      const leadId = crypto.randomUUID();
      const result = await createCanonicalEvent(
        baseInput({
          eventName: "lead_captured",
          eventId: `wmc_lead_captured_${metaConsent}`,
          leadId,
          payload: {
            identity: { leadId, phoneHash: "c".repeat(64) },
            journey: { route: "/wmchat", flow: "public" },
            metadata: { measurement_scope: "wmchat_day1_lead" },
          },
          dispatchPolicy: {
            allowedPlatforms: ["meta"],
            metaConsent,
            metaSuppressionReason: reason,
          },
        }),
        { db },
      );

      expect(result.canonicalEvent.shouldSendMeta).toBe(false);
      expect(result.canonicalEvent.dispatchStatus).toBe("suppressed");
      expect(result.dispatchPlatforms).toEqual(["meta"]);
      expect(db.upserts.wm_platform_dispatch_log).toEqual([
        expect.objectContaining({
          platform_name: "meta",
          dispatch_status: "suppressed",
          error_message: reason,
        }),
      ]);
    },
  );

  it("omitted dispatchPolicy preserves existing quote event platforms", async () => {
    const db = new MockDB();
    const result = await createCanonicalEvent(baseInput(), {
      db,
      createId: () => "wmc_policy_omitted",
    });
    expect(result.dispatchPlatforms).toContain("meta");
    expect(result.dispatchPlatforms).toContain("google_ads");
  });

  it.each(["phone_verified", "report_revealed"] as const)(
    "omitted dispatchPolicy preserves existing %s platforms",
    async (eventName) => {
      const db = new MockDB();
      const base = baseInput();
      const result = await createCanonicalEvent(
        baseInput({
          eventName,
          payload: {
            ...base.payload,
            quote: undefined,
            analytics: undefined,
          },
        }),
        {
          db,
          createId: () => `wmc_policy_omitted_${eventName}`,
        },
      );

      expect(result.dispatchPlatforms).toContain("meta");
      expect(result.dispatchPlatforms).toContain("google_ads");
    },
  );
});
