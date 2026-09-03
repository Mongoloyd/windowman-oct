import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EMQValidator } from "@/components/admin/EMQValidator";
import type { CapiDiagnosticCode, CapiDiagnostics, SignalEventRow } from "@/services/signalDispatch";

const EMPTY_KEYS: SignalEventRow["matchKeys"] = {
  emailHash: false,
  phoneHash: false,
  fbc: false,
  fbp: false,
  gclid: false,
  externalId: false,
  leadId: false,
  clientIpPresent: false,
  clientUserAgentPresent: false,
};

function makeDiagnostics(reasonCodes: CapiDiagnosticCode[] = [], overrides: Partial<CapiDiagnostics> = {}): CapiDiagnostics {
  return {
    scorable: true,
    reasonCodes,
    match: {
      emailHash: "missing",
      phoneHash: "missing",
      clientIp: "missing",
      clientUserAgent: "missing",
      fbp: "missing",
      fbc: "missing",
      externalId: "missing",
    },
    dispatch: {
      envelope: "valid",
      eventTimeFormat: "valid",
      eventTimeDrift: "valid",
      eventId: "valid",
      eventName: "valid",
      actionSource: "valid",
    },
    ...overrides,
  };
}

function makeRow(overrides: Partial<SignalEventRow> = {}): SignalEventRow {
  return {
    id: "capi:1",
    sourceTable: "capi_signal_logs",
    timestamp: "2026-09-03T12:00:00.000Z",
    platform: "Meta CAPI",
    eventType: "Lead",
    leadId: null,
    sourceCampaign: null,
    eventId: "event-1",
    dedupKey: "event-1",
    matchKeys: { ...EMPTY_KEYS },
    capiDiagnostics: makeDiagnostics(),
    httpStatus: 200,
    status: "success",
    retryStatus: "Complete",
    payloadHash: null,
    payloadVersion: null,
    payloadSize: null,
    responseCode: null,
    errorMessage: null,
    responseExcerpt: null,
    related: {},
    ...overrides,
  };
}

function rowsWithNewestCodes(codes: CapiDiagnosticCode[], count: number): SignalEventRow[] {
  return Array.from({ length: count }, (_, index) => makeRow({
    id: `capi:${index}`,
    eventType: `Event ${index}`,
    timestamp: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    capiDiagnostics: makeDiagnostics(codes),
  }));
}

describe("EMQValidator lifecycle", () => {
  it("renders loading, fetch error, empty, and success states", () => {
    const { rerender } = render(<EMQValidator events={[]} isLoading error={null} />);
    expect(screen.getByLabelText(/Loading Meta CAPI match readiness/i)).toBeInTheDocument();

    rerender(<EMQValidator events={[]} isLoading={false} error="network" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/failed to load/i);

    rerender(<EMQValidator events={[]} isLoading={false} error={null} />);
    expect(screen.getByText(/No Meta CAPI dispatch rows found/i)).toBeInTheDocument();

    rerender(<EMQValidator events={[makeRow()]} isLoading={false} error={null} />);
    expect(screen.getByLabelText(/Latest 20 CAPI diagnostic rows/i)).toBeInTheDocument();
  });

  it("labels the score and codes as WindowMan internal diagnostics", () => {
    render(<EMQValidator events={[]} isLoading={false} error={null} />);
    expect(screen.getByText(/Internal estimate—not Meta-reported EMQ/i)).toBeInTheDocument();
    expect(screen.getByText(/WindowMan diagnostic codes—not Meta response codes/i)).toHaveClass("!text-white");
    expect(screen.getByText(/The validator shows only existing capi_signal_logs evidence/i)).toHaveClass("!text-white");
    expect(screen.getByText(/This panel diagnoses existing sanitized logs only/i)).toHaveClass("!text-white");
    expect(screen.getByTestId("emq-empty-state")).not.toHaveClass("text-emerald-100");
  });
});

describe("EMQValidator latest-20 selection", () => {
  it("filters non-CAPI sources, sorts newest first, limits to 20, and preserves input order", () => {
    const capiRows = rowsWithNewestCodes([], 22);
    const nonCapi = makeRow({ id: "conversion:1", sourceTable: "conversion_logs", eventType: "Exclude me" });
    const events = [nonCapi, ...capiRows];
    const originalOrder = events.map((event) => event.id);

    render(<EMQValidator events={events} isLoading={false} error={null} />);

    const rows = screen.getAllByTestId(/^emq-row-/);
    expect(rows).toHaveLength(20);
    expect(within(rows[0]).getByText("Event 21")).toBeInTheDocument();
    expect(within(rows[19]).getByText("Event 2")).toBeInTheDocument();
    expect(screen.queryByText("Exclude me")).not.toBeInTheDocument();
    expect(events.map((event) => event.id)).toEqual(originalOrder);
  });

  it("places invalid timestamps last without mutating the input", () => {
    const events = [
      makeRow({ id: "older", eventType: "Older", timestamp: "2026-09-01T00:00:00.000Z" }),
      makeRow({ id: "invalid", eventType: "Invalid", timestamp: "not-a-date" }),
      makeRow({ id: "newer", eventType: "Newer", timestamp: "2026-09-03T00:00:00.000Z" }),
    ];
    render(<EMQValidator events={events} isLoading={false} error={null} />);
    const rows = screen.getAllByTestId(/^emq-row-/);
    expect(within(rows[0]).getByText("Newer")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Invalid timestamp")).toBeInTheDocument();
  });

  it("keeps five newer malformed real rows in the visible 20 instead of backfilling older valid rows", () => {
    const events = Array.from({ length: 25 }, (_, index) => {
      const malformed = index >= 20;
      return makeRow({
        id: `capi:${index}`,
        eventType: `Event ${index}`,
        timestamp: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
        capiDiagnostics: malformed
          ? makeDiagnostics(["CAPI_DATA_EMPTY"], { scorable: false, dispatch: { ...makeDiagnostics().dispatch, envelope: "data_empty" } })
          : makeDiagnostics(),
      });
    });

    render(<EMQValidator events={events} isLoading={false} error={null} />);

    expect(screen.getAllByTestId(/^emq-row-/)).toHaveLength(20);
    expect(screen.getAllByLabelText("Unable to score")).toHaveLength(5);
    expect(screen.getByText("Event 24")).toBeInTheDocument();
    expect(screen.getByText("Event 5")).toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();

    const malformedRow = screen.getAllByTestId(/^emq-row-/)[0];
    fireEvent.click(within(malformedRow).getByText("Event 24"));
    expect(within(malformedRow).getAllByText("CAPI_DATA_EMPTY").length).toBeGreaterThan(0);
  });

  it("ignores artificial nullish and primitive entries without ghost rows", () => {
    const hostile = [null, undefined, "bad", 42, makeRow()] as unknown as SignalEventRow[];
    render(<EMQValidator events={hostile} isLoading={false} error={null} />);
    expect(screen.getAllByTestId(/^emq-row-/)).toHaveLength(1);
  });
});

describe("EMQValidator row explanations", () => {
  it("preserves green, yellow, red, and unscorable bands", () => {
    const fullKeys = { ...EMPTY_KEYS, emailHash: true, phoneHash: true, fbc: true, fbp: true, externalId: true, clientIpPresent: true, clientUserAgentPresent: true };
    const validMatch = { emailHash: "valid", phoneHash: "valid", fbc: "valid", fbp: "valid", externalId: "valid", clientIp: "valid", clientUserAgent: "valid" } as const;
    const rows = [
      makeRow({ id: "high", eventType: "High", matchKeys: fullKeys, capiDiagnostics: makeDiagnostics([], { match: validMatch }) }),
      makeRow({ id: "mid", eventType: "Mid", matchKeys: { ...EMPTY_KEYS, emailHash: true, fbp: true, clientUserAgentPresent: true } }),
      makeRow({ id: "low", eventType: "Low" }),
      makeRow({ id: "none", eventType: "Unscorable", capiDiagnostics: makeDiagnostics(["CAPI_DATA_EMPTY"], { scorable: false }) }),
    ];
    render(<EMQValidator events={rows} isLoading={false} error={null} />);
    expect(screen.getByLabelText("10 out of 10")).toHaveClass("text-emerald-200");
    expect(screen.getByLabelText("4 out of 10")).toHaveClass("text-yellow-100");
    expect(screen.getByLabelText("0 out of 10")).toHaveClass("text-red-200");
    expect(screen.getByLabelText("Unable to score")).toHaveClass("text-slate-100");
  });

  it("expands to the exact ledger, deterministic findings, platform outcome, and confidence labels", () => {
    const row = makeRow({
      matchKeys: { ...EMPTY_KEYS, emailHash: true },
      capiDiagnostics: makeDiagnostics([
        "CAPI_FBP_HASHED",
        "CAPI_TIME_WRONG_UNIT",
        "CAPI_EVENT_ID_MISSING",
        "CAPI_EVENT_NAME_LOG_MISMATCH",
        "CAPI_ACTION_SOURCE_UNEXPECTED",
      ], { match: { ...makeDiagnostics().match, emailHash: "valid", fbp: "hashed" } }),
      httpStatus: 400,
    });
    render(<EMQValidator events={[row]} isLoading={false} error={null} />);
    const details = screen.getByTestId("emq-row-0");
    fireEvent.click(within(details).getByText("Lead"));

    expect(within(details).getByText("Why this score?")).toBeInTheDocument();
    expect(within(details).getByText("2 / 2")).toBeInTheDocument();
    expect(within(details).getAllByText(/0 \/ [12]/)).toHaveLength(6);
    expect(within(details).getAllByText("CAPI_FBP_HASHED").length).toBeGreaterThan(0);
    expect(within(details).getAllByText("CAPI_TIME_WRONG_UNIT").length).toBeGreaterThan(0);
    expect(within(details).getAllByText("CAPI_EVENT_ID_MISSING").length).toBeGreaterThan(0);
    expect(within(details).getAllByText("CAPI_EVENT_NAME_LOG_MISMATCH").length).toBeGreaterThan(0);
    expect(within(details).getAllByText("CAPI_ACTION_SOURCE_UNEXPECTED").length).toBeGreaterThan(0);
    expect(within(details).getByText(/Meta request rejected at HTTP layer/i)).toBeInTheDocument();
    expect(within(details).getByText(/causal relationship not proven/i)).toBeInTheDocument();
    expect(within(details).getAllByText(/OBSERVED/).length).toBeGreaterThan(0);
    expect(within(details).getAllByText(/INFERRED/).length).toBeGreaterThan(0);
    expect(within(details).getByText(/Meta-reported EMQ remain UNKNOWN/i)).toBeInTheDocument();
  });

  it("uses green only for earned factors, clean integrity, and an actual 2xx outcome", () => {
    const fullKeys = { ...EMPTY_KEYS, emailHash: true, phoneHash: true, fbc: true, fbp: true, externalId: true, clientIpPresent: true, clientUserAgentPresent: true };
    const validMatch = { emailHash: "valid", phoneHash: "valid", fbc: "valid", fbp: "valid", externalId: "valid", clientIp: "valid", clientUserAgent: "valid" } as const;
    const rows = [
      makeRow({ id: "healthy", eventType: "Healthy", matchKeys: fullKeys, capiDiagnostics: makeDiagnostics([], { match: validMatch }), httpStatus: 200 }),
      makeRow({ id: "warning", eventType: "Warning", capiDiagnostics: makeDiagnostics(["CAPI_TIME_WRONG_UNIT"]), httpStatus: 400 }),
      makeRow({ id: "unscorable", eventType: "Unscorable", capiDiagnostics: makeDiagnostics(["CAPI_DATA_EMPTY"], { scorable: false }), httpStatus: null }),
    ];
    render(<EMQValidator events={rows} isLoading={false} error={null} />);

    const healthy = screen.getByTestId("emq-row-0");
    fireEvent.click(within(healthy).getByText("Healthy"));
    expect(healthy.querySelectorAll('[data-factor-status="ready"]')).toHaveLength(7);
    expect(within(healthy).getByText(/No integrity warnings detected/i)).toHaveClass("text-emerald-100");
    expect(healthy.querySelector('[data-platform-outcome="accepted"]')).toHaveClass("bg-emerald-400/10");

    const warning = screen.getByTestId("emq-row-1");
    fireEvent.click(within(warning).getByText("Warning"));
    expect(within(warning).queryByText(/No integrity warnings detected/i)).not.toBeInTheDocument();
    expect(warning.querySelector('[data-platform-outcome="not-accepted"]')).not.toHaveClass("bg-emerald-400/10");

    const unscorable = screen.getByTestId("emq-row-2");
    fireEvent.click(within(unscorable).getByText("Unscorable"));
    expect(unscorable.querySelectorAll('[data-factor-status="ready"]')).toHaveLength(0);
    expect(within(unscorable).queryByText(/No integrity warnings detected/i)).not.toBeInTheDocument();
  });
});

describe("EMQValidator global intelligence", () => {
  it("uses the full sample, reports dominant frequency, and shows a seven-row streak", () => {
    const events = rowsWithNewestCodes(["CAPI_FBP_HASHED"], 25);
    render(<EMQValidator events={events} isLoading={false} error={null} />);
    const panel = screen.getByTestId("emq-intelligence");
    expect(within(panel).getByText(/Based on 25 CAPI rows/i)).toBeInTheDocument();
    expect(within(panel).getAllByText("CAPI_FBP_HASHED").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/25 of 25 rows \(100%\)/i).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/25 newest consecutive rows/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Protected-system trigger:/i)).toBeInTheDocument();
    expect(within(panel).getByText(/Smallest safe next sprint:/i)).toBeInTheDocument();
  });

  it("shows recovery only after five healthy newest rows and an older actionable failure", () => {
    const recoveryRows = [
      makeRow({ id: "6", timestamp: "2026-09-03T12:06:00Z" }),
      makeRow({ id: "5", timestamp: "2026-09-03T12:05:00Z" }),
      makeRow({ id: "4", timestamp: "2026-09-03T12:04:00Z", capiDiagnostics: makeDiagnostics(["CAPI_FBC_MISSING"]) }),
      makeRow({ id: "3", timestamp: "2026-09-03T12:03:00Z" }),
      makeRow({ id: "2", timestamp: "2026-09-03T12:02:00Z" }),
      makeRow({ id: "1", timestamp: "2026-09-03T12:01:00Z", capiDiagnostics: makeDiagnostics(["CAPI_TIME_WRONG_UNIT"]) }),
    ];
    const { rerender } = render(<EMQValidator events={recoveryRows} isLoading={false} error={null} />);
    expect(screen.getByText(/Recovery observed in the fetched sample/i)).toBeInTheDocument();

    rerender(<EMQValidator events={recoveryRows.slice(0, 5)} isLoading={false} error={null} />);
    expect(screen.queryByText(/Recovery observed in the fetched sample/i)).not.toBeInTheDocument();
  });

  it("shows no dominant issue when the sample has informational codes only", () => {
    render(<EMQValidator events={[makeRow({ capiDiagnostics: makeDiagnostics(["CAPI_FBC_MISSING"]) })]} isLoading={false} error={null} />);
    expect(screen.getAllByText(/No error or warning code is dominant/i).length).toBeGreaterThan(0);
  });
});

describe("EMQValidator clipboard and privacy", () => {
  it("copies an anonymous diagnostic and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<EMQValidator events={[makeRow({ capiDiagnostics: makeDiagnostics(["CAPI_FBP_HASHED"]) })]} isLoading={false} error={null} />);

    const button = screen.getByRole("button", { name: /Copy safe diagnostic/i });
    expect(button).toHaveClass("min-h-11");
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Diagnostic copied")).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain("CAPI_FBP_HASHED");
    expect(button).toHaveClass("border-emerald-300/70");
    expect(screen.getByText("Diagnostic copied")).toHaveClass("text-emerald-200");
  });

  it("announces rejected and unavailable clipboard states without entering fetch error", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const { rerender } = render(<EMQValidator events={[makeRow()]} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy safe diagnostic/i }));
    await waitFor(() => expect(screen.getByText("Copy failed")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    rerender(<EMQValidator events={[makeRow()]} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy safe diagnostic/i }));
    expect(screen.getByText("Copy unavailable")).toBeInTheDocument();
  });

  it("never renders or copies row-level identity, attribution, or response sentinels", async () => {
    const sentinels = [
      "email-private-sentinel",
      "phone-private-sentinel",
      "external-private-sentinel",
      "fbp-private-sentinel",
      "fbc-private-sentinel",
      "203.0.113.222",
      "ua-private-sentinel",
      "event-private-sentinel",
      "lead-private-sentinel",
      "client-private-sentinel",
      "pixel-private-sentinel",
      "https://private.example/sentinel",
      "response-private-sentinel",
    ];
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const row = makeRow({
      id: sentinels[0],
      eventId: sentinels[7],
      leadId: sentinels[8],
      sourceCampaign: `${sentinels[9]} ${sentinels[10]} ${sentinels[11]}`,
      responseExcerpt: sentinels[12],
      payloadVersion: sentinels.slice(1, 7).join(" "),
      capiDiagnostics: makeDiagnostics(["CAPI_FBP_HASHED"]),
    });
    const { container } = render(<EMQValidator events={[row]} isLoading={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy safe diagnostic/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());

    const rendered = container.textContent ?? "";
    const copied = writeText.mock.calls[0][0] as string;
    for (const sentinel of sentinels) {
      expect(rendered).not.toContain(sentinel);
      expect(copied).not.toContain(sentinel);
    }
  });
});
