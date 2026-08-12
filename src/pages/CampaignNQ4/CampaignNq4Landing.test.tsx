import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import CampaignNq4Page from "./CampaignNq4Page";
import {
  __resetNq4DocumentStateForTests,
  NQ4_ROBOTS_META_ID,
  NQ4_STYLE_ELEMENT_ID,
} from "./scopeNq4Css";

const { defaultSubmitterMock } = vi.hoisted(() => ({
  defaultSubmitterMock: vi.fn(),
}));

vi.mock("./campaignNq4LeadCapture", () => ({
  createCampaignNq4LeadSubmitter: () => defaultSubmitterMock,
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

vi.mock("@/components/intake", () => ({
  WindowManIntakePreview: () => null,
}));

function renderPage(submitter = vi.fn()) {
  return render(<CampaignNq4Page onSubmitLead={submitter} />);
}

function openHeroIntake() {
  fireEvent.change(screen.getByTestId("nq4-hero-zip"), {
    target: { value: "33301" },
  });
  fireEvent.click(screen.getByTestId("nq4-check-area"));
  return screen.getByRole("dialog");
}

function advanceToContact() {
  const dialog = openHeroIntake();
  fireEvent.click(
    within(dialog).getByRole("radio", { name: "Impact windows" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "6–10" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.click(
    within(dialog).getByRole("radio", { name: "1–3 months" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
}

function fillContact(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("First name"), {
    target: { value: " Maria " },
  });
  fireEvent.change(within(dialog).getByLabelText("Email address"), {
    target: { value: "Maria@Example.com" },
  });
  fireEvent.change(within(dialog).getByLabelText("Mobile number"), {
    target: { value: "3055550142" },
  });
}

describe("CampaignNq4Landing", () => {
  beforeEach(() => {
    defaultSubmitterMock.mockReset();
    window.history.replaceState({}, "", "/nq4");
    __resetNq4DocumentStateForTests();
  });

  afterEach(() => {
    cleanup();
    __resetNq4DocumentStateForTests();
  });

  it("renders at the exact /nq4 route through the application router", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Give the next contractor a real number to beat.",
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq4");
  });

  it("mounts scoped styles and runtime noindex metadata only for its lifetime", () => {
    const { unmount } = renderPage();

    expect(document.getElementById(NQ4_STYLE_ELEMENT_ID)).toBeInTheDocument();
    expect(document.getElementById(NQ4_ROBOTS_META_ID)).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );

    unmount();

    expect(document.getElementById(NQ4_STYLE_ELEMENT_ID)).not.toBeInTheDocument();
    expect(document.getElementById(NQ4_ROBOTS_META_ID)).not.toBeInTheDocument();
  });

  it("uses an accessible inline ZIP form and leaves the footer CTA intact", () => {
    renderPage();
    const hero = screen
      .getByRole("heading", {
        level: 1,
        name: "Give the next contractor a real number to beat.",
      })
      .closest("section");
    if (!(hero instanceof HTMLElement)) {
      throw new Error("Expected the NQ4 hero section.");
    }

    const zipInput = within(hero).getByLabelText("Florida ZIP code");
    expect(zipInput).toHaveAttribute("type", "text");
    expect(zipInput).toHaveAttribute("inputmode", "numeric");
    expect(zipInput).toHaveAttribute("maxlength", "5");
    expect(zipInput).toHaveAttribute("autocomplete", "postal-code");
    expect(within(hero).getByTestId("nq4-check-area")).toHaveTextContent(
      "Check My Area",
    );
    expect(screen.getByTestId("nq4-cta-footer")).toHaveTextContent(
      "Start My Estimate Request",
    );
  });

  it.each(["", "12345"])(
    "rejects invalid hero ZIP %j without opening the intake",
    (zip) => {
      renderPage();
      const zipInput = screen.getByTestId("nq4-hero-zip");
      fireEvent.change(zipInput, { target: { value: zip } });

      fireEvent.click(screen.getByTestId("nq4-check-area"));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a valid 5-digit Florida ZIP code.",
      );
      expect(zipInput).toHaveAttribute("aria-invalid", "true");
      expect(zipInput).toHaveFocus();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("opens at product, preserves ZIP for Back, and exposes accessible progress", () => {
    renderPage();
    const dialog = openHeroIntake();

    expect(
      within(dialog).getByRole("heading", {
        name: "What are you replacing?",
      }),
    ).toBeInTheDocument();
    const progress = within(dialog).getByRole("progressbar", {
      name: "Step 2 of 5",
    });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "5");
    expect(progress).toHaveAttribute("aria-valuenow", "2");
    expect(progress).toHaveAttribute(
      "aria-valuetext",
      "Step 2 of 5, current step",
    );
    expect(progress).toHaveAttribute("aria-busy", "false");
    expect(progress.querySelectorAll("span")).toHaveLength(5);

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));

    expect(
      within(dialog).getByRole("heading", { name: "Where is the project?" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Florida ZIP code")).toHaveValue(
      "33301",
    );
  });

  it("strictly enforces product, openings, and timing before contact", () => {
    renderPage();
    const dialog = openHeroIntake();

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose what you are replacing.",
    );
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Impact doors" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose the approximate number of openings.",
    );
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Not sure" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose when you are hoping to start.",
    );
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Planning ahead" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      within(dialog).getByRole("heading", {
        name: "Save your project request",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Step 5 of 5" }),
    ).toHaveAttribute("aria-valuenow", "5");
  });

  it("preserves contact disclosure and explicit consent construction copy", () => {
    renderPage();
    const dialog = advanceToContact();

    expect(
      within(dialog).getByText(
        "WindowMan won’t share your details with contractors unless you later ask for an introduction.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("No contractor list. No marketing consent."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("First name")).toBeRequired();
    expect(within(dialog).getByLabelText("Email address")).toBeRequired();
    expect(within(dialog).getByLabelText("Mobile number")).toBeRequired();
    expect(
      within(dialog).getByText(
        "By continuing, you authorize WindowMan to contact you regarding this estimate request via call, email, or text (msg/data rates apply, reply STOP to opt out). We do not sell your data to contractor lists.",
      ),
    ).toBeInTheDocument();
  });

  it("waits for persisted IDs, submits once, then shows confirmed success", async () => {
    let resolveSubmit!: (result: {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }) => void;
    const submitter = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    const submitButton = within(dialog).getByRole("button", {
      name: "Save My Project Request",
    });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitter).toHaveBeenCalledTimes(1));
    expect(submitter).toHaveBeenCalledWith(
      {
        zip: "33301",
        projectType: "Impact windows",
        openings: "6–10",
        timing: "1–3 months",
        name: "Maria",
        email: "maria@example.com",
        phone: "+13055550142",
      },
      expect.objectContaining({
        captureAttemptId: expect.any(String),
        landingVisitId: expect.any(String),
        entryPoint: "hero_zip",
      }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByTestId("nq4-intake-progress"),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("nq4-success")).not.toBeInTheDocument();

    resolveSubmit({
      ok: true,
      leadId: "lead-123",
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      reused: false,
    });

    const success = await screen.findByTestId("nq4-success");
    expect(
      within(success).getByText("Project request received"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["lead ID", "", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    ["session ID", "lead-123", ""],
  ])("fails closed when persistence omits the %s", async (_label, leadId, sessionId) => {
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId,
      sessionId,
      reused: false,
    });
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );

    expect(
      await within(dialog).findByText(
        "We couldn't submit your request. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("nq4-success")).not.toBeInTheDocument();
  });

  it("allows retry after a safe persistence failure", async () => {
    const submitter = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        message: "We couldn't submit your request. Please try again.",
      })
      .mockResolvedValueOnce({
        ok: true,
        leadId: "lead-retry",
        sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        reused: false,
      });
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );
    expect(
      await within(dialog).findByText(
        "We couldn't submit your request. Please try again.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );

    expect(await screen.findByTestId("nq4-success")).toBeInTheDocument();
    expect(submitter).toHaveBeenCalledTimes(2);
  });

  it("opens the footer CTA on the location step", () => {
    renderPage();

    fireEvent.click(screen.getByTestId("nq4-cta-footer"));
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByRole("heading", { name: "Where is the project?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Step 1 of 5" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(within(dialog).getByLabelText("Florida ZIP code")).toHaveValue("");
  });
});
