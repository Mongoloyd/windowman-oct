import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import NoQuoteLanding from "./NoQuoteLanding";
import { scopeNq3Css } from "./scopeNq3Css";

const { defaultSubmitMock } = vi.hoisted(() => ({
  defaultSubmitMock: vi.fn(),
}));

vi.mock("./campaignNq3LeadCapture", () => ({
  createCampaignNq3LeadSubmitter: () =>
    (...args: unknown[]) => defaultSubmitMock(...args),
}));

vi.mock("@/components/AppTrackingProvider", () => ({
  AppTrackingProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/consentBanner", () => ({
  default: () => null,
}));

vi.mock("@/state/scanFunnel", () => ({
  ScanFunnelProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/pages/Index", () => ({
  default: () => <div>Home</div>,
}));

function renderPage(onSubmitLead?: Parameters<typeof NoQuoteLanding>[0]["onSubmitLead"]) {
  return render(
    <HelmetProvider>
      <NoQuoteLanding onSubmitLead={onSubmitLead} />
    </HelmetProvider>,
  );
}

function advanceToContactStep() {
  fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
    target: { value: "34997" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Impact windows" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "6–10" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Not sure" }));
  return dialog;
}

describe("CampaignNQ3 NoQuoteLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-default",
      sessionId: "session-default",
      reused: false,
    });
  });

  it("renders at the exact /nq3 route through the application router", async () => {
    window.history.replaceState({}, "", "/nq3");
    render(<App />);

    expect(await screen.findByRole("heading", {
      level: 1,
      name: "Don't just get a window estimate. Get one that's been checked.",
    })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq3");
  });

  describe("route-scoped stylesheet contract", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/CampaignNQ3/nq-landing.css"),
      "utf8",
    );
    const scoped = scopeNq3Css(css);

    it("keeps every rule scoped to the NQ3 route container", () => {
      const selectors = scoped
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .match(/([^{}]+)\{/g)
        ?.map((match) => match.slice(0, -1).trim())
        .filter((selector) => selector && !selector.startsWith("@")) ?? [];

      expect(selectors.length).toBeGreaterThan(50);
      for (const selectorList of selectors) {
        for (const selector of selectorList.split(",")) {
          expect(selector.trim()).toMatch(/^\[data-page="campaign-nq3"\]/);
        }
      }
    });

    it("introduces no unscoped global form, button, or input rules", () => {
      expect(scoped).not.toMatch(/(^|[},])\s*(button|input|select|form|body|html)\s*[,{]/);
    });

    it("retains the intake modal selectors the skin depends on", () => {
      for (const selector of [
        ".overlay",
        ".modal",
        ".modal-top",
        ".modal-body",
        ".prog",
        ".prog-copy",
        ".m-kicker",
        ".m-close",
        ".m-back",
        ".opts",
        ".opt",
      ]) {
        expect(css).toContain(selector);
      }
    });

    it("stacks intake options in a single full-width column", () => {
      expect(css).toMatch(/\.opts\{[^}]*flex-direction:column/);
      expect(css).not.toMatch(/\.opts\{[^}]*grid-template-columns:1fr 1fr/);
    });

    it("keeps unrelated landing sections and their classes intact", () => {
      for (const selector of [
        ".hero",
        ".nav-in",
        ".steps",
        ".checks",
        ".findings",
        ".faq",
        ".final",
        "footer",
        ".disclaimer",
      ]) {
        expect(css).toContain(selector);
      }
    });
  });

  it("renders the modular landing sections, real legal links, and route-lifecycle CSS", () => {
    const { container, unmount } = renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /Don't just get a window estimate/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One estimate isn't a price. It's an opening offer." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The parts of an estimate people skim." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Specific, sourced, and worth asking about." })).toBeInTheDocument();
    expect(screen.getByText("Illustrative examples — not real estimates")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Disclaimer" })).toHaveAttribute("href", "/disclaimer");
    const routeStyles = container.querySelector("style[data-nq3-landing-styles]");
    expect(routeStyles).toBeInTheDocument();
    expect(scopeNq3Css("section{padding:1px}@media(max-width:1px){nav{top:0}}"))
      .toBe('[data-page="campaign-nq3"] section{padding:1px}@media(max-width:1px){[data-page="campaign-nq3"] nav{top:0}}');
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    expect(document.querySelector("style[data-nq3-landing-styles]")).not.toBeInTheDocument();
  });

  it.each(["32901", "33301", "34997"])(
    "accepts Florida ZIP %s and opens directly on project details",
    (zip) => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida project ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: zip } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What are you replacing?" })).toBeInTheDocument();
    },
  );

  it("shows an accessible error for a non-Florida ZIP", () => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida project ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: "90210" } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida project ZIP code.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes a validated, normalized payload to the submission boundary", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-injected",
      sessionId: "session-injected",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "Sam@Example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledWith({
      zip: "34997",
      projectType: "Impact windows",
      openings: "6–10",
      timing: "Not sure",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, expect.objectContaining({
      captureAttemptId: expect.any(String),
      landingVisitId: expect.any(String),
      entryPoint: "navigation_primary",
    })));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("uses the operational persistence adapter by default", async () => {
    renderPage();
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(defaultSubmitMock).toHaveBeenCalledWith({
      zip: "34997",
      projectType: "Impact windows",
      openings: "6–10",
      timing: "Not sure",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, expect.objectContaining({
      captureAttemptId: expect.any(String),
      landingVisitId: expect.any(String),
      entryPoint: "navigation_primary",
    })));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("requires a valid email before submission", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-valid",
      sessionId: "session-valid",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "invalid" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByText("Enter a valid email address.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("closes with Escape and returns focus to the opener", async () => {
    renderPage();
    const opener = screen.getByRole("button", { name: "Get Started" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveFocus(),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("traps forward and reverse Tab focus within the dialog", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Close" });
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveFocus(),
    );
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(continueButton).toHaveFocus();
    fireEvent.keyDown(continueButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("rejects repeated and canonical fake phone numbers before submission", () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-phone",
      sessionId: "session-phone",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    const phoneInput = screen.getByLabelText("Mobile number");

    fireEvent.change(phoneInput, { target: { value: "1111111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(
      screen.getByText("Enter a valid 10-digit mobile number."),
    ).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: "1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(
      screen.getByText("Enter a valid 10-digit mobile number."),
    ).toBeInTheDocument();
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("opens Get Started at the location step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Where's the project?" }),
    ).toBeInTheDocument();
  });

  it("advances each single-choice step on one activation, with no Continue button", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida project ZIP code.",
    );

    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      within(dialog).getByRole("heading", { name: "What are you replacing?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));
    expect(
      within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "1–5" }));
    expect(
      within(dialog).getByRole("heading", { name: "When are you hoping to start?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Planning ahead" }));
    expect(
      within(dialog).getByRole("heading", { name: "Where should we send it?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Get My Comparison" }),
    ).toBeInTheDocument();
  });

  it("renders visible Step X of 5 copy and an accessible step name on every step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    const stepCopy = () =>
      within(dialog).getByTestId("nq3-intake-step-copy").textContent;
    const progressLabel = () =>
      within(dialog)
        .getByTestId("nq3-intake-progress")
        .getAttribute("aria-valuetext");

    expect(stepCopy()).toBe("Step 1 of 5");
    expect(progressLabel()).toBe("Step 1 of 5: Project location");
    expect(within(dialog).getByText("Step 1")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(stepCopy()).toBe("Step 2 of 5");
    expect(progressLabel()).toBe("Step 2 of 5: Product");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));
    expect(stepCopy()).toBe("Step 3 of 5");
    expect(progressLabel()).toBe("Step 3 of 5: Openings");

    fireEvent.click(within(dialog).getByRole("radio", { name: "1–5" }));
    expect(stepCopy()).toBe("Step 4 of 5");
    expect(progressLabel()).toBe("Step 4 of 5: Timing");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Planning ahead" }));
    expect(stepCopy()).toBe("Step 5 of 5");
    expect(progressLabel()).toBe("Step 5 of 5: Contact details");
    expect(within(dialog).getByText("Step 5")).toBeInTheDocument();
  });

  it("renders the five openings choices as one vertical radiogroup", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact windows" }));

    const group = within(dialog).getByRole("radiogroup", {
      name: "Approximate openings",
    });
    const options = within(group).getAllByRole("radio");

    expect(options).toHaveLength(5);
    expect(options.map((option) => option.textContent)).toEqual([
      "1–5",
      "6–10",
      "11–15",
      "16+",
      "Not sure",
    ]);
    expect(group).toHaveClass("opts");
    expect(within(group).queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("moves focus to the new step heading after automatic advancement", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("heading", { name: "What are you replacing?" }),
      ).toHaveFocus(),
    );

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
      ).toHaveFocus(),
    );
  });

  it("does not advance when an option only receives focus", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    const option = within(dialog).getByRole("radio", { name: "Impact doors" });
    fireEvent.focus(option);
    fireEvent.mouseOver(option);
    fireEvent.mouseDown(option);
    fireEvent.keyDown(option, { key: "ArrowDown" });

    expect(
      within(dialog).getByRole("heading", { name: "What are you replacing?" }),
    ).toBeInTheDocument();
    expect(option).toHaveAttribute("aria-checked", "false");
  });

  it("advances on keyboard activation of a choice card", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    const option = within(dialog).getByRole("radio", { name: "Impact doors" });
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
    fireEvent.click(option);

    expect(
      within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
    ).toBeInTheDocument();
  });

  it("preserves selections when navigating Back across all choice steps", () => {
    renderPage();
    const dialog = advanceToContactStep();

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByRole("radio", { name: "Not sure" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(within(dialog).getByRole("radio", { name: "6–10" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByRole("radio", { name: "Impact windows" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByLabelText("Florida project ZIP code"),
    ).toHaveValue("34997");
  });

  it("requires a valid first name before persistence", async () => {
    const onSubmitLead = vi.fn();
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByText("Enter your first name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("does not show success before confirmed server success", async () => {
    let resolveSubmit!: (value: {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }) => void;
    const onSubmitLead = vi.fn(
      () =>
        new Promise<{
          ok: true;
          leadId: string;
          sessionId: string;
          reused: boolean;
        }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "You're in." }))
      .not.toBeInTheDocument();

    resolveSubmit({
      ok: true,
      leadId: "lead-new",
      sessionId: "session-new",
      reused: false,
    });
    expect(await screen.findByRole("heading", { name: "You're in." }))
      .toBeInTheDocument();
  });

  it("does not show success after failed persistence", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: false,
      message: "Try again.",
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
    expect(screen.queryByRole("heading", { name: "You're in." }))
      .not.toBeInTheDocument();
  });

  it("shows success for a reused persisted lead through the same boundary", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-reused",
      sessionId: "session-reused",
      reused: true,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByRole("heading", { name: "You're in." }))
      .toBeInTheDocument();
  });
});
