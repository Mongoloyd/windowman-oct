import { StrictMode, Suspense, startTransition, useEffect } from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppTrackingProvider } from "./AppTrackingProvider";

const mocks = vi.hoisted(() => ({
  initMetaBrowserPixel: vi.fn(),
  trackMetaPageView: vi.fn(),
  initOpenAiAdsPixel: vi.fn(),
  markOpenAiAdsPageViewSuppressed: vi.fn(),
  trackOpenAiAdsPageViewed: vi.fn(),
  pushTruthGateViewedOnce: vi.fn(),
  pushVirtualPageView: vi.fn(),
  useUtmCapture: vi.fn(() => ({})),
}));

vi.mock("@/lib/metaBrowserPixel", () => ({
  initMetaBrowserPixel: mocks.initMetaBrowserPixel,
  trackMetaPageView: mocks.trackMetaPageView,
}));

vi.mock("@/lib/openAiAdsPixel", () => ({
  initOpenAiAdsPixel: mocks.initOpenAiAdsPixel,
  markOpenAiAdsPageViewSuppressed: mocks.markOpenAiAdsPageViewSuppressed,
  trackOpenAiAdsPageViewed: mocks.trackOpenAiAdsPageViewed,
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushTruthGateViewedOnce: mocks.pushTruthGateViewedOnce,
  pushVirtualPageView: mocks.pushVirtualPageView,
}));

vi.mock("@/lib/useLeadId", () => ({
  getLeadId: () => "test-lead-id",
  useLeadId: () => "test-lead-id",
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getUtmData: () => ({}),
  getUtmPayload: () => ({}),
  useUtmCapture: mocks.useUtmCapture,
}));

let navigateRef: ((to: string) => void) | null = null;
let suspendWmChatRender = false;
const neverResolves = new Promise<never>(() => undefined);

function NavExposer() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    navigateRef = navigate;
    return () => {
      navigateRef = null;
    };
  }, [navigate]);
  if (suspendWmChatRender && location.pathname === "/wmchat") {
    throw neverResolves;
  }
  return <div>App</div>;
}

function renderProvider(initialEntry: string, strict = false) {
  const tree = (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Suspense fallback={<div>Loading</div>}>
        <AppTrackingProvider>
          <NavExposer />
        </AppTrackingProvider>
      </Suspense>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

async function navigate(to: string) {
  await act(async () => {
    navigateRef?.(to);
  });
}

function expectNoApplicationPageMeasurement() {
  expect(mocks.initMetaBrowserPixel).not.toHaveBeenCalled();
  expect(mocks.trackMetaPageView).not.toHaveBeenCalled();
  expect(mocks.initOpenAiAdsPixel).not.toHaveBeenCalled();
  expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  expect(mocks.pushVirtualPageView).not.toHaveBeenCalled();
  expect(mocks.pushTruthGateViewedOnce).not.toHaveBeenCalled();
}

describe("AppTrackingProvider /wmchat measurement exclusion", () => {
  beforeEach(() => {
    navigateRef = null;
    suspendWmChatRender = false;
    vi.clearAllMocks();
  });

  it("keeps attribution capture but emits no initial /wmchat page measurement", () => {
    renderProvider("/wmchat?utm_source=meta#truth-gate");

    expect(mocks.useUtmCapture).toHaveBeenCalledWith(
      "/wmchat?utm_source=meta",
    );
    expect(mocks.markOpenAiAdsPageViewSuppressed).not.toHaveBeenCalled();
    expectNoApplicationPageMeasurement();
  });

  it("keeps /wmchat search and hash changes silent while attribution updates", async () => {
    renderProvider("/wmchat?utm_source=meta");
    await navigate("/wmchat?utm_source=next#truth-gate");

    expect(mocks.useUtmCapture).toHaveBeenLastCalledWith(
      "/wmchat?utm_source=next",
    );
    expect(mocks.markOpenAiAdsPageViewSuppressed).not.toHaveBeenCalled();
    expectNoApplicationPageMeasurement();
  });

  it("keeps uppercase and descendant /wmchat routes silent", () => {
    renderProvider("/WMCHAT/diagnosis?utm_source=meta");

    expect(mocks.useUtmCapture).toHaveBeenCalledWith(
      "/WMCHAT/diagnosis?utm_source=meta",
    );
    expect(mocks.markOpenAiAdsPageViewSuppressed).not.toHaveBeenCalled();
    expectNoApplicationPageMeasurement();
  });

  it("suppresses consent-triggered OpenAI page measurement on /wmchat", () => {
    renderProvider("/wmchat");
    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });

    expectNoApplicationPageMeasurement();
  });

  it("keeps consent measurement bound to the last committed route", () => {
    renderProvider("/about");
    vi.clearAllMocks();
    suspendWmChatRender = true;

    act(() => {
      startTransition(() => navigateRef?.("/wmchat"));
    });
    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });

    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
    expect(mocks.markOpenAiAdsPageViewSuppressed).not.toHaveBeenCalled();
  });

  it("initializes each page adapter exactly once on an initial eligible route", () => {
    renderProvider("/about?utm_source=meta");

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushVirtualPageView).toHaveBeenCalledWith({
      page_path: "/about",
      page_search: "?utm_source=meta",
    });
    expect(mocks.pushTruthGateViewedOnce).toHaveBeenCalledTimes(1);
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).not.toHaveBeenCalled();
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  });

  it("emits nothing when an eligible route enters /wmchat", async () => {
    renderProvider("/about");
    vi.clearAllMocks();

    await navigate("/wmchat?utm_source=meta");

    expect(mocks.useUtmCapture).toHaveBeenCalledWith(
      "/wmchat?utm_source=meta",
    );
    expect(mocks.markOpenAiAdsPageViewSuppressed).toHaveBeenCalledTimes(1);
    expectNoApplicationPageMeasurement();
  });

  it("marks only the transition into /wmchat, not internal route changes", async () => {
    renderProvider("/about");

    await navigate("/wmchat?step=one");
    await navigate("/WMCHAT/diagnosis?step=two#details");

    expect(mocks.markOpenAiAdsPageViewSuppressed).toHaveBeenCalledTimes(1);
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  });

  it("initializes once when the first eligible route follows /wmchat", async () => {
    renderProvider("/wmchat");
    await navigate("/about");

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushTruthGateViewedOnce).toHaveBeenCalledTimes(1);
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).not.toHaveBeenCalled();
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  });

  it("resumes each established page lane exactly once after leaving /wmchat", async () => {
    renderProvider("/about");
    await navigate("/wmchat");
    vi.clearAllMocks();

    await navigate("/contact?from=wmchat");

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushTruthGateViewedOnce).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).toHaveBeenCalledTimes(1);
    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
    expect(mocks.initMetaBrowserPixel).not.toHaveBeenCalled();
    expect(mocks.initOpenAiAdsPixel).not.toHaveBeenCalled();
  });

  it("signals one OpenAI resume for /about to /wmchat to /about", async () => {
    renderProvider("/about");
    await navigate("/wmchat");
    vi.clearAllMocks();

    await navigate("/about");

    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).toHaveBeenCalledTimes(1);
    expect(mocks.markOpenAiAdsPageViewSuppressed).not.toHaveBeenCalled();
  });

  it("preserves consent-triggered OpenAI measurement on eligible routes", () => {
    renderProvider("/about");
    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });

    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
  });

  it("deduplicates StrictMode effect replay and measures /wmchat-other normally", () => {
    renderProvider("/wmchat-other", true);

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushTruthGateViewedOnce).toHaveBeenCalledTimes(1);
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).not.toHaveBeenCalled();
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  });
});
