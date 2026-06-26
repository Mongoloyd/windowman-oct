import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScanFunnelProvider } from "@/state/scanFunnel";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCAN_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const uploadZonePropsRef = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const invokeMock = vi.hoisted(() => vi.fn());
// Session id that the mocked TruthGateFlow emits via onLeadCaptured when clicked.
const truthGateEmit = vi.hoisted(() => ({ sessionId: "" }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
    rpc: vi.fn(),
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/hooks/useAnalysisData", () => ({
  useAnalysisData: () => ({
    data: null,
    v2ReportSource: null,
    isLoading: false,
    error: null,
    fullFetchError: null,
    fetchFull: vi.fn(),
    isFullLoaded: false,
    isLoadingFull: false,
    tryResume: vi.fn(),
    isResuming: false,
  }),
}));

vi.mock("@/hooks/useHomepageVariant", () => ({
  useHomepageVariant: () => ({
    headline: "Test headline",
    subheadline: "Test sub",
    badgeText: "Test badge",
  }),
}));

vi.mock("@/lib/useClientSlug", () => ({
  useClientSlug: () => ({ slug: null, ready: true }),
}));

vi.mock("@/lib/verifiedAccess", () => ({
  getVerifiedAccess: vi.fn(() => null),
  clearVerifiedAccess: vi.fn(),
}));

vi.mock("@/lib/reportDiagnosisHandoff", () => ({
  consumeHomepageDarkV2ReportReturn: vi.fn(() => null),
  clearHomepageDarkV2ReportReturn: vi.fn(),
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/components/LinearHeader", () => ({
  default: () => <div data-testid="linear-header" />,
}));

vi.mock("@/components/AuditHero", () => ({
  default: () => <div data-testid="audit-hero" />,
}));

vi.mock("@/components/StickyRecoveryBar", () => ({
  default: () => null,
}));

vi.mock("@/components/StickyCTAFooter", () => ({
  default: () => null,
}));

vi.mock("@/components/HomepageBackdrop", () => ({
  default: () => null,
}));

vi.mock("@/components/LazySection", () => ({
  LazySection: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/components/TruthGateFlow", () => ({
  default: (props: { onLeadCaptured?: (sessionId: string) => void }) => (
    <button
      type="button"
      data-testid="truth-gate-flow"
      onClick={() => props.onLeadCaptured?.(truthGateEmit.sessionId)}
    >
      truth gate
    </button>
  ),
  hasTrustedContactIdentity: (
    leadId: string | null | undefined,
    sessionId: string | null | undefined,
  ) => {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof leadId === "string" && uuid.test(leadId) &&
      typeof sessionId === "string" && uuid.test(sessionId);
  },
}));

vi.mock("@/components/UploadZone", () => ({
  default: (props: Record<string, unknown>) => {
    uploadZonePropsRef.current = props;
    return props.isVisible ? <div data-testid="upload-zone">Upload zone</div> : null;
  },
}));

vi.mock("@/components/ScanTheatrics", () => ({
  default: () => null,
}));

vi.mock("@/components/post-scan/PostScanReportSwitcher", () => ({
  PostScanReportSwitcher: () => null,
}));

const nullComponent = { default: () => null };

vi.mock("@/components/SocialProofStrip", () => nullComponent);
vi.mock("@/components/IndustryTruth", () => nullComponent);
vi.mock("@/components/ProcessSteps", () => nullComponent);
vi.mock("@/components/NarrativeProof", () => nullComponent);
vi.mock("@/components/ClosingManifesto", () => nullComponent);
vi.mock("@/components/Testimonials", () => nullComponent);
vi.mock("@/components/MarketMakerManifesto", () => nullComponent);
vi.mock("@/components/OrangeScanner", () => nullComponent);
vi.mock("@/components/ScamConcernImage", () => nullComponent);
vi.mock("@/components/QuoteSpreadShowcase", () => nullComponent);
vi.mock("@/components/Footer", () => nullComponent);
vi.mock("@/components/ExitIntentPhoneModal", () => nullComponent);

import Index, { shouldRehydrateContactUpload } from "@/pages/Index";
import { readPersistedFunnelSnapshot } from "@/state/scanFunnel";
import { trackEvent } from "@/lib/trackEvent";
import { NO_QUOTE_DIAGNOSTIC } from "@/components/postcapture/postCaptureCopy";

const trackEventMock = vi.mocked(trackEvent);

vi.mock("@/state/scanFunnel", async () => {
  const actual = await vi.importActual<typeof import("@/state/scanFunnel")>(
    "@/state/scanFunnel",
  );
  return {
    ...actual,
    readPersistedFunnelSnapshot: vi.fn(() => null),
  };
});

const readPersistedFunnelSnapshotMock = vi.mocked(readPersistedFunnelSnapshot);

function seedFunnelStorage(overrides?: {
  leadId?: string | null;
  sessionId?: string | null;
  scanSessionId?: string | null;
}) {
  const store = new Map<string, string>();
  const leadId = overrides && "leadId" in overrides ? overrides.leadId : LEAD_ID;
  const sessionId =
    overrides && "sessionId" in overrides ? overrides.sessionId : SESSION_ID;
  const scanSessionId =
    overrides && "scanSessionId" in overrides ? overrides.scanSessionId : null;

  if (leadId) store.set("wm_funnel_leadId", leadId);
  if (sessionId) store.set("wm_funnel_sessionId", sessionId);
  if (scanSessionId) store.set("wm_funnel_scanSessionId", scanSessionId);
  store.set("wm_funnel_ts", String(Date.now()));

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  });
}

function renderIndex() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ScanFunnelProvider>
          <Index />
        </ScanFunnelProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubDomObservers() {
  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
}

describe("shouldRehydrateContactUpload", () => {
  it("returns true for trusted contact ids without scan session", () => {
    expect(
      shouldRehydrateContactUpload({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        persistedScanSessionId: null,
        inProductPhase: false,
      }),
    ).toBe(true);
  });

  it("returns false when leadId is missing or invalid", () => {
    expect(
      shouldRehydrateContactUpload({
        leadId: null,
        sessionId: SESSION_ID,
        persistedScanSessionId: null,
        inProductPhase: false,
      }),
    ).toBe(false);
    expect(
      shouldRehydrateContactUpload({
        leadId: "not-a-uuid",
        sessionId: SESSION_ID,
        persistedScanSessionId: null,
        inProductPhase: false,
      }),
    ).toBe(false);
  });

  it("returns false when sessionId is missing or invalid", () => {
    expect(
      shouldRehydrateContactUpload({
        leadId: LEAD_ID,
        sessionId: null,
        persistedScanSessionId: null,
        inProductPhase: false,
      }),
    ).toBe(false);
  });

  it("returns false when a persisted scan session should take precedence", () => {
    expect(
      shouldRehydrateContactUpload({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        persistedScanSessionId: SCAN_SESSION_ID,
        inProductPhase: false,
      }),
    ).toBe(false);
  });

  it("returns false during active product phase", () => {
    expect(
      shouldRehydrateContactUpload({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        persistedScanSessionId: null,
        inProductPhase: true,
      }),
    ).toBe(false);
  });
});

describe("Index contact resume rehydration", () => {
  beforeEach(() => {
    uploadZonePropsRef.current = null;
    invokeMock.mockReset();
    readPersistedFunnelSnapshotMock.mockReturnValue(null);
    seedFunnelStorage();
    stubDomObservers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rehydrates to the intent router (not UploadZone) when funnel has trusted contact ids", async () => {
    renderIndex();

    // Sprint 2F-C: refresh with a trusted pair returns the user to the router,
    // not straight into UploadZone and not a re-capture.
    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();

    // Choosing the quote-ready path then mounts a usable UploadZone.
    fireEvent.click(screen.getByRole("button", { name: "Upload my quote" }));

    await waitFor(() => {
      expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    });
    expect(uploadZonePropsRef.current).toMatchObject({
      isVisible: true,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
    });
    expect(screen.getByText("You're ready to upload your quote.")).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("does not rehydrate when leadId is missing", async () => {
    seedFunnelStorage({ leadId: null });

    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("truth-gate-flow")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("does not rehydrate when sessionId is missing", async () => {
    seedFunnelStorage({ sessionId: null });

    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("truth-gate-flow")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("does not rehydrate when a persisted scan session takes precedence", async () => {
    readPersistedFunnelSnapshotMock.mockReturnValue({
      scanSessionId: SCAN_SESSION_ID,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
      quoteFileId: null,
      phoneE164: null,
      phoneStatus: "none",
    });

    renderIndex();

    await waitFor(() => {
      expect(screen.getByText("You have an unfinished scan.")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(
      screen.queryByText("You're ready to upload your quote."),
    ).not.toBeInTheDocument();
  });
});

const LOCK_HEADLINE = /Don.t let a window quote sit unchecked/;

describe("Index homepage upload mount guard (Sprint 2B-3B)", () => {
  beforeEach(() => {
    uploadZonePropsRef.current = null;
    invokeMock.mockReset();
    trackEventMock.mockReset();
    truthGateEmit.sessionId = "";
    readPersistedFunnelSnapshotMock.mockReturnValue(null);
    seedFunnelStorage();
    stubDomObservers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts a usable UploadZone after selecting the quote-ready router path", async () => {
    // Default seed has a valid leadId + sessionId → rehydration shows the router.
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload my quote" }));

    await waitFor(() => {
      expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    });

    expect(uploadZonePropsRef.current).toMatchObject({
      isVisible: true,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
    });
    expect(screen.queryByText(LOCK_HEADLINE)).not.toBeInTheDocument();
  });

  it("shows the locked placeholder when upload is unlocked but leadId is missing", async () => {
    seedFunnelStorage({ leadId: null });
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    // No rehydration without a leadId; unlock via the TruthGateFlow callback.
    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByText(LOCK_HEADLINE)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Start a free quote check in under a minute/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Free" })).toBeInTheDocument();
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("shows the locked placeholder when upload is unlocked but sessionId is invalid", async () => {
    seedFunnelStorage({ sessionId: null });
    truthGateEmit.sessionId = "not-a-uuid";

    renderIndex();

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByText(LOCK_HEADLINE)).toBeInTheDocument();
    });

    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("lets pending scan/report resume take precedence over the locked placeholder on mount", async () => {
    seedFunnelStorage({ leadId: null });
    readPersistedFunnelSnapshotMock.mockReturnValue({
      scanSessionId: SCAN_SESSION_ID,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
      quoteFileId: null,
      phoneE164: null,
      phoneStatus: "none",
    });
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    await waitFor(() => {
      expect(screen.getByText("You have an unfinished scan.")).toBeInTheDocument();
    });

    // Resume banner suppresses the locked placeholder until the user acts.
    expect(screen.queryByText(LOCK_HEADLINE)).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("does not call capture/tracking when rendering or clicking the placeholder CTA", async () => {
    seedFunnelStorage({ leadId: null });
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByText(LOCK_HEADLINE)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start Free" }));

    expect(invokeMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});

describe("Index post-capture intent router (Sprint 2F-C)", () => {
  beforeEach(() => {
    uploadZonePropsRef.current = null;
    invokeMock.mockReset();
    trackEventMock.mockReset();
    truthGateEmit.sessionId = "";
    readPersistedFunnelSnapshotMock.mockReturnValue(null);
    seedFunnelStorage();
    stubDomObservers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the router before any UploadZone once a trusted pair exists", async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload my quote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save my spot" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show me what to check" }),
    ).toBeInTheDocument();
  });

  it("does not render the router without a trusted contact identity", async () => {
    seedFunnelStorage({ leadId: null });
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByText(LOCK_HEADLINE)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("post-capture-router")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
  });

  it("'I have a quote, but not here' does not mount UploadZone or hit the backend", async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save my spot" }));

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-upload-later")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("'I don't have a quote yet' does not mount UploadZone or hit the backend", async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Show me what to check" }));

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-no-quote")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("runs the no-quote diagnostic then pivots to a usable UploadZone with the same pair", async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Show me what to check" }));
    await waitFor(() => {
      expect(screen.getByTestId("post-capture-no-quote")).toBeInTheDocument();
    });

    // Answer each diagnostic question (no UploadZone / no backend during it).
    for (const question of NO_QUOTE_DIAGNOSTIC.questions) {
      fireEvent.click(screen.getByRole("button", { name: question.options[0] }));
    }
    expect(screen.queryByTestId("upload-zone")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText("You're quote-ready.")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "I got my quote — scan it now" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    });
    expect(uploadZonePropsRef.current).toMatchObject({
      isVisible: true,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
    });
    // No second capture call from the no-quote → upload pivot.
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("pivots from the upload-later placeholder back to UploadZone with the same pair", async () => {
    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save my spot" }));
    await waitFor(() => {
      expect(screen.getByTestId("post-capture-upload-later")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "I found my quote — scan it now" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    });
    expect(uploadZonePropsRef.current).toMatchObject({
      isVisible: true,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe("Index post-capture smoothness", () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    uploadZonePropsRef.current = null;
    invokeMock.mockReset();
    trackEventMock.mockReset();
    truthGateEmit.sessionId = "";
    readPersistedFunnelSnapshotMock.mockReturnValue(null);
    seedFunnelStorage();
    stubDomObservers();
    scrollIntoViewMock = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scrolls to PostCaptureRouter after fresh contact capture", async () => {
    seedFunnelStorage({ sessionId: null });
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    expect(screen.queryByTestId("post-capture-router")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it("fresh contact capture clears pendingResume and shows post-capture router", async () => {
    seedFunnelStorage({ sessionId: null });
    truthGateEmit.sessionId = SESSION_ID;
    readPersistedFunnelSnapshotMock.mockReturnValue({
      scanSessionId: SCAN_SESSION_ID,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
      quoteFileId: null,
      phoneE164: null,
      phoneStatus: "none",
    });

    renderIndex();

    await waitFor(() => {
      expect(screen.getByText("You have an unfinished scan.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.queryByText("You have an unfinished scan.")).not.toBeInTheDocument();
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });
  });

  it("fresh contact capture resets postCapturePath to router from a non-router branch", async () => {
    truthGateEmit.sessionId = SESSION_ID;

    renderIndex();

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save my spot" }));

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-upload-later")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("truth-gate-flow"));

    await waitFor(() => {
      expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
      expect(screen.queryByTestId("post-capture-upload-later")).not.toBeInTheDocument();
    });
  });

  it("Start Over from pending resume clears banner and resets to a fresh intake state", async () => {
    readPersistedFunnelSnapshotMock.mockReturnValue({
      scanSessionId: SCAN_SESSION_ID,
      sessionId: SESSION_ID,
      leadId: LEAD_ID,
      quoteFileId: null,
      phoneE164: null,
      phoneStatus: "none",
    });

    renderIndex();

    await waitFor(() => {
      expect(screen.getByText("You have an unfinished scan.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Start over" }));

    await waitFor(() => {
      expect(screen.queryByText("You have an unfinished scan.")).not.toBeInTheDocument();
      expect(screen.getByTestId("truth-gate-flow")).toBeInTheDocument();
    });
  });
});
