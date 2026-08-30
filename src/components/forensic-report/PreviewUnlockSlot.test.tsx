import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import PreviewUnlockSlot from "./PreviewUnlockSlot";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("PreviewUnlockSlot visual-lab phone disclosure", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the neutral analysis copy and preserves the local gate interaction", () => {
    render(<PreviewUnlockSlot />);

    expect(
      screen.getByRole("heading", { name: "View Your Full Quote Analysis" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter your mobile number to view the findings, supporting context, and the exact questions to ask before signing.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Analysis Complete · Ready to Verify")).toBeInTheDocument();
    expect(screen.queryByText(/risk signals|case file created/i)).not.toBeInTheDocument();
    expect(screen.getByText("Check SMS for your secure code.")).toHaveClass("text-[#b0b4ba]");
    expect(
      screen.getByText(
        "Your number is used to send a one-time verification code for this report. It does not enroll you in marketing messages or authorize contractor calls.",
      ),
    ).toBeInTheDocument();

    const sendButton = screen.getByRole("button", { name: "Unlock My Report" });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615551212" },
    });

    expect(screen.getByRole("button", { name: "Send Verification Code" })).toBeEnabled();
  });

  it("preserves the visual-lab phone-to-code transition", () => {
    vi.useFakeTimers();
    render(<PreviewUnlockSlot />);

    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "5615551212" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText(/We sent a 6-digit code to/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify & Unlock Report" })).toBeDisabled();
  });
});
