import { describe, expect, it } from "vitest";
import { rowFromCapi, type CapiDiagnosticCode, type CapiSignalLogRow } from "@/services/signalDispatch";

const FIRED_AT = "2026-09-03T12:00:00.000Z";
const FIRED_SECONDS = Math.floor(Date.parse(FIRED_AT) / 1_000);
const SHA_A = "a".repeat(64);
const SHA_B = "B".repeat(64);

function capiRow(payload: unknown, overrides: Partial<CapiSignalLogRow> = {}): CapiSignalLogRow {
  return {
    id: "log-1",
    fired_at: FIRED_AT,
    client_slug: "windowman",
    pixel_id: "1234567890",
    event_name: "Lead",
    status_code: 200,
    payload,
    response: { events_received: 1 },
    ...overrides,
  };
}

function payload(userData: Record<string, unknown> = {}, eventOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data: [{
      event_id: "event-123",
      event_name: "Lead",
      event_time: FIRED_SECONDS,
      action_source: "website",
      user_data: userData,
      ...eventOverrides,
    }],
  };
}

function diagnosticsFor(rawPayload: unknown, overrides: Partial<CapiSignalLogRow> = {}) {
  const diagnostics = rowFromCapi(capiRow(rawPayload, overrides)).capiDiagnostics;
  expect(diagnostics).not.toBeNull();
  return diagnostics!;
}

describe("rowFromCapi envelope safety", () => {
  it.each<[string, unknown, CapiDiagnosticCode, string]>([
    ["null payload", null, "CAPI_ENVELOPE_NOT_OBJECT", "not_object"],
    ["primitive payload", "bad", "CAPI_ENVELOPE_NOT_OBJECT", "not_object"],
    ["missing data", {}, "CAPI_DATA_MISSING", "data_missing"],
    ["non-array data", { data: {} }, "CAPI_DATA_NOT_ARRAY", "data_not_array"],
    ["empty data", { data: [] }, "CAPI_DATA_EMPTY", "data_empty"],
    ["null first event", { data: [null] }, "CAPI_EVENT_NOT_OBJECT", "event_not_object"],
    ["primitive first event", { data: [42] }, "CAPI_EVENT_NOT_OBJECT", "event_not_object"],
    ["missing user_data", { data: [{}] }, "CAPI_USER_DATA_MISSING", "user_data_missing"],
    ["null user_data", { data: [{ user_data: null }] }, "CAPI_USER_DATA_NOT_OBJECT", "user_data_not_object"],
    ["array user_data", { data: [{ user_data: [] }] }, "CAPI_USER_DATA_NOT_OBJECT", "user_data_not_object"],
    ["primitive user_data", { data: [{ user_data: "bad" }] }, "CAPI_USER_DATA_NOT_OBJECT", "user_data_not_object"],
  ])("returns an unscorable safe row for %s", (_label, rawPayload, reason, envelope) => {
    expect(() => rowFromCapi(capiRow(rawPayload))).not.toThrow();
    const row = rowFromCapi(capiRow(rawPayload));

    expect(row.id).toBe("capi:log-1");
    expect(row.capiDiagnostics).toMatchObject({ scorable: false, dispatch: { envelope } });
    expect(row.capiDiagnostics?.reasonCodes[0]).toBe(reason);
    expect(Object.values(row.matchKeys).every((value) => typeof value === "boolean")).toBe(true);
  });

  it("traverses the standard data array and detects canonical match fields", () => {
    const row = rowFromCapi(capiRow(payload({
      em: [SHA_A],
      ph: [SHA_B],
      fbp: "fb.1.1756900800000.browser.segment",
      fbc: "fb.1.1756900800000.click.segment",
      external_id: SHA_A,
      client_ip_address: "203.0.113.10",
      client_user_agent: "Mozilla/5.0",
    })));

    expect(row.eventId).toBe("event-123");
    expect(row.leadId).toBeNull();
    expect(row.matchKeys).toMatchObject({
      emailHash: true,
      phoneHash: true,
      fbp: true,
      fbc: true,
      externalId: true,
      leadId: false,
      clientIpPresent: true,
      clientUserAgentPresent: true,
    });
    expect(row.capiDiagnostics).toMatchObject({ scorable: true, reasonCodes: [], dispatch: { envelope: "valid" } });
  });
});

describe("rowFromCapi match classifiers", () => {
  it.each([
    ["lowercase hash", SHA_A, "valid"],
    ["uppercase hash", SHA_B, "valid"],
    ["canonical array", [SHA_A], "valid"],
    ["empty array", [], "missing"],
    ["whitespace array", ["   "], "malformed"],
    ["mixed invalid array", [SHA_A, "raw"], "not_sha256"],
    ["raw email", "private@example.com", "not_sha256"],
    ["short hash", "abc123", "not_sha256"],
    ["object", { hash: SHA_A }, "malformed"],
    ["nested array", [[SHA_A]], "malformed"],
    ["missing", undefined, "missing"],
  ] as const)("classifies email %s", (_label, value, expected) => {
    expect(diagnosticsFor(payload({ em: value })).match.emailHash).toBe(expected);
  });

  it.each([
    ["canonical array", [SHA_A], "valid"],
    ["raw phone", "+1 561 555 0123", "not_sha256"],
    ["empty array", [], "missing"],
    ["invalid array", [null, ""], "malformed"],
    ["object", {}, "malformed"],
  ] as const)("classifies phone %s", (_label, value, expected) => {
    expect(diagnosticsFor(payload({ ph: value })).match.phoneHash).toBe(expected);
  });

  it("requires a scalar SHA-256 external ID and never treats it as a lead ID", () => {
    const valid = rowFromCapi(capiRow(payload({ external_id: SHA_A })));
    const array = rowFromCapi(capiRow(payload({ external_id: [SHA_A] })));

    expect(valid.matchKeys.externalId).toBe(true);
    expect(valid.leadId).toBeNull();
    expect(valid.matchKeys.leadId).toBe(false);
    expect(array.capiDiagnostics?.match.externalId).toBe("malformed");
  });

  it.each([
    ["valid fbp", "fb.1.1756900800000.browser-id", "valid"],
    ["opaque suffix with periods", "fb.12.1756900800000.opaque.with.periods", "valid"],
    ["seconds cookie timestamp", "fb.1.1756900800.opaque", "valid"],
    ["lowercase hash", SHA_A, "hashed"],
    ["uppercase hash", SHA_B, "hashed"],
    ["missing", undefined, "missing"],
    ["whitespace", "   ", "missing"],
    ["bad prefix", "xx.1.1756900800000.opaque", "malformed"],
    ["missing creation time", "fb.1..opaque", "malformed"],
    ["empty opaque suffix", "fb.1.1756900800000.", "malformed"],
    ["array", ["fb.1.1756900800000.opaque"], "malformed"],
    ["nested array", [["fb.1.1756900800000.opaque"]], "malformed"],
    ["object", {}, "malformed"],
    ["number", 123, "malformed"],
  ] as const)("classifies fbp %s", (_label, value, expected) => {
    expect(diagnosticsFor(payload({ fbp: value })).match.fbp).toBe(expected);
  });

  it("distinguishes missing fbc from malformed fbc and accepts millisecond cookie time", () => {
    const missing = diagnosticsFor(payload({}));
    const malformed = diagnosticsFor(payload({ fbc: "fb.1.bad.click" }));
    const valid = diagnosticsFor(payload({ fbc: "fb.1.1756900800000.click.id" }));

    expect(missing.match.fbc).toBe("missing");
    expect(missing.reasonCodes).toContain("CAPI_FBC_MISSING");
    expect(malformed.match.fbc).toBe("malformed");
    expect(malformed.reasonCodes).toContain("CAPI_FBC_MALFORMED");
    expect(valid.match.fbc).toBe("valid");
  });

  it.each([
    ["valid IP", "203.0.113.10", "valid"],
    ["fallback IP", "0.0.0.0", "fallback"],
    ["missing IP", undefined, "missing"],
    ["whitespace IP", "   ", "missing"],
    ["wrong-type IP", { ip: "203.0.113.10" }, "malformed"],
  ] as const)("classifies %s", (_label, value, expected) => {
    expect(diagnosticsFor(payload({ client_ip_address: value })).match.clientIp).toBe(expected);
  });

  it.each([
    ["valid UA", "Mozilla/5.0", "valid"],
    ["missing UA", undefined, "missing"],
    ["whitespace UA", "  ", "missing"],
    ["wrong-type UA", ["Mozilla/5.0"], "malformed"],
  ] as const)("classifies %s", (_label, value, expected) => {
    expect(diagnosticsFor(payload({ client_user_agent: value })).match.clientUserAgent).toBe(expected);
  });
});

describe("rowFromCapi event_time", () => {
  it.each([
    ["valid seconds", FIRED_SECONDS, "valid", "valid", null],
    ["exactly seven days old", FIRED_SECONDS - 7 * 24 * 60 * 60, "valid", "valid", null],
    ["one second stale", FIRED_SECONDS - 7 * 24 * 60 * 60 - 1, "valid", "stale", "CAPI_TIME_STALE"],
    ["one second future", FIRED_SECONDS + 1, "valid", "future", "CAPI_TIME_FUTURE"],
    ["numeric string", String(FIRED_SECONDS), "wrong_type", "not_evaluated", "CAPI_TIME_WRONG_TYPE"],
    ["empty string", "", "wrong_type", "not_evaluated", "CAPI_TIME_WRONG_TYPE"],
    ["float", FIRED_SECONDS + 0.5, "unsafe_integer", "not_evaluated", "CAPI_TIME_UNSAFE_INTEGER"],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1, "unsafe_integer", "not_evaluated", "CAPI_TIME_UNSAFE_INTEGER"],
    ["NaN", Number.NaN, "wrong_type", "not_evaluated", "CAPI_TIME_WRONG_TYPE"],
    ["positive infinity", Number.POSITIVE_INFINITY, "wrong_type", "not_evaluated", "CAPI_TIME_WRONG_TYPE"],
    ["negative infinity", Number.NEGATIVE_INFINITY, "wrong_type", "not_evaluated", "CAPI_TIME_WRONG_TYPE"],
    ["negative integer", -1, "out_of_range", "not_evaluated", "CAPI_TIME_OUT_OF_RANGE"],
    ["Date.now-style milliseconds", 1_756_900_800_000, "wrong_unit", "not_evaluated", "CAPI_TIME_WRONG_UNIT"],
    ["other oversized seconds", 10_000_000_000, "out_of_range", "not_evaluated", "CAPI_TIME_OUT_OF_RANGE"],
  ] as const)("classifies %s", (_label, value, format, drift, reason) => {
    const diagnostics = diagnosticsFor(payload({}, { event_time: value }));

    expect(diagnostics.dispatch.eventTimeFormat).toBe(format);
    expect(diagnostics.dispatch.eventTimeDrift).toBe(drift);
    if (reason) expect(diagnostics.reasonCodes).toContain(reason);
  });

  it("reports milliseconds as wrong unit rather than future", () => {
    const diagnostics = diagnosticsFor(payload({}, { event_time: 1_756_900_800_000 }));
    expect(diagnostics.reasonCodes).toContain("CAPI_TIME_WRONG_UNIT");
    expect(diagnostics.reasonCodes).not.toContain("CAPI_TIME_FUTURE");
  });

  it("uses fired_at as the historical reference and never falls back to the wall clock", () => {
    const historical = rowFromCapi(capiRow(payload({}, { event_time: 1_700_000_000 }), {
      fired_at: new Date(1_700_000_000 * 1_000).toISOString(),
    }));
    const unavailable = diagnosticsFor(payload({}, { event_time: 1_700_000_000 }), { fired_at: "invalid" });

    expect(historical.capiDiagnostics?.dispatch.eventTimeDrift).toBe("valid");
    expect(unavailable.dispatch.eventTimeDrift).toBe("reference_unavailable");
    expect(unavailable.reasonCodes).toContain("CAPI_TIME_REFERENCE_UNAVAILABLE");
  });
});

describe("rowFromCapi required fields and output contract", () => {
  it.each([
    ["missing", undefined, "missing", "CAPI_EVENT_ID_MISSING"],
    ["empty", "", "missing", "CAPI_EVENT_ID_MISSING"],
    ["whitespace", "   ", "missing", "CAPI_EVENT_ID_MISSING"],
    ["wrong type", 42, "wrong_type", "CAPI_EVENT_ID_WRONG_TYPE"],
    ["UUID", "01f695fe-5209-43a6-bf49-c255d625084f", "valid", null],
    ["non-UUID", "dedupe-key", "valid", null],
  ] as const)("classifies event_id %s", (_label, value, expected, reason) => {
    const row = rowFromCapi(capiRow(payload({}, { event_id: value })));
    expect(row.capiDiagnostics?.dispatch.eventId).toBe(expected);
    if (reason) expect(row.capiDiagnostics?.reasonCodes).toContain(reason);
  });

  it("preserves the existing top-level event_id fallback", () => {
    const raw = payload({}, { event_id: undefined });
    raw.event_id = "top-level-event";
    const row = rowFromCapi(capiRow(raw));

    expect(row.eventId).toBe("top-level-event");
    expect(row.capiDiagnostics?.dispatch.eventId).toBe("valid");
  });

  it.each([
    ["missing event name", undefined, "missing", "CAPI_EVENT_NAME_MISSING"],
    ["wrong-type event name", 42, "wrong_type", "CAPI_EVENT_NAME_WRONG_TYPE"],
    ["matching event name", "Lead", "valid", null],
    ["mismatched event name", "Purchase", "log_mismatch", "CAPI_EVENT_NAME_LOG_MISMATCH"],
  ] as const)("classifies %s", (_label, value, expected, reason) => {
    const diagnostics = diagnosticsFor(payload({}, { event_name: value }));
    expect(diagnostics.dispatch.eventName).toBe(expected);
    if (reason) expect(diagnostics.reasonCodes).toContain(reason);
  });

  it.each([
    ["missing action source", undefined, "missing", "CAPI_ACTION_SOURCE_MISSING"],
    ["wrong-type action source", 42, "wrong_type", "CAPI_ACTION_SOURCE_WRONG_TYPE"],
    ["website action source", "website", "valid", null],
    ["unexpected WindowMan action source", "app", "unexpected", "CAPI_ACTION_SOURCE_UNEXPECTED"],
  ] as const)("classifies %s", (_label, value, expected, reason) => {
    const diagnostics = diagnosticsFor(payload({}, { action_source: value }));
    expect(diagnostics.dispatch.actionSource).toBe(expected);
    if (reason) expect(diagnostics.reasonCodes).toContain(reason);
  });

  it("returns reason codes once in fixed match, time, ID, name, source order", () => {
    const row = rowFromCapi(capiRow(payload({}, {
      event_time: 1_756_900_800_000,
      event_id: undefined,
      event_name: undefined,
      action_source: undefined,
    })));

    expect(row.capiDiagnostics?.reasonCodes).toEqual([
      "CAPI_EMAIL_MISSING",
      "CAPI_PHONE_MISSING",
      "CAPI_CLIENT_IP_MISSING",
      "CAPI_CLIENT_UA_MISSING",
      "CAPI_FBP_MISSING",
      "CAPI_FBC_MISSING",
      "CAPI_EXTERNAL_ID_MISSING",
      "CAPI_TIME_WRONG_UNIT",
      "CAPI_EVENT_ID_MISSING",
      "CAPI_EVENT_NAME_MISSING",
      "CAPI_ACTION_SOURCE_MISSING",
    ]);
    expect(new Set(row.capiDiagnostics?.reasonCodes).size).toBe(row.capiDiagnostics?.reasonCodes.length);
  });

  it("keeps raw identifier sentinels out of the serialized sanitized row", () => {
    const sentinels = {
      email: "raw-email-sentinel@example.com",
      phone: "+1-555-raw-phone-sentinel",
      external: "external-id-sentinel-unique",
      fbp: "fbp-sentinel-unique",
      fbc: "fbc-sentinel-unique",
      ip: "203.0.113.199",
      ua: "private-user-agent-sentinel",
    };
    const row = rowFromCapi(capiRow(payload({
      em: sentinels.email,
      ph: sentinels.phone,
      external_id: sentinels.external,
      fbp: sentinels.fbp,
      fbc: sentinels.fbc,
      client_ip_address: sentinels.ip,
      client_user_agent: sentinels.ua,
    })));
    const serialized = JSON.stringify(row);

    expect(row.leadId).toBeNull();
    expect(Object.values(row.matchKeys).every((value) => typeof value === "boolean")).toBe(true);
    for (const sentinel of Object.values(sentinels)) expect(serialized).not.toContain(sentinel);
  });
});
