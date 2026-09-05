import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProphecyLanding from "./ProphecyLanding";

const navigateMock = vi.fn();
const uploadZonePropsMock = vi.fn();

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
    onPersistedSuccess,
    onClose,
  }: {
    onPersistedSuccess?: (
      values: Record<string, string>,
      persisted: Record<string, unknown>,
    ) => void;
    onClose: () => void;
  }) => (
    <div>
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

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../CampaignNQ/useCampaignNqIllumination", () => ({
  useCampaignNqIllumination: () => ({ current: null }),
}));

vi.mock("./campaignProphecyLeadCapture", () => ({
  createCampaignProphecyLeadSubmitter: () => vi.fn(),
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () => "session-page-local",
}));

vi.mock("./useProphecyVariant", () => ({
  useProphecyVariant: () => ({
    id: "variant-a",
    eyebrow: "eyebrow",
    headline: "headline",
    headlineAccent: "",
    subheadline: "subheadline",
  }),
}));

vi.mock("./sections/ProphecyHero", () => ({
  default: () => <section>Hero</section>,
}));

vi.mock("./sections/ProphecyPredictions", () => ({
  default: () => <section>Predictions</section>,
}));

vi.mock("./sections/ProphecyExplainer", () => ({
  default: () => <section>Explainer</section>,
}));

vi.mock("./sections/ProphecyFAQ", () => ({
  default: () => <section>FAQ</section>,
}));

vi.mock("./sections/ProphecyFinalCTA", () => ({
  default: () => <section>Final CTA</section>,
}));

vi.mock("./sections/ProphecyChrome", () => ({
  ProphecyNavigation: () => <nav>Nav</nav>,
  ProphecyFooter: () => <footer>Footer</footer>,
}));

describe("ProphecyLanding", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    uploadZonePropsMock.mockClear();
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
});
