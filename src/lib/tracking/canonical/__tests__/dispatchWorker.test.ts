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
}

class MockDB {
  public eventStatuses = new Map<string, WMDispatchStatus[]>([]);
  public upserts: Record<string, Array<Record<string, unknown>>> = {};

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
          maybeSingle: async () => ({ data: null, error: null }),
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
});
