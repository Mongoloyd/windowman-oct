import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProphecyLanding from "./ProphecyLanding";

const navigateMock = vi.fn();
const uploadZonePropsMock = vi.fn();
const lowIntentEventMock = vi.fn();
const persistLeadMock = vi.fn();
const submitResultMock = vi.fn();
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const PAGE_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_KEY = "wm_prophecy_upload_resume_v1";

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/intake/universal/UniversalIntakeHost", () => ({
  default: ({
    openRequest,
    submitter,
    onPersistedSuccess,
    onClose,
  }: {
    openRequest?: Record<string, unknown> | null;
    submitter?: (
      values: Record<string, string>,
      context: Record<string, string>,
    ) => Promise<unknown>;
    onPersistedSuccess?: (
      values: Record<string, string>,
      persisted: Record<string, unknown>,
    ) => void;
    onClose: () => void;
  }) => (
    <div data-testid="intake-host" data-open={openRequest ? "yes" : "no"}>
      <button
        type="button"
        onClick={() =>
          onPersistedSuccess?.(
            { intent: "has_quote", zip: "33301" },
            {
              ok: true,
              leadId: LEAD_ID,
              sessionId: SESSION_ID,
              reused: false,
            },
          )
        }
      >
        Persist has quote
      </button>
      <button
        type="button"
        onClick={() =>
          onPersistedSuccess?.(
            { intent: "has_quote", zip: "33301" },
            {
              ok: true,
              leadId: LEAD_ID,
              sessionId: 42,
              reused: false,
            },
          )
        }
      >
        Persist has quote invalid session
      </button>
      <button
        type="button"
        onClick={() =>
          onPersistedSuccess?.(
            { intent: "no_quote", zip: "33301" },
            {
              ok: true,
              leadId: "44444444-4444-4444-8444-444444444444",
              sessionId: "55555555-5555-4555-8555-555555555555",
              reused: false,
            },
          )
        }
      >
        Persist no quote
      </button>
      <button type="button" onClick={onClose}>
        Close intake
      </button>
      <button
        type="button"
        onClick={() => {
          void submitter?.(
            { intent: "has_quote" },
            {
              captureAttemptId: "attempt-1",
              landingVisitId: "visit-1",
              entryPoint: "hero_primary",
            },
          ).then(submitResultMock);
        }}
      >
        Submit failing intake
      </button>
    </div>
  ),
}));

vi.mock("@/components/UploadZone", () => ({
  default: (props: Record<string, unknown>) => {
    uploadZonePropsMock(props);
    return (
      <div
        data-testid="upload-zone"
        data-visible={props.isVisible ? "yes" : "no"}
        data-session-id={String(props.sessionId)}
        data-lead-id={String(props.leadId ?? "")}
      />
    );
  },
}));

vi.mock("@/lib/tracking/prophecyEvents", () => ({
  pushProphecyLowIntentEvent: (...args: unknown[]) =>
    lowIntentEventMock(...args),
}));

vi.mock("../CampaignNQ/useCampaignNqIllumination", () => ({
  useCampaignNqIllumination: () => ({ current: null }),
}));

vi.mock("./campaignProphecyLeadCapture", () => ({
  createCampaignProphecyLeadSubmitter: () => persistLeadMock,
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () => PAGE_SESSION_ID,
}));

vi.mock("./useProphecyVariant", () => ({
  useProphecyVariant: () => ({
    id: "prophecy",
    eyebrow: "eyebrow",
    headline: "headline",
    headlineAccent: "",
    subheadline: "subheadline",
  }),
}));

vi.mock("./sections/ProphecyHero", () => ({
  default: ({
    onChooseIntent,
  }: {
    onChooseIntent: (intent: "has_quote" | "no_quote") => void;
  }) => (
    <section>
      <button type="button" onClick={() => onChooseIntent("has_quote")}>
        Hero has quote
      </button>
    </section>
  ),
}));

vi.mock("./sections/ProphecyPredictions", () => ({
  default: () => <section>Predictions</section>,
}));

vi.mock("./sections/ProphecyExplainer", () => ({
  default: ({ onPlay }: { onPlay?: () => void }) => (
    <section>
      <button type="button" onClick={onPlay}>
        Play explainer
      </button>
    </section>
  ),
}));

vi.mock("./sections/ProphecyFAQ", () => ({
  default: () => <section>FAQ</section>,
}));

vi.mock("./sections/ProphecyFinalCTA", () => ({
  default: ({
    onChooseIntent,
  }: {
    onChooseIntent: (intent: "has_quote" | "no_quote") => void;
  }) => (
    <section>
      <button type="button" onClick={() => onChooseIntent("no_quote")}>
        Footer no quote
      </button>
    </section>
  ),
}));

vi.mock("./sections/ProphecyChrome", () => ({
  ProphecyNavigation: () => <nav>Nav</nav>,
  ProphecyFooter: () => <footer>Footer</footer>,
}));

describe("ProphecyLanding", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    navigateMock.mockReset();
    uploadZonePropsMock.mockClear();
    lowIntentEventMock.mockReset();
    persistLeadMock.mockReset();
    submitResultMock.mockReset();
    persistLeadMock.mockResolvedValue({
      ok: true,
      leadId: "66666666-6666-4666-8666-666666666666",
      sessionId: "77777777-7777-4777-8777-777777777777",
      reused: false,
    });
  });

  it("passes the persisted sessionId and leadId to UploadZone after a has-quote capture", () => {
    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Persist has quote" }));
    fireEvent.click(screen.getByRole("button", { name: "Close intake" }));

    const uploadZone = screen.getByTestId("upload-zone");
    expect(uploadZone).toHaveAttribute("data-visible", "yes");
    expect(uploadZone).toHaveAttribute("data-session-id", SESSION_ID);
    expect(uploadZone).toHaveAttribute("data-lead-id", LEAD_ID);
    expect(
      JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null"),
    ).toMatchObject({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
  });

  it("does not expose UploadZone or persist a hint for malformed callback IDs", () => {
    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Persist has quote invalid session" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close intake" }));

    const uploadZone = screen.getByTestId("upload-zone");
    expect(uploadZone).toHaveAttribute("data-visible", "no");
    expect(uploadZone).toHaveAttribute("data-session-id", PAGE_SESSION_ID);
    expect(uploadZone).toHaveAttribute("data-lead-id", "");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores the exact persisted UploadZone handoff after remount", () => {
    const firstRender = render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Persist has quote" }));
    fireEvent.click(screen.getByRole("button", { name: "Close intake" }));
    firstRender.unmount();

    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    expect(screen.getByTestId("upload-zone")).toHaveAttribute(
      "data-visible",
      "yes",
    );
    expect(screen.getByTestId("upload-zone")).toHaveAttribute(
      "data-lead-id",
      LEAD_ID,
    );
    expect(screen.getByTestId("upload-zone")).toHaveAttribute(
      "data-session-id",
      SESSION_ID,
    );
  });

  it("clears an existing upload hint and hides UploadZone after no-quote persistence", () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );

    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );
    expect(screen.getByTestId("upload-zone")).toHaveAttribute(
      "data-visible",
      "yes",
    );

    fireEvent.click(screen.getByRole("button", { name: "Persist no quote" }));

    expect(screen.getByTestId("upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("deduplicates rapid intent measurement and resets after close", () => {
    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    const heroIntent = screen.getByRole("button", { name: "Hero has quote" });
    fireEvent.click(heroIntent);
    fireEvent.click(heroIntent);

    expect(screen.getByTestId("intake-host")).toHaveAttribute(
      "data-open",
      "yes",
    );
    expect(lowIntentEventMock.mock.calls).toEqual([
      [
        "path_selected",
        {
          flow_variant: "prophecy",
          wm_intent: "has_quote",
          cta_location: "hero_primary",
          step_name: "intent",
        },
      ],
      [
        "form_start",
        {
          flow_variant: "prophecy",
          wm_intent: "has_quote",
          cta_location: "hero_primary",
          step_name: "intent",
        },
      ],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Close intake" }));
    fireEvent.click(screen.getByRole("button", { name: "Footer no quote" }));

    expect(lowIntentEventMock).toHaveBeenCalledTimes(4);
    expect(lowIntentEventMock).toHaveBeenNthCalledWith(3, "path_selected", {
      flow_variant: "prophecy",
      wm_intent: "no_quote",
      cta_location: "footer_primary",
      step_name: "intent",
    });
    expect(lowIntentEventMock).toHaveBeenNthCalledWith(4, "form_start", {
      flow_variant: "prophecy",
      wm_intent: "no_quote",
      cta_location: "footer_primary",
      step_name: "intent",
    });
  });

  it("returns an unsuccessful capture result unchanged and emits a safe form error", async () => {
    const failedResult = {
      ok: false as const,
      message: "Private server detail that must not be measured",
    };
    persistLeadMock.mockResolvedValueOnce(failedResult);

    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit failing intake" }));

    await waitFor(() => expect(submitResultMock).toHaveBeenCalledWith(failedResult));
    expect(submitResultMock.mock.calls[0]?.[0]).toBe(failedResult);
    expect(lowIntentEventMock).toHaveBeenCalledWith("form_error", {
      flow_variant: "prophecy",
      wm_intent: "has_quote",
      step_name: "submission",
    });
    expect(lowIntentEventMock.mock.calls.flat(Infinity)).not.toContain(
      failedResult.message,
    );
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("wires safe upload and video callbacks without changing report handoff", () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );
    navigateMock.mockImplementation(() => {
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    render(
      <HelmetProvider>
        <ProphecyLanding />
      </HelmetProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play explainer" }));
    const latestUploadProps = uploadZonePropsMock.mock.calls.at(-1)?.[0] as {
      onUploadAttempt?: (fileType: string) => void;
      onUploadFailure?: (fileType: string) => void;
      onScanStart?: (fileName: string, scanId: string) => void;
    };
    latestUploadProps.onUploadAttempt?.("application/pdf");
    latestUploadProps.onUploadFailure?.("application/pdf");
    latestUploadProps.onScanStart?.("private-filename.pdf", "scan-session-id");

    expect(lowIntentEventMock).toHaveBeenCalledWith("video_play", {
      flow_variant: "prophecy",
      step_name: "explainer",
    });
    expect(lowIntentEventMock).toHaveBeenCalledWith("upload_start", {
      flow_variant: "prophecy",
      wm_intent: "has_quote",
      step_name: "upload",
      file_type: "application/pdf",
    });
    expect(lowIntentEventMock).toHaveBeenCalledWith("upload_error", {
      flow_variant: "prophecy",
      wm_intent: "has_quote",
      step_name: "upload",
      file_type: "application/pdf",
    });
    expect(navigateMock).toHaveBeenCalledWith(
      "/report/classic/scan-session-id",
    );
    expect(lowIntentEventMock.mock.calls.flat(Infinity)).not.toContain(
      "private-filename.pdf",
    );
    expect(lowIntentEventMock.mock.calls.flat(Infinity)).not.toContain(
      "scan-session-id",
    );
  });
});
