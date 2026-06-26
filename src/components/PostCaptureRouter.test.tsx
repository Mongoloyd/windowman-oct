import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PostCaptureRouter, { type PostCapturePath } from "@/components/PostCaptureRouter";
import {
  NO_QUOTE_DIAGNOSTIC,
  POST_CAPTURE_ROUTER_COPY,
} from "@/components/postcapture/postCaptureCopy";

/** Answer every diagnostic question (pick the first option each time). */
function completeNoQuoteDiagnostic() {
  for (const question of NO_QUOTE_DIAGNOSTIC.questions) {
    fireEvent.click(screen.getByRole("button", { name: question.options[0] }));
  }
}

function setup(selectedPath: PostCapturePath) {
  const onSelectPath = vi.fn();
  const onUploadNow = vi.fn();
  const utils = render(
    <PostCaptureRouter
      selectedPath={selectedPath}
      onSelectPath={onSelectPath}
      onUploadNow={onUploadNow}
    />,
  );
  return { onSelectPath, onUploadNow, ...utils };
}

describe("PostCaptureRouter", () => {
  it("renders three intent options on the router path", () => {
    setup("router");
    expect(screen.getByTestId("post-capture-router")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload my quote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save my spot" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show me what to check" }),
    ).toBeInTheDocument();
  });

  it("exposes a stable scroll anchor with offset for homepage post-capture scroll", () => {
    setup("router");
    const router = screen.getByTestId("post-capture-router");
    expect(router).toHaveAttribute("id", "post-capture-router-anchor");
    expect(router.className).toMatch(/scroll-mt-24/);
  });

  it("quote-ready card triggers onUploadNow", () => {
    const { onUploadNow, onSelectPath } = setup("router");
    fireEvent.click(screen.getByRole("button", { name: "Upload my quote" }));
    expect(onUploadNow).toHaveBeenCalledTimes(1);
    expect(onSelectPath).not.toHaveBeenCalled();
  });

  it("quote-not-here card selects the upload_later path", () => {
    const { onSelectPath } = setup("router");
    fireEvent.click(screen.getByRole("button", { name: "Save my spot" }));
    expect(onSelectPath).toHaveBeenCalledWith("upload_later");
  });

  it("no-quote card selects the no_quote path", () => {
    const { onSelectPath } = setup("router");
    fireEvent.click(screen.getByRole("button", { name: "Show me what to check" }));
    expect(onSelectPath).toHaveBeenCalledWith("no_quote");
  });

  it("renders the upload-later save-my-spot panel with a pivot to upload", () => {
    const { onUploadNow } = setup("upload_later");
    expect(screen.getByTestId("post-capture-upload-later")).toBeInTheDocument();
    expect(screen.queryByTestId("post-capture-router")).not.toBeInTheDocument();
    expect(
      screen.getByText(POST_CAPTURE_ROUTER_COPY.uploadLater.headline),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "I found my quote — scan it now" }),
    );
    expect(onUploadNow).toHaveBeenCalledTimes(1);
  });

  it("upload-later panel never mounts UploadZone (no file input)", () => {
    const { container } = setup("upload_later");
    expect(screen.queryByTestId("upload-zone")).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it("upload-later panel has no ArbitrageEngine or scary/stale copy", () => {
    const { container } = setup("upload_later");
    expect(container.innerHTML).not.toMatch(/arbitrage/i);
    expect(container.innerHTML).not.toMatch(
      /unlock|locked|upload zone|access denied|unauthorized|forbidden|security error|lead form/i,
    );
  });

  it("renders the no-quote diagnostic, then pivots to upload from the quote-ready screen", () => {
    const { onUploadNow } = setup("no_quote");
    expect(screen.getByTestId("post-capture-no-quote")).toBeInTheDocument();
    // First diagnostic question is shown (not the final screen yet).
    expect(
      screen.getByText(NO_QUOTE_DIAGNOSTIC.questions[0].prompt),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("no-quote-quote-ready")).not.toBeInTheDocument();

    completeNoQuoteDiagnostic();

    expect(screen.getByTestId("no-quote-quote-ready")).toBeInTheDocument();
    expect(screen.getByText("You're quote-ready.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "I got my quote — scan it now" }),
    );
    expect(onUploadNow).toHaveBeenCalledTimes(1);
  });

  it("renders nothing on the upload path (UploadZone is owned by Index)", () => {
    const { container } = setup("upload");
    expect(container).toBeEmptyDOMElement();
  });

  it("placeholders can return to the router options", () => {
    const { onSelectPath } = setup("no_quote");
    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(onSelectPath).toHaveBeenCalledWith("router");
  });
});
