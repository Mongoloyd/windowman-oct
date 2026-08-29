import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScoringPlayground from "./ScoringPlayground";
import { getPresetExtraction } from "./scoringPlaygroundModel";

function renderPlayground() {
  return render(
    <HelmetProvider>
      <ScoringPlayground />
    </HelmetProvider>,
  );
}

describe("ScoringPlayground", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("switches complete canonical fixtures and keeps terminal outcomes ungraded", async () => {
    renderPlayground();

    expect(screen.getByRole("heading", { name: "Master Control Room" })).toBeInTheDocument();
    expect(screen.getByTestId("scoring-playground")).toHaveClass(
      "motion-reduce:[&_*]:animate-none",
      "motion-reduce:[&_*]:transition-none",
    );
    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex,nofollow",
      ),
    );
    expect(screen.getByTestId("canonical-grade")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corner-Cutting" }));
    expect(screen.getByRole("button", { name: "Corner-Cutting" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("canonical-grade")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Invalid Document" }));
    expect(screen.getByTestId("terminal-outcome")).toHaveTextContent("No grade is produced");
    expect(screen.queryByTestId("canonical-grade")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Low Confidence" }));
    expect(screen.getByTestId("terminal-outcome")).toHaveTextContent("needs_better_upload");
  });

  it("updates fixture fields while leaving the canonical scorer in control", () => {
    renderPlayground();

    const contractor = screen.getByLabelText("Contractor name (fixture only)");
    fireEvent.change(contractor, { target: { value: "Local Fixture Contractor" } });
    expect(contractor).toHaveValue("Local Fixture Contractor");

    const terms = screen.getByRole("switch", { name: "Terms and conditions present" });
    fireEvent.click(terms);
    expect(terms).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("canonical-grade")).toBeInTheDocument();
  });

  it("suppresses only the local experiment when weights do not total 100 percent", () => {
    renderPlayground();

    const canonicalBefore = screen.getByTestId("canonical-grade").textContent;
    const safetyWeight = screen.getByRole("slider", { name: "Safety experimental weight" });
    expect(safetyWeight).toHaveAttribute("step", "5");
    fireEvent.change(safetyWeight, { target: { value: "20" } });

    expect(
      screen.getByText("Experimental output is disabled until weights total exactly 100%."),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByTestId("experiment-grade")).not.toBeInTheDocument();
    expect(screen.getByTestId("canonical-grade")).toHaveTextContent(canonicalBefore ?? "");

    fireEvent.click(screen.getByRole("button", { name: "Reset Weights" }));
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.getByTestId("experiment-grade")).toBeInTheDocument();
  });

  it("rejects malformed and persisted-report JSON, then accepts a canonical fixture", () => {
    renderPlayground();

    const input = screen.getByLabelText("Fixture JSON");
    const importButton = screen.getByRole("button", { name: "Import & Score Locally" });

    fireEvent.change(input, { target: { value: "not-json" } });
    fireEvent.click(importButton);
    expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");

    fireEvent.change(input, {
      target: {
        value: JSON.stringify({ ...getPresetExtraction("gradeA"), full_json: { protected: true } }),
      },
    });
    fireEvent.click(importButton);
    expect(screen.getByRole("alert")).toHaveTextContent("not accepted");

    fireEvent.change(input, {
      target: { value: JSON.stringify(getPresetExtraction("mixedPillars")) },
    });
    fireEvent.click(importButton);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("canonical-grade")).toBeInTheDocument();
  });

  it("exports only to the clipboard without network or browser persistence", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });

    renderPlayground();
    fireEvent.click(screen.getByRole("button", { name: "Export Experiment" }));

    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledOnce());
    const exported = JSON.parse(String(clipboardWrite.mock.calls[0][0]));
    expect(exported.schema).toBe("windowman.scoring-playground.v1");
    expect(exported).not.toHaveProperty("leadId");
    expect(exported).not.toHaveProperty("sessionId");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorageSpy).not.toHaveBeenCalled();
  });
});
