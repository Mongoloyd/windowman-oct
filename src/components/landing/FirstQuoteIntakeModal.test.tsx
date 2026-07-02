import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FirstQuoteIntakeModal from "./FirstQuoteIntakeModal";
import {
  HELP_NEEDED_OPTIONS,
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  TIMING_OPTIONS,
  ZIP_CODE_ERROR,
} from "./firstQuoteIntakeTypes";

const submitMock = vi.fn();

vi.mock("@/services/windowmanFirstQuoteLeadCapture", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/windowmanFirstQuoteLeadCapture")>();
  return {
    ...actual,
    submitWindowmanFirstQuoteLead: (...args: unknown[]) => submitMock(...args),
    getOrCreateFirstQuoteSessionId: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  };
});

vi.mock("./landingTracking", () => ({
  trackAndHandoffToCanonicalUpload: vi.fn(),
}));

import { trackAndHandoffToCanonicalUpload } from "./landingTracking";

function setup(open = true) {
  const onOpenChange = vi.fn();
  render(<FirstQuoteIntakeModal open={open} onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

function fillStep1BasicsExceptZip() {
  fireEvent.click(screen.getByRole("radio", { name: PROPERTY_TYPE_OPTIONS[0] }));
  fireEvent.click(screen.getByRole("radio", { name: OPENINGS_BUCKET_OPTIONS[0] }));
  fireEvent.click(screen.getByRole("radio", { name: PRODUCT_SCOPE_OPTIONS[0] }));
  fireEvent.click(screen.getByRole("radio", { name: TIMING_OPTIONS[0] }));
}

function setZip(value: string) {
  fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value } });
}

function fillStep1(zip = "33301") {
  setZip(zip);
  fillStep1BasicsExceptZip();
}

function goToStep2() {
  fillStep1();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function goToStep3() {
  goToStep2();
  fireEvent.click(screen.getByRole("radio", { name: HELP_NEEDED_OPTIONS[0] }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

function fillContact() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "5551234567" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Sam@Example.com" } });
}

describe("FirstQuoteIntakeModal", () => {
  beforeEach(() => {
    submitMock.mockReset();
    vi.mocked(trackAndHandoffToCanonicalUpload).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens with Step 1", () => {
    setup();
    expect(screen.getByTestId("first-quote-intake-modal")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3 — Project basics")).toBeInTheDocument();
    expect(screen.getByText("Build your first-quote plan")).toBeInTheDocument();
    expect(screen.getByLabelText("ZIP code")).toBeInTheDocument();
  });

  it("cannot continue Step 1 without required project basics", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText(ZIP_CODE_ERROR)).toBeInTheDocument();
    expect(screen.getByText("Select a property type.")).toBeInTheDocument();
    expect(screen.queryByText("Step 2 of 3 — Help needed")).not.toBeInTheDocument();
  });

  describe("ZIP validation", () => {
    it.each([
      ["Miami", ""],
      ["abcde", ""],
      ["3330", "3330"],
    ])("blocks invalid ZIP input %s on Step 1 continue", (input) => {
      setup();
      setZip(input);
      fillStep1BasicsExceptZip();
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByText(ZIP_CODE_ERROR)).toBeInTheDocument();
      expect(screen.queryByText("Step 2 of 3 — Help needed")).not.toBeInTheDocument();
    });

    it("accepts valid ZIP 33301", () => {
      setup();
      goToStep2();
      expect(screen.getByText("Step 2 of 3 — Help needed")).toBeInTheDocument();
    });

    it("strips non-digits from ZIP input", () => {
      setup();
      setZip("33a3b0c1");
      expect(screen.getByLabelText("ZIP code")).toHaveValue("33301");
    });
  });

  it("can continue to Step 2", () => {
    setup();
    goToStep2();
    expect(screen.getByText("Step 2 of 3 — Help needed")).toBeInTheDocument();
  });

  it("cannot continue Step 2 without help selection", () => {
    setup();
    goToStep2();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Select what you want help with first.")).toBeInTheDocument();
  });

  it("can continue to Step 3", () => {
    setup();
    goToStep3();
    expect(screen.getByText("Step 3 of 3 — Contact")).toBeInTheDocument();
  });

  it("contact validation blocks missing/invalid fields", () => {
    setup();
    goToStep3();
    fireEvent.click(screen.getByRole("button", { name: "Build My First-Quote Plan" }));
    expect(screen.getByText("Enter your first name (2–50 characters).")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a 10-digit US mobile number so we can send your WindowMan plan."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("does not submit when user returns to Step 1 with invalid ZIP before submit", async () => {
    setup();
    goToStep3();
    fillContact();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    setZip("3330");
    fillStep1BasicsExceptZip();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText(ZIP_CODE_ERROR)).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("submit button disables while pending", async () => {
    setup();
    goToStep3();
    fillContact();

    let resolveSubmit: (value: { ok: true }) => void;
    submitMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = () => resolve({ ok: true });
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Build My First-Quote Plan" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Saving/i })).toBeDisabled();
    });

    resolveSubmit!({ ok: true });

    await waitFor(() => {
      expect(screen.getByText("Your first-quote plan is started.")).toBeInTheDocument();
    });
  });

  it("blocks duplicate submit while pending", async () => {
    setup();
    goToStep3();
    fillContact();

    let resolveSubmit: (value: { ok: true }) => void;
    submitMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = () => resolve({ ok: true });
        }),
    );

    const submitButton = screen.getByRole("button", { name: "Build My First-Quote Plan" });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledTimes(1);
    });

    resolveSubmit!({ ok: true });
    await waitFor(() => {
      expect(screen.getByText("Your first-quote plan is started.")).toBeInTheDocument();
    });
  });

  it("success state appears after mocked submit", async () => {
    setup();
    goToStep3();
    fillContact();

    submitMock.mockResolvedValue({ ok: true, leadId: "lead-1" });

    fireEvent.click(screen.getByRole("button", { name: "Build My First-Quote Plan" }));

    await waitFor(() => {
      expect(screen.getByText("Your first-quote plan is started.")).toBeInTheDocument();
    });
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(submitMock.mock.calls[0][0].email).toBe("sam@example.com");
    expect(submitMock.mock.calls[0][0].projectBasics.zipOrCity).toBe("33301");
  });

  it("failure state shows safe generic error", async () => {
    setup();
    goToStep3();
    fillContact();

    submitMock.mockResolvedValue({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Build My First-Quote Plan" }));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't save your plan yet. Check your details and try again."),
      ).toBeInTheDocument();
    });
  });

  it("Analyze a Quote Instead calls trackAndHandoffToCanonicalUpload", async () => {
    setup();
    goToStep3();
    fillContact();
    submitMock.mockResolvedValue({ ok: true });

    fireEvent.click(screen.getByRole("button", { name: "Build My First-Quote Plan" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Analyze a Quote Instead" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Analyze a Quote Instead" }));
    expect(trackAndHandoffToCanonicalUpload).toHaveBeenCalledWith(
      "first_quote_modal_has_quote",
    );
  });
});
