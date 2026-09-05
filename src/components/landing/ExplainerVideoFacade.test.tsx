import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExplainerVideoFacade } from "./ExplainerVideoFacade";

const nativeSource = {
  kind: "native" as const,
  src: "/media/windowman-explainer-60s.mp4",
  mimeType: "video/mp4" as const,
};

describe("ExplainerVideoFacade", () => {
  it("reports the first deliberate play once and then mounts the video", () => {
    const onPlay = vi.fn();
    render(
      <ExplainerVideoFacade
        poster="/poster.webp"
        source={nativeSource}
        title="How WindowMan checks an estimate"
        onPlay={onPlay}
      />,
    );

    expect(screen.queryByTestId("explainer-video")).not.toBeInTheDocument();
    const play = screen.getByRole("button", {
      name: "Play How WindowMan checks an estimate",
    });
    fireEvent.click(play);
    fireEvent.click(play);

    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("explainer-video")).toBeInTheDocument();
  });

  it("starts playback even when optional measurement throws", () => {
    render(
      <ExplainerVideoFacade
        poster="/poster.webp"
        source={nativeSource}
        title="Resilient explainer"
        onPlay={() => {
          throw new Error("measurement unavailable");
        }}
      />,
    );

    expect(() =>
      fireEvent.click(
        screen.getByRole("button", { name: "Play Resilient explainer" }),
      ),
    ).not.toThrow();
    expect(screen.getByTestId("explainer-video")).toBeInTheDocument();
  });
});
