import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UniversalIntakeHost from "./UniversalIntakeHost";
import type {
  IntakeOpenRequest,
  IntakeSkinProps,
  IntakeSubmitResult,
  IntakeSubmitter,
  UniversalIntakeConfig,
} from "./intakeTypes";

const FLORIDA_LOCATION = {
  marketId: "florida",
  inputLabel: "Florida project ZIP code",
  helperText:
    "Enter the ZIP code for the Florida property where the work will be completed.",
  placeholder: "e.g. 33139",
  invalidMessage: "Enter a valid 5-digit Florida project ZIP code.",
  isEligibleZip: (value: string) => /^3[2-4]\d{3}$/.test(value.trim()),
} as const;

const CONFIG = {
  route: "/nq3",
  campaignVariant: "nq3",
  wmIntent: "no_quote",
  captureSource: "windowman-first-quote",
  location: FLORIDA_LOCATION,
  steps: [
    { id: "location", fields: ["zip"], validation: "service_area_zip" },
    {
      id: "product",
      fields: ["projectType"],
      validation: "product_scope",
    },
    {
      id: "openings",
      fields: ["openings"],
      validation: "openings_scope",
    },
    {
      id: "timing",
      fields: ["timing"],
      validation: "timing_scope",
    },
    {
      id: "contact",
      fields: ["name", "email", "phone"],
      validation: "contact",
    },
  ],
} as const satisfies UniversalIntakeConfig;

const NQ4_CONFIG = {
  route: "/nq4",
  campaignVariant: "nq4",
  wmIntent: "no_quote",
  captureSource: "windowman-first-quote",
  location: FLORIDA_LOCATION,
  steps: [
    { id: "location", fields: ["zip"], validation: "service_area_zip" },
    {
      id: "product",
      fields: ["projectType"],
      validation: "product_scope",
    },
    {
      id: "openings",
      fields: ["openings"],
      validation: "openings_scope",
    },
    {
      id: "timing",
      fields: ["timing"],
      validation: "timing_scope",
    },
    {
      id: "contact",
      fields: ["name", "email", "phone"],
      validation: "contact",
    },
  ],
} as const satisfies UniversalIntakeConfig;

const REQUEST: IntakeOpenRequest = {
  requestId: "11111111-1111-4111-8111-111111111111",
  entryPoint: "navigation_primary",
  startingStep: "location",
};

function TestSkin({
  step,
  stepNumber,
  values,
  validationError,
  submitError,
  isSubmitting,
  onFieldChange,
  onSelectAndNext,
  onNext,
  onBack,
  onSubmit,
  onClose,
}: IntakeSkinProps) {
  return (
    <div>
      <output aria-label="step">{step}</output>
      <output aria-label="step number">{stepNumber}</output>
      <button
        type="button"
        onClick={() => onSelectAndNext("projectType", "Impact doors")}
      >
        Quick product
      </button>
      <button
        type="button"
        onClick={() => onSelectAndNext("openings", "11–15")}
      >
        Quick openings
      </button>
      <button
        type="button"
        onClick={() => onSelectAndNext("timing", "ASAP")}
      >
        Quick timing
      </button>
      <button
        type="button"
        onClick={() => onSelectAndNext("timing", "Someday")}
      >
        Quick invalid timing
      </button>
      <button
        type="button"
        onClick={() => onSelectAndNext("openings", "6–10")}
      >
        Quick openings mismatch
      </button>
      <input
        aria-label="zip"
        value={values.zip}
        onChange={(event) => onFieldChange("zip", event.target.value)}
      />
      <input
        aria-label="project type"
        value={values.projectType}
        onChange={(event) =>
          onFieldChange("projectType", event.target.value)
        }
      />
      <input
        aria-label="openings"
        value={values.openings}
        onChange={(event) => onFieldChange("openings", event.target.value)}
      />
      <input
        aria-label="timing"
        value={values.timing ?? ""}
        onChange={(event) => onFieldChange("timing", event.target.value)}
      />
      <input
        aria-label="name"
        value={values.name}
        onChange={(event) => onFieldChange("name", event.target.value)}
      />
      <input
        aria-label="email"
        value={values.email}
        onChange={(event) => onFieldChange("email", event.target.value)}
      />
      <input
        aria-label="phone"
        value={values.phone}
        onChange={(event) => onFieldChange("phone", event.target.value)}
      />
      {validationError && <p role="alert">{validationError.message}</p>}
      {submitError && <p role="alert">{submitError}</p>}
      <button type="button" onClick={onNext}>Next</button>
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? "Submitting" : "Submit"}
      </button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  );
}

function ReopenHarness({ submitter }: { submitter: IntakeSubmitter }) {
  const [request, setRequest] = useState<IntakeOpenRequest | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setRequest({
            requestId: crypto.randomUUID(),
            entryPoint: "navigation_primary",
          })
        }
      >
        Open
      </button>
      <UniversalIntakeHost
        config={CONFIG}
        openRequest={request}
        submitter={submitter}
        skin={TestSkin}
        onClose={() => setRequest(null)}
      />
    </>
  );
}

function renderHost(
  submitter: IntakeSubmitter,
  request: IntakeOpenRequest | null = REQUEST,
  onPersistedSuccess = vi.fn(),
) {
  return render(
    <UniversalIntakeHost
      config={CONFIG}
      openRequest={request}
      submitter={submitter}
      skin={TestSkin}
      onClose={vi.fn()}
      onPersistedSuccess={onPersistedSuccess}
    />,
  );
}

function fillValidValues() {
  fireEvent.change(screen.getByLabelText("zip"), {
    target: { value: "33301" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("project type"), {
    target: { value: "Impact windows" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("openings"), {
    target: { value: "6–10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("timing"), {
    target: { value: "Not sure" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("name"), {
    target: { value: "Sam" },
  });
  fireEvent.change(screen.getByLabelText("email"), {
    target: { value: "Sam@Example.com" },
  });
  fireEvent.change(screen.getByLabelText("phone"), {
    target: { value: "3055550142" },
  });
}

describe("UniversalIntakeHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses config-driven step order and Back behavior", async () => {
    renderHost(vi.fn());
    expect(await screen.findByLabelText("step")).toHaveTextContent("location");

    fireEvent.change(screen.getByLabelText("zip"), {
      target: { value: "33301" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("product");

    fireEvent.change(screen.getByLabelText("project type"), {
      target: { value: "Impact windows" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("openings");

    fireEvent.change(screen.getByLabelText("openings"), {
      target: { value: "1–5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");

    fireEvent.change(screen.getByLabelText("timing"), {
      target: { value: "ASAP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("contact");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");
  });

  it("enforces the separate NQ4 ZIP, product, openings, timing, and contact steps", async () => {
    render(
      <UniversalIntakeHost
        config={NQ4_CONFIG}
        openRequest={{
          requestId: "44444444-4444-4444-8444-444444444444",
          entryPoint: "hero_primary",
          startingStep: "location",
        }}
        submitter={vi.fn()}
        skin={TestSkin}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText("step")).toHaveTextContent("location");
    fireEvent.change(screen.getByLabelText("zip"), {
      target: { value: "33301" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("product");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose what you are replacing.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("product");

    fireEvent.change(screen.getByLabelText("project type"), {
      target: { value: "Impact windows" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("openings");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose the approximate number of openings.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("openings");

    fireEvent.change(screen.getByLabelText("openings"), {
      target: { value: "6–10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose when you are hoping to start.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");

    fireEvent.change(screen.getByLabelText("timing"), {
      target: { value: "Someday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose when you are hoping to start.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");

    fireEvent.change(screen.getByLabelText("timing"), {
      target: { value: "1–3 months" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("contact");
  });

  it("prevents invalid advancement", async () => {
    renderHost(vi.fn());
    await screen.findByLabelText("step");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida project ZIP code.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("location");
  });

  it("disables submit while persistence is in flight", async () => {
    let resolveSubmit!: (value: IntakeSubmitResult) => void;
    const submitter = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    ) as IntakeSubmitter;
    renderHost(submitter);
    await screen.findByLabelText("step");
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("button", { name: "Submitting" }))
      .toBeDisabled();
    resolveSubmit({
      ok: true,
      leadId: "lead-1",
      sessionId: "session-1",
      reused: false,
    });
    expect(await screen.findByLabelText("step")).toHaveTextContent("success");
  });

  it("keeps failed submissions retryable", async () => {
    const submitter = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({
        ok: true,
        leadId: "lead-retry",
        sessionId: "session-retry",
        reused: false,
      });
    renderHost(submitter);
    await screen.findByLabelText("step");
    fillValidValues();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByLabelText("step")).toHaveTextContent("success");
    expect(submitter).toHaveBeenCalledTimes(2);
  });

  it("reports normalized values to presentation only after persisted identifiers exist", async () => {
    const onPersistedSuccess = vi.fn();
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-1",
      sessionId: "session-1",
      reused: false,
    });
    renderHost(submitter, REQUEST, onPersistedSuccess);
    await screen.findByLabelText("step");
    fillValidValues();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(onPersistedSuccess).toHaveBeenCalledTimes(1),
    );
    expect(onPersistedSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        zip: "33301",
        name: "Sam",
        email: "sam@example.com",
        phone: "+13055550142",
      }),
    );
  });

  it("fails closed when persistence omits a lead ID", async () => {
    const onPersistedSuccess = vi.fn();
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "",
      sessionId: "session-1",
      reused: false,
    });
    renderHost(submitter, REQUEST, onPersistedSuccess);
    await screen.findByLabelText("step");
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't submit your request. Please try again.",
    );
    expect(screen.getByLabelText("step")).toHaveTextContent("contact");
    expect(onPersistedSuccess).not.toHaveBeenCalled();
  });

  it("fails closed when persistence omits a session ID", async () => {
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-1",
      sessionId: "",
      reused: false,
    });
    renderHost(submitter);
    await screen.findByLabelText("step");
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't submit your request. Please try again.",
    );
  });

  describe("atomic quick-select advancement", () => {
    async function openAtProduct() {
      renderHost(vi.fn(), {
        ...REQUEST,
        zipPrefill: "33301",
        startingStep: "product",
      });
      await screen.findByLabelText("step");
    }

    it("records the value and advances one step in a single transition", async () => {
      await openAtProduct();

      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));

      expect(screen.getByLabelText("step")).toHaveTextContent("openings");
      expect(screen.getByLabelText("step number")).toHaveTextContent("3");
      expect(screen.getByLabelText("project type")).toHaveValue("Impact doors");
    });

    it("advances exactly one step per activation across all choice steps", async () => {
      await openAtProduct();

      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("openings");

      fireEvent.click(screen.getByRole("button", { name: "Quick openings" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("timing");

      fireEvent.click(screen.getByRole("button", { name: "Quick timing" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("contact");
    });

    it("cannot skip steps when a later step's field is selected early", async () => {
      await openAtProduct();

      fireEvent.click(
        screen.getByRole("button", { name: "Quick openings mismatch" }),
      );

      expect(screen.getByLabelText("step")).toHaveTextContent("product");
      expect(screen.getByLabelText("openings")).toHaveValue("");
    });

    it("does not advance on an invalid value", async () => {
      await openAtProduct();
      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      fireEvent.click(screen.getByRole("button", { name: "Quick openings" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("timing");

      fireEvent.click(
        screen.getByRole("button", { name: "Quick invalid timing" }),
      );

      expect(screen.getByLabelText("step")).toHaveTextContent("timing");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Choose when you are hoping to start.",
      );
    });

    it("is rejected on the location and contact steps", async () => {
      renderHost(vi.fn());
      await screen.findByLabelText("step");

      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("location");
      expect(screen.getByLabelText("project type")).toHaveValue("");

      fillValidValues();
      expect(screen.getByLabelText("step")).toHaveTextContent("contact");
      fireEvent.click(screen.getByRole("button", { name: "Quick timing" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("contact");
    });

    it("preserves the selected value through Back and re-selects normally", async () => {
      await openAtProduct();
      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      fireEvent.click(screen.getByRole("button", { name: "Quick openings" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("timing");

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("openings");
      expect(screen.getByLabelText("openings")).toHaveValue("11–15");

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("product");
      expect(screen.getByLabelText("project type")).toHaveValue("Impact doors");

      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("openings");
    });

    it("is ignored while a submission is in flight", async () => {
      let resolveSubmit!: (value: IntakeSubmitResult) => void;
      const submitter = vi.fn(
        () =>
          new Promise<IntakeSubmitResult>((resolve) => {
            resolveSubmit = resolve;
          }),
      );
      renderHost(submitter);
      await screen.findByLabelText("step");
      fillValidValues();
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("button", { name: "Submitting" });

      fireEvent.click(screen.getByRole("button", { name: "Quick product" }));
      expect(screen.getByLabelText("step")).toHaveTextContent("contact");

      await act(async () => {
        resolveSubmit({
          ok: true,
          leadId: "lead-1",
          sessionId: "session-1",
          reused: false,
        });
      });
    });
  });

  it("validates service-area ZIP through campaign location config", async () => {
    const futureMarketConfig = {
      ...CONFIG,
      location: {
        marketId: "future-market",
        inputLabel: "Project ZIP code",
        helperText: "Enter the project ZIP code.",
        placeholder: "e.g. 99001",
        invalidMessage: "Enter a valid project ZIP code for this market.",
        isEligibleZip: (value: string) => /^99\d{3}$/.test(value.trim()),
      },
    } as const satisfies UniversalIntakeConfig;

    render(
      <UniversalIntakeHost
        config={futureMarketConfig}
        openRequest={REQUEST}
        submitter={vi.fn()}
        skin={TestSkin}
        onClose={vi.fn()}
      />,
    );

    await screen.findByLabelText("step");
    fireEvent.change(screen.getByLabelText("zip"), {
      target: { value: "33301" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid project ZIP code for this market.",
    );

    fireEvent.change(screen.getByLabelText("zip"), {
      target: { value: "99001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("product");
  });

  it("ignores a pending response after close and reopen", async () => {
    let resolveOldAttempt!: (value: IntakeSubmitResult) => void;
    const submitter = vi.fn(
      () =>
        new Promise<IntakeSubmitResult>((resolve) => {
          resolveOldAttempt = resolve;
        }),
    );
    render(<ReopenHarness submitter={submitter} />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByLabelText("step");
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("button", { name: "Submitting" }))
      .toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByLabelText("step");

    await act(async () => {
      resolveOldAttempt({
        ok: true,
        leadId: "lead-stale",
        sessionId: "session-stale",
        reused: false,
      });
    });

    expect(screen.getByLabelText("step")).toHaveTextContent("location");
  });
});
