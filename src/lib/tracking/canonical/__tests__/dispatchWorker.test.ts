import { describe, expect, it } from "vitest";
import {
  buildGoogleDryRunDispatchEnvelope,
  buildGoogleDispatchAuthHeaders,
  buildMissingGoogleDispatchUrlResult,
  evaluateGoogleDispatchHttpResponse,
  GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY,
  parseDispatchWorkerRequest,
  resolveNextdoorActionSourceUrl,
  runDispatchWorker,
  TIKTOK_DISPATCH_DRY_RUN_ONLY,
  TIKTOK_DRY_RUN_EVENT_SOURCE_ID,
  type DBLike,
} from "../dispatchWorker";
import type { WMDispatchStatus, WMPlatformName } from "../types";

interface MockDispatchRow {
  dispatch_id: string;
  event_log_id: string;
  platform_name: WMPlatformName;
  dispatch_status: WMDispatchStatus;
  attempt_count: number;
  event_id: string;
  event_name: string;
  event_timestamp: string;
  event_payload: Record<string, unknown>;
  event_raw_payload: Record<string, unknown>;
  event_schema_version: string;
  event_model_version: string | null;
  event_rubric_version: string | null;
  event_identity_quality: "unknown" | "low" | "medium" | "high";
  should_send_meta: boolean;
  should_send_google: boolean;
  event_client_slug?: string | null;
  event_lead_id?: string | null;
  event_scan_session_id?: string | null;
  event_analysis_id?: string | null;
  event_quote_file_id?: string | null;
}

interface EventLogRecord {
  client_slug?: string | null;
  lead_id?: string | null;
  scan_session_id?: string | null;
  analysis_id?: string | null;
  quote_file_id?: string | null;
  attribution?: Record<string, unknown>;
  query_params?: Record<string, unknown>;
}

class MockDB {
  public eventStatuses = new Map<string, WMDispatchStatus[]>([]);
  public updates: Record<string, Array<Record<string, unknown>>> = {};
  public upserts: Record<string, Array<Record<string, unknown>>> = {};
  public eventLogs = new Map<string, EventLogRecord>();
  public attributionBatchFetchIds: string[] = [];
  public slugLookups: Record<string, Record<string, string | null>> = {
    leads: {},
    scan_sessions: {},
    analyses: {},
  };
  public quoteFileLeads: Record<string, string | null> = {};
  public rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

  constructor(private rows: MockDispatchRow[]) {
    for (const row of rows) {
      this.eventStatuses.set(row.event_log_id, [row.dispatch_status]);
    }
  }

  private applyPlatformDispatchPatch(dispatchId: string, patch: Record<string, unknown>): void {
    const matched = this.rows.find((item) => item.dispatch_id === dispatchId);
    if (matched && typeof patch.dispatch_status === "string") {
      matched.dispatch_status = patch.dispatch_status as WMDispatchStatus;
      const eventStatusList = this.eventStatuses.get(matched.event_log_id) ?? [];
      this.eventStatuses.set(matched.event_log_id, [matched.dispatch_status, ...eventStatusList.slice(1)]);
    }
  }

  async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message?: string } | null }> {
    this.rpcCalls.push({ fn, args });
    return { data: this.rows as T, error: null };
  }

  from(table: string) {
    return {
      select: (_columns: string) => ({
        eq: (_column: string, value: string) => ({
          in: (_statusColumn: string, _statuses: string[]) => ({
            order: async () => {
              const statuses = this.eventStatuses.get(value) ?? [];
              return {
                data: statuses.map((status) => ({ dispatch_status: status })),
                error: null,
              };
            },
          }),
          maybeSingle: async () => {
            if (table === "wm_event_log") {
              const record = this.eventLogs.get(value);
              return { data: record ?? null, error: null };
            }

            const slug = this.slugLookups[table]?.[value] ?? null;
            if (table === "leads" || table === "scan_sessions" || table === "analyses") {
              return {
                data: slug != null ? { client_slug: slug } : null,
                error: null,
              };
            }

            if (table === "quote_files") {
              const leadId = this.quoteFileLeads[value] ?? null;
              return {
                data: leadId != null ? { lead_id: leadId } : null,
                error: null,
              };
            }

            return { data: null, error: null };
          },
        }),
        in: (_column: string, values: string[]) => ({
          order: async () => {
            if (table === "wm_event_log") {
              this.attributionBatchFetchIds = values;
              const data = values
                .map((id) => {
                  const record = this.eventLogs.get(id);
                  if (!record) return null;
                  return {
                    id,
                    attribution: record.attribution ?? {},
                    query_params: record.query_params ?? {},
                  };
                })
                .filter((row): row is NonNullable<typeof row> => row !== null);
              return { data, error: null };
            }

            return { data: [], error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_column: string, value: string) => {
          this.updates[table] = [...(this.updates[table] ?? []), { id: value, ...payload }];

          if (table === "wm_platform_dispatch_log") {
            this.applyPlatformDispatchPatch(value, payload);
          }

          return { data: null, error: null };
        },
      }),
      upsert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.upserts[table] = [...(this.upserts[table] ?? []), ...rows];

        if (table === "wm_platform_dispatch_log") {
          for (const row of rows) {
            const dispatchId = row.id as string;
            if (dispatchId) {
              this.applyPlatformDispatchPatch(dispatchId, row);
            }
          }
        }

        return { data: rows, error: null };
      },
    };
  }
}

function makeRow(overrides: Partial<MockDispatchRow> = {}): MockDispatchRow {
  return {
    dispatch_id: crypto.randomUUID(),
    event_log_id: crypto.randomUUID(),
    platform_name: "meta",
    dispatch_status: "processing",
    attempt_count: 1,
    event_id: "wmc_1",
    event_name: "lead_identified",
    event_timestamp: "2026-04-14T12:00:00.000Z",
    event_payload: {
      identity: {
        leadId: crypto.randomUUID(),
        emailHash: "a".repeat(64),
      },
      journey: { route: "/", flow: "public" },
      optimization: { approvedForAds: true, approvedForIndex: true, manualReviewRequired: false, valueUsd: 10 },
    },
    event_raw_payload: {},
    event_schema_version: "1.0.0",
    event_model_version: null,
    event_rubric_version: null,
    event_identity_quality: "high",
    should_send_meta: true,
    should_send_google: true,
    event_client_slug: "tenant-alpha",
    ...overrides,
  };
}

describe("runDispatchWorker", () => {
  describe("scoped claim RPC selection", () => {
    it("calls wm_claim_dispatch_rows when no scope is provided", async () => {
      const row = makeRow();
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
        sendToGoogle: async () => ({ ok: true }),
      });

      expect(mock.rpcCalls).toHaveLength(1);
      expect(mock.rpcCalls[0]?.fn).toBe("wm_claim_dispatch_rows");
      expect(mock.rpcCalls[0]?.args).toEqual({
        p_limit: 25,
        p_lock_stale_minutes: 10,
      });
    });

    it("calls wm_claim_dispatch_rows_scoped with p_platform_name when target_platform is google_ads", async () => {
      const row = makeRow({ platform_name: "google_ads" });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        claimScope: { targetPlatform: "google_ads" },
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
      });

      expect(mock.rpcCalls[0]?.fn).toBe("wm_claim_dispatch_rows_scoped");
      expect(mock.rpcCalls[0]?.args).toEqual({
        p_limit: 25,
        p_lock_stale_minutes: 10,
        p_platform_name: "google_ads",
        p_dispatch_id: null,
      });
    });

    it("calls wm_claim_dispatch_rows_scoped with p_dispatch_id and effective limit 1", async () => {
      const dispatchId = "00000000-0000-4000-8000-000000000001";
      const row = makeRow({ dispatch_id: dispatchId, platform_name: "google_ads" });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        batchSize: 5,
        claimScope: { dispatchId },
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
      });

      expect(mock.rpcCalls[0]?.fn).toBe("wm_claim_dispatch_rows_scoped");
      expect(mock.rpcCalls[0]?.args).toEqual({
        p_limit: 1,
        p_lock_stale_minutes: 10,
        p_platform_name: null,
        p_dispatch_id: dispatchId,
      });
    });

    it("calls wm_claim_dispatch_rows_scoped with both platform and dispatch_id when provided", async () => {
      const dispatchId = "00000000-0000-4000-8000-000000000002";
      const row = makeRow({ dispatch_id: dispatchId, platform_name: "google_ads" });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        claimScope: { targetPlatform: "google_ads", dispatchId },
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
      });

      expect(mock.rpcCalls[0]?.fn).toBe("wm_claim_dispatch_rows_scoped");
      expect(mock.rpcCalls[0]?.args).toEqual({
        p_limit: 1,
        p_lock_stale_minutes: 10,
        p_platform_name: "google_ads",
        p_dispatch_id: dispatchId,
      });
    });
  });

  describe("parseDispatchWorkerRequest", () => {
    it("rejects invalid target_platform safely", () => {
      const result = parseDispatchWorkerRequest({ target_platform: "meta" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("target_platform must be google_ads when provided");
      }
    });

    it("rejects invalid dispatch_id safely", () => {
      const result = parseDispatchWorkerRequest({ dispatch_id: "not-a-uuid" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("dispatch_id must be a valid UUID when provided");
      }
    });

    it("accepts scoped google_ads smoke body and forces limit 1 when dispatch_id is present", () => {
      const dispatchId = "00000000-0000-4000-8000-000000000003";
      const result = parseDispatchWorkerRequest({
        target_platform: "google_ads",
        dispatch_id: dispatchId,
        limit: 1,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.batchSize).toBe(1);
        expect(result.claimScope).toEqual({
          targetPlatform: "google_ads",
          dispatchId,
        });
      }
    });

    it("preserves unscoped default when body is empty", () => {
      const result = parseDispatchWorkerRequest(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.batchSize).toBe(25);
        expect(result.claimScope).toBeUndefined();
      }
    });
  });

  it("marks mapper-suppressed rows as suppressed", async () => {
    const row = makeRow({
      event_payload: {
        identity: {},
        journey: { route: "/", flow: "public" },
      },
    });

    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const platformUpsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(platformUpsert?.dispatch_status).toBe("suppressed");
  });

  it("marks successful send as sent", async () => {
    const row = makeRow();
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const platformUpsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(platformUpsert?.dispatch_status).toBe("sent");
  });

  it("schedules retry for retryable errors", async () => {
    const row = makeRow({ attempt_count: 2 });
    const mock = new MockDB([row]);
    const now = new Date("2026-04-14T12:00:00.000Z");

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      now: () => now,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({
        ok: false,
        retryable: true,
        statusCode: 503,
        errorMessage: "temporary outage",
      }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const failureUpsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(failureUpsert?.dispatch_status).toBe("failed");
    expect(String(failureUpsert?.next_attempt_at)).toBe("2026-04-14T12:30:00.000Z");
  });

  it("dead-letters after max attempts for retryable errors", async () => {
    const row = makeRow({ attempt_count: 5 });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({
        ok: false,
        retryable: true,
        statusCode: 503,
        errorMessage: "still down",
      }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const failureUpsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(failureUpsert?.dispatch_status).toBe("dead_letter");
    expect(failureUpsert?.next_attempt_at).toBe(null);
  });

  it("dead-letters immediately for non-retryable errors without scheduling a retry", async () => {
    const row = makeRow({ attempt_count: 1 });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({
        ok: false,
        retryable: false,
        statusCode: 400,
        errorMessage: "Bad Request: invalid payload",
      }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const failureUpsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(failureUpsert?.dispatch_status).toBe("dead_letter");
    expect(failureUpsert?.next_attempt_at).toBe(null);
  });

  it("does not resend already sent rows", async () => {
    const row = makeRow({ dispatch_status: "sent" });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
  });

  it("does not crash on old claim row shape without ownership fields", async () => {
    const row = makeRow({
      event_client_slug: "tenant-alpha",
      event_lead_id: undefined,
      event_scan_session_id: undefined,
      event_analysis_id: undefined,
      event_quote_file_id: undefined,
    });
    delete (row as Partial<MockDispatchRow>).event_client_slug;
    delete (row as Partial<MockDispatchRow>).event_lead_id;

    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, { client_slug: "tenant-alpha" });
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(1);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("sends to Meta and injects client_slug when event_client_slug is present", async () => {
    const row = makeRow({ event_client_slug: "Tenant-Beta" });
    const mock = new MockDB([row]);
    let capturedPayload: Record<string, unknown> | null = null;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async (payload) => {
        capturedPayload = payload;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(capturedPayload?.client_slug).toBe("tenant-beta");
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("does not call sendToMeta when slug is null and lead_id is present", async () => {
    const leadId = crypto.randomUUID();
    const row = makeRow({
      event_client_slug: null,
      event_lead_id: leadId,
      attempt_count: 1,
    });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("failed");
    expect(upsert?.error_message).toBe("route_resolution_deferred");
    expect(upsert?.provider_response_code).toBe("ownership_gate");
  });

  it("does not call sendToMeta when slug is null and scan_session_id is present", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_scan_session_id: crypto.randomUUID(),
      attempt_count: 2,
    });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
  });

  it("does not call sendToMeta when slug is null and analysis_id is present", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_analysis_id: crypto.randomUUID(),
      attempt_count: 3,
    });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
  });

  it("does not call sendToMeta when slug is null and quote_file_id is present", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_quote_file_id: crypto.randomUUID(),
      attempt_count: 1,
    });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
  });

  it("defers unresolved tenant rows when attemptCount is less than 4", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_lead_id: crypto.randomUUID(),
      attempt_count: 2,
    });
    const mock = new MockDB([row]);
    const now = new Date("2026-04-14T12:00:00.000Z");

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      now: () => now,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("failed");
    expect(upsert?.error_message).toBe("route_resolution_deferred");
    expect(String(upsert?.next_attempt_at)).toBe("2026-04-14T12:30:00.000Z");
    expect(upsert?.provider_response_body).toMatchObject({
      reason: "route_resolution_deferred",
      route_class: "unresolved",
    });
  });

  it("blocks unresolved tenant rows when attemptCount is 4 or greater", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_lead_id: crypto.randomUUID(),
      attempt_count: 4,
    });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("blocked");
    expect(upsert?.error_message).toBe("legacy_ambiguous_owner");
    expect(upsert?.next_attempt_at).toBeNull();
    expect(upsert?.provider_response_code).toBe("ownership_gate");
  });

  it("blocks no-entity non-allowlisted events immediately as platform_default_not_allowed", async () => {
    const row = makeRow({
      event_client_slug: null,
      event_lead_id: null,
      event_scan_session_id: null,
      event_analysis_id: null,
      event_quote_file_id: null,
      attempt_count: 1,
    });
    const mock = new MockDB([row]);
    let calls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => {
        calls += 1;
        return { ok: true };
      },
      sendToGoogle: async () => ({ ok: true }),
    });

    expect(calls).toBe(0);
    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("blocked");
    expect(upsert?.error_message).toBe("platform_default_not_allowed");
    expect(upsert?.next_attempt_at).toBeNull();
  });

  function makeNextdoorRow(overrides: Partial<MockDispatchRow> = {}): MockDispatchRow {
    return makeRow({
      platform_name: "nextdoor",
      event_name: "lead_identified",
      event_identity_quality: "high",
      event_client_slug: "tenant-alpha",
      ...overrides,
    });
  }

  function makeTikTokRow(overrides: Partial<MockDispatchRow> = {}): MockDispatchRow {
    return makeRow({
      platform_name: "tiktok",
      event_name: "quote_uploaded",
      event_identity_quality: "high",
      event_client_slug: "tenant-alpha",
      event_payload: {
        identity: {
          leadId: crypto.randomUUID(),
          emailHash: "a".repeat(64),
        },
        journey: { route: "/", flow: "public" },
        optimization: {
          approvedForAds: true,
          approvedForIndex: true,
          manualReviewRequired: false,
          valueUsd: 10,
        },
      },
      ...overrides,
    });
  }

  function tiktokWorkerDeps(
    mock: MockDB,
    sendToTikTok: NonNullable<Parameters<typeof runDispatchWorker>[0]["sendToTikTok"]>,
    overrides: Partial<Parameters<typeof runDispatchWorker>[0]> = {},
  ) {
    return {
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToTikTok,
      ...overrides,
    };
  }

  it("nextdoor branch suppresses with nextdoor_sender_not_configured when sendToNextdoor is missing", async () => {
    const row = makeNextdoorRow();
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("nextdoor_sender_not_configured");
  });

  it("nextdoor branch suppresses with nextdoor_missing_action_source_url when URL is missing", async () => {
    const row = makeNextdoorRow();
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToNextdoor: async () => ({ ok: true }),
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("nextdoor_missing_action_source_url");
  });

  it("nextdoor branch suppresses with nextdoor_missing_client_slug when slug cannot be resolved", async () => {
    const row = makeNextdoorRow({
      event_client_slug: null,
      event_lead_id: null,
      event_scan_session_id: null,
      event_analysis_id: null,
      event_quote_file_id: null,
    });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToNextdoor: async () => ({ ok: true }),
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("nextdoor_missing_client_slug");
  });

  it("nextdoor branch passes mapper suppression reason through when mapToNextdoor suppresses", async () => {
    const row = makeNextdoorRow({
      event_payload: {
        identity: {},
        journey: { route: "/", flow: "public" },
      },
    });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToNextdoor: async () => ({ ok: true }),
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("missing_customer");
  });

  it("nextdoor branch calls sendToNextdoor when mapping succeeds", async () => {
    const row = makeNextdoorRow();
    const mock = new MockDB([row]);
    let capturedRequest: Record<string, unknown> | null = null;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async (request) => {
        capturedRequest = request as unknown as Record<string, unknown>;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(capturedRequest?.clientSlug).toBe("tenant-alpha");
    expect(capturedRequest?.verifiedClientSlug).toBe("tenant-alpha");
    expect(capturedRequest?.eventId).toBe("wmc_1");
    expect((capturedRequest?.payload as Record<string, unknown>)?.data_source_id).toBe(
      "server_resolved_by_nextdoor_capi_event",
    );
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("nextdoor branch schedules retry for retryable sendToNextdoor errors", async () => {
    const row = makeNextdoorRow({ attempt_count: 2 });
    const mock = new MockDB([row]);
    const now = new Date("2026-04-14T12:00:00.000Z");

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      now: () => now,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async () => ({
        ok: false,
        retryable: true,
        statusCode: 503,
        errorMessage: "provider_5xx",
      }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("failed");
    expect(String(upsert?.next_attempt_at)).toBe("2026-04-14T12:30:00.000Z");
  });

  it("nextdoor branch dead-letters immediately for non-retryable sendToNextdoor errors", async () => {
    const row = makeNextdoorRow({ attempt_count: 1 });
    const mock = new MockDB([row]);

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async () => ({
        ok: false,
        retryable: false,
        statusCode: 400,
        errorMessage: "provider_4xx",
      }),
    });

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("dead_letter");
    expect(upsert?.next_attempt_at).toBe(null);
  });

  it("google path still sends through sendToGoogle", async () => {
    const row = makeRow({
      platform_name: "google_ads",
      event_name: "lead_identified",
    });
    const mock = new MockDB([row]);
    let googleCalls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => {
        googleCalls += 1;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(googleCalls).toBe(1);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("google branch batch-fetches attribution and query_params from wm_event_log", async () => {
    const row = makeRow({
      platform_name: "google_ads",
      event_name: "phone_verified",
      event_payload: {
        identity: {
          leadId: crypto.randomUUID(),
          phoneHash: "b".repeat(64),
        },
        journey: { route: "/verify", flow: "public" },
        optimization: {
          approvedForAds: true,
          approvedForIndex: true,
          manualReviewRequired: false,
          valueUsd: 10,
        },
      },
    });
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {
      attribution: { gclid: "attr-gclid-from-log", gbraid: "attr-gbraid-from-log" },
      query_params: { wbraid: "query-wbraid-from-log" },
    });

    let sentPayload: Record<string, unknown> | null = null;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async (payload) => {
        sentPayload = payload;
        return { ok: true, statusCode: 200, responseBody: { success: true, dry_run: true } };
      },
    });

    expect(mock.attributionBatchFetchIds).toEqual([row.event_log_id]);
    expect(sentPayload?.gclid).toBe("attr-gclid-from-log");
    expect(sentPayload?.gbraid).toBe("attr-gbraid-from-log");
    expect(sentPayload?.wbraid).toBe("query-wbraid-from-log");
  });

  describe("Google Ads dry-run dispatch bridge", () => {
    const mapPayload = {
      conversion_action: "wm_lead_identified",
      transaction_id: "wmc_google_bridge_test",
      conversion_date_time: "2026-06-24T12:00:00.000Z",
      conversion_value: 10,
      currency_code: "USD",
      gclid: "CjwKCAiAQa4a_FAKE_GCLID_TEST_ONLY",
      user_identifiers: {
        hashed_email: "a".repeat(64),
      },
    };

    it("buildGoogleDryRunDispatchEnvelope wraps mapToGoogle output as dry_run envelope", () => {
      const envelope = buildGoogleDryRunDispatchEnvelope(mapPayload);

      expect(envelope.dry_run).toBe(true);
      expect(envelope.payload).toEqual(mapPayload);
      expect(JSON.stringify(envelope)).not.toMatch(/@|\+1\d{10}|Bearer\s+[A-Za-z0-9._-]{20,}/);
    });

    it("never emits dry_run:false from envelope builder", () => {
      expect(GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY).toBe(true);

      const envelope = buildGoogleDryRunDispatchEnvelope(mapPayload);
      expect(envelope.dry_run).toBe(true);
      expect(envelope.dry_run).not.toBe(false);
    });

    it("buildGoogleDispatchAuthHeaders uses Authorization Bearer service role", () => {
      const headers = buildGoogleDispatchAuthHeaders("staging-service-role-placeholder");

      expect(headers.Authorization).toBe("Bearer staging-service-role-placeholder");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(JSON.stringify(headers)).not.toMatch(/@|\+1\d{10}/);
    });

    it("buildMissingGoogleDispatchUrlResult fails safely without fetch", () => {
      const result = buildMissingGoogleDispatchUrlResult(mapPayload);

      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.errorMessage).toBe("GOOGLE_ADS_DISPATCH_URL is not configured");
      expect(result.requestPayload).toEqual(mapPayload);
    });

    it("evaluateGoogleDispatchHttpResponse requires success:true in body", () => {
      const requestPayload = buildGoogleDryRunDispatchEnvelope(mapPayload);

      const success = evaluateGoogleDispatchHttpResponse(
        { ok: true, status: 200 },
        { success: true, dry_run: true },
        requestPayload,
      );
      expect(success.ok).toBe(true);

      const httpOkOnly = evaluateGoogleDispatchHttpResponse(
        { ok: true, status: 200 },
        { success: false, dry_run: true },
        requestPayload,
      );
      expect(httpOkOnly.ok).toBe(false);
      expect(httpOkOnly.retryable).toBe(false);
    });

    it("google dry-run success marks dispatch row sent with dry_run in provider_response_body", async () => {
      const row = makeRow({
        platform_name: "google_ads",
        event_name: "lead_identified",
        event_payload: {
          identity: {
            leadId: crypto.randomUUID(),
            emailHash: "a".repeat(64),
            gclid: "CjwKCAiAQa4a_FAKE_GCLID_TEST_ONLY",
          },
          journey: { route: "/", flow: "public" },
          optimization: {
            approvedForAds: true,
            approvedForIndex: true,
            manualReviewRequired: false,
            valueUsd: 10,
          },
        },
      });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async () => ({
          ok: true,
          statusCode: 200,
          responseBody: { success: true, dry_run: true },
        }),
      });

      const upsert = mock.updates.wm_platform_dispatch_log?.[0];
      expect(upsert?.dispatch_status).toBe("sent");
      expect(upsert?.provider_response_body).toMatchObject({ dry_run: true });
    });

    it("google branch never uses dry_run:false at worker send boundary", async () => {
      const row = makeRow({
        platform_name: "google_ads",
        event_name: "lead_identified",
        event_payload: {
          identity: {
            leadId: crypto.randomUUID(),
            emailHash: "a".repeat(64),
            gclid: "CjwKCAiAQa4a_FAKE_GCLID_TEST_ONLY",
          },
          journey: { route: "/", flow: "public" },
          optimization: {
            approvedForAds: true,
            approvedForIndex: true,
            manualReviewRequired: false,
            valueUsd: 10,
          },
        },
      });
      const mock = new MockDB([row]);
      const envelopes: Array<{ dry_run?: boolean }> = [];

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async (payload) => {
          envelopes.push(buildGoogleDryRunDispatchEnvelope(payload));
          return { ok: true, statusCode: 200, responseBody: { success: true } };
        },
      });

      expect(envelopes).toEqual([{ dry_run: true, payload: expect.objectContaining({
        conversion_action: "wm_lead_identified",
      }) }]);
      expect(envelopes.some((item) => item.dry_run === false)).toBe(false);
    });
  });

  it("nextdoor branch uses worker-local shouldSendNextdoor override for queued rows", async () => {
    const row = makeNextdoorRow();
    const mock = new MockDB([row]);
    let sendCalls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/nextdoor",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async () => {
        sendCalls += 1;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(sendCalls).toBe(1);
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("nextdoor branch prefers metadata current_page_url over NEXTDOOR_EVENT_SOURCE_URL", async () => {
    const row = makeNextdoorRow({
      event_payload: {
        identity: {
          leadId: crypto.randomUUID(),
          emailHash: "a".repeat(64),
          clickId: "ndclid-1",
        },
        journey: { route: "/", flow: "public" },
        optimization: {
          approvedForAds: true,
          approvedForIndex: true,
          manualReviewRequired: false,
          valueUsd: 10,
        },
        metadata: {
          current_page_url: "/truth-gate?utm_source=nextdoor",
          landing_page_url: "/about?utm_source=nextdoor",
        },
      },
    });
    const mock = new MockDB([row]);
    let actionSourceUrl: string | undefined;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/static-fallback",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async (request) => {
        actionSourceUrl = (request.payload as Record<string, unknown>)
          .action_source_url as string;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(actionSourceUrl).toBe("/truth-gate?utm_source=nextdoor");
    expect(mock.updates.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
  });

  it("nextdoor branch falls back to metadata landing_page_url when current_page_url is absent", async () => {
    const row = makeNextdoorRow({
      event_payload: {
        identity: {
          leadId: crypto.randomUUID(),
          emailHash: "a".repeat(64),
          clickId: "ndclid-1",
        },
        journey: { route: "/", flow: "public" },
        optimization: {
          approvedForAds: true,
          approvedForIndex: true,
          manualReviewRequired: false,
          valueUsd: 10,
        },
        metadata: {
          landing_page_url: "/city/pompano-beach?utm_source=nextdoor",
        },
      },
    });
    const mock = new MockDB([row]);
    let actionSourceUrl: string | undefined;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/static-fallback",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async (request) => {
        actionSourceUrl = (request.payload as Record<string, unknown>)
          .action_source_url as string;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(actionSourceUrl).toBe("/city/pompano-beach?utm_source=nextdoor");
  });

  it("nextdoor branch falls back to NEXTDOOR_EVENT_SOURCE_URL when event URLs are absent", async () => {
    const row = makeNextdoorRow();
    const mock = new MockDB([row]);
    let actionSourceUrl: string | undefined;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      nextdoorEventSourceUrl: "https://windowman.app/static-fallback",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToNextdoor: async (request) => {
        actionSourceUrl = (request.payload as Record<string, unknown>)
          .action_source_url as string;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      },
    });

    expect(actionSourceUrl).toBe("https://windowman.app/static-fallback");
  });

  it("tiktok dry-run success marks dispatch row sent with dry_run in provider_response_body", async () => {
    const row = makeTikTokRow();
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, { attribution: { ttclid: "ttclid-1" } });

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async () => ({
        ok: true,
        statusCode: 200,
        responseBody: { success: true, dry_run: true },
      })),
    );

    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("sent");
    expect(upsert?.provider_response_body).toMatchObject({ dry_run: true });
  });

  it("tiktok dry-run sends dry_run:true to sender bridge", async () => {
    const row = makeTikTokRow();
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {});
    let capturedRequest: Record<string, unknown> | null = null;

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async (request) => {
        capturedRequest = request as unknown as Record<string, unknown>;
        return { ok: true, statusCode: 200, responseBody: { success: true, dry_run: true } };
      }),
    );

    expect(capturedRequest?.dry_run).toBe(true);
    expect(capturedRequest?.clientSlug).toBe("tenant-alpha");
    expect(capturedRequest?.eventId).toBe("wmc_1");
  });

  it("tiktok branch uses buildTikTokPayload with dry-run event source id", async () => {
    const row = makeTikTokRow();
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {});
    let capturedPayload: Record<string, unknown> | null = null;

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async (request) => {
        capturedPayload = request.payload;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      }),
    );

    expect(capturedPayload?.event_source_id).toBe(TIKTOK_DRY_RUN_EVENT_SOURCE_ID);
    expect(capturedPayload?.event_source).toBe("web");
    expect(Array.isArray(capturedPayload?.data)).toBe(true);
  });

  it("tiktok branch batch-fetches attribution and query_params from wm_event_log", async () => {
    const row = makeTikTokRow();
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {
      attribution: { ttclid: "tt-attribution-clid" },
      query_params: { ttp: "ttp-from-query" },
    });
    let capturedPayload: Record<string, unknown> | null = null;

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async (request) => {
        capturedPayload = request.payload;
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      }),
    );

    expect(mock.attributionBatchFetchIds).toEqual([row.event_log_id]);
    const user = ((capturedPayload?.data as Array<Record<string, unknown>>)?.[0]?.user ??
      {}) as Record<string, string>;
    expect(user.ttclid).toBe("tt-attribution-clid");
    expect(user.ttp).toBe("ttp-from-query");
  });

  it("unmapped tiktok event marks dispatch row suppressed", async () => {
    const row = makeTikTokRow({ event_name: "virtual_page_view" });
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {});
    let sendCalls = 0;

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async () => {
        sendCalls += 1;
        return { ok: true };
      }),
    );

    expect(sendCalls).toBe(0);
    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("no_tiktok_mapping");
  });

  it("revenue tiktok event missing value marks dispatch row suppressed", async () => {
    const row = makeTikTokRow({
      event_name: "sold",
      event_payload: {
        identity: {
          leadId: crypto.randomUUID(),
          emailHash: "a".repeat(64),
        },
        journey: { route: "/", flow: "public" },
        optimization: {
          approvedForAds: true,
          approvedForIndex: true,
          manualReviewRequired: false,
        },
      },
    });
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {});
    let sendCalls = 0;

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async () => {
        sendCalls += 1;
        return { ok: true };
      }),
    );

    expect(sendCalls).toBe(0);
    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("missing_revenue_value");
  });

  it("tiktok branch never uses dry_run:false", async () => {
    expect(TIKTOK_DISPATCH_DRY_RUN_ONLY).toBe(true);

    const row = makeTikTokRow();
    const mock = new MockDB([row]);
    mock.eventLogs.set(row.event_log_id, {});
    const dryRunFlags: boolean[] = [];

    await runDispatchWorker(
      tiktokWorkerDeps(mock, async (request) => {
        dryRunFlags.push(request.dry_run);
        return { ok: true, statusCode: 200, responseBody: { success: true } };
      }),
    );

    expect(dryRunFlags).toEqual([true]);
    expect(dryRunFlags.some((flag) => flag === false)).toBe(false);
  });

  it("unsupported non-tiktok platform behavior remains unchanged", async () => {
    const row = makeRow({ platform_name: "internal" });
    const mock = new MockDB([row]);
    let tiktokCalls = 0;

    await runDispatchWorker({
      db: mock as unknown as DBLike,
      metaEventSourceUrl: "https://windowman.app",
      sendToMeta: async () => ({ ok: true }),
      sendToGoogle: async () => ({ ok: true }),
      sendToTikTok: async () => {
        tiktokCalls += 1;
        return { ok: true };
      },
    });

    expect(tiktokCalls).toBe(0);
    const upsert = mock.updates.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("suppressed");
    expect(upsert?.error_message).toBe("unsupported_platform:internal");
  });

  describe("dispatch row write-back", () => {
    it("updates suppressed rows by dispatch_id without partial upsert columns", async () => {
      const row = makeRow({
        event_payload: {
          identity: {},
          journey: { route: "/", flow: "public" },
        },
      });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true }),
        sendToGoogle: async () => ({ ok: true }),
      });

      const update = mock.updates.wm_platform_dispatch_log?.[0];
      expect(update?.id).toBe(row.dispatch_id);
      expect(update?.dispatch_status).toBe("suppressed");
      expect(update).not.toHaveProperty("event_log_id");
      expect(mock.upserts.wm_platform_dispatch_log).toBeUndefined();
      expect(mock.updates.wm_event_log?.length).toBeGreaterThan(0);
    });

    it("updates sent rows by dispatch_id without partial upsert", async () => {
      const row = makeRow();
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
        sendToGoogle: async () => ({ ok: true }),
      });

      const update = mock.updates.wm_platform_dispatch_log?.[0];
      expect(update?.id).toBe(row.dispatch_id);
      expect(update?.dispatch_status).toBe("sent");
      expect(update).not.toHaveProperty("event_log_id");
      expect(mock.upserts.wm_platform_dispatch_log).toBeUndefined();
    });

    it("updates failed/dead_letter rows by dispatch_id without partial upsert", async () => {
      const row = makeRow({ attempt_count: 1 });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({
          ok: false,
          retryable: false,
          statusCode: 400,
          errorMessage: "provider_4xx",
        }),
        sendToGoogle: async () => ({ ok: true }),
      });

      const update = mock.updates.wm_platform_dispatch_log?.[0];
      expect(update?.id).toBe(row.dispatch_id);
      expect(update?.dispatch_status).toBe("dead_letter");
      expect(update).not.toHaveProperty("event_log_id");
      expect(mock.upserts.wm_platform_dispatch_log).toBeUndefined();
    });

    it("updates ownership-gated rows by dispatch_id without partial upsert", async () => {
      const row = makeRow({
        event_client_slug: null,
        event_lead_id: null,
        event_scan_session_id: null,
        event_analysis_id: null,
        event_quote_file_id: null,
        attempt_count: 4,
      });
      const mock = new MockDB([row]);

      await runDispatchWorker({
        db: mock as unknown as DBLike,
        metaEventSourceUrl: "https://windowman.app",
        sendToMeta: async () => ({ ok: true, statusCode: 200, responseBody: { success: true } }),
        sendToGoogle: async () => ({ ok: true }),
      });

      const update = mock.updates.wm_platform_dispatch_log?.[0];
      expect(update?.id).toBe(row.dispatch_id);
      expect(update?.dispatch_status).toBe("blocked");
      expect(update?.provider_response_code).toBe("ownership_gate");
      expect(update).not.toHaveProperty("event_log_id");
      expect(mock.upserts.wm_platform_dispatch_log).toBeUndefined();
    });

    it("does not write private report or secret fields in dispatch write-back", async () => {
      const row = makeTikTokRow();
      const mock = new MockDB([row]);
      mock.eventLogs.set(row.event_log_id, { attribution: { ttclid: "ttclid-1" } });

      await runDispatchWorker(
        tiktokWorkerDeps(mock, async () => ({
          ok: true,
          statusCode: 200,
          responseBody: { success: true, dry_run: true },
        })),
      );

      const serialized = JSON.stringify(mock.updates.wm_platform_dispatch_log ?? []);
      expect(serialized).not.toMatch(/full_json|signedUrl|createSignedUrl|ACCESS_TOKEN|SECRET|ocr/i);
      expect(mock.updates.wm_platform_dispatch_log?.[0]?.provider_response_body).toMatchObject({
        dry_run: true,
      });
    });
  });

  describe("resolveNextdoorActionSourceUrl", () => {
    it("prefers current_page_url, then landing_page_url, then fallback", () => {
      const canonical = {
        eventId: "wmc_1",
        eventName: "lead_identified" as const,
        eventTimestamp: "2026-04-14T12:00:00.000Z",
        schemaVersion: "1.0.0",
        dispatchStatus: "processing" as const,
        identityQuality: "high" as const,
        shouldSendMeta: false,
        shouldSendGoogle: false,
        shouldSendNextdoor: true,
        payload: {
          identity: {},
          journey: { route: "/", flow: "public" as const },
          metadata: {
            current_page_url: "/truth-gate",
            landing_page_url: "/about?utm_source=nextdoor",
          },
        },
      };

      expect(resolveNextdoorActionSourceUrl(canonical, "https://fallback.example")).toBe(
        "/truth-gate",
      );

      const landingOnly = {
        ...canonical,
        payload: {
          ...canonical.payload,
          metadata: { landing_page_url: "/about?utm_source=nextdoor" },
        },
      };
      expect(resolveNextdoorActionSourceUrl(landingOnly, "https://fallback.example")).toBe(
        "/about?utm_source=nextdoor",
      );

      const noEventUrls = {
        ...canonical,
        payload: {
          identity: {},
          journey: { route: "/", flow: "public" as const },
        },
      };
      expect(resolveNextdoorActionSourceUrl(noEventUrls, "https://fallback.example")).toBe(
        "https://fallback.example",
      );
    });
  });
});
