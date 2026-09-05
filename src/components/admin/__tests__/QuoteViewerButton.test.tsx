import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { QuoteViewerButton } from "@/components/admin/QuoteViewerButton";

vi.mock("@/services/adminDataService", () => ({
  fetchQuoteEvidence: vi.fn(async () => ({
    signed_url: "https://example.test/quote.png",
    file_name: "quote.png",
    scan_session_id: "scan-1",
    expires_in: 3600,
  })),
}));

describe("QuoteViewerButton", () => {
  it("restores focus to the trigger after the viewer closes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <QuoteViewerButton leadId="0621be04-8984-4087-8cec-324e0efd25d4" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const trigger = screen.getByRole("button", { name: "View uploaded quote" });
    fireEvent.click(trigger);
    await screen.findByTestId("quote-viewer-image");
    fireEvent.click(screen.getByRole("button", { name: "Close quote viewer" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
