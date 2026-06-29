import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UploadLaterPanel from "@/components/postcapture/UploadLaterPanel";
import { POST_CAPTURE_ROUTER_COPY } from "@/components/postcapture/postCaptureCopy";

const C = POST_CAPTURE_ROUTER_COPY;

function setup() {
  const onUploadNow = vi.fn();
  const onSelectPath = vi.fn();
  const utils = render(
    <UploadLaterPanel onUploadNow={onUploadNow} onSelectPath={onSelectPath} />,
  );
  return { onUploadNow, onSelectPath, ...utils };
}

describe("UploadLaterPanel", () => {
  it("renders the save-my-spot panel with calm started copy", () => {
    setup();
    expect(screen.getByTestId("post-capture-upload-later")).toBeInTheDocument();
    expect(screen.getByText(C.uploadLater.headline)).toBeInTheDocument();
    expect(screen.getByText(C.uploadLater.supporting)).toBeInTheDocument();
    expect(
      screen.getByText(C.uploadLater.secondarySupporting),
    ).toBeInTheDocument();
  });

  it("does not mount UploadZone or any file drop surface", () => {
    setup();
    expect(screen.queryByTestId("upload-zone")).toBeNull();
    expect(screen.queryByTestId("upload-zone-input")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("primary CTA pivots to the upload path via onUploadNow", () => {
    const { onUploadNow, onSelectPath } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "I found my quote — scan it now" }),
    );
    expect(onUploadNow).toHaveBeenCalledTimes(1);
    expect(onSelectPath).not.toHaveBeenCalled();
  });

  it("offers a calm way back to the router options", () => {
    const { onSelectPath } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(onSelectPath).toHaveBeenCalledWith("router");
  });

  it("does not reference ArbitrageEngine or any scan/upload backend", () => {
    const { container } = setup();
    expect(container.innerHTML).not.toMatch(/arbitrage/i);
  });

  it("contains no scary/stale gate-style copy", () => {
    const { container } = setup();
    expect(container.innerHTML).not.toMatch(
      /unlock|locked|upload zone|access denied|unauthorized|forbidden|security error|lead form/i,
    );
  });
});
