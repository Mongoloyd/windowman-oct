import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WM_CHAT_RESUME_STORAGE_KEY } from "./wmChatResume";
import { getWmChatOption } from "./wmChatContent";
import type {
  WmChatEmailSubmitter,
  WmChatPostCaptureSubmitInput,
  WmChatPostCaptureSubmitter,
  WmChatSubmitInput,
  WmChatSubmitter,
} from "./wmChatTypes";
import WmChatPage from "./WmChatPage";

const {
  navigateMock,
  setPhoneMock,
  setLeadIdMock,
  setSessionIdMock,
  powerToolPropsMock,
  submitWmChatPostCaptureMock,
  getOrCreateContinuationSubmissionIdMock,
  rotateContinuationSubmissionIdMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  setPhoneMock: vi.fn(),
  setLeadIdMock: vi.fn(),
  setSessionIdMock: vi.fn(),
  powerToolPropsMock: vi.fn(),
  submitWmChatPostCaptureMock: vi.fn(),
  getOrCreateContinuationSubmissionIdMock: vi.fn(),
  rotateContinuationSubmissionIdMock: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    setPhone: setPhoneMock,
    setLeadId: setLeadIdMock,
    setSessionId: setSessionIdMock,
  }),
}));

vi.mock("@/services/wmchatPostCapture", () => ({
  submitWmChatPostCapture: (input: WmChatPostCaptureSubmitInput) =>
    submitWmChatPostCaptureMock(input),
}));

vi.mock("./wmChatIdentity", () => ({
  getOrCreateWmChatSessionId: () =>
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  getOrCreateWmChatSubmissionId: () =>
    "11111111-2222-4333-8444-555555555555",
  getOrCreateWmChatContinuationSubmissionId: () =>
    getOrCreateContinuationSubmissionIdMock(),
  rotateWmChatContinuationSubmissionId: () =>
    rotateContinuationSubmissionIdMock(),
}));

vi.mock("@/components/PowerToolDemo", () => ({
  default: (props: {
    triggerOpen?: boolean;
    entrySource?: string;
    onToolClose?: () => void;
  }) => {
    powerToolPropsMock(props);
    return (
      <div role="dialog" aria-label="WindowMan Power Demo">
        <button type="button" onClick={props.onToolClose}>
          Close Instant Demo
        </button>
      </div>
    );
  },
}));

const LEAD_ID = "99999999-8888-4777-8666-555555555555";
const CONTINUATION_STORAGE_KEY = "wm_wmchat_continuation_submission_id";
const CONTINUATION_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const ROTATED_CONTINUATION_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const scrollIntoViewMock = vi.fn();

function renderPage(
  submitter: WmChatSubmitter = vi.fn(),
  initialEntry = "/wmchat",
  thinkingDelayMs: () => number = () => 0,
  emailSubmitter?: WmChatEmailSubmitter,
  postCaptureSubmitter?: WmChatPostCaptureSubmitter,
) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <WmChatPage
          submitter={submitter}
          emailSubmitter={emailSubmitter}
          postCaptureSubmitter={postCaptureSubmitter}
          thinkingDelayMs={thinkingDelayMs}
        />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function renderPageWithProductionDelay(submitter: WmChatSubmitter = vi.fn()) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/wmchat"]}>
        <WmChatPage submitter={submitter} />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function choose(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function advanceNeedQuoteToFullRecap() {
  choose("Help me get a fair quote");
  choose("I’m planning, budgeting, or researching");
  choose("A realistic price baseline");
  choose("A clear price baseline");
  choose("Keep going");
  choose("Unexpected cost later");
  choose("Pressure to sign quickly");
}

function advanceNeedQuoteToPhone() {
  advanceNeedQuoteToFullRecap();
  choose("That’s right");
  fireEvent.change(screen.getByLabelText("ZIP code"), {
    target: { value: "33301" },
  });
  choose("Continue");
  choose("Windows");
  choose("6–10");
  choose("I’m setting a baseline");
  choose("1–3 months");
  choose("Skip");
}

function advanceQuoteUploadToPhone() {
  choose("Check my existing quote");
  choose("Upload first");
}

function advanceQuoteDiagnosisToPhone() {
  choose("Check my existing quote");
  choose("The price");
  choose("The total feels high");
  choose("Skip");
}

describe("WmChatPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setPhoneMock.mockReset();
    setLeadIdMock.mockReset();
    setSessionIdMock.mockReset();
    powerToolPropsMock.mockReset();
    submitWmChatPostCaptureMock.mockReset();
    getOrCreateContinuationSubmissionIdMock.mockReset();
    rotateContinuationSubmissionIdMock.mockReset();
    scrollIntoViewMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    getOrCreateContinuationSubmissionIdMock.mockImplementation(() => {
      const existing = sessionStorage.getItem(CONTINUATION_STORAGE_KEY);
      if (existing) return existing;
      sessionStorage.setItem(CONTINUATION_STORAGE_KEY, CONTINUATION_ID);
      return CONTINUATION_ID;
    });
    rotateContinuationSubmissionIdMock.mockImplementation(() => {
      sessionStorage.setItem(
        CONTINUATION_STORAGE_KEY,
        ROTATED_CONTINUATION_ID,
      );
      return ROTATED_CONTINUATION_ID;
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the approved hero, identity, opening, restrained recommendation, and no email field", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "WindowMan: Your Quote Hero" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("WindowMan holding a project checklist")).toHaveAttribute(
      "src",
      expect.stringContaining("windowman-script"),
    );
    expect(screen.getByText("WindowMan AI · Software, not a contractor")).toBeInTheDocument();
    expect(
      screen.getByText("Tell me what brought you here. I’ll keep the next step simple."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What can I help you with?"),
    ).toBeInTheDocument();
    const quoteButton = screen.getByRole("button", { name: "Check my existing quote" });
    const fairQuoteButton = screen.getByRole("button", { name: "Help me get a fair quote" });
    const powersButton = screen.getByRole("button", { name: "Show me how it works" });
    expect(quoteButton).toBeEnabled();
    expect(fairQuoteButton).toBeEnabled();
    expect(powersButton).toBeEnabled();
    expect(fairQuoteButton).toHaveAttribute("data-recommended", "true");
    expect(fairQuoteButton.className).toContain("rgba(46,143,255,0.08)");
    expect(fairQuoteButton.className).not.toContain("bg-[#2e8fff]");
    expect(quoteButton).not.toHaveAttribute("data-recommended");
    expect(powersButton).not.toHaveAttribute("data-recommended");
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("shows nationwide first-glance status and evidence cards without unsupported promises", () => {
    renderPage();

    expect(screen.getByText("Free for homeowners")).toBeInTheDocument();
    expect(
      screen.getByText("AI quote intelligence for homeowner protection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Independent software")).toBeInTheDocument();
    expect(screen.getByText("Private by design")).toBeInTheDocument();

    const floatingHeader = screen.getByTestId("wmchat-floating-header");
    expect(floatingHeader.className).not.toMatch(/rounded|border|bg-|shadow/);

    const trustRail = screen.getByRole("complementary", {
      name: "What WindowMan checks",
    });
    expect(trustRail).toHaveTextContent("Find Costly Gaps");
    expect(trustRail).toHaveTextContent("Check Ratings & Scope");
    expect(trustRail).toHaveTextContent("Compare Real Evidence");
    expect(trustRail).not.toHaveTextContent(/save thousands|guarantee your home safety/i);
    expect(trustRail).not.toHaveTextContent(/verified against florida market data/i);
    expect(trustRail).not.toHaveTextContent(/statewide labor rates/i);
    expect(trustRail).not.toHaveTextContent(/truth score|savings potential/i);
    expect(screen.queryByText(/^Florida$/i)).not.toBeInTheDocument();
  });

  it("opens only one trust card at a time and exposes the proof accessibly", () => {
    renderPage();

    const costCard = screen.getByRole("button", {
      name: "Find Costly Gaps. Show details",
    });
    const scopeCard = screen.getByRole("button", {
      name: "Check Ratings & Scope. Show details",
    });
    expect(costCard).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(costCard);
    expect(
      screen.getByRole("button", { name: "Find Costly Gaps. Hide details" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(costCard).toHaveTextContent(
      "Flags unclear fees, bundled pricing, and missing line-item detail.",
    );

    fireEvent.click(scopeCard);
    expect(costCard).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", {
        name: "Check Ratings & Scope. Hide details",
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the window-card motion bounded and honors reduced motion", () => {
    const css = readFileSync(
      resolve(
        process.cwd(),
        "src/pages/WmChat/wmchat-trust-cards.css",
      ),
      "utf8",
    );
    expect(css).toContain("aspect-ratio: 1");
    expect(css).toContain("-apple-system");
    expect(css).toContain("BlinkMacSystemFont");
    expect(css).toContain('"Segoe UI"');
    expect(css).toContain("text-shadow");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none");
    expect(css).not.toMatch(/animation:[^;]*infinite/);
  });

  it("keeps stable product IDs while presenting nationwide approval copy", () => {
    expect(getWmChatOption("product_impact_noa")).toEqual(
      expect.objectContaining({
        id: "product_impact_noa",
        label: "Required product approvals or ratings",
      }),
    );
  });

  it("keeps trust peripheral by removing the opening rail after the first choice", async () => {
    renderPage();

    choose("Help me get a fair quote");

    await screen.findByText(/What’s got you looking into windows or doors right now/);
    expect(
      screen.queryByRole("complementary", {
        name: "What WindowMan checks",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the same hero element mounted as the conversation advances", async () => {
    renderPage();
    const hero = screen.getByAltText("WindowMan holding a project checklist");

    choose("Help me get a fair quote");

    expect(
      await screen.findByText(/What’s got you looking into windows or doors right now/),
    ).toBeInTheDocument();
    expect(screen.getByAltText("WindowMan holding a project checklist")).toBe(hero);
    expect(
      screen.getByRole("heading", { level: 1, name: "WindowMan: Your Quote Hero" }),
    ).toBeInTheDocument();
  });

  it("sets the locked title, noindex, and theme metadata", async () => {
    const staticRobotsMeta = document.createElement("meta");
    staticRobotsMeta.name = "robots";
    staticRobotsMeta.content = "index, follow";
    document.head.appendChild(staticRobotsMeta);
    const view = renderPage();
    await waitFor(() => expect(document.title).toBe("WindowMan: Your Quote Hero"));
    await waitFor(() => {
      const robots = Array.from(
        document.querySelectorAll('meta[name="robots"]'),
      );
      expect(robots.length).toBeGreaterThan(0);
      expect(robots.every((meta) => meta.getAttribute("content") === "noindex,nofollow"))
        .toBe(true);
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        "#070a0f",
      );
    });
    view.unmount();
    expect(staticRobotsMeta).toHaveAttribute("content", "index, follow");
    staticRobotsMeta.remove();
  });

  it("does not expose inconsistent browser speech controls", () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: /tap to hear|hear this reply/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help me get a fair quote" })).toBeEnabled();
  });

  it("uses instant transcript positioning when reduced motion is requested", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
      })),
    });
    renderPage(vi.fn(), "/wmchat", () => 500);

    choose("Help me get a fair quote");

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "auto",
        block: "end",
      });
    });
  });

  it("top-aligns each complete new question and its answer options", async () => {
    renderPage();

    choose("Help me get a fair quote");

    const prompt = await screen.findByText(
      /What’s got you looking into windows or doors right now/,
    );
    const activeQuestion = screen.getByTestId("wmchat-active-question");
    expect(activeQuestion).toContainElement(prompt);
    expect(activeQuestion).toContainElement(
      screen.getByRole("button", {
        name: "I’m planning, budgeting, or researching",
      }),
    );
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenLastCalledWith({
        behavior: "auto",
        block: "start",
      });
      expect(scrollIntoViewMock.mock.contexts.at(-1)).toBe(activeQuestion);
    });
  });

  it("locks the choices and shows a bounded WindowMan typing pause before advancing", async () => {
    vi.useFakeTimers();
    try {
      renderPage(vi.fn(), "/wmchat", () => 500);

      const choice = screen.getByRole("button", { name: "Help me get a fair quote" });
      fireEvent.click(choice);
      fireEvent.click(choice);

      expect(screen.getByRole("status", { name: "WindowMan is typing" })).toBeInTheDocument();
      expect(screen.getByText("Help me get a fair quote")).toBeInTheDocument();
      expect(screen.queryByText(/What’s got you looking into windows or doors right now/)).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(499);
      });
      expect(screen.getByRole("status", { name: "WindowMan is typing" })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("status", { name: "WindowMan is typing" })).not.toBeInTheDocument();
      expect(screen.getByText(/What’s got you looking into windows or doors right now/)).toBeInTheDocument();
      expect(screen.getAllByText("Help me get a fair quote")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the production delay when no test delay hook is supplied", async () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      renderPageWithProductionDelay();

      choose("Help me get a fair quote");
      expect(
        screen.getByRole("status", { name: "WindowMan is typing" }),
      ).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(
        screen.getByText(
          /What’s got you looking into windows or doors right now/,
        ),
      ).toBeInTheDocument();
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });

  it("captures optional name, required mobile, service-only consent, and succeeds only with a real pair", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.getByText(/authorize service texts and an automated WindowMan AI call/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    expect(
      await screen.findByRole("heading", { name: "Your project request is saved." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    ).toBeEnabled();
    expect(submitter).toHaveBeenCalledTimes(1);
    expect(submitter.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        firstName: null,
        phoneE164: "+15615550123",
        serviceCommunicationsGranted: true,
        marketingConsentPresented: false,
        marketingCommunicationsGranted: false,
      }),
    );
    expect(JSON.stringify(submitter.mock.calls[0][0].wmchatIntake)).not.toContain(
      "+15615550123",
    );
    expect(setPhoneMock).not.toHaveBeenCalled();
    expect(setLeadIdMock).not.toHaveBeenCalled();
    expect(setSessionIdMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("makes a persisted game-plan choice terminal without recapturing contact", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    const postCaptureSubmitter = vi.fn(
      async (input: WmChatPostCaptureSubmitInput) => ({
        ok: true as const,
        leadId: input.leadId,
        sessionId: input.sessionId,
      }),
    );
    renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Where is this project?" }),
    ).toBeInTheDocument();
    choose("Skip this step");
    expect(screen.getByText(/Project address:/i).closest("p")).toHaveTextContent(
      "Skipped",
    );
    choose("Confirm this next step");

    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your original project request remains safely preserved."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Return to post-capture choices",
      }),
    ).not.toBeInTheDocument();
    expect(postCaptureSubmitter).toHaveBeenCalledTimes(1);
    expect(submitWmChatPostCaptureMock).not.toHaveBeenCalled();
    expect(postCaptureSubmitter.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        leadId: LEAD_ID,
        action: "quote_request_game_plan",
        propertyAddress: null,
      }),
    );
    expect(screen.queryByLabelText("Mobile number")).not.toBeInTheDocument();
  });

  it("temporarily hides the unfulfilled WindowMan conversation action", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    await screen.findByRole("heading", { name: "Your project request is saved." });
    expect(
      screen.queryByRole("button", {
        name: /Schedule a WindowMan conversation/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Review my quote when ready/i }),
    ).toBeEnabled();
  });

  it("uses the canonical production post-capture submitter when no test seam is injected", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    submitWmChatPostCaptureMock.mockImplementation(
      async (input: WmChatPostCaptureSubmitInput) => ({
        ok: true as const,
        leadId: input.leadId,
        sessionId: input.sessionId,
      }),
    );
    renderPage(submitter);
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    choose("Skip this step");
    choose("Confirm this next step");

    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
    expect(submitWmChatPostCaptureMock).toHaveBeenCalledTimes(1);
    expect(submitWmChatPostCaptureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: LEAD_ID,
        sessionId: submitter.mock.calls[0][0].sessionId,
        action: "quote_request_game_plan",
        propertyAddress: null,
      }),
    );
  });

  it("keeps the synchronous duplicate-submit guard on the production submitter", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    let resolveContinuation!: (value: {
      ok: true;
      leadId: string;
      sessionId: string;
    }) => void;
    submitWmChatPostCaptureMock.mockImplementation(
      (input: WmChatPostCaptureSubmitInput) =>
        new Promise((resolve) => {
          resolveContinuation = () =>
            resolve({
              ok: true,
              leadId: input.leadId,
              sessionId: input.sessionId,
            });
        }),
    );
    renderPage(submitter);
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    choose("Skip this step");

    const confirm = screen.getByRole("button", { name: "Confirm this next step" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(submitWmChatPostCaptureMock).toHaveBeenCalledTimes(1),
    );
    expect(confirm).toBeDisabled();

    resolveContinuation({ ok: true, leadId: LEAD_ID, sessionId: "unused" });
    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
  });

  it("opens the existing private scanner directly from the post-capture quote path", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Review my quote when ready/i }),
    );
    expect(screen.queryByText("Where is this project?")).not.toBeInTheDocument();
    choose("Yes — open my secure scanner");

    expect(
      screen.getByRole("heading", { name: "Opening your secure quote scanner." }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Project address:/i)).not.toBeInTheDocument();
    await waitFor(() => expect(setLeadIdMock).toHaveBeenCalledWith(LEAD_ID));
    expect(setPhoneMock).toHaveBeenCalledWith("+15615550123", "screened_valid");
    expect(setSessionIdMock).toHaveBeenCalledWith(
      submitter.mock.calls[0][0].sessionId,
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(
        "/?post_capture=upload&source=wmchat",
      ),
    );
  });

  it("cancels an abandoned scanner handoff and rearms it once on re-entry", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");

    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Review my quote when ready/i }),
    );

    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      choose("Yes — open my secure scanner");
      expect(
        screen.getByRole("heading", { name: "Opening your secure quote scanner." }),
      ).toBeInTheDocument();

      choose("Back");
      expect(
        screen.getByRole("heading", { name: "Do you have the written quote now?" }),
      ).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
      expect(navigateMock).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("scanner_timer_orphaned_cleanup");

      choose("Yes — open my secure scanner");
      await act(async () => {
        vi.advanceTimersByTime(280);
      });
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(
        "/?post_capture=upload&source=wmchat",
      );
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("reuses one continuation identity after a failure and blocks duplicate taps", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    const seen: WmChatPostCaptureSubmitInput[] = [];
    let resolveFirst!: (value: { ok: false; message: string }) => void;
    const postCaptureSubmitter = vi.fn(
      (input: WmChatPostCaptureSubmitInput) => {
        seen.push(input);
        if (seen.length === 1) {
          return new Promise<{ ok: false; message: string }>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({
          ok: true as const,
          leadId: input.leadId,
          sessionId: input.sessionId,
        });
      },
    );
    renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    choose("Skip this step");

    const confirm = screen.getByRole("button", { name: "Confirm this next step" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(postCaptureSubmitter).toHaveBeenCalledTimes(1);
    resolveFirst({ ok: false, message: "Try that again." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Try that again.");
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Return to post-capture choices" }),
    ).toBeEnabled();

    choose("Confirm this next step");
    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
    expect(postCaptureSubmitter).toHaveBeenCalledTimes(2);
    expect(seen[1].submissionId).toBe(seen[0].submissionId);
    expect(seen[1].leadId).toBe(seen[0].leadId);
    expect(seen[1].sessionId).toBe(seen[0].sessionId);
    expect(getOrCreateContinuationSubmissionIdMock).toHaveBeenCalledTimes(1);
    expect(rotateContinuationSubmissionIdMock).not.toHaveBeenCalled();
  });

  it("reuses the sessionStorage continuation UUID after a page reload", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    const seen: WmChatPostCaptureSubmitInput[] = [];
    const postCaptureSubmitter = vi.fn(
      async (input: WmChatPostCaptureSubmitInput) => {
        seen.push(input);
        return seen.length === 1
          ? { ok: false as const, message: "The response was interrupted." }
          : {
              ok: true as const,
              leadId: input.leadId,
              sessionId: input.sessionId,
            };
      },
    );

    const firstPage = renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    choose("Skip this step");
    choose("Confirm this next step");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The response was interrupted.",
    );
    expect(sessionStorage.getItem(CONTINUATION_STORAGE_KEY)).toBe(
      CONTINUATION_ID,
    );

    firstPage.unmount();
    renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    choose("Skip this step");
    choose("Confirm this next step");

    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
    expect(seen).toHaveLength(2);
    expect(seen[1].submissionId).toBe(seen[0].submissionId);
    expect(seen[1].submissionId).toBe(CONTINUATION_ID);
    expect(rotateContinuationSubmissionIdMock).not.toHaveBeenCalled();
  });

  it("rotates the continuation UUID when the draft changes before persistence", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    const seen: WmChatPostCaptureSubmitInput[] = [];
    const postCaptureSubmitter = vi.fn(
      async (input: WmChatPostCaptureSubmitInput) => {
        seen.push(input);
        return seen.length === 1
          ? { ok: false as const, message: "Review the address." }
          : {
              ok: true as const,
              leadId: input.leadId,
              sessionId: input.sessionId,
            };
      },
    );
    renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    fireEvent.change(screen.getByLabelText("Street address"), {
      target: { value: "123 Main Street" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Fort Lauderdale" },
    });
    fireEvent.change(screen.getByLabelText("State"), {
      target: { value: "FL" },
    });
    fireEvent.change(screen.getByLabelText("Project ZIP code"), {
      target: { value: "33301" },
    });
    choose("Add to my game plan");
    choose("Confirm this next step");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Review the address.",
    );

    choose("Back");
    fireEvent.change(screen.getByLabelText("Street address"), {
      target: { value: "456 Oak Avenue" },
    });
    choose("Add to my game plan");
    choose("Confirm this next step");

    expect(
      await screen.findByRole("heading", { name: "Game-plan request received." }),
    ).toBeInTheDocument();
    expect(seen.map(({ submissionId }) => submissionId)).toEqual([
      CONTINUATION_ID,
      ROTATED_CONTINUATION_ID,
    ]);
    expect(rotateContinuationSubmissionIdMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CONTINUATION_STORAGE_KEY)).toBe(
      ROTATED_CONTINUATION_ID,
    );
  });

  it("stores no phone or property PII with the continuation UUID", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    const postCaptureSubmitter = vi.fn(
      async () => ({ ok: false as const, message: "Try again later." }),
    );
    renderPage(
      submitter,
      "/wmchat",
      () => 0,
      undefined,
      postCaptureSubmitter,
    );
    advanceNeedQuoteToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save my project request");
    await screen.findByRole("heading", { name: "Your project request is saved." });
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );
    fireEvent.change(screen.getByLabelText("Street address"), {
      target: { value: "123 Main Street" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Fort Lauderdale" },
    });
    fireEvent.change(screen.getByLabelText("State"), {
      target: { value: "FL" },
    });
    fireEvent.change(screen.getByLabelText("Project ZIP code"), {
      target: { value: "33301" },
    });
    choose("Add to my game plan");
    choose("Confirm this next step");
    await screen.findByRole("alert");

    const storedEntries = Array.from(
      { length: sessionStorage.length },
      (_, index) => {
        const key = sessionStorage.key(index);
        return key ? [key, sessionStorage.getItem(key)] : null;
      },
    ).filter(Boolean);
    expect(storedEntries).toEqual([
      [CONTINUATION_STORAGE_KEY, CONTINUATION_ID],
    ]);
    expect(JSON.stringify(storedEntries)).not.toMatch(
      /5615550123|123 main street|fort lauderdale|33301/i,
    );
  });

  it("pays out the deterministic project brief immediately before no-quote phone capture", () => {
    const submitter = vi.fn();
    renderPage(submitter);
    advanceNeedQuoteToPhone();

    const preview = screen.getByTestId("wmchat-project-brief-preview");
    const phonePrompt = screen.getByText(
      /Your first-quote game plan is ready\. What mobile should I use/i,
    );
    const phoneInput = screen.getByLabelText("Mobile number");

    expect(preview).toHaveTextContent("Your first-quote game plan");
    expect(preview).toHaveTextContent("Goal");
    expect(preview).toHaveTextContent(
      "Build a comparable baseline before sales pressure begins.",
    );
    expect(preview).toHaveTextContent("Scope checklist");
    expect(preview.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(preview.querySelectorAll("li").length).toBeLessThanOrEqual(3);
    expect(preview).toHaveTextContent("Key question");
    expect(preview).toHaveTextContent(
      "What specifically changes if I do not sign today?",
    );
    expect(
      preview.compareDocumentPosition(phonePrompt) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(phoneInput).not.toHaveFocus();
    expect(submitter).not.toHaveBeenCalled();
  });

  it("does not show the no-quote brief on the quote-upload handoff", () => {
    renderPage();
    advanceQuoteUploadToPhone();

    expect(screen.queryByTestId("wmchat-project-brief-preview")).not.toBeInTheDocument();
    expect(
      screen.getByText(/open your secure quote scanner without making you start over/i),
    ).toBeInTheDocument();
  });

  it("keeps input and submission identity stable across a failed retry", async () => {
    const seen: WmChatSubmitInput[] = [];
    const submitter = vi.fn(async (input: WmChatSubmitInput) => {
      seen.push(input);
      if (seen.length === 1) return { ok: false as const, message: "Try that again." };
      return {
        ok: true as const,
        leadId: LEAD_ID,
        sessionId: input.sessionId,
        reused: true,
      };
    });
    renderPage(submitter);
    advanceQuoteUploadToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save & open secure scanner");

    expect(await screen.findByRole("alert")).toHaveTextContent("Try that again.");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("(561) 555-0123");
    expect(setPhoneMock).not.toHaveBeenCalled();
    expect(setLeadIdMock).not.toHaveBeenCalled();
    expect(setSessionIdMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    choose("Save & open secure scanner");
    await waitFor(() => expect(submitter).toHaveBeenCalledTimes(2));
    expect(seen[1].sessionId).toBe(seen[0].sessionId);
    expect(seen[1].submissionId).toBe(seen[0].submissionId);
  });

  it("marks a Twilio-invalid number inline and clears the failure on edit", async () => {
    const submitter = vi.fn(async () => ({
      ok: false as const,
      code: "invalid_phone" as const,
      message:
        "That number could not be validated. Check it and enter a valid US number.",
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();

    const input = screen.getByLabelText("Mobile number");
    fireEvent.change(input, { target: { value: "5615550123" } });
    choose("Save my project request");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That number could not be validated",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveValue("(561) 555-0123");

    fireEvent.change(input, { target: { value: "5615550199" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveValue("(561) 555-0199");
  });

  it("renders a temporary Lookup outage without blaming the entered number", async () => {
    const submitter = vi.fn(async () => ({
      ok: false as const,
      code: "lookup_unavailable" as const,
      message:
        "I couldn’t check that number right now. Your answers are still here—please try again.",
    }));
    renderPage(submitter);
    advanceNeedQuoteToPhone();

    const input = screen.getByLabelText("Mobile number");
    fireEvent.change(input, { target: { value: "5615550123" } });
    choose("Save my project request");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "I couldn’t check that number right now",
    );
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveValue("(561) 555-0123");
  });

  it("recovers when the mobile capture submitter rejects", async () => {
    const seen: WmChatSubmitInput[] = [];
    const submitter = vi.fn(async (input: WmChatSubmitInput) => {
      seen.push(input);
      if (seen.length === 1) throw new Error("offline");
      return {
        ok: true as const,
        leadId: LEAD_ID,
        sessionId: input.sessionId,
        reused: true,
      };
    });
    renderPage(submitter);
    advanceQuoteUploadToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save & open secure scanner");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That didn’t save safely. Please try again.",
    );
    expect(screen.getByLabelText("Mobile number")).toHaveValue("(561) 555-0123");
    expect(screen.getByRole("button", { name: "Save & open secure scanner" })).toBeEnabled();
    expect(navigateMock).not.toHaveBeenCalled();
    choose("Save & open secure scanner");
    expect(
      await screen.findByRole("heading", { name: "Now show me the quote." }),
    ).toBeInTheDocument();
    expect(submitter).toHaveBeenCalledTimes(2);
    expect(seen[1].sessionId).toBe(seen[0].sessionId);
    expect(seen[1].submissionId).toBe(seen[0].submissionId);
  });

  it("blocks duplicate submit taps", async () => {
    let resolveSubmit!: (value: {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }) => void;
    const submitter = vi.fn(
      (input: WmChatSubmitInput) =>
        new Promise((resolve) => {
          resolveSubmit = () =>
            resolve({
              ok: true,
              leadId: LEAD_ID,
              sessionId: input.sessionId,
              reused: false,
            });
        }),
    );
    renderPage(submitter);
    advanceQuoteUploadToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    const button = screen.getByRole("button", { name: "Save & open secure scanner" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submitter).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent("Checking your number…");
    resolveSubmit({ ok: true, leadId: LEAD_ID, sessionId: "unused", reused: false });
  });

  it("carries the trusted quote-holder identity into the existing private-upload handoff", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceQuoteUploadToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save & open secure scanner");

    expect(await screen.findByRole("heading", { name: "Now show me the quote." })).toBeInTheDocument();
    expect(screen.getByText("PDF or clear photos. Private upload. No retyping.")).toBeInTheDocument();
    expect(
      screen.getByText(/Opening your secure quote scanner/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(setLeadIdMock).toHaveBeenCalledWith(LEAD_ID));
    expect(setPhoneMock).toHaveBeenCalledWith("+15615550123", "screened_valid");
    const submittedSessionId = submitter.mock.calls[0][0].sessionId;
    expect(setSessionIdMock).toHaveBeenCalledWith(submittedSessionId);
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        "/?post_capture=upload&source=wmchat",
      );
    });
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const handoffUrl = navigateMock.mock.calls[0][0] as string;
    expect(handoffUrl).not.toContain(LEAD_ID);
    expect(handoffUrl).not.toContain(submittedSessionId);
    expect(handoffUrl).not.toContain("5615550123");
    expect(handoffUrl).not.toContain("consent");
  });

  it("hands off the completed quote-diagnosis path through the same private uploader", async () => {
    const submitter = vi.fn(async (input: WmChatSubmitInput) => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: input.sessionId,
      reused: false,
    }));
    renderPage(submitter);
    advanceQuoteDiagnosisToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "(561) 555-0123" },
    });
    choose("Save & open secure scanner");

    await waitFor(() => expect(setPhoneMock).toHaveBeenCalledTimes(1));
    expect(setPhoneMock).toHaveBeenCalledWith("+15615550123", "screened_valid");
    expect(setLeadIdMock).toHaveBeenCalledWith(LEAD_ID);
    expect(setSessionIdMock).toHaveBeenCalledWith(
      submitter.mock.calls[0][0].sessionId,
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
  });

  it("rejects a capture response whose session does not match the submitted identity", async () => {
    const submitter = vi.fn(async () => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
      reused: false,
    }));
    renderPage(submitter);
    advanceQuoteUploadToPhone();
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615550123" },
    });
    choose("Save & open secure scanner");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That didn’t save safely. Please try again.",
    );
    expect(screen.getByLabelText("Mobile number")).toHaveValue("(561) 555-0123");
    expect(screen.queryByRole("heading", { name: "Now show me the quote." })).not.toBeInTheDocument();
    expect(setPhoneMock).not.toHaveBeenCalled();
    expect(setLeadIdMock).not.toHaveBeenCalled();
    expect(setSessionIdMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("restores a validated cached conversation on an ordinary refresh", () => {
    localStorage.setItem(
      WM_CHAT_RESUME_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAtMs: Date.now(),
        entryIntent: "need_quote",
        currentNodeId: "need_reason",
        history: [{ nodeId: "entry", optionIds: ["entry_need_quote"] }],
      }),
    );
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start over" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Help me get a fair quote" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/What’s got you looking into windows or doors right now/),
    ).toBeInTheDocument();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).not.toBeNull();
  });

  it.each(["/wmchat?r=1", "/wmchat?resume_token=returning"]) (
    "also restores a cached conversation through an explicit resume URL (%s)",
    (initialEntry) => {
      localStorage.setItem(
        WM_CHAT_RESUME_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 1,
          savedAtMs: Date.now(),
          entryIntent: "need_quote",
          currentNodeId: "need_reason",
          history: [{ nodeId: "entry", optionIds: ["entry_need_quote"] }],
        }),
      );
      renderPage(vi.fn(), initialEntry);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start over" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Resume conversation" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Help me get a fair quote" })).not.toBeInTheDocument();
      expect(screen.getByText(/What’s got you looking into windows or doors right now/)).toBeInTheDocument();
    },
  );

  it("renders the config-driven recap edit menu and returns an unfinished edit to it", () => {
    renderPage();
    advanceNeedQuoteToFullRecap();

    expect(screen.getByText(/You care most about a clear price baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/practical outcome you most want to avoid is unexpected cost later/i)).toBeInTheDocument();
    expect(screen.getByText(/biggest concern with the process is pressure to sign quickly/i)).toBeInTheDocument();

    choose("Change something");
    expect(screen.getByRole("button", { name: "What brought me here" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "The specific situation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "What matters most" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "What I want to avoid" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "My trust concern" })).toBeEnabled();

    choose("What brought me here");
    choose("Comfort, outside noise, or energy use");
    expect(screen.getByText(/What’s most noticeable/i)).toBeInTheDocument();
    choose("Back");

    expect(screen.getByText("Absolutely. What should we change?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What brought me here" })).toBeEnabled();
  });

  it("keeps UI modules free of direct database, tracking, scanner, OTP, reveal, and full_json imports", () => {
    const files = [
      "WmChatPage.tsx",
      "WmChatConversation.tsx",
      "WmChatOpening.tsx",
      "WmChatProjectBriefPreview.tsx",
      "wmChatContent.ts",
      "wmChatReducer.ts",
      "wmChatResume.ts",
    ];
    const source = files
      .map((file) =>
        readFileSync(resolve(process.cwd(), "src/pages/WmChat", file), "utf8"),
      )
      .join("\n");
    expect(source).not.toMatch(/from ["'][^"']*supabase/i);
    expect(source).not.toMatch(/trackConversion|dataLayer|capi-event|scan-quote|full_json/i);
    expect(source).not.toMatch(/otp|reveal authorization/i);
  });

  it("opens the existing Power Demo with wm_chat attribution and returns to the hesitation choice", async () => {
    renderPage();
    choose("Show me how it works");
    choose("Show me what quotes leave out");
    choose("Show me how real comparisons work");
    choose("Show me how my contact stays private");
    choose("Show me how you track follow-through");
    choose("Not ready yet");

    expect(screen.getByRole("button", { name: "Run the Instant Demo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Email me what to watch for" })).toBeEnabled();
    choose("Run the Instant Demo");

    expect(
      await screen.findByRole("dialog", { name: "WindowMan Power Demo" }),
    ).toBeInTheDocument();
    expect(powerToolPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ triggerOpen: true, entrySource: "wm_chat" }),
    );
    expect(navigateMock).not.toHaveBeenCalled();
    choose("Close Instant Demo");
    expect(
      await screen.findByRole("button", { name: "Run the Instant Demo" }),
    ).toBeEnabled();
  });

  it("captures the Protection Kit as email-only with truthful service disclosure", async () => {
    const emailSubmitter = vi.fn(async () => ({
      ok: true as const,
      leadId: LEAD_ID,
      sessionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
      reused: false,
    }));
    renderPage(vi.fn(), "/wmchat", () => 0, emailSubmitter);
    choose("Show me how it works");
    choose("Show me what quotes leave out");
    choose("Show me how real comparisons work");
    choose("Show me how my contact stays private");
    choose("Show me how you track follow-through");
    choose("Not ready yet");
    choose("Email me what to watch for");

    expect(
      screen.getByText("Get the Answers Before You Get the Quote"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/does not enroll you in marketing messages/i)).not.toHaveLength(0);
    expect(screen.getByText(/Automated delivery is not live yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  Maria@Example.com  " },
    });
    choose("Save my Protection Kit request");

    expect(
      await screen.findByRole("heading", {
        name: "Protection Kit request received.",
      }),
    ).toBeInTheDocument();
    expect(emailSubmitter).toHaveBeenCalledTimes(1);
    expect(emailSubmitter).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "maria@example.com",
        wmchatIntake: expect.objectContaining({
          continuation: "email_only",
          entry_intent: "learn_powers",
        }),
      }),
    );
    expect(JSON.stringify(emailSubmitter.mock.calls[0][0].wmchatIntake)).not.toContain(
      "maria@example.com",
    );
    expect(setPhoneMock).not.toHaveBeenCalled();
    expect(setLeadIdMock).not.toHaveBeenCalled();
    expect(setSessionIdMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("recovers when the Protection Kit submitter rejects", async () => {
    let attempts = 0;
    const emailSubmitter = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return {
        ok: true as const,
        leadId: LEAD_ID,
        sessionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
        reused: true,
      };
    });
    renderPage(vi.fn(), "/wmchat", () => 0, emailSubmitter);
    choose("Show me how it works");
    choose("Show me what quotes leave out");
    choose("Show me how real comparisons work");
    choose("Show me how my contact stays private");
    choose("Show me how you track follow-through");
    choose("Not ready yet");
    choose("Email me what to watch for");
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "maria@example.com" },
    });
    choose("Save my Protection Kit request");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That didn’t save safely. Please try again.",
    );
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "maria@example.com",
    );
    expect(
      screen.getByRole("button", { name: "Save my Protection Kit request" }),
    ).toBeEnabled();
    choose("Save my Protection Kit request");
    expect(
      await screen.findByRole("heading", {
        name: "Protection Kit request received.",
      }),
    ).toBeInTheDocument();
    expect(emailSubmitter).toHaveBeenCalledTimes(2);
  });
});
