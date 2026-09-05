import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteViewerModal } from "@/components/admin/QuoteViewerModal";
import { fetchQuoteEvidence } from "@/services/adminDataService";

vi.mock("@/services/adminDataService", () => ({
  fetchQuoteEvidence: vi.fn(),
}));

const fetchQuoteEvidenceMock = vi.mocked(fetchQuoteEvidence);

function renderViewer(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const onOpenChange = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <button type="button">Outside</button>
        <QuoteViewerModal
          leadId="0621be04-8984-4087-8cec-324e0efd25d4"
          open={open}
          onOpenChange={onOpenChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onOpenChange, ...view };
}

describe("QuoteViewerModal", () => {
  beforeEach(() => {
    fetchQuoteEvidenceMock.mockReset();
  });

  it("shows a loading state while quote evidence is fetched", async () => {
    fetchQuoteEvidenceMock.mockImplementation(() => new Promise(() => undefined));
    renderViewer();
    expect(await screen.findByTestId("quote-viewer-loading")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uploaded quote" })).toBeInTheDocument();
    expect(
      screen.getByText("Securely retrieved from the homeowner's private quote on file."),
    ).toBeInTheDocument();
  });

  it("shows a retryable error and refetches on retry", async () => {
    fetchQuoteEvidenceMock
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce({
        signed_url: "https://example.test/quote.png",
        file_name: "quote.png",
        scan_session_id: "scan-1",
        expires_in: 3600,
      });
    renderViewer();
    expect(
      await screen.findByText("Quote temporarily unavailable. Try again."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("quote-viewer-image")).toHaveAttribute(
      "src",
      "https://example.test/quote.png",
    );
    expect(fetchQuoteEvidenceMock).toHaveBeenCalledTimes(2);
    expect(fetchQuoteEvidenceMock).toHaveBeenCalledWith("0621be04-8984-4087-8cec-324e0efd25d4");
  });

  it("shows the no-file state without constructing a storage path", async () => {
    fetchQuoteEvidenceMock.mockResolvedValue({
      signed_url: null,
      file_name: null,
      scan_session_id: null,
      expires_in: 3600,
    });
    renderViewer();
    expect(await screen.findByTestId("quote-viewer-empty")).toHaveTextContent(
      "No quote uploaded for this lead yet.",
    );
    expect(screen.getByRole("link", { name: /Evidence Inspector/ })).toHaveAttribute(
      "href",
      "/admin/lead-evidence?lead_id=0621be04-8984-4087-8cec-324e0efd25d4",
    );
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });

  it("renders an image with zoom, rotate, fit, and open-in-new-tab controls", async () => {
    fetchQuoteEvidenceMock.mockResolvedValue({
      signed_url: "https://example.test/quote.png",
      file_name: "quote.png",
      scan_session_id: "scan-1",
      expires_in: 1800,
    });
    renderViewer();
    const image = await screen.findByTestId("quote-viewer-image");
    expect(image).toHaveAttribute("data-zoom", "1");
    expect(image).toHaveAttribute("data-rotation", "0");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in quote" }));
    expect(image).toHaveAttribute("data-zoom", "1.25");

    fireEvent.click(screen.getByRole("button", { name: "Rotate quote" }));
    expect(image).toHaveAttribute("data-rotation", "90");

    fireEvent.click(screen.getByRole("button", { name: "Fit quote to window" }));
    expect(image).toHaveAttribute("data-zoom", "1");
    expect(image).toHaveAttribute("data-rotation", "0");

    expect(screen.getByRole("link", { name: "Open in new tab" })).toHaveAttribute(
      "href",
      "https://example.test/quote.png",
    );
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });

  it("keeps PDFs on the existing open-in-new-tab path", async () => {
    fetchQuoteEvidenceMock.mockResolvedValue({
      signed_url: "https://example.test/files/quote.pdf?token=abc",
      file_name: "quote.pdf",
      scan_session_id: "scan-1",
      expires_in: 3600,
    });
    renderViewer();
    expect(await screen.findByText("Quote document (PDF)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open PDF in new tab" })).toHaveAttribute(
      "href",
      "https://example.test/files/quote.pdf?token=abc",
    );
    expect(screen.queryByRole("button", { name: "Zoom in quote" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("quote-viewer-image")).not.toBeInTheDocument();
  });

  it("closes from the labelled control and via Escape", async () => {
    fetchQuoteEvidenceMock.mockResolvedValue({
      signed_url: "https://example.test/quote.png",
      file_name: "quote.png",
      scan_session_id: "scan-1",
      expires_in: 3600,
    });
    const { onOpenChange } = renderViewer();
    await screen.findByTestId("quote-viewer-image");
    fireEvent.click(screen.getByRole("button", { name: "Close quote viewer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(screen.getByTestId("quote-viewer-modal"), { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalled();
    });
  });
});
