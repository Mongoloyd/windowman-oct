import { StrictMode, useEffect } from "react";
import { act, render } from "@testing-library/react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useNavigate } from "react-router-dom";
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

const PROPHECY_TITLE =
  "WindowMan — We Can Tell You What's On Your Window Estimate";

let nextFrameId = 1;
let frameQueue = new Map<number, FrameRequestCallback>();
let navigateRef: ((to: string) => void) | null = null;

function installControlledAnimationFrames() {
  nextFrameId = 1;
  frameQueue = new Map();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      frameQueue.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      frameQueue.delete(id);
    }),
  );
}

function flushAnimationFrames() {
  act(() => {
    while (frameQueue.size > 0) {
      const callbacks = [...frameQueue.values()];
      frameQueue.clear();
      for (const callback of callbacks) callback(performance.now());
    }
  });
}

function ProphecyDocument() {
  return (
    <>
      <Helmet>
        <title>{PROPHECY_TITLE}</title>
      </Helmet>
      <main data-page="campaign-prophecy">Prophecy</main>
    </>
  );
}

function NavigationExposer() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef = navigate;
    return () => {
      navigateRef = null;
    };
  }, [navigate]);
  return null;
}

function renderProvider(page: React.ReactNode, strict = false) {
  const tree = (
    <HelmetProvider>
      <MemoryRouter initialEntries={["/prophecy"]}>
        <AppTrackingProvider>
          {page}
          <NavigationExposer />
        </AppTrackingProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe("AppTrackingProvider Prophecy metadata timing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateRef = null;
    installControlledAnimationFrames();
    document.title = "Stale app title";
    mocks.initMetaBrowserPixel.mockReturnValue(true);
    mocks.trackMetaPageView.mockReturnValue(true);
  });

  it("measures the first Prophecy view only after Helmet commits its title", () => {
    const measuredTitles: string[] = [];
    mocks.pushVirtualPageView.mockImplementation(() => {
      measuredTitles.push(document.title);
    });

    renderProvider(<ProphecyDocument />);

    expect(mocks.pushVirtualPageView).not.toHaveBeenCalled();
    expect(mocks.initMetaBrowserPixel).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });
    expect(mocks.initMetaBrowserPixel).not.toHaveBeenCalled();

    flushAnimationFrames();

    expect(measuredTitles).toEqual([PROPHECY_TITLE]);
    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushVirtualPageView).toHaveBeenCalledWith({
      page_path: "/prophecy",
      page_search: "",
    });
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).not.toHaveBeenCalled();
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();
  });

  it("waits for a lazy Prophecy page root before scheduling measurement", async () => {
    const measuredTitles: string[] = [];
    mocks.pushVirtualPageView.mockImplementation(() => {
      measuredTitles.push(document.title);
    });

    const view = renderProvider(<div>Loading route</div>);
    flushAnimationFrames();
    expect(mocks.pushVirtualPageView).not.toHaveBeenCalled();

    view.rerender(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/prophecy"]}>
          <AppTrackingProvider>
            <ProphecyDocument />
          </AppTrackingProvider>
        </MemoryRouter>
      </HelmetProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    flushAnimationFrames();

    expect(measuredTitles).toEqual([PROPHECY_TITLE]);
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
  });

  it("survives StrictMode cancellation without double-firing", () => {
    renderProvider(<ProphecyDocument />, true);
    flushAnimationFrames();

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    expect(mocks.pushTruthGateViewedOnce).toHaveBeenCalledTimes(1);
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
  });

  it("measures each committed Prophecy route key exactly once", async () => {
    renderProvider(<ProphecyDocument />);
    flushAnimationFrames();

    await act(async () => {
      navigateRef?.("/prophecy?variant=b");
    });
    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(1);
    flushAnimationFrames();

    expect(mocks.pushVirtualPageView).toHaveBeenCalledTimes(2);
    expect(mocks.pushVirtualPageView).toHaveBeenLastCalledWith({
      page_path: "/prophecy",
      page_search: "?variant=b",
    });
    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackMetaPageView).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
  });
});
