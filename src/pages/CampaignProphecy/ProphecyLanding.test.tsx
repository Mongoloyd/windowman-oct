import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProphecyLanding from "./ProphecyLanding";

const navigateMock = vi.fn();
const uploadZonePropsMock = vi.fn();
const lowIntentEventMock = vi.fn();
const persistLeadMock = vi.fn();
const submitResultMock = vi.fn();

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
              leadId: "lead-persisted",
              sessionId: "session-persisted",
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
              leadId: "lead-persisted",
              sessionId: 42,
              reused: false,
            },
          )
        }
      >
        Persist has quote invalid session
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
  getOrCreateFirstQuoteSessionId: () => "session-page-local",
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
    navigateMock.mockReset();
    uploadZonePropsMock.mockClear();
    lowIntentEventMock.mockReset();
    persistLeadMock.mockReset();
    submitResultMock.mockReset();
    persistLeadMock.mockResolvedValue({
      ok: true,
      leadId: "lead-default",
      sessionId: "session-default",
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
    expect(uploadZone).toHaveAttribute("data-session-id", "session-persisted");
    expect(uploadZone).toHaveAttribute("data-lead-id", "lead-persisted");
  });

  it("falls back to the page sessionId when persisted sessionId is not a string", () => {
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
    expect(uploadZone).toHaveAttribute("data-visible", "yes");
    expect(uploadZone).toHaveAttribute("data-session-id", "session-page-local");
    expect(uploadZone).toHaveAttribute("data-lead-id", "lead-persisted");
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
  });

  it("wires safe upload and video callbacks without changing report handoff", () => {
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
