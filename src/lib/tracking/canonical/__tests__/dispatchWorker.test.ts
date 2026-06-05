import { describe, expect, it } from "vitest";
import { runDispatchWorker, type DBLike } from "../dispatchWorker";
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
}

class MockDB {
  public eventStatuses = new Map<string, WMDispatchStatus[]>([]);
  public upserts: Record<string, Array<Record<string, unknown>>> = {};
  public eventLogs = new Map<string, EventLogRecord>();
  public slugLookups: Record<string, Record<string, string | null>> = {
    leads: {},
    scan_sessions: {},
    analyses: {},
  };
  public quoteFileLeads: Record<string, string | null> = {};

  constructor(private rows: MockDispatchRow[]) {
    for (const row of rows) {
      this.eventStatuses.set(row.event_log_id, [row.dispatch_status]);
    }
  }

  async rpc<T>(_fn: string): Promise<{ data: T | null; error: { message?: string } | null }> {
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
        in: (_column: string, _values: string[]) => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
      upsert: async (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        this.upserts[table] = [...(this.upserts[table] ?? []), ...rows];

        if (table === "wm_platform_dispatch_log") {
          for (const row of rows) {
            const dispatchId = row.id as string;
            const matched = this.rows.find((item) => item.dispatch_id === dispatchId);
            if (matched && typeof row.dispatch_status === "string") {
              matched.dispatch_status = row.dispatch_status as WMDispatchStatus;
              const eventStatusList = this.eventStatuses.get(matched.event_log_id) ?? [];
              this.eventStatuses.set(matched.event_log_id, [matched.dispatch_status, ...eventStatusList.slice(1)]);
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

    const platformUpsert = mock.upserts.wm_platform_dispatch_log?.[0];
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

    const platformUpsert = mock.upserts.wm_platform_dispatch_log?.[0];
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

    const failureUpsert = mock.upserts.wm_platform_dispatch_log?.[0];
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

    const failureUpsert = mock.upserts.wm_platform_dispatch_log?.[0];
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

    const failureUpsert = mock.upserts.wm_platform_dispatch_log?.[0];
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
    expect(mock.upserts.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
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
    expect(mock.upserts.wm_platform_dispatch_log?.[0]?.dispatch_status).toBe("sent");
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
    const upsert = mock.upserts.wm_platform_dispatch_log?.[0];
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
    expect(mock.upserts.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
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
    expect(mock.upserts.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
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
    expect(mock.upserts.wm_platform_dispatch_log?.[0]?.error_message).toBe("route_resolution_deferred");
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

    const upsert = mock.upserts.wm_platform_dispatch_log?.[0];
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

    const upsert = mock.upserts.wm_platform_dispatch_log?.[0];
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
    const upsert = mock.upserts.wm_platform_dispatch_log?.[0];
    expect(upsert?.dispatch_status).toBe("blocked");
    expect(upsert?.error_message).toBe("platform_default_not_allowed");
    expect(upsert?.next_attempt_at).toBeNull();
  });
});
