import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { nq4IntakeConfig } from "@/pages/CampaignNQ4/nq4IntakeConfig";
import UniversalIntakeHost from "./UniversalIntakeHost";
import type {
  IntakeOpenRequest,
  IntakeSkinProps,
  IntakeSubmitResult,
  IntakeSubmitter,
} from "./intakeTypes";

const REQUEST: IntakeOpenRequest = {
  requestId: "11111111-1111-4111-8111-111111111111",
  entryPoint: "hero_primary",
  startingStep: "location",
};

function TestSkin({
  step,
  stepNumber,
  totalSteps,
  values,
  validationError,
  submitError,
  isSubmitting,
  onFieldChange,
  onNext,
  onBack,
  onSubmit,
  onClose,
}: IntakeSkinProps) {
  return (
    <div>
      <output aria-label="step">{step}</output>
      <output aria-label="progress">{`${stepNumber}/${totalSteps}`}</output>
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
      {validationError ? <p role="alert">{validationError.message}</p> : null}
      {submitError ? <p role="alert">{submitError}</p> : null}
      <button type="button" onClick={onNext}>
        Next
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? "Submitting" : "Submit"}
      </button>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function renderHost(
  submitter: IntakeSubmitter,
  onPersistedSuccess = vi.fn(),
  request: IntakeOpenRequest | null = REQUEST,
) {
  return render(
    <UniversalIntakeHost
      config={nq4IntakeConfig}
      openRequest={request}
      submitter={submitter}
      skin={TestSkin}
      onClose={vi.fn()}
      onPersistedSuccess={onPersistedSuccess}
    />,
  );
}

function ReopenHarness({
  submitter,
  onPersistedSuccess,
}: {
  submitter: IntakeSubmitter;
  onPersistedSuccess: ReturnType<typeof vi.fn>;
}) {
  const [request, setRequest] = useState<IntakeOpenRequest | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setRequest({
            requestId: crypto.randomUUID(),
            entryPoint: "hero_primary",
            startingStep: "location",
          })
        }
      >
        Open
      </button>
      <UniversalIntakeHost
        config={nq4IntakeConfig}
        openRequest={request}
        submitter={submitter}
        skin={TestSkin}
        onClose={() => setRequest(null)}
        onPersistedSuccess={onPersistedSuccess}
      />
    </>
  );
}

function fillValidValues() {
  fireEvent.change(screen.getByLabelText("zip"), {
    target: { value: "33301" },
  });
  fireEvent.change(screen.getByLabelText("project type"), {
    target: { value: "Impact windows" },
  });
  fireEvent.change(screen.getByLabelText("openings"), {
    target: { value: "6–10" },
  });
  fireEvent.change(screen.getByLabelText("timing"), {
    target: { value: "1–3 months" },
  });
  fireEvent.change(screen.getByLabelText("name"), {
    target: { value: " Sam " },
  });
  fireEvent.change(screen.getByLabelText("email"), {
    target: { value: "Sam@Example.com" },
  });
  fireEvent.change(screen.getByLabelText("phone"), {
    target: { value: "3055550142" },
  });
}

describe("UniversalIntakeHost", () => {
  it("uses NQ4 config-driven steps, progress, validation, and Back behavior", async () => {
    renderHost(vi.fn());

    expect(await screen.findByLabelText("step")).toHaveTextContent("location");
    expect(screen.getByLabelText("progress")).toHaveTextContent("1/5");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida ZIP code.",
    );

    fireEvent.change(screen.getByLabelText("zip"), {
      target: { value: "33301" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("product");
    expect(screen.getByLabelText("progress")).toHaveTextContent("2/5");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose what you are replacing.",
    );

    fireEvent.change(screen.getByLabelText("project type"), {
      target: { value: "Impact windows" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("openings");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose the approximate number of openings.",
    );

    fireEvent.change(screen.getByLabelText("openings"), {
      target: { value: "6–10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");
    fireEvent.change(screen.getByLabelText("timing"), {
      target: { value: "Someday" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose when you are hoping to start.",
    );

    fireEvent.change(screen.getByLabelText("timing"), {
      target: { value: "1–3 months" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("contact");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("step")).toHaveTextContent("timing");
  });

  it("shows success only after both persisted IDs and returns normalized values", async () => {
    let resolveSubmit!: (result: IntakeSubmitResult) => void;
    const submitter = vi.fn(
      () =>
        new Promise<IntakeSubmitResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const onPersistedSuccess = vi.fn();
    renderHost(submitter, onPersistedSuccess);
    await screen.findByLabelText("step");
    fillValidValues();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByRole("button", { name: "Submitting" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("step")).not.toHaveTextContent("success");
    expect(onPersistedSuccess).not.toHaveBeenCalled();

    resolveSubmit({
      ok: true,
      leadId: "lead-1",
      sessionId: "session-1",
      reused: false,
    });

    expect(await screen.findByLabelText("step")).toHaveTextContent("success");
    expect(onPersistedSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        zip: "33301",
        name: "Sam",
        email: "sam@example.com",
        phone: "+13055550142",
      }),
    );
  });

  it.each([
    ["lead ID", "", "session-1"],
    ["session ID", "lead-1", ""],
  ])("fails closed when persistence omits the %s", async (_label, leadId, sessionId) => {
    const onPersistedSuccess = vi.fn();
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId,
      sessionId,
      reused: false,
    });
    renderHost(submitter, onPersistedSuccess);
    await screen.findByLabelText("step");
    fillValidValues();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't submit your request. Please try again.",
    );
    expect(screen.getByLabelText("step")).not.toHaveTextContent("success");
    expect(onPersistedSuccess).not.toHaveBeenCalled();
  });

  it("maps thrown persistence failures to a safe retryable error", async () => {
    const submitter = vi.fn().mockRejectedValue(new Error("raw backend detail"));
    renderHost(submitter);
    await screen.findByLabelText("step");
    fillValidValues();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't submit your request. Please try again.",
    );
    expect(screen.queryByText("raw backend detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
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

  it("ignores a stale response after close and reopen", async () => {
    let resolveOldAttempt!: (result: IntakeSubmitResult) => void;
    const submitter = vi.fn(
      () =>
        new Promise<IntakeSubmitResult>((resolve) => {
          resolveOldAttempt = resolve;
        }),
    );
    const onPersistedSuccess = vi.fn();
    render(
      <ReopenHarness
        submitter={submitter}
        onPersistedSuccess={onPersistedSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByLabelText("step");
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByRole("button", { name: "Submitting" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() =>
      expect(screen.getByLabelText("step")).toHaveTextContent("location"),
    );

    await act(async () => {
      resolveOldAttempt({
        ok: true,
        leadId: "lead-stale",
        sessionId: "session-stale",
        reused: false,
      });
    });

    expect(screen.getByLabelText("step")).toHaveTextContent("location");
    expect(onPersistedSuccess).not.toHaveBeenCalled();
  });

  it("prevents double submission while persistence is in flight", async () => {
    let resolveSubmit!: (result: IntakeSubmitResult) => void;
    const submitter = vi.fn(
      () =>
        new Promise<IntakeSubmitResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderHost(submitter);
    await screen.findByLabelText("step");
    fillValidValues();

    const submitButton = screen.getByRole("button", { name: "Submit" });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(submitter).toHaveBeenCalledTimes(1);

    resolveSubmit({
      ok: true,
      leadId: "lead-once",
      sessionId: "session-once",
      reused: false,
    });
    expect(await screen.findByLabelText("step")).toHaveTextContent("success");
  });
});
