import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

const pushLowIntentEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushLowIntentEvent: (...args: unknown[]) => pushLowIntentEventMock(...args),
}));

vi.mock("@/assets/exit-intent-superhero.png", () => ({
  default: "exit-intent-mock.png",
}));

vi.mock("framer-motion", () => {
  const make =
    (tag: string) =>
    ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(tag, rest, children);

  return {
    motion: new Proxy({}, { get: (_, key: string) => make(key) }),
    AnimatePresence: ({ children }: React.PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
  };
});

import HomepageMicroConversionTracker from "./HomepageMicroConversionTracker";
import ExitIntentPhoneModal from "@/components/ExitIntentPhoneModal";

const SCROLLABLE_HEIGHT = 1000;
const VIEWPORT_HEIGHT = 1000;
const DOCUMENT_HEIGHT = SCROLLABLE_HEIGHT + VIEWPORT_HEIGHT;
const WM_EXIT_SHOWN_KEY = "wm_exit_shown";

function callsFor(eventName: string) {
  return pushLowIntentEventMock.mock.calls.filter(([name]) => name === eventName);
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}

function setDocumentFocus(hasFocus: boolean) {
  vi.spyOn(document, "hasFocus").mockReturnValue(hasFocus);
}

let currentScrollY = 0;

function installScrollMetrics() {
  currentScrollY = 0;
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => currentScrollY);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
    DOCUMENT_HEIGHT,
  );
}

function setScrollMetrics(scrollY: number) {
  currentScrollY = scrollY;
}

function dispatchScroll() {
  act(() => {
    fireEvent.scroll(window);
    vi.runOnlyPendingTimers();
  });
}

// jsdom's PointerEvent does not populate `relatedTarget` from fireEvent init,
// so define it explicitly on the event to exercise the CTA boundary guard.
function firePointerWithRelatedTarget(
  type: "pointerOver" | "pointerOut",
  element: Element,
  relatedTarget?: Element | null,
) {
  const event = createEvent[type](element);
  if (relatedTarget != null) {
    Object.defineProperty(event, "relatedTarget", {
      value: relatedTarget,
      configurable: true,
    });
  }
  fireEvent(element, event);
}

function dispatchPointerOver(element: Element, relatedTarget?: Element | null) {
  act(() => {
    firePointerWithRelatedTarget("pointerOver", element, relatedTarget);
  });
}

function dispatchPointerOut(element: Element, relatedTarget?: Element | null) {
  act(() => {
    firePointerWithRelatedTarget("pointerOut", element, relatedTarget);
  });
}

function dispatchPointerDown(element: Element) {
  act(() => {
    fireEvent.pointerDown(element);
  });
}

// Controlled matchMedia state. The mock is installed as a spy in beforeEach so
// vi.restoreAllMocks() reliably tears it down and state cannot leak between
// tests (a direct `window.matchMedia = vi.fn()` assignment would not restore).
let finePointerMatches = false;
let matchMediaSpy: MockInstance;

function installMatchMediaSpy() {
  matchMediaSpy = vi
    .spyOn(window, "matchMedia")
    .mockImplementation((query: string) => ({
      matches:
        query === "(hover: hover) and (pointer: fine)"
          ? finePointerMatches
          : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList);
}

function setFinePointerMedia(matches: boolean) {
  finePointerMatches = matches;
}

function advanceEngagementMs(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderTrackerWithMarkup(markup?: React.ReactNode) {
  return render(
    <>
      <HomepageMicroConversionTracker />
      {markup}
    </>,
  );
}

const exitIntentDefaultProps = {
  suppressExitIntent: false,
  stepsCompleted: 0,
  flowMode: "A" as const,
  leadCaptured: false,
  flowBLeadCaptured: false,
  county: "Palm Beach",
  answers: {
    windowCount: null,
    projectType: null,
    county: null,
    quoteStage: null,
    firstName: null,
    email: null,
    phone: null,
  },
  onClose: vi.fn(),
  onCTAClick: vi.fn(),
};

describe("HomepageMicroConversionTracker", () => {
  let rafSpy: MockInstance;
  let hasFocusSpy: MockInstance | undefined;

  beforeEach(() => {
    pushLowIntentEventMock.mockReset();
    sessionStorage.clear();
    vi.useFakeTimers();

    setVisibility("visible");
    hasFocusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    installScrollMetrics();
    installMatchMediaSpy();
    setFinePointerMedia(false);

    rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        return window.setTimeout(() => cb(performance.now()), 0) as unknown as number;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    rafSpy.mockRestore();
    hasFocusSpy?.mockRestore();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("1. active 30-second engagement", () => {
    it("does not emit engaged_session before 30 active seconds", () => {
      renderTrackerWithMarkup();
      advanceEngagementMs(29_999);
      expect(callsFor("engaged_session")).toHaveLength(0);
    });

    it("emits exactly one engaged_session at 30 active seconds", () => {
      renderTrackerWithMarkup();
      advanceEngagementMs(30_000);
      expect(callsFor("engaged_session")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("engaged_session", {
        page_path: "/",
        active_time_seconds: 30,
        engagement_definition: "30s_active_foreground",
      });
    });

    it("does not duplicate engaged_session after additional timer advancement", () => {
      renderTrackerWithMarkup();
      advanceEngagementMs(30_000);
      advanceEngagementMs(60_000);
      expect(callsFor("engaged_session")).toHaveLength(1);
    });
  });

  describe("2. hidden-tab pause", () => {
    it("pauses engagement while hidden and resumes with remaining active duration", () => {
      renderTrackerWithMarkup();

      advanceEngagementMs(15_000);
      expect(callsFor("engaged_session")).toHaveLength(0);

      setVisibility("hidden");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      advanceEngagementMs(20_000);
      expect(callsFor("engaged_session")).toHaveLength(0);

      setVisibility("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      advanceEngagementMs(15_000);

      expect(callsFor("engaged_session")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("engaged_session", {
        page_path: "/",
        active_time_seconds: 30,
        engagement_definition: "30s_active_foreground",
      });
    });
  });

  describe("3. scroll milestones", () => {
    it("fires 25%, 50%, and 75% scroll_depth exactly once each", () => {
      renderTrackerWithMarkup();

      setScrollMetrics(250);
      dispatchScroll();
      setScrollMetrics(500);
      dispatchScroll();
      setScrollMetrics(750);
      dispatchScroll();

      expect(callsFor("scroll_depth")).toHaveLength(3);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("scroll_depth", {
        page_path: "/",
        scroll_percent: 25,
        scroll_unit: "percent",
      });
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("scroll_depth", {
        page_path: "/",
        scroll_percent: 50,
        scroll_unit: "percent",
      });
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("scroll_depth", {
        page_path: "/",
        scroll_percent: 75,
        scroll_unit: "percent",
      });
    });

    it("does not duplicate scroll_depth when scrolling above a fired threshold", () => {
      renderTrackerWithMarkup();

      setScrollMetrics(500);
      dispatchScroll();
      setScrollMetrics(600);
      dispatchScroll();
      setScrollMetrics(700);
      dispatchScroll();

      const scrollCalls = callsFor("scroll_depth");
      expect(scrollCalls).toHaveLength(2);
      expect(scrollCalls.map((call) => call[1])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ scroll_percent: 25 }),
          expect.objectContaining({ scroll_percent: 50 }),
        ]),
      );
    });

    it("emits all newly crossed thresholds once when jumping to 80%", () => {
      renderTrackerWithMarkup();

      setScrollMetrics(800);
      dispatchScroll();

      const scrollCalls = callsFor("scroll_depth");
      expect(scrollCalls).toHaveLength(3);
      expect(scrollCalls.map((call) => (call[1] as { scroll_percent: number }).scroll_percent)).toEqual([
        25, 50, 75,
      ]);
    });
  });

  describe("4. QPV time first", () => {
    it("fires quality_page_view only after 30s engagement and 50% scroll", () => {
      renderTrackerWithMarkup();

      advanceEngagementMs(30_000);
      expect(callsFor("quality_page_view")).toHaveLength(0);

      setScrollMetrics(500);
      dispatchScroll();

      expect(callsFor("quality_page_view")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("quality_page_view", {
        page_path: "/",
        active_time_seconds: 30,
        scroll_percent: 50,
        qpv_definition: "30s_active_and_50_scroll",
        qpv_version: "v1",
      });
    });
  });

  describe("5. QPV scroll first", () => {
    it("fires quality_page_view only after 50% scroll and 30s engagement", () => {
      renderTrackerWithMarkup();

      setScrollMetrics(500);
      dispatchScroll();
      expect(callsFor("quality_page_view")).toHaveLength(0);

      advanceEngagementMs(30_000);

      expect(callsFor("quality_page_view")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("quality_page_view", {
        page_path: "/",
        active_time_seconds: 30,
        scroll_percent: 50,
        qpv_definition: "30s_active_and_50_scroll",
        qpv_version: "v1",
      });
    });
  });

  describe("6. form start", () => {
    it("emits form_start once on first focus of a marked input only", () => {
      renderTrackerWithMarkup(
        <>
          <input
            data-testid="marked-input"
            data-wm-form-start="truth_gate_contact"
            data-wm-form-step="1"
            data-wm-field-name="first_name"
          />
          <input data-testid="unmarked-input" />
        </>,
      );

      const marked = screen.getByTestId("marked-input");
      const unmarked = screen.getByTestId("unmarked-input");

      act(() => {
        marked.focus();
      });
      act(() => {
        marked.focus();
      });
      act(() => {
        unmarked.focus();
      });

      expect(callsFor("form_start")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("form_start", {
        page_path: "/",
        form_id: "truth_gate_contact",
        form_step: "1",
        field_name: "first_name",
      });
    });
  });

  describe("7. CTA hover", () => {
    function renderMarkedCta() {
      const view = renderTrackerWithMarkup(
        <button
          type="button"
          data-testid="marked-cta"
          data-wm-primary-cta="true"
          data-wm-cta-id="hero_scan_quote"
          data-wm-cta-location="hero"
        >
          Scan My Quote
        </button>,
      );
      return screen.getByTestId("marked-cta");
    }

    it("does not emit cta_hover before 2,000 ms on fine-pointer devices", () => {
      setFinePointerMedia(true);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(1_999);

      expect(callsFor("cta_hover")).toHaveLength(0);
    });

    it("emits cta_hover at 2,000 ms on fine-pointer hover-capable devices", () => {
      setFinePointerMedia(true);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(2_000);

      expect(callsFor("cta_hover")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("cta_hover", {
        page_path: "/",
        cta_id: "hero_scan_quote",
        cta_location: "hero",
        hover_duration_ms: 2_000,
      });
    });

    it("cancels cta_hover when pointerout leaves the CTA before 2,000 ms", () => {
      setFinePointerMedia(true);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(1_000);
      // relatedTarget outside the CTA => genuine boundary exit.
      dispatchPointerOut(cta, document.body);
      advanceEngagementMs(2_000);

      expect(callsFor("cta_hover")).toHaveLength(0);
    });

    it("keeps the hover timer when moving between nested children of the same CTA", () => {
      setFinePointerMedia(true);
      const view = renderTrackerWithMarkup(
        <button
          type="button"
          data-testid="nested-cta"
          data-wm-primary-cta="true"
          data-wm-cta-id="hero_scan_quote"
          data-wm-cta-location="hero"
        >
          <span data-testid="cta-icon">Icon</span>
          <span data-testid="cta-label">Scan My Quote</span>
        </button>,
      );

      const icon = screen.getByTestId("cta-icon");
      const label = screen.getByTestId("cta-label");

      // Pointer enters via the icon child.
      dispatchPointerOver(icon);
      advanceEngagementMs(1_000);

      // Transition icon -> label: pointerout of icon (relatedTarget=label, still
      // inside CTA) must NOT reset the timer, and the bubbled pointerover of the
      // already-active CTA must NOT restart it.
      dispatchPointerOut(icon, label);
      dispatchPointerOver(label);

      advanceEngagementMs(1_000);

      // Exactly one cta_hover at 2 total continuous seconds.
      expect(callsFor("cta_hover")).toHaveLength(1);
      expect(pushLowIntentEventMock).toHaveBeenCalledWith("cta_hover", {
        page_path: "/",
        cta_id: "hero_scan_quote",
        cta_location: "hero",
        hover_duration_ms: 2_000,
      });

      view.unmount();
    });

    it("cancels cta_hover when pointerdown happens before 2,000 ms", () => {
      setFinePointerMedia(true);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(1_000);
      dispatchPointerDown(cta);
      advanceEngagementMs(2_000);

      expect(callsFor("cta_hover")).toHaveLength(0);
    });

    it("never emits cta_hover on touch/non-hover media conditions", () => {
      setFinePointerMedia(false);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(2_000);

      expect(callsFor("cta_hover")).toHaveLength(0);
    });

    it("does not duplicate cta_hover for the same CTA ID", () => {
      setFinePointerMedia(true);
      const cta = renderMarkedCta();

      dispatchPointerOver(cta);
      advanceEngagementMs(2_000);

      dispatchPointerOver(cta);
      advanceEngagementMs(2_000);

      expect(callsFor("cta_hover")).toHaveLength(1);
    });
  });

  describe("8. cleanup", () => {
    it("does not emit tracking events after unmount with pending timers and rAF work", () => {
      setFinePointerMedia(true);
      const view = renderTrackerWithMarkup(
        <button
          type="button"
          data-testid="cleanup-cta"
          data-wm-primary-cta="true"
          data-wm-cta-id="cleanup_cta"
          data-wm-cta-location="test"
        >
          Cleanup CTA
        </button>,
      );
      const ctaButton = screen.getByTestId("cleanup-cta");

      dispatchPointerOver(ctaButton);
      setScrollMetrics(500);
      dispatchScroll();
      advanceEngagementMs(5_000);

      const callsBeforeUnmount = pushLowIntentEventMock.mock.calls.length;
      view.unmount();

      advanceEngagementMs(60_000);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        fireEvent.pointerOver(ctaButton);
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(pushLowIntentEventMock.mock.calls.length).toBe(callsBeforeUnmount);
    });
  });

  describe("9. background ticker cleanup", () => {
    it("clears the interval while hidden, ignores hidden time, and resumes to fire engaged_session once", () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
      renderTrackerWithMarkup();

      // Ticker runs while foregrounded and accrues 15s of active time.
      advanceEngagementMs(15_000);
      expect(callsFor("engaged_session")).toHaveLength(0);

      const clearsBeforeHide = clearIntervalSpy.mock.calls.length;

      // Hiding the tab flushes elapsed time AND clears the active interval.
      setVisibility("hidden");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(clearsBeforeHide);

      // Hidden time must not count toward engagement.
      advanceEngagementMs(60_000);
      expect(callsFor("engaged_session")).toHaveLength(0);

      // Restoring visibility creates a new ticker; remaining 15s completes 30s.
      setVisibility("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("focus"));
      });
      advanceEngagementMs(15_000);

      expect(callsFor("engaged_session")).toHaveLength(1);

      clearIntervalSpy.mockRestore();
    });
  });
});

describe("ExitIntentPhoneModal tracking", () => {
  let pushStateSpy: MockInstance;

  beforeEach(() => {
    pushLowIntentEventMock.mockReset();
    sessionStorage.clear();
    pushStateSpy = vi.spyOn(history, "pushState").mockImplementation(() => {});
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("opens the modal and emits exactly one desktop_chrome exit_intent", () => {
    render(<ExitIntentPhoneModal {...exitIntentDefaultProps} />);

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });

    expect(callsFor("exit_intent")).toHaveLength(1);
    expect(pushLowIntentEventMock).toHaveBeenCalledWith("exit_intent", {
      exit_method: "desktop_chrome",
      page_path: expect.any(String),
    });
    expect(
      screen.getByAltText(
        "Before you go — learn how WindowMan gets you the best window quotes",
      ),
    ).toBeInTheDocument();
  });

  it("does not emit exit_intent when suppressExitIntent is true", () => {
    render(
      <ExitIntentPhoneModal {...exitIntentDefaultProps} suppressExitIntent />,
    );

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });

    expect(callsFor("exit_intent")).toHaveLength(0);
    expect(
      screen.queryByAltText(
        "Before you go — learn how WindowMan gets you the best window quotes",
      ),
    ).not.toBeInTheDocument();
  });

  it("does not emit exit_intent when leadCaptured is true", () => {
    render(
      <ExitIntentPhoneModal {...exitIntentDefaultProps} leadCaptured />,
    );

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });

    expect(callsFor("exit_intent")).toHaveLength(0);
  });

  it("does not emit exit_intent when an interactive form field has focus", () => {
    render(
      <>
        <ExitIntentPhoneModal {...exitIntentDefaultProps} />
        <input data-testid="focused-field" />
      </>,
    );

    const field = screen.getByTestId("focused-field");
    act(() => {
      field.focus();
    });

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });

    expect(callsFor("exit_intent")).toHaveLength(0);
  });

  it("does not emit duplicate exit_intent after session deduplication", () => {
    sessionStorage.setItem(WM_EXIT_SHOWN_KEY, "true");

    render(<ExitIntentPhoneModal {...exitIntentDefaultProps} />);

    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 5, bubbles: true }),
      );
    });

    expect(callsFor("exit_intent")).toHaveLength(0);
  });

  it("cleans up history and listeners on unmount without leaving side effects", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const view = render(<ExitIntentPhoneModal {...exitIntentDefaultProps} />);
    expect(pushStateSpy).toHaveBeenCalled();

    const mouseleaveAdds = addSpy.mock.calls.filter(([type]) => type === "mouseleave")
      .length;
    const mouseleaveRemovesBefore = removeSpy.mock.calls.filter(
      ([type]) => type === "mouseleave",
    ).length;

    view.unmount();

    const mouseleaveRemovesAfter = removeSpy.mock.calls.filter(
      ([type]) => type === "mouseleave",
    ).length;
    expect(mouseleaveRemovesAfter - mouseleaveRemovesBefore).toBeGreaterThanOrEqual(
      mouseleaveAdds,
    );

    pushLowIntentEventMock.mockClear();
    act(() => {
      document.dispatchEvent(
        new MouseEvent("mouseleave", { clientY: 10, bubbles: true }),
      );
    });
    expect(callsFor("exit_intent")).toHaveLength(0);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("registers history.pushState only once across unrelated prop re-renders", () => {
    const view = render(<ExitIntentPhoneModal {...exitIntentDefaultProps} />);

    const initialCalls = pushStateSpy.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // Re-render with unchanged suppressExitIntent/leadCaptured but a changed
    // unrelated prop. A stable `show` keeps the history effect registered once.
    view.rerender(
      <ExitIntentPhoneModal {...exitIntentDefaultProps} stepsCompleted={3} />,
    );
    view.rerender(
      <ExitIntentPhoneModal {...exitIntentDefaultProps} stepsCompleted={5} />,
    );

    expect(pushStateSpy.mock.calls.length).toBe(initialCalls);

    view.unmount();
  });
});
