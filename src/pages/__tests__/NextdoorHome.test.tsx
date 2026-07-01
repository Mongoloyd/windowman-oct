import { act, fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanFunnelProvider } from "@/state/scanFunnel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Sealed supabase client throws without env — mock before importing the page.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/components/UploadZone", () => ({
  default: () => <div data-testid="upload-zone" />,
}));

vi.mock("@/components/TruthGateFlow", () => ({
  hasTrustedContactIdentity: (
    leadId: string | null | undefined,
    sessionId: string | null | undefined,
  ) =>
    typeof leadId === "string" &&
    UUID_RE.test(leadId) &&
    typeof sessionId === "string" &&
    UUID_RE.test(sessionId),
}));

vi.mock("@/hooks/useScanPolling", () => ({
  useScanPolling: () => ({ status: "pending" }),
}));

vi.mock("@/lib/engagementScoring", () => ({
  trackEngagement: vi.fn(),
}));

vi.mock("@/components/BrandLogo", () => ({
  default: () => <a href="/">WindowMan</a>,
}));

vi.mock("@/components/nextdoor/NextdoorBeforeAfterStrip", () => ({
  NextdoorBeforeAfterStrip: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorChecksGrid", () => ({
  NextdoorChecksGrid: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorContractorQuestionCard", () => ({
  NextdoorContractorQuestionCard: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorFinancialRiskBlock", () => ({
  NextdoorFinancialRiskBlock: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorHeroMascotStack", () => ({
  NextdoorHeroMascotStack: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorNotMarketplacePanel", () => ({
  NextdoorNotMarketplacePanel: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorQuoteLeverageLoop", () => ({
  NextdoorQuoteLeverageLoop: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorWhatGetsMissed", () => ({
  NextdoorWhatGetsMissed: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorJourneyTimeline", () => ({
  NextdoorJourneyTimeline: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorTrustStrip", () => ({
  NextdoorTrustStrip: () => <div />,
}));
vi.mock("@/components/nextdoor/NextdoorProtectionLedger", () => ({
  NextdoorProtectionLedger: () => <div />,
}));

import NextdoorHome, { shouldRehydrateNextdoorUpload } from "@/pages/NextdoorHome";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderNextdoorHome() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/nextdoor"]}>
        <ScanFunnelProvider>
          <NextdoorHome />
        </ScanFunnelProvider>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("shouldRehydrateNextdoorUpload", () => {
  it("rehydrates when leadId is valid and sessionId matches nextdoorSessionId", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(true);
  });

  it("does not rehydrate when funnel.sessionId differs from nextdoorSessionId", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: OTHER_SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it("does not rehydrate when leadId is missing", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: null,
        sessionId: SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it("does not rehydrate when nextdoorSessionId is not a valid UUID", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: "bad",
        nextdoorSessionId: "bad",
      }),
    ).toBe(false);
  });
});

describe("NextdoorHome quote-ready CTA handoff", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.sessionStorage?.clear();
    window.localStorage?.clear();
  });

  it("shows quote-ready Step 2 first while keeping upload gated on a cold click", () => {
    renderNextdoorHome();

    const scanCta = screen.getByText("Scan my quote").closest("button");
    expect(scanCta).not.toBeNull();
    fireEvent.click(scanCta as HTMLButtonElement);

    expect(screen.getByText(/Step 2 .* Save your details/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Save your details first, then upload opens here/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save my details to continue/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/Secure your place to upload/i)).toBeInTheDocument();
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(scrollIntoView).toHaveBeenCalled();
  });
});
