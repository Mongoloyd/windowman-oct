import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCampaignNqIllumination,
  type CampaignNqIlluminationOptions,
} from "./useCampaignNqIllumination";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

type MediaListener = () => void;

function stubMatchMedia(matchingQueries: string[]) {
  const listeners = new Map<string, Set<MediaListener>>();
  window.matchMedia = ((query: string) => ({
    matches: matchingQueries.includes(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_event: string, listener: MediaListener) => {
      const bucket = listeners.get(query) ?? new Set<MediaListener>();
      bucket.add(listener);
      listeners.set(query, bucket);
    },
    removeEventListener: (_event: string, listener: MediaListener) => {
      listeners.get(query)?.delete(listener);
    },
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  return listeners;
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  disconnectCount = 0;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  unobserve(element: Element) {
    this.observed = this.observed.filter((candidate) => candidate !== element);
  }

  disconnect() {
    this.disconnectCount += 1;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  emit(element: Element, isIntersecting: boolean) {
    this.callback(
      [{ target: element, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

let frameQueue: FrameRequestCallback[] = [];
let nextFrameId = 0;
let cancelledFrames: number[] = [];

function runPendingFrames() {
  const queued = frameQueue;
  frameQueue = [];
  for (const callback of queued) callback(0);
}

/** jsdom has no PointerEvent; MouseEvent carries the clientX/clientY the hook reads. */
function firePointerMove(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
}

function setScrollGeometry({
  scrollHeight,
  innerHeight,
  scrollY,
}: { scrollHeight: number; innerHeight: number; scrollY: number }) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: scrollY });
}

function Harness(options: CampaignNqIlluminationOptions) {
  const ref = useCampaignNqIllumination<HTMLDivElement>(options);
  return (
    <div ref={ref} data-testid="root">
      <section data-testid="first" className="wake" />
      <section data-testid="second" className="wake" />
    </div>
  );
}

const POINTER_OPTIONS: CampaignNqIlluminationOptions = {
  driver: "pointer",
  sectionSelector: ".wake",
};

const SCROLL_OPTIONS: CampaignNqIlluminationOptions = {
  driver: "scroll",
  sectionSelector: ".wake",
  progressProperty: "--scan-progress",
};

describe("useCampaignNqIllumination", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    frameQueue = [];
    nextFrameId = 0;
    cancelledFrames = [];
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frameQueue.push(callback);
      nextFrameId += 1;
      return nextFrameId;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => {
      cancelledFrames.push(id);
    }) as typeof window.cancelAnimationFrame;
    setScrollGeometry({ scrollHeight: 3000, innerHeight: 1000, scrollY: 0 });
    stubMatchMedia([FINE_HOVER_QUERY]);
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function listenedEvents(spy: ReturnType<typeof vi.spyOn>): string[] {
    return spy.mock.calls.map((call) => String(call[0]));
  }

  describe("reduced motion", () => {
    beforeEach(() => {
      stubMatchMedia([REDUCED_MOTION_QUERY, FINE_HOVER_QUERY]);
    });

    it("attaches no driver, observes nothing, and writes no custom properties", () => {
      const { getByTestId } = render(<Harness {...POINTER_OPTIONS} />);

      expect(listenedEvents(addSpy)).not.toContain("pointermove");
      expect(listenedEvents(addSpy)).not.toContain("scroll");
      expect(FakeIntersectionObserver.instances).toHaveLength(0);
      expect(frameQueue).toHaveLength(0);
      expect(getByTestId("root").getAttribute("style")).toBeNull();
    });
  });

  describe("pointer driver", () => {
    it("coalesces a burst of pointer moves into a single frame write", () => {
      const { getByTestId } = render(<Harness {...POINTER_OPTIONS} />);
      const root = getByTestId("root");

      firePointerMove(100, 200);
      firePointerMove(300, 400);
      firePointerMove(250, 500);

      expect(frameQueue).toHaveLength(1);
      runPendingFrames();

      // Only the most recent position is committed, normalised against the viewport.
      expect(root.style.getPropertyValue("--lit-x")).toBe("0.2500");
      expect(root.style.getPropertyValue("--lit-y")).toBe("0.5000");
    });

    it("schedules no frames while the page is idle", () => {
      render(<Harness {...POINTER_OPTIONS} />);
      expect(frameQueue).toHaveLength(0);
    });

    it("falls back to the scroll driver when the device has no fine hover", () => {
      stubMatchMedia([]);
      render(<Harness {...POINTER_OPTIONS} />);

      expect(listenedEvents(addSpy)).not.toContain("pointermove");
      expect(listenedEvents(addSpy)).toContain("scroll");
    });
  });

  describe("scroll driver", () => {
    it("writes clamped progress synchronously on mount so a restored scroll position is lit", () => {
      setScrollGeometry({ scrollHeight: 3000, innerHeight: 1000, scrollY: 500 });
      const { getByTestId } = render(<Harness {...SCROLL_OPTIONS} />);

      // 500 / (3000 - 1000) = 0.25, committed without waiting for a frame.
      expect(getByTestId("root").style.getPropertyValue("--scan-progress")).toBe("0.2500");
      expect(frameQueue).toHaveLength(0);
    });

    it("clamps progress to 0-1 beyond both ends of the document", () => {
      const { getByTestId, unmount } = render(<Harness {...SCROLL_OPTIONS} />);
      const root = getByTestId("root");

      Object.defineProperty(window, "scrollY", { configurable: true, value: 99999 });
      window.dispatchEvent(new Event("scroll"));
      runPendingFrames();
      expect(root.style.getPropertyValue("--scan-progress")).toBe("1.0000");

      Object.defineProperty(window, "scrollY", { configurable: true, value: -500 });
      window.dispatchEvent(new Event("scroll"));
      runPendingFrames();
      expect(root.style.getPropertyValue("--scan-progress")).toBe("0.0000");

      unmount();
    });

    it("reports zero progress when the document is too short to scroll", () => {
      setScrollGeometry({ scrollHeight: 600, innerHeight: 1000, scrollY: 0 });
      const { getByTestId } = render(<Harness {...SCROLL_OPTIONS} />);
      expect(getByTestId("root").style.getPropertyValue("--scan-progress")).toBe("0.0000");
    });

    it("recomputes on resize because the scrollable travel changes with the viewport", () => {
      render(<Harness {...SCROLL_OPTIONS} />);
      expect(listenedEvents(addSpy)).toContain("resize");
    });
  });

  describe("live section wake", () => {
    it("sets data-lit on entry and clears it on exit without latching", () => {
      const { getByTestId } = render(<Harness {...POINTER_OPTIONS} />);
      const observer = FakeIntersectionObserver.instances[0];
      const first = getByTestId("first");

      observer.emit(first, true);
      expect(first.dataset.lit).toBe("on");

      observer.emit(first, false);
      expect(first.dataset.lit).toBeUndefined();

      // The same section must be able to wake again on the way back up.
      observer.emit(first, true);
      expect(first.dataset.lit).toBe("on");
    });

    it("keeps observing after the first intersection", () => {
      const { getByTestId } = render(<Harness {...POINTER_OPTIONS} />);
      const observer = FakeIntersectionObserver.instances[0];

      observer.emit(getByTestId("first"), true);

      expect(observer.disconnectCount).toBe(0);
      expect(observer.observed).toHaveLength(2);
    });

    it("observes each section against the middle band of the viewport", () => {
      render(<Harness {...POINTER_OPTIONS} />);
      const observer = FakeIntersectionObserver.instances[0];

      expect(observer.observed).toHaveLength(2);
      expect(observer.options?.rootMargin).toBe("-35% 0px -35% 0px");
    });
  });

  describe("teardown", () => {
    it("removes listeners, disconnects, cancels the pending frame, and clears all state", () => {
      const { getByTestId, unmount } = render(<Harness {...POINTER_OPTIONS} />);
      const root = getByTestId("root");
      const first = getByTestId("first");
      const observer = FakeIntersectionObserver.instances[0];

      observer.emit(first, true);
      firePointerMove(10, 20);
      runPendingFrames();
      expect(root.style.getPropertyValue("--lit-x")).toBe("0.0100");

      // Leave a frame in flight so cancellation is actually exercised.
      firePointerMove(40, 60);
      expect(frameQueue).toHaveLength(1);

      unmount();

      expect(listenedEvents(removeSpy)).toContain("pointermove");
      expect(observer.disconnectCount).toBe(1);
      expect(cancelledFrames).toHaveLength(1);
      expect(first.dataset.lit).toBeUndefined();
      expect(root.style.getPropertyValue("--lit-x")).toBe("");
    });

    it("removes both scroll listeners and the progress property", () => {
      const { getByTestId, unmount } = render(<Harness {...SCROLL_OPTIONS} />);
      const root = getByTestId("root");

      unmount();

      const removed = listenedEvents(removeSpy);
      expect(removed).toContain("scroll");
      expect(removed).toContain("resize");
      expect(root.style.getPropertyValue("--scan-progress")).toBe("");
    });
  });

  it("rebuilds the driver when the reduced-motion preference flips at runtime", () => {
    const listeners = stubMatchMedia([FINE_HOVER_QUERY]);
    render(<Harness {...POINTER_OPTIONS} />);
    expect(listenedEvents(addSpy)).toContain("pointermove");

    // The user turns reduced motion on without reloading.
    stubMatchMedia([REDUCED_MOTION_QUERY, FINE_HOVER_QUERY]);
    act(() => {
      for (const listener of listeners.get(REDUCED_MOTION_QUERY) ?? []) listener();
    });

    expect(listenedEvents(removeSpy)).toContain("pointermove");
  });
});
