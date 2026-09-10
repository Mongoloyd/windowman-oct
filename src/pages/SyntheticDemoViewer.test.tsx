import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePowerToolDemoLead } from "@/lib/capturePowerToolDemoLead";
import SyntheticDemoViewer from "./SyntheticDemoViewer";
import { SAMPLE_QUOTE } from "@/components/synthetic-demo/fixture";

vi.mock("@/lib/capturePowerToolDemoLead", () => ({ capturePowerToolDemoLead: vi.fn() }));
vi.mock("@/components/synthetic-demo/productionCaptureClient", () => ({
  productionCaptureClient: { startSession: () => { throw new Error("Production client must not be used by visual QA"); } },
}));
function view(variant: string) {
  return render(<HelmetProvider><MemoryRouter initialEntries={[`/visual/synthetic-demo/${variant}`]}><Routes>
    <Route path="/visual/synthetic-demo/:variant" element={<SyntheticDemoViewer />} />
  </Routes></MemoryRouter></HelmetProvider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("synthetic visual QA viewer", () => {
  it.each(["xray", "lens", "challenge"])("maps %s, labels synthetic QA, and uses only memory capture", async (variant) => {
    view(variant);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-synthetic-demo", variant);
    expect(dialog).toHaveTextContent("Visual QA — synthetic data — no lead writes");
    if (variant === "xray") {
      fireEvent.click(await screen.findByRole("button", { name: "Help Me Get a Quote" }));
      expect(await screen.findByRole("heading", { name: "Mock no-quote handoff" })).toBeInTheDocument();
      expect(capturePowerToolDemoLead).not.toHaveBeenCalled();
      return;
    }
    await screen.findByText(/(?:Sample risk sweep|Contract challenge) · 1 of 3/);
    for (let step = 0; step < 3; step++) {
      if (variant === "challenge") fireEvent.click(screen.getByRole("radio", { name: new RegExp(SAMPLE_QUOTE.signals[step].answers[0].label) }));
      else fireEvent.click(screen.getByRole("button", { name: `Inspect ${SAMPLE_QUOTE.signals[step].label.toLowerCase()}` }));
      fireEvent.click(screen.getByRole("button", { name: step === 2 ? (variant === "challenge" ? "Build my 3-question checklist" : "Reveal my question list")
        : variant === "lens" ? "Next signal" : "Try the next question" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Save my next step" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Visual" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "visual@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save my details" }));
    await screen.findByText("Your details are saved.");
    fireEvent.click(screen.getByRole("button", { name: "Help me request an estimate" }));
    expect(await screen.findByRole("heading", { name: "Mock no-quote handoff" })).toBeInTheDocument();
    expect(capturePowerToolDemoLead).not.toHaveBeenCalled();
  });
  it.each(["wrong", "XRAY", "lens-extra"])("fails safely for invalid %s", (variant) => {
    view(variant);
    expect(screen.getByRole("alert")).toHaveTextContent("Unknown demo variant");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(capturePowerToolDemoLead).not.toHaveBeenCalled();
  });
  it("sets noindex and shows a mock has-quote panel without navigation", async () => {
    view("xray");
    fireEvent.click(await screen.findByRole("button", { name: "I have a quote to upload" }));
    expect(await screen.findByRole("heading", { name: "Mock has-quote handoff" })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow"));
    expect(capturePowerToolDemoLead).not.toHaveBeenCalled();
  });
});
