import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import XrayVariant from "./XrayVariant";
import { SAMPLE_QUOTE } from "./fixture";
import type { VariantViewModel } from "./types";
import source from "./XrayVariant.tsx?raw";

function model(overrides: Partial<VariantViewModel> = {}): VariantViewModel {
  return { step: 0, signal: SAMPLE_QUOTE.signals[0], revealed: false, revealedCount: 0, reducedMotion: false,
    onReveal: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn(), onPayoff: vi.fn(), onHasQuote: vi.fn(), onNoQuote: vi.fn(), onAnswer: vi.fn(), ...overrides };
}
afterEach(cleanup);

describe("static X-Ray showcase", () => {
  it("renders only the revealed photo and semantic finding without synthetic progression", () => {
    const view = model();
    const { container } = render(<StrictMode><XrayVariant {...view} /></StrictMode>);
    const photos = container.querySelectorAll("img");
    expect(photos).toHaveLength(1);
    expect(photos[0]).toHaveAttribute("src", "/images/synthetic-demo/xray/xray-revealed.webp");
    expect(photos[0]).toHaveAttribute("width", "1072");
    expect(photos[0]).toHaveAttribute("height", "1471");
    expect(photos[0]).toHaveAttribute("alt", "");
    expect(photos[0]).not.toHaveAttribute("tabindex");
    expect(screen.getByText("Synthetic sample—not your quote or a real contractor quote.")).toBeVisible();
    expect(screen.getByText(SAMPLE_QUOTE.signals[0].finding)).toBeVisible();
    expect(screen.getByText(`Ask: ${SAMPLE_QUOTE.signals[0].question}`)).toBeVisible();
    expect(screen.getByRole("heading", { name: "We look beneath the surface." })).toBeVisible();
    expect(screen.getByText("Our AI reviews your quote line by line, highlighting what's missing, unclear, or risky so you can move forward with confidence.")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(container.querySelector(".sd-progress, .sd-sample-label, .sd-xray-reveal, [tabindex], input")).toBeNull();
    expect(screen.queryByText(/1 of 3|Check the next line|Tap to lift|Back/i)).not.toBeInTheDocument();
    fireEvent.load(photos[0]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    for (const callback of [view.onReveal, view.onNext, view.onPrevious, view.onPayoff, view.onAnswer]) expect(callback).not.toHaveBeenCalled();
    expect(source).not.toMatch(/useEffect|framer-motion|xray-closed|dispatch\(|setTimeout|setInterval/);
  });

  it.each([false, true])("keeps the first fixture finding static with reduced motion %s", (reducedMotion) => {
    const view = model({ step: 2, signal: SAMPLE_QUOTE.signals[2], revealed: false, reducedMotion });
    render(<XrayVariant {...view} />);
    expect(screen.getByText(SAMPLE_QUOTE.signals[0].finding)).toBeVisible();
    expect(screen.queryByText(SAMPLE_QUOTE.signals[2].finding)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Help Me Get a Quote" }));
    expect(view.onNoQuote).toHaveBeenCalledTimes(1);
    expect(view.onHasQuote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I have a quote to upload" }));
    expect(view.onHasQuote).toHaveBeenCalledTimes(1);
    expect(view.onReveal).not.toHaveBeenCalled();
  });

  it("keeps finding and both handoffs available on failure and retries the revealed photo", () => {
    const view = model(); const { container } = render(<XrayVariant {...view} />);
    const first = container.querySelector("img")!;
    expect(screen.getByRole("status")).toHaveTextContent("Loading sample photo");
    fireEvent.error(first);
    expect(screen.getByRole("alert")).toHaveTextContent("The sample photo could not load");
    expect(screen.getByText(SAMPLE_QUOTE.signals[0].finding)).toBeVisible();
    expect(screen.getByRole("button", { name: "Help Me Get a Quote" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "I have a quote to upload" })).toBeEnabled();
    const retry = screen.getByRole("button", { name: "Retry sample photo" });
    retry.focus(); fireEvent.click(retry);
    expect(screen.getByRole("button", { name: "Help Me Get a Quote" })).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const second = container.querySelector("img")!;
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute("src", first.getAttribute("src"));
    fireEvent.load(second);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(view.onReveal).not.toHaveBeenCalled();
    expect(view.onNoQuote).not.toHaveBeenCalled();
  });
});
