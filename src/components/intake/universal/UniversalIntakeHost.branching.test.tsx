import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UniversalIntakeHost from "./UniversalIntakeHost";
import type {
  IntakeOpenRequest,
  IntakeSkinProps,
  IntakeSubmitter,
  IntakeValues,
  UniversalIntakeConfig,
} from "./intakeTypes";

const FLORIDA_LOCATION = {
  marketId: "florida",
  inputLabel: "Florida project ZIP code",
  helperText: "Enter the ZIP code for the Florida property.",
  placeholder: "e.g. 33139",
  invalidMessage: "Enter a valid 5-digit Florida project ZIP code.",
  isEligibleZip: (value: string) => /^3[2-4]\d{3}$/.test(value.trim()),
} as const;

const hasQuote = (values: IntakeValues) => values.intent === "has_quote";

/** Mirrors the shape of the Prophecy config: a fork that drops two steps. */
const BRANCHING_CONFIG = {
  route: "/prophecy",
  campaignVariant: "prophecy",
  wmIntent: "dual",
  captureSource: "windowman-prophecy",
  location: FLORIDA_LOCATION,
  steps: [
    { id: "intent", fields: ["intent"], validation: "intent_selected" },
    { id: "location", fields: ["zip"], validation: "service_area_zip" },
    {
      id: "openings",
      fields: ["openings"],
      validation: "openings_scope",
      skipWhen: hasQuote,
    },
    {
      id: "priority",
      fields: ["priority"],
      validation: "priority_scope",
      skipWhen: hasQuote,
    },
    {
      id: "contact",
      fields: ["name", "email", "phone"],
      validation: "contact",
    },
  ],
} as const satisfies UniversalIntakeConfig;

function TestSkin({
  step,
  stepNumber,
  totalSteps,
  values,
  validationError,
  onFieldChange,
  onSelectAndNext,
  onNext,
  onBack,
  onSubmit,
}: IntakeSkinProps) {
  return (
    <div>
      <output aria-label="step">{step}</output>
      <output aria-label="progress">{`${stepNumber}/${totalSteps}`}</output>
      <button type="button" onClick={() => onSelectAndNext("intent", "has_quote")}>
        Pick has quote
      </button>
      <button type="button" onClick={() => onSelectAndNext("intent", "no_quote")}>
        Pick no quote
      </button>
      <button type="button" onClick={() => onFieldChange("intent", "has_quote")}>
        Set intent has quote
      </button>
      <button type="button" onClick={() => onSelectAndNext("openings", "11–15")}>
        Pick openings
      </button>
      <button
        type="button"
        onClick={() => onSelectAndNext("priority", "Not overpaying")}
      >
        Pick priority
      </button>
      <input
        aria-label="zip"
        value={values.zip}
        onChange={(event) => onFieldChange("zip", event.target.value)}
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
      <button type="button" onClick={onNext}>
        Next
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onSubmit}>
        Submit
      </button>
    </div>
  );
}

const REQUEST: IntakeOpenRequest = {
  requestId: "11111111-1111-4111-8111-111111111111",
  entryPoint: "hero_primary",
  startingStep: "intent",
};

function renderHost(
  submitter: IntakeSubmitter,
  request: IntakeOpenRequest = REQUEST,
) {
  return render(
    <UniversalIntakeHost
      config={BRANCHING_CONFIG}
      openRequest={request}
      submitter={submitter}
      skin={TestSkin}
      onClose={vi.fn()}
    />,
  );
}

const okSubmitter: IntakeSubmitter = vi.fn(async () => ({
  ok: true as const,
  leadId: "lead-1",
  sessionId: "session-1",
  reused: false,
}));

function stepName() {
  return screen.getByLabelText("step").textContent;
}
function progress() {
  return screen.getByLabelText("progress").textContent;
}

function fillContact() {
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Sam" } });
  fireEvent.change(screen.getByLabelText("email"), {
    target: { value: "sam@example.com" },
  });
  fireEvent.change(screen.getByLabelText("phone"), {
    target: { value: "3055550142" },
  });
}

describe("UniversalIntakeHost branching", () => {
  beforeEach(() => {
    vi.mocked(okSubmitter).mockClear();
  });

  it("jumps over skipped steps when moving forward", () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick has quote" }));
    expect(stepName()).toBe("location");

    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // openings and priority do not apply to this branch.
    expect(stepName()).toBe("contact");
  });

  it("walks every step when none are skipped", () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick no quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(stepName()).toBe("openings");

    fireEvent.click(screen.getByRole("button", { name: "Pick openings" }));
    expect(stepName()).toBe("priority");

    fireEvent.click(screen.getByRole("button", { name: "Pick priority" }));
    expect(stepName()).toBe("contact");
  });

  it("counts progress against the path actually walked", () => {
    const { unmount } = renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick has quote" }));
    expect(progress()).toBe("2/3");
    unmount();

    renderHost(okSubmitter, { ...REQUEST, requestId: crypto.randomUUID() });
    fireEvent.click(screen.getByRole("button", { name: "Pick no quote" }));
    expect(progress()).toBe("2/5");
  });

  it("skips inactive steps when going back", () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick has quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(stepName()).toBe("contact");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    // Straight back to location — never into the branch that was skipped.
    expect(stepName()).toBe("location");
  });

  it("does not validate skipped steps on submit", async () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick has quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fillContact();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    // openings and priority are empty, and that must not block this branch.
    await waitFor(() => expect(okSubmitter).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still validates active steps on submit", async () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick no quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick openings" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick priority" }));
    fillContact();

    // Corrupt an active step's answer, then submit.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        FLORIDA_LOCATION.invalidMessage,
      ),
    );
    expect(okSubmitter).not.toHaveBeenCalled();
  });

  it("seeds preset answers and opens past them", () => {
    renderHost(okSubmitter, {
      requestId: crypto.randomUUID(),
      entryPoint: "hero_primary",
      startingStep: "location",
      presetValues: { intent: "has_quote" },
    });

    expect(stepName()).toBe("location");
    // Seeded intent shapes the branch immediately, before anything is typed.
    expect(progress()).toBe("2/3");
  });

  it("passes the seeded answer through to the submitter", async () => {
    renderHost(okSubmitter, {
      requestId: crypto.randomUUID(),
      entryPoint: "hero_primary",
      startingStep: "location",
      presetValues: { intent: "has_quote" },
    });

    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fillContact();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(okSubmitter).toHaveBeenCalledTimes(1));
    expect(vi.mocked(okSubmitter).mock.calls[0][0]).toMatchObject({
      intent: "has_quote",
      zip: "33139",
    });
  });

  it("refuses a quick-select for a field that is not the current step's", () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick no quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(stepName()).toBe("openings");

    // A stale control firing "intent" while the openings step is showing must
    // not silently rewrite the branch out from under the visitor.
    fireEvent.click(screen.getByRole("button", { name: "Pick has quote" }));
    expect(stepName()).toBe("openings");
    expect(progress()).toBe("3/5");
  });

  it("re-routes forward rather than stranding the visitor on a dropped step", () => {
    renderHost(okSubmitter);

    fireEvent.click(screen.getByRole("button", { name: "Pick no quote" }));
    fireEvent.change(screen.getByLabelText("zip"), { target: { value: "33139" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(stepName()).toBe("openings");

    // A plain field change can reshape the branch while standing on a step that
    // the new answer removes. The visitor must be carried forward, not left on
    // a step that is no longer part of their path.
    fireEvent.click(screen.getByRole("button", { name: "Set intent has quote" }));

    expect(stepName()).toBe("contact");
    expect(progress()).toBe("3/3");
  });
});
