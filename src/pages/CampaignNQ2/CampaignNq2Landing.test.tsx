import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { BUSINESS_EVENTS } from "@/lib/tracking/events";
import CampaignNq2Landing from "./CampaignNq2Landing";

const submitMock = vi.fn();
const lowIntentMock = vi.fn();
const uploadHandoffMock = vi.fn();

vi.mock("./campaignNq2LeadCapture", () => ({
  submitCampaignNq2Lead: (...args: unknown[]) => submitMock(...args),
}));

vi.mock("@/lib/tracking/dataLayer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tracking/dataLayer")>();
  return {
    ...actual,
    pushLowIntentEvent: (...args: unknown[]) => lowIntentMock(...args),
  };
});

vi.mock("@/components/landing/landingHandoff", () => ({
  handoffToCanonicalUpload: () => uploadHandoffMock(),
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

function renderLanding() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/nq2"]}>
        <CampaignNq2Landing />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function openDialog(buttonIndex = 0) {
  fireEvent.click(
    screen.getAllByRole("button", { name: "Get My Free Quote" })[
      buttonIndex
    ],
  );
  return screen.getByRole("dialog");
}

function fillValidForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("First Name"), {
    target: { value: "Maria" },
  });
  fireEvent.change(within(dialog).getByLabelText("Phone Number"), {
    target: { value: "3055551234" },
  });
  fireEvent.change(within(dialog).getByLabelText("Email Address"), {
    target: { value: "maria@example.com" },
  });
}

describe("CampaignNq2Landing", () => {
  beforeEach(() => {
    submitMock.mockReset();
    lowIntentMock.mockReset();
    uploadHandoffMock.mockReset();
    window.history.replaceState({}, "", "/nq2");
    submitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      reused: false,
    });
  });

  it("renders at the exact /nq2 route through the application router", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Get a Free Window Quote — Then Let AI Audit It.",
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq2");
  });

  it("uses a real WindowMan repository asset in the hero", () => {
    renderLanding();

    expect(
      screen.getByRole("img", {
        name: "WindowMan guide pointing toward the free quote request",
      }),
    ).toHaveAttribute("src", expect.stringContaining("wm-pointing"));
  });

  it("opens the accessible three-field capture dialog from the primary CTA", () => {
    renderLanding();
    const dialog = openDialog();

    expect(
      within(dialog).getByRole("heading", {
        name: "Get your free window quote",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("First Name")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Phone Number")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email Address")).toBeInTheDocument();
    expect(lowIntentMock).toHaveBeenCalledWith(
      BUSINESS_EVENTS.first_quote_modal_opened,
      expect.objectContaining({
        page_path: "/nq2",
        campaign_variant: "nq2",
        cta_source: "hero",
      }),
    );
  });

  it("requires full name, canonical phone screening, and a valid email", async () => {
    renderLanding();
    const dialog = openDialog();
    const submit = within(dialog).getByRole("button", {
      name: "Get My Free Quote",
    });

    fireEvent.click(submit);
    expect(await within(dialog).findByText("Enter your first name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(within(dialog).getByText("Enter your phone number.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("First Name"), {
      target: { value: "Maria" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone Number"), {
      target: { value: "1111111111" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email Address"), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(submit);

    expect(
      within(dialog).getByText("Enter a valid U.S. phone number."),
    ).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submits the three contact fields and presented marketing choice through the canonical CampaignNQ2 adapter", async () => {
    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Get My Free Quote" }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Maria",
        phone: "(305) 555-1234",
        email: "maria@example.com",
        marketingCommunicationsGranted: false,
      }),
    );
  });

  it("passes an explicit optional marketing opt-in to the canonical adapter", async () => {
    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);

    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /promotional calls/i }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Get My Free Quote" }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ marketingCommunicationsGranted: true }),
    );
  });

  it("prevents duplicate active submissions and waits for persistence success", async () => {
    let resolveSubmit:
      | ((value: {
          ok: true;
          leadId: string;
          sessionId: string;
          reused: boolean;
        }) => void)
      | undefined;
    submitMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);
    const submit = within(dialog).getByRole("button", {
      name: "Get My Free Quote",
    });
    const form = submit.closest("form") as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(
      within(dialog).queryByRole("heading", { name: "Request received" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveSubmit?.({
        ok: true,
        leadId: "lead-123",
        sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        reused: false,
      });
    });

    expect(
      await within(dialog).findByRole("heading", {
        name: "Request received",
      }),
    ).toBeInTheDocument();
  });

  it("keeps marketing consent immutable while a submission is active", async () => {
    let resolveSubmit:
      | ((value: {
          ok: true;
          leadId: string;
          sessionId: string;
          reused: boolean;
        }) => void)
      | undefined;
    submitMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);
    const consent = within(dialog).getByRole("checkbox", {
      name: /promotional calls/i,
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Get My Free Quote" }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(consent).toBeDisabled();
    fireEvent.click(consent);
    expect(consent).not.toBeChecked();
    expect(submitMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ marketingCommunicationsGranted: false }),
    );

    await act(async () => {
      resolveSubmit?.({
        ok: true,
        leadId: "lead-123",
        sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        reused: false,
      });
    });
  });

  it("preserves form values after a recoverable persistence error", async () => {
    submitMock.mockResolvedValue({
      ok: false,
      message: "We couldn't save your request yet. Check your details and try again.",
    });
    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Get My Free Quote" }),
    );

    expect(
      await within(dialog).findByText(
        "We couldn't save your request yet. Check your details and try again.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("First Name")).toHaveValue(
      "Maria",
    );
    expect(within(dialog).getByLabelText("Phone Number")).toHaveValue(
      "(305) 555-1234",
    );
  });

  it("rotates the consent submission ID when the marketing choice changes before retry", async () => {
    submitMock.mockResolvedValue({
      ok: false,
      message: "We couldn't save your request yet. Check your details and try again.",
    });
    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);
    const submit = within(dialog).getByRole("button", {
      name: "Get My Free Quote",
    });

    fireEvent.click(submit);
    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    const firstSubmissionId = submitMock.mock.calls[0][0].submissionId;

    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: /promotional calls/i }),
    );
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({ marketingCommunicationsGranted: true }),
    );
    expect(submitMock.mock.calls[1][0].submissionId).not.toBe(firstSubmissionId);
  });

  it("opens the native file picker directly and never opens the contact dialog", () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    renderLanding();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Already Have a Quote? Upload It Here",
      }),
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(uploadHandoffMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    clickSpy.mockRestore();
  });

  it("hands an accepted selection to the canonical secure upload flow", () => {
    renderLanding();
    const input = screen.getByLabelText("Choose an existing contractor quote");
    const file = new File(["quote"], "contractor-quote.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadHandoffMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("contractor-quote.pdf")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Continuing to WindowMan's secure upload flow/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports accessible FAQ interaction", () => {
    renderLanding();
    const trigger = screen.getByRole("button", {
      name: "Is WindowMan a window contractor?",
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/WindowMan is independent software and quote intelligence/i),
    ).toBeInTheDocument();
  });

  it("opens the same capture experience from the bottom CTA", () => {
    renderLanding();
    const primaryCtas = screen.getAllByRole("button", {
      name: "Get My Free Quote",
    });

    fireEvent.click(primaryCtas[primaryCtas.length - 1]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(lowIntentMock).toHaveBeenCalledWith(
      BUSINESS_EVENTS.first_quote_modal_opened,
      expect.objectContaining({ cta_source: "footer" }),
    );
  });
});
