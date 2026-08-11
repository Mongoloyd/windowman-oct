import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import CampaignNqLanding from "./CampaignNqLanding";

const submitMock = vi.fn();
const handoffMock = vi.fn();

vi.mock("./campaignNqLeadCapture", () => ({
  submitCampaignNqLead: (...args: unknown[]) => submitMock(...args),
}));

vi.mock("@/components/landing/landingHandoff", () => ({
  handoffToCanonicalUpload: () => handoffMock(),
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
      <MemoryRouter initialEntries={["/nq"]}>
        <CampaignNqLanding />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

function openDialog() {
  fireEvent.click(
    screen.getAllByRole("button", {
      name: "Help Me Get My First Quote",
    })[0],
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

describe("CampaignNqLanding", () => {
  beforeEach(() => {
    submitMock.mockReset();
    handoffMock.mockReset();
    window.history.replaceState({}, "", "/nq");
    submitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      reused: false,
    });
  });

  it("renders at the exact /nq route through the application router", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Need a Window Quote? Start Here.",
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq");
  });

  it("uses an existing WindowMan repository asset in the hero", () => {
    renderLanding();

    const heroImage = screen.getByRole("img", {
      name: "WindowMan guide pointing toward the first-quote request",
    });
    expect(heroImage).toHaveAttribute(
      "src",
      expect.stringContaining("wm-pointing-tall"),
    );
    expect(heroImage).toHaveAttribute("loading", "eager");
    expect(heroImage).toHaveAttribute("fetchpriority", "high");
  });

  it("keeps the site header and footer outside the main landmark", () => {
    renderLanding();

    const main = screen.getByRole("main");
    const header = screen.getByRole("banner");
    const footer = screen.getByRole("contentinfo");

    expect(main).not.toContainElement(header);
    expect(main).not.toContainElement(footer);
    expect(header.parentElement).toBe(main.parentElement);
    expect(footer.parentElement).toBe(main.parentElement);
  });

  it("names the illustrative quote review list", () => {
    renderLanding();

    expect(
      screen.getByRole("list", { name: "Illustrative quote review summary" }),
    ).toBeInTheDocument();
  });

  it("opens the capture dialog from the primary CTA", () => {
    renderLanding();

    const dialog = openDialog();
    expect(
      within(dialog).getByRole("heading", {
        name: "Tell us where to reach you",
      }),
    ).toBeInTheDocument();
  });

  it("validates first name, canonical phone format, and email accessibly", async () => {
    renderLanding();
    const dialog = openDialog();
    const submit = within(dialog).getByRole("button", {
      name: "Help Me Get My First Quote",
    });

    fireEvent.click(submit);
    expect(await within(dialog).findByText("Enter your first name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(
      within(dialog).getByText("Enter a valid 10-digit phone number."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Enter a valid email address."),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("First Name"), {
      target: { value: "Maria" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone Number"), {
      target: { value: "30555" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email Address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(submit);

    expect(
      within(dialog).getByLabelText("Phone Number"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(
      within(dialog).getByLabelText("Email Address"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submits canonical three-field values through the CampaignNQ adapter", async () => {
    renderLanding();
    const dialog = openDialog();
    fillValidForm(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Help Me Get My First Quote",
      }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Maria",
        phoneE164: "+13055551234",
        email: "maria@example.com",
        marketingCommunicationsGranted: false,
      }),
    );
  });

  it("normalizes a pasted US country code without changing the phone identity", async () => {
    renderLanding();
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("First Name"), {
      target: { value: "Maria" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone Number"), {
      target: { value: "13055551234" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email Address"), {
      target: { value: "maria@example.com" },
    });

    expect(within(dialog).getByLabelText("Phone Number")).toHaveValue(
      "(305) 555-1234",
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Help Me Get My First Quote",
      }),
    );

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({ phoneE164: "+13055551234" }),
    );
  });

  it("rejects an obvious fake phone number before persistence", async () => {
    renderLanding();
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("First Name"), {
      target: { value: "Maria" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone Number"), {
      target: { value: "0000000000" },
    });
    fireEvent.change(within(dialog).getByLabelText("Email Address"), {
      target: { value: "maria@example.com" },
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Help Me Get My First Quote",
      }),
    );

    expect(
      await within(dialog).findByText(
        "Enter a valid 10-digit phone number.",
      ),
    ).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
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
      name: "Help Me Get My First Quote",
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
    await waitFor(() => expect(within(dialog).getByRole("status")).toHaveFocus());
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
      within(dialog).getByRole("button", {
        name: "Help Me Get My First Quote",
      }),
    );

    expect(
      await within(dialog).findByText(
        "We couldn't save your request yet. Check your details and try again.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("First Name")).toHaveValue("Maria");
    expect(within(dialog).getByLabelText("Phone Number")).toHaveValue(
      "(305) 555-1234",
    );
    expect(within(dialog).getByLabelText("Email Address")).toHaveValue(
      "maria@example.com",
    );
  });

  it("hands quote holders to the canonical path without opening the no-quote form", () => {
    renderLanding();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Already Have a Quote? Check It Here",
      }),
    );

    expect(handoffMock).toHaveBeenCalledTimes(1);
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
      screen.getByText(/WindowMan is an independent software/i),
    ).toBeInTheDocument();
  });

  it("opens the same capture experience from the bottom CTA", () => {
    renderLanding();
    const primaryCtas = screen.getAllByRole("button", {
      name: "Help Me Get My First Quote",
    });

    fireEvent.click(primaryCtas[primaryCtas.length - 1]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("First Name")).toBeInTheDocument();
  });
});
