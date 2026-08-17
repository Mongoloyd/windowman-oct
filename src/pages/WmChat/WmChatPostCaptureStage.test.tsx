import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createWmChatInitialState, wmChatReducer } from "./wmChatReducer";
import { WmChatPostCaptureStage } from "./WmChatPostCaptureStage";
import type { WmChatState } from "./wmChatTypes";

const LEAD_ID = "d6d9a0b5-12ad-4b95-9493-72a3ba98ad2f";
const SESSION_ID = "86080f63-66ff-4756-bc21-81fbd497761c";

function capturedState(): WmChatState {
  return {
    ...createWmChatInitialState(),
    currentNodeId: "success",
    status: "success",
    leadId: LEAD_ID,
    sessionId: SESSION_ID,
    postCaptureNodeId: "choice",
  };
}

function Harness({ onPersist = vi.fn() }: { readonly onPersist?: () => void }) {
  const [state, dispatch] = useReducer(wmChatReducer, undefined, capturedState);
  return (
    <WmChatPostCaptureStage
      state={state}
      dispatch={dispatch}
      onPersist={onPersist}
    />
  );
}

describe("WmChatPostCaptureStage", () => {
  afterEach(cleanup);

  it("presents the game plan as a blue tactile fast lane without orange actions", () => {
    const view = render(<Harness />);
    const fastLane = screen.getByRole("button", {
      name: /Build my quote-request game plan/i,
    });

    expect(fastLane).toHaveAttribute("data-fast-lane", "true");
    expect(fastLane.className).toContain("border-[#58adf8]");
    expect(fastLane.className).toContain("shadow-");
    expect(screen.getByRole("button", { name: /Schedule a WindowMan conversation/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Review my quote when ready/i })).toBeEnabled();
    expect(view.container.innerHTML.toLowerCase()).not.toMatch(/orange|amber|#f59e0b/);
  });

  it("routes a ready quote directly to the private scanner with no address prompt", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: /Review my quote when ready/i }),
    );

    expect(
      screen.getByRole("heading", { name: "Do you have the written quote now?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Where is this project?")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Yes — open my secure scanner" }),
    );
    expect(
      screen.getByRole("heading", { name: "Opening your secure quote scanner." }),
    ).toBeInTheDocument();
    expect(screen.getByText("PDF or clear photos. Private upload. No retyping.")).toBeInTheDocument();
    expect(screen.queryByText(/Project address:/i)).not.toBeInTheDocument();
  });

  it("uses selfish utility copy for the optional game-plan address", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: /Build my quote-request game plan/i }),
    );

    expect(
      screen.getByRole("heading", { name: "Where is this project?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Optional — add it so your game plan can include the right local pricing and permit questions.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip this step" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add to my game plan" }).className).toContain("min-h-12");
  });

  it("omits address from a not-yet quote review and calls the persistence boundary", () => {
    const onPersist = vi.fn();
    render(<Harness onPersist={onPersist} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Review my quote when ready/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Not yet — choose when to continue" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check back next week" }),
    );

    expect(screen.queryByText(/Project address:/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm this next step" }),
    );
    expect(onPersist).toHaveBeenCalledTimes(1);
  });

  it("describes a callback window as a request rather than a booked appointment", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: /Schedule a WindowMan conversation/i }),
    );

    expect(
      screen.getByText("Choose a preferred window. We’ll treat it as a request until it is confirmed."),
    ).toBeInTheDocument();
  });
});
