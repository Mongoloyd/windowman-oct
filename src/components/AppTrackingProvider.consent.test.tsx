import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppTrackingProvider } from "./AppTrackingProvider";

const mocks = vi.hoisted(() => ({
  initMetaBrowserPixel: vi.fn(),
  initOpenAiAdsPixel: vi.fn(),
  trackOpenAiAdsPageViewed: vi.fn(),
}));

vi.mock("@/lib/metaBrowserPixel", () => ({
  initMetaBrowserPixel: mocks.initMetaBrowserPixel,
  trackMetaPageView: vi.fn(),
}));

vi.mock("@/lib/openAiAdsPixel", () => ({
  initOpenAiAdsPixel: mocks.initOpenAiAdsPixel,
  trackOpenAiAdsPageViewed: mocks.trackOpenAiAdsPageViewed,
}));

vi.mock("@/lib/useLeadId", () => ({
  getLeadId: () => "test-lead-id",
  useLeadId: () => "test-lead-id",
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getUtmData: () => ({}),
  getUtmPayload: () => ({}),
  useUtmCapture: () => ({}),
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushTruthGateViewedOnce: vi.fn(),
  pushVirtualPageView: vi.fn(),
}));

describe("AppTrackingProvider consent handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-syncs OpenAI page measurement when consent changes", () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppTrackingProvider>
          <div>App</div>
        </AppTrackingProvider>
      </MemoryRouter>,
    );

    expect(mocks.initMetaBrowserPixel).toHaveBeenCalledTimes(1);
    expect(mocks.initOpenAiAdsPixel).toHaveBeenCalledTimes(1);
    expect(mocks.trackOpenAiAdsPageViewed).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });
    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      window.dispatchEvent(new Event("consentChanged"));
    });
    expect(mocks.trackOpenAiAdsPageViewed).toHaveBeenCalledTimes(1);
  });
});
