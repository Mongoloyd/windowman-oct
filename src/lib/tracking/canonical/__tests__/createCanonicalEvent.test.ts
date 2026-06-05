import { describe, expect, it } from "vitest";
import { createCanonicalEvent } from "../createCanonicalEvent";
import type { CreateCanonicalEventInput } from "../types";

class MockDB {
  public inserts: Record<string, unknown[]> = {};
  public upserts: Record<string, unknown[]> = {};
  public slugLookups: Record<string, Record<string, string | null>> = {
    leads: {},
    scan_sessions: {},
    analyses: {},
  };

  from(table: string) {
    return {
      insert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.inserts[table] = [...(this.inserts[table] ?? []), ...rows];
        return { data: rows, error: null };
      },
      upsert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.upserts[table] = [...(this.upserts[table] ?? []), ...rows];
        return { data: rows, error: null };
      },
      select: (_columns: string) => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => {
            if (table === "wm_event_log") {
              return { data: { id: "event-log-1" }, error: null };
            }

            const slug = this.slugLookups[table]?.[value] ?? null;
            if (
              table === "leads" ||
              table === "scan_sessions" ||
              table === "analyses"
            ) {
              return {
                data: slug != null ? { client_slug: slug } : null,
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

function baseInput(overrides: Partial<CreateCanonicalEventInput> = {}): CreateCanonicalEventInput {
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

describe("createCanonicalEvent", () => {
  it("generates event_id when omitted and reuses when provided", async () => {
    const db = new MockDB();

    const generated = await createCanonicalEvent(baseInput({ eventId: undefined }), {
      db,
      createId: () => "wmc_fixed",
      now: () => new Date("2026-04-14T10:00:00.000Z"),
    });

    const reused = await createCanonicalEvent(baseInput({ eventId: "wmc_reused" }), {
      db,
      now: () => new Date("2026-04-14T10:00:00.000Z"),
    });

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
    expect(result.dispatchPlatforms).toContain("meta");
    expect(result.dispatchPlatforms).toContain("google_ads");
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
          insert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
            insertCount += 1;
            if (insertCount === 1) {
              return {
                data: null,
                error: { message: "duplicate key value violates unique constraint wm_event_log_event_id" },
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
});
